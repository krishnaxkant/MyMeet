import { useCallback, useEffect, useRef, useState } from 'react';
import type { LocalTrack, RemoteTrack } from 'livekit-client';
import {
  analyzeScreenFrame,
  recordMeetingTranscript,
  transcribeAudioChunk,
} from '../services/api';

interface UseMeetingAiAgentOptions {
  meetingCode: string;
  accessToken: string | null;
  speakerName: string;
  enabled: boolean;
  localAudioTrack: LocalTrack | RemoteTrack | null;
  screenShareTrack: LocalTrack | RemoteTrack | null;
  screenSharerName: string | null;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to encode audio chunk.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read audio chunk.'));
    reader.readAsDataURL(blob);
  });
}

function pickAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}

async function captureTrackFrameAsJpeg(
  track: LocalTrack | RemoteTrack,
): Promise<string | null> {
  const mediaStreamTrack = track.mediaStreamTrack;
  if (!mediaStreamTrack || mediaStreamTrack.readyState !== 'live') return null;

  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = new MediaStream([mediaStreamTrack]);

  try {
    await video.play();
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const scale = Math.min(1, 960 / width);
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, targetW, targetH);
    return canvas.toDataURL('image/jpeg', 0.65);
  } catch {
    return null;
  } finally {
    video.pause();
    video.srcObject = null;
  }
}

export function useMeetingAiAgent({
  meetingCode,
  accessToken,
  speakerName,
  enabled,
  localAudioTrack,
  screenShareTrack,
  screenSharerName,
}: UseMeetingAiAgentOptions) {
  const [aiAgentActive, setAiAgentActive] = useState(true);
  const [voiceCount, setVoiceCount] = useState(0);
  const [screenCount, setScreenCount] = useState(0);
  const [capturingScreen, setCapturingScreen] = useState(false);
  const [lastCaptureNotice, setLastCaptureNotice] = useState<string | null>(null);

  const busyCaptureRef = useRef(false);
  // Once Gemini Audio succeeds, prefer it over browser SpeechRecognition to avoid duplicates
  const geminiAudioActiveRef = useRef(false);
  const geminiAudioUnavailableRef = useRef(false);

  const saveVoiceTranscript = useCallback(
    async (text: string) => {
      if (!enabled || !aiAgentActive || !accessToken || !meetingCode) return;
      // Avoid duplicating transcripts when Gemini Audio transcription is actively capturing
      if (geminiAudioActiveRef.current) return;
      const cleaned = text.trim();
      if (cleaned.length < 6) return;
      try {
        const res = await recordMeetingTranscript(accessToken, meetingCode, cleaned, speakerName);
        if (!res.skipped) {
          setVoiceCount((prev) => prev + 1);
        }
      } catch {
        // Silent best-effort during live call
      }
    },
    [enabled, aiAgentActive, accessToken, meetingCode, speakerName],
  );

  // Silence-aware 25-second Gemini Audio capture (works on ALL browsers & Hindi/Hinglish/English)
  useEffect(() => {
    if (!enabled || !aiAgentActive || !accessToken || !meetingCode || !localAudioTrack) return;
    if (geminiAudioUnavailableRef.current) return;
    if (typeof MediaRecorder === 'undefined') return;

    const rawTrack = localAudioTrack.mediaStreamTrack;
    if (!rawTrack || rawTrack.readyState !== 'live') return;

    const clonedTrack = rawTrack.clone();
    const stream = new MediaStream([clonedTrack]);

    // Voice Activity Detection (RMS energy check) so silent intervals send ZERO API requests
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let dataArr: Uint8Array<ArrayBuffer> | null = null;
    let hadSpeechInWindow = false;

    try {
      const AudioCtxCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxCtor) {
        audioCtx = new AudioCtxCtor();
        const source = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        dataArr = new Uint8Array(analyser.fftSize);
      }
    } catch {
      // Fallback: treat window as active if AudioContext is unavailable
      hadSpeechInWindow = true;
    }

    const vadTimer = setInterval(() => {
      if (!analyser || !dataArr) {
        hadSpeechInWindow = true;
        return;
      }
      analyser.getByteTimeDomainData(dataArr);
      let sumSquares = 0;
      for (let i = 0; i < dataArr.length; i += 1) {
        const normalized = (dataArr[i] - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / dataArr.length);
      if (rms > 0.015) {
        hadSpeechInWindow = true;
      }
    }, 400);

    let stopped = false;
    let recorder: MediaRecorder | null = null;
    let rotateTimer: ReturnType<typeof setTimeout> | null = null;
    const mimeType = pickAudioMimeType();

    const startChunkSegment = () => {
      if (stopped || geminiAudioUnavailableRef.current || clonedTrack.readyState !== 'live') {
        return;
      }

      const chunks: BlobPart[] = [];
      hadSpeechInWindow = false;

      try {
        recorder = mimeType
          ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 24000 })
          : new MediaRecorder(stream);
      } catch {
        return;
      }

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunks.push(ev.data);
        }
      };

      recorder.onstop = () => {
        const shouldSend = hadSpeechInWindow && chunks.length > 0 && !geminiAudioUnavailableRef.current;
        const blob = shouldSend
          ? new Blob(chunks, { type: recorder?.mimeType || mimeType || 'audio/webm' })
          : null;

        // Immediately start next 25s clip so no speech is dropped between segments
        if (!stopped) {
          startChunkSegment();
        }

        if (blob && blob.size > 1500) {
          void (async () => {
            try {
              const dataUrl = await blobToDataUrl(blob);
              const res = await transcribeAudioChunk(
                accessToken,
                meetingCode,
                dataUrl,
                blob.type || 'audio/webm',
                speakerName,
              );
              if (!res.usedAi) {
                // Backend does not have GEMINI_API_KEY configured; fall back cleanly to browser captions
                geminiAudioUnavailableRef.current = true;
                return;
              }
              geminiAudioActiveRef.current = true;
              if (res.saved) {
                setVoiceCount((prev) => prev + 1);
              }
            } catch {
              // Non-fatal during live meeting
            }
          })();
        }
      };

      try {
        recorder.start();
        rotateTimer = setTimeout(() => {
          if (recorder && recorder.state === 'recording') {
            recorder.stop();
          }
        }, 25_000);
      } catch {
        // Ignore recorder start failure
      }
    };

    startChunkSegment();

    return () => {
      stopped = true;
      clearInterval(vadTimer);
      if (rotateTimer) clearTimeout(rotateTimer);
      try {
        if (recorder && recorder.state === 'recording') {
          recorder.stop();
        }
      } catch {
        // Ignore stop cleanup
      }
      clonedTrack.stop();
      if (audioCtx) {
        void audioCtx.close().catch(() => {});
      }
    };
  }, [enabled, aiAgentActive, accessToken, meetingCode, localAudioTrack, speakerName]);

  const captureScreenNow = useCallback(async () => {
    if (!enabled || !aiAgentActive || !accessToken || !meetingCode || !screenShareTrack) return;
    if (busyCaptureRef.current) return;

    busyCaptureRef.current = true;
    setCapturingScreen(true);
    try {
      const dataUrl = await captureTrackFrameAsJpeg(screenShareTrack);
      if (!dataUrl) return;

      const res = await analyzeScreenFrame(
        accessToken,
        meetingCode,
        dataUrl,
        screenSharerName || 'Shared Screen',
      );
      setScreenCount((prev) => prev + 1);
      setLastCaptureNotice(
        res.usedAi
          ? 'AI Agent analyzed shared screen & saved visual notes.'
          : 'Screen frame saved for meeting summary.',
      );
      setTimeout(() => setLastCaptureNotice(null), 4000);
    } catch {
      // Non-fatal during meeting
    } finally {
      busyCaptureRef.current = false;
      setCapturingScreen(false);
    }
  }, [enabled, aiAgentActive, accessToken, meetingCode, screenShareTrack, screenSharerName]);

  // Periodically analyze active shared screen every 20s (starting 3s after screen share starts)
  useEffect(() => {
    if (!enabled || !aiAgentActive || !screenShareTrack) return;

    const initialTimer = setTimeout(() => {
      void captureScreenNow();
    }, 3000);

    const interval = setInterval(() => {
      void captureScreenNow();
    }, 20_000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [enabled, aiAgentActive, screenShareTrack, captureScreenNow]);

  return {
    aiAgentActive,
    setAiAgentActive,
    voiceCount,
    screenCount,
    capturingScreen,
    lastCaptureNotice,
    saveVoiceTranscript,
    captureScreenNow,
  };
}
