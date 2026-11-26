import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

interface LiveKitNativeAudioModule {
  createAudioSinkListener?: (pcId: number, trackId: string) => string;
  deleteAudioSinkListener?: (reactTag: string, pcId: number, trackId: string) => boolean;
  addListener?: (eventName: string) => void;
  removeListeners?: (count: number) => void;
}

interface RawMediaStreamTrackLike {
  id?: string;
  _peerConnectionId?: number;
  readyState?: string;
}

export interface NativeAudioCaptureOptions {
  mediaStreamTrack: RawMediaStreamTrackLike;
  segmentMs?: number;
  onWavChunk: (wavBase64: string, mimeType: 'audio/wav') => void | Promise<void>;
}

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_LOOKUP = new Uint8Array(256);
for (let i = 0; i < BASE64_CHARS.length; i += 1) {
  BASE64_LOOKUP[BASE64_CHARS.charCodeAt(i)] = i;
}

function decodeBase64ToBytes(b64: string): Uint8Array {
  const len = b64.length;
  if (len === 0) return new Uint8Array(0);
  let pad = 0;
  if (b64.charCodeAt(len - 1) === 61) pad += 1;
  if (len > 1 && b64.charCodeAt(len - 2) === 61) pad += 1;
  const outLen = ((len * 3) >> 2) - pad;
  const out = new Uint8Array(Math.max(0, outLen));

  let outIdx = 0;
  for (let i = 0; i < len; i += 4) {
    const a = BASE64_LOOKUP[b64.charCodeAt(i)] ?? 0;
    const b = BASE64_LOOKUP[b64.charCodeAt(i + 1)] ?? 0;
    const c = BASE64_LOOKUP[b64.charCodeAt(i + 2)] ?? 0;
    const d = BASE64_LOOKUP[b64.charCodeAt(i + 3)] ?? 0;
    const triple = (a << 18) | (b << 12) | (c << 6) | d;
    if (outIdx < out.length) out[outIdx++] = (triple >> 16) & 0xff;
    if (outIdx < out.length) out[outIdx++] = (triple >> 8) & 0xff;
    if (outIdx < out.length) out[outIdx++] = triple & 0xff;
  }
  return out;
}

function encodeBytesToBase64(bytes: Uint8Array): string {
  const len = bytes.length;
  if (len === 0) return '';
  const parts: string[] = [];
  const chunkSize = 3072; // Multiple of 3 for zero intermediate padding
  for (let offset = 0; offset < len; offset += chunkSize) {
    const end = Math.min(len, offset + chunkSize);
    let str = '';
    for (let i = offset; i < end; i += 3) {
      const b0 = bytes[i];
      const hasB1 = i + 1 < end;
      const hasB2 = i + 2 < end;
      const b1 = hasB1 ? bytes[i + 1] : 0;
      const b2 = hasB2 ? bytes[i + 2] : 0;
      const triple = (b0 << 16) | (b1 << 8) | b2;
      str += BASE64_CHARS[(triple >> 18) & 0x3f];
      str += BASE64_CHARS[(triple >> 12) & 0x3f];
      str += hasB1 ? BASE64_CHARS[(triple >> 6) & 0x3f] : '=';
      str += hasB2 ? BASE64_CHARS[triple & 0x3f] : '=';
    }
    parts.push(str);
  }
  return parts.join('');
}

function inferAudioFormat(
  firstChunkBytes: number,
  totalBytes: number,
  elapsedMs: number,
): { sampleRate: number; channels: number } {
  // LiveKit Android AudioRecordSamplesDispatcher delivers 10ms PCM-16 chunks
  if (firstChunkBytes === 960) return { sampleRate: 48000, channels: 1 };
  if (firstChunkBytes === 1920) return { sampleRate: 48000, channels: 2 };
  if (firstChunkBytes === 882) return { sampleRate: 44100, channels: 1 };
  if (firstChunkBytes === 1764) return { sampleRate: 44100, channels: 2 };
  if (firstChunkBytes === 640) return { sampleRate: 32000, channels: 1 };
  if (firstChunkBytes === 480) return { sampleRate: 24000, channels: 1 };
  if (firstChunkBytes === 320) return { sampleRate: 16000, channels: 1 };

  const seconds = Math.max(0.5, elapsedMs / 1000);
  const estimatedRate = totalBytes / 2 / seconds;
  const standards = [16000, 24000, 32000, 44100, 48000];
  let best = 48000;
  let bestDiff = Infinity;
  for (const rate of standards) {
    const diff = Math.abs(rate - estimatedRate);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = rate;
    }
  }
  return { sampleRate: best, channels: 1 };
}

function build16kMonoWav(
  decodedChunks: Uint8Array[],
  sourceRate: number,
  channels: number,
): { wavBytes: Uint8Array; activeSpeechMs: number } {
  let totalBytes = 0;
  for (const c of decodedChunks) totalBytes += c.byteLength;
  const totalInt16 = totalBytes >> 1;
  const monoCount = channels === 2 ? totalInt16 >> 1 : totalInt16;
  const mono = new Int16Array(monoCount);

  let writeIdx = 0;
  for (const chunk of decodedChunks) {
    const view = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    const step = channels === 2 ? 4 : 2;
    for (let off = 0; off + step <= chunk.byteLength && writeIdx < monoCount; off += step) {
      if (channels === 2) {
        const left = view.getInt16(off, true);
        const right = view.getInt16(off + 2, true);
        mono[writeIdx++] = (left + right) >> 1;
      } else {
        mono[writeIdx++] = view.getInt16(off, true);
      }
    }
  }

  // Silence-aware Voice Activity Detection (200ms energy windows)
  const windowSamples = Math.max(1, Math.round(sourceRate * 0.2));
  let activeWindows = 0;
  for (let start = 0; start < writeIdx; start += windowSamples) {
    const end = Math.min(writeIdx, start + windowSamples);
    let sumSq = 0;
    for (let i = start; i < end; i += 1) {
      const norm = mono[i] / 32768;
      sumSq += norm * norm;
    }
    const rms = Math.sqrt(sumSq / Math.max(1, end - start));
    if (rms > 0.014) {
      activeWindows += 1;
    }
  }
  const activeSpeechMs = activeWindows * 200;

  // Downsample to 16 kHz mono 16-bit PCM (compact & optimal for Gemini Audio)
  const targetRate = sourceRate > 16000 ? 16000 : sourceRate;
  const ratio = sourceRate / targetRate;
  const targetLength = Math.max(1, Math.floor(writeIdx / ratio));
  const dataSize = targetLength * 2;
  const wav = new Uint8Array(44 + dataSize);
  const header = new DataView(wav.buffer);

  // RIFF / WAVE header
  wav.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  header.setUint32(4, 36 + dataSize, true);
  wav.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE"
  wav.set([0x66, 0x6d, 0x74, 0x20], 12); // "fmt "
  header.setUint32(16, 16, true); // PCM subchunk size
  header.setUint16(20, 1, true); // AudioFormat = 1 (PCM)
  header.setUint16(22, 1, true); // NumChannels = 1 (Mono)
  header.setUint32(24, targetRate, true); // SampleRate
  header.setUint32(28, targetRate * 2, true); // ByteRate = SampleRate * 1 * 16/8
  header.setUint16(32, 2, true); // BlockAlign
  header.setUint16(34, 16, true); // BitsPerSample
  wav.set([0x64, 0x61, 0x74, 0x61], 36); // "data"
  header.setUint32(40, dataSize, true);

  let outOff = 44;
  if (Math.abs(ratio - 1) < 0.01) {
    for (let i = 0; i < targetLength; i += 1) {
      header.setInt16(outOff, mono[i], true);
      outOff += 2;
    }
  } else {
    for (let i = 0; i < targetLength; i += 1) {
      const start = Math.floor(i * ratio);
      const end = Math.min(writeIdx, Math.max(start + 1, Math.floor((i + 1) * ratio)));
      let acc = 0;
      for (let j = start; j < end; j += 1) {
        acc += mono[j];
      }
      const avg = Math.round(acc / Math.max(1, end - start));
      header.setInt16(outOff, Math.max(-32768, Math.min(32767, avg)), true);
      outOff += 2;
    }
  }

  return { wavBytes: wav, activeSpeechMs };
}

/**
 * Attaches directly to LiveKit's native Android AudioRecordSamplesDispatcher sink
 * (zero hardware microphone conflict) and periodically emits compact 16 kHz mono WAV
 * chunks ONLY when real voice activity is detected.
 */
export function startNativeAiAudioCapture(options: NativeAudioCaptureOptions): () => void {
  if (Platform.OS !== 'android') {
    return () => {};
  }

  const nativeModule = NativeModules.LivekitReactNativeModule as
    | LiveKitNativeAudioModule
    | undefined;
  const trackId = options.mediaStreamTrack?.id;
  if (
    !nativeModule ||
    typeof nativeModule.createAudioSinkListener !== 'function' ||
    typeof nativeModule.deleteAudioSinkListener !== 'function' ||
    !trackId
  ) {
    return () => {};
  }

  const pcId =
    typeof options.mediaStreamTrack._peerConnectionId === 'number'
      ? options.mediaStreamTrack._peerConnectionId
      : -1;
  const segmentMs = options.segmentMs ?? 20_000;

  let reactTag: string | null = null;
  try {
    reactTag = nativeModule.createAudioSinkListener(pcId, trackId);
  } catch {
    return () => {};
  }
  if (!reactTag) {
    return () => {};
  }

  let stopped = false;
  let pendingBase64: string[] = [];
  let windowStartedAt = Date.now();
  const MAX_CHUNKS_PER_WINDOW = 2600; // ~26 seconds safety cap

  const emitter = new NativeEventEmitter(
    nativeModule as unknown as ConstructorParameters<typeof NativeEventEmitter>[0],
  );
  const sub = emitter.addListener(
    'LK_AUDIO_DATA',
    (event: { id?: string; data?: string } | undefined) => {
      if (stopped || !event || event.id !== reactTag || typeof event.data !== 'string') return;
      if (pendingBase64.length < MAX_CHUNKS_PER_WINDOW) {
        pendingBase64.push(event.data);
      }
    },
  );

  const flushSegment = (minActiveMs: number) => {
    if (pendingBase64.length < 30) {
      pendingBase64 = [];
      windowStartedAt = Date.now();
      return;
    }

    const rawChunks = pendingBase64;
    const elapsedMs = Date.now() - windowStartedAt;
    pendingBase64 = [];
    windowStartedAt = Date.now();

    try {
      const decoded: Uint8Array[] = [];
      let totalBytes = 0;
      for (const b64 of rawChunks) {
        const bytes = decodeBase64ToBytes(b64);
        if (bytes.byteLength > 0) {
          decoded.push(bytes);
          totalBytes += bytes.byteLength;
        }
      }
      if (decoded.length === 0 || totalBytes < 4000) return;

      const { sampleRate, channels } = inferAudioFormat(
        decoded[0].byteLength,
        totalBytes,
        elapsedMs,
      );
      const { wavBytes, activeSpeechMs } = build16kMonoWav(decoded, sampleRate, channels);
      // Skip silent windows so zero unnecessary Gemini API calls are made
      if (activeSpeechMs < minActiveMs) return;

      const wavBase64 = encodeBytesToBase64(wavBytes);
      if (wavBase64.length > 0) {
        void Promise.resolve(options.onWavChunk(wavBase64, 'audio/wav')).catch(() => {});
      }
    } catch {
      // Non-fatal: never disrupt live call audio
    }
  };

  const timer = setInterval(() => {
    if (!stopped) {
      flushSegment(600);
    }
  }, segmentMs);

  return () => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    // Flush any remaining spoken snippet (>= 1s of speech) before closing
    flushSegment(1000);
    try {
      sub.remove();
    } catch {
      // Ignore cleanup errors
    }
    if (reactTag) {
      const tagToDelete = reactTag;
      reactTag = null;
      try {
        nativeModule.deleteAudioSinkListener?.(tagToDelete, pcId, trackId);
      } catch {
        // Track may already be stopped/unpublished
      }
    }
  };
}
