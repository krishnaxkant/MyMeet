import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Participant, RemoteAudioTrack, Room, VideoTrack } from 'livekit-client';
import { MicSymbol } from './MediaIcons';
import { startNativeAiAudioCapture } from '../utils/nativeAiAudioCapture';
import { initNativeLiveKitIfAvailable } from '../utils/nativeLiveKit';

export interface NativeStageHandle {
  setMic: (enabled: boolean) => void;
  setCam: (enabled: boolean) => void;
  setScreenShare: (enabled: boolean) => void;
  flipCam: () => void;
  setSpeakerMuted: (muted: boolean) => void;
  setHand: (raised: boolean) => void;
  disconnect: () => void;
}

export interface NativeStageEvent {
  type: 'connected' | 'disconnected' | 'mediaState' | 'handEvent' | 'error';
  micEnabled?: boolean;
  camEnabled?: boolean;
  screenShareEnabled?: boolean;
  remoteScreenShareActive?: boolean;
  identity?: string;
  name?: string;
  raised?: boolean;
  warning?: string;
  message?: string;
}

interface NativeLiveKitStageProps {
  url: string;
  token: string;
  initialMic: boolean;
  initialCam: boolean;
  localName: string;
  avatars: Record<string, string>;
  aiNotesEnabled?: boolean;
  onAiAudioChunk?: (wavBase64: string, mimeType: 'audio/wav') => void;
  onStageEvent: (event: NativeStageEvent) => void;
}

interface TileSnapshot {
  identity: string;
  name: string;
  isLocal: boolean;
  isHost: boolean;
  isSpeaking: boolean;
  micOn: boolean;
  videoTrack: VideoTrack | undefined;
  isHandRaised: boolean;
}

interface ScreenSnapshot {
  identity: string;
  name: string;
  isLocal: boolean;
  videoTrack: VideoTrack;
}

function getInitials(name: string): string {
  const parts = String(name || 'M')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'M';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function isHostParticipant(p: Participant): boolean {
  try {
    const meta = JSON.parse(p.metadata || '{}') as { role?: string };
    return meta.role === 'host';
  } catch {
    return false;
  }
}

function isNetworkRelayError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('pc connection') ||
    lower.includes('ice') ||
    lower.includes('could not establish') ||
    lower.includes('signal')
  );
}

export const NativeLiveKitStage = forwardRef<NativeStageHandle, NativeLiveKitStageProps>(
  function NativeLiveKitStage(
    {
      url,
      token,
      initialMic,
      initialCam,
      localName,
      avatars,
      aiNotesEnabled = true,
      onAiAudioChunk,
      onStageEvent,
    },
    ref,
  ) {
    const runtime = initNativeLiveKitIfAvailable();
    const roomRef = useRef<Room | null>(null);
    const onStageEventRef = useRef(onStageEvent);
    onStageEventRef.current = onStageEvent;
    const onAiAudioChunkRef = useRef(onAiAudioChunk);
    onAiAudioChunkRef.current = onAiAudioChunk;
    const aiNotesEnabledRef = useRef(aiNotesEnabled);
    aiNotesEnabledRef.current = aiNotesEnabled;
    const stopAiCaptureRef = useRef<(() => void) | null>(null);
    const activeAiTrackIdRef = useRef<string | null>(null);
    const prevRemoteScreenRef = useRef(false);

    const desiredMicRef = useRef(initialMic);
    const desiredCamRef = useRef(initialCam);
    const speakerMutedRef = useRef(false);
    const isFrontCameraRef = useRef(true);
    const raisedHandsRef = useRef<Record<string, string>>({});
    const mediaQueueRef = useRef<Promise<void>>(Promise.resolve());
    const unmountedRef = useRef(false);
    const captionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [connecting, setConnecting] = useState(true);
    const [tiles, setTiles] = useState<TileSnapshot[]>([]);
    const [screenShare, setScreenShare] = useState<ScreenSnapshot | null>(null);
    const [isFrontCamera, setIsFrontCamera] = useState(true);
    const [recordingBy, setRecordingBy] = useState<string | null>(null);
    const [caption, setCaption] = useState<{ speaker: string; text: string } | null>(null);
    const [stageStatus, setStageStatus] = useState<string | null>(null);

    const enqueueMedia = useCallback((task: () => Promise<void>) => {
      const next = mediaQueueRef.current.then(task, task);
      mediaQueueRef.current = next.catch(() => {});
      return next;
    }, []);

    const syncSpeakerVolume = useCallback(
      (muted: boolean) => {
        const room = roomRef.current;
        const vol = muted ? 0 : 1;
        if (runtime.LiveKitRN?.AudioSession?.setDefaultRemoteAudioTrackVolume) {
          void runtime.LiveKitRN.AudioSession.setDefaultRemoteAudioTrackVolume(vol).catch(
            () => {},
          );
        }
        if (!room) return;
        room.remoteParticipants.forEach((participant) => {
          participant.audioTrackPublications.forEach((pub) => {
            const track = pub.track as RemoteAudioTrack | undefined;
            if (track && typeof track.setVolume === 'function') {
              try {
                track.setVolume(vol);
              } catch {
                // Ignore per-track volume errors
              }
            }
          });
        });
      },
      [runtime.LiveKitRN],
    );

    const stopAiCapture = useCallback(() => {
      if (stopAiCaptureRef.current) {
        const stop = stopAiCaptureRef.current;
        stopAiCaptureRef.current = null;
        activeAiTrackIdRef.current = null;
        stop();
      }
    }, []);

    const syncAiAudioCapture = useCallback(() => {
      const room = roomRef.current;
      const LK = runtime.LiveKitClient;
      if (
        unmountedRef.current ||
        !aiNotesEnabledRef.current ||
        !onAiAudioChunkRef.current ||
        !room ||
        room.state !== 'connected' ||
        !LK
      ) {
        stopAiCapture();
        return;
      }

      const micPub = room.localParticipant.getTrackPublication(LK.Track.Source.Microphone);
      const rawTrack = micPub?.track?.mediaStreamTrack as
        | { id?: string; _peerConnectionId?: number; readyState?: string }
        | undefined;
      const isLiveMic = Boolean(
        micPub && !micPub.isMuted && rawTrack?.id && rawTrack.readyState !== 'ended',
      );

      if (!isLiveMic || !rawTrack?.id) {
        stopAiCapture();
        return;
      }

      if (activeAiTrackIdRef.current === rawTrack.id && stopAiCaptureRef.current) {
        return;
      }

      stopAiCapture();
      activeAiTrackIdRef.current = rawTrack.id;
      stopAiCaptureRef.current = startNativeAiAudioCapture({
        mediaStreamTrack: rawTrack,
        segmentMs: 20_000,
        onWavChunk: (wavBase64, mimeType) => {
          onAiAudioChunkRef.current?.(wavBase64, mimeType);
        },
      });
    }, [runtime.LiveKitClient, stopAiCapture]);

    useEffect(() => {
      syncAiAudioCapture();
    }, [aiNotesEnabled, syncAiAudioCapture]);

    const refreshTiles = useCallback(() => {
      const room = roomRef.current;
      const LK = runtime.LiveKitClient;
      if (!room || !LK) return;

      const all: Array<{ p: Participant; isLocal: boolean }> = [
        { p: room.localParticipant, isLocal: true },
        ...Array.from(room.remoteParticipants.values()).map((p) => ({ p, isLocal: false })),
      ];

      let remoteScreen: ScreenSnapshot | null = null;
      let localScreen: ScreenSnapshot | null = null;
      for (const item of all) {
        const sp = item.p.getTrackPublication(LK.Track.Source.ScreenShare);
        if (sp?.track && !sp.isMuted) {
          const snap: ScreenSnapshot = {
            identity: item.p.identity,
            name: item.p.name || item.p.identity,
            isLocal: item.isLocal,
            videoTrack: sp.track as VideoTrack,
          };
          if (!item.isLocal && !remoteScreen) {
            remoteScreen = snap;
          } else if (item.isLocal && !localScreen) {
            localScreen = snap;
          }
        }
      }
      const activeScreen = remoteScreen ?? localScreen;
      setScreenShare(activeScreen);

      const isRemoteScreenNow = Boolean(activeScreen && !activeScreen.isLocal);
      if (isRemoteScreenNow !== prevRemoteScreenRef.current) {
        prevRemoteScreenRef.current = isRemoteScreenNow;
        onStageEventRef.current({
          type: 'mediaState',
          remoteScreenShareActive: isRemoteScreenNow,
        });
      }

      const snapshots: TileSnapshot[] = all.map(({ p, isLocal }) => {
        const camPub = p.getTrackPublication(LK.Track.Source.Camera);
        const micPub = p.getTrackPublication(LK.Track.Source.Microphone);
        const hasVideo = Boolean(camPub?.track && !camPub.isMuted);
        return {
          identity: p.identity,
          name: p.name || (isLocal ? localName : p.identity) || 'Participant',
          isLocal,
          isHost: isHostParticipant(p),
          isSpeaking: p.isSpeaking,
          micOn: Boolean(micPub && !micPub.isMuted),
          videoTrack: hasVideo ? (camPub?.track as VideoTrack | undefined) : undefined,
          isHandRaised: Boolean(raisedHandsRef.current[p.identity]),
        };
      });

      setTiles(snapshots);
      syncSpeakerVolume(speakerMutedRef.current);
      syncAiAudioCapture();
    }, [localName, runtime.LiveKitClient, syncAiAudioCapture, syncSpeakerVolume]);

    const applyMicInternal = useCallback(
      async (enabled: boolean) => {
        desiredMicRef.current = enabled;
        const room = roomRef.current;
        if (!room || room.state !== 'connected') return;
        try {
          if (enabled) {
            setStageStatus('Starting microphone...');
            await room.localParticipant.setMicrophoneEnabled(true, {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            });
          } else {
            await room.localParticipant.setMicrophoneEnabled(false);
          }
          setStageStatus(null);
          refreshTiles();
          onStageEventRef.current({
            type: 'mediaState',
            micEnabled: room.localParticipant.isMicrophoneEnabled,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unable to access microphone.';
          desiredMicRef.current = false;
          setStageStatus(null);
          onStageEventRef.current({
            type: 'mediaState',
            micEnabled: false,
            warning: `Mic: ${msg}`,
          });
        }
      },
      [refreshTiles],
    );

    const applyCamInternal = useCallback(
      async (enabled: boolean) => {
        desiredCamRef.current = enabled;
        const room = roomRef.current;
        if (!room || room.state !== 'connected') return;
        try {
          if (enabled) {
            setStageStatus('Starting camera...');
            await room.localParticipant.setCameraEnabled(
              true,
              {
                facingMode: isFrontCameraRef.current ? 'user' : 'environment',
                resolution: { width: 640, height: 480, frameRate: 24 },
              },
              {
                simulcast: false,
                videoEncoding: { maxBitrate: 700_000, maxFramerate: 24 },
              },
            );
          } else {
            await room.localParticipant.setCameraEnabled(false);
          }
          setStageStatus(null);
          refreshTiles();
          onStageEventRef.current({
            type: 'mediaState',
            camEnabled: room.localParticipant.isCameraEnabled,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unable to access camera.';
          desiredCamRef.current = false;
          setStageStatus(null);
          onStageEventRef.current({
            type: 'mediaState',
            camEnabled: false,
            warning: `Camera: ${msg}`,
          });
        }
      },
      [refreshTiles],
    );

    const applyScreenShareInternal = useCallback(
      async (enabled: boolean) => {
        const room = roomRef.current;
        if (!room || room.state !== 'connected') {
          onStageEventRef.current({
            type: 'mediaState',
            screenShareEnabled: false,
            warning: 'Wait for meeting connection before sharing your screen.',
          });
          return;
        }
        try {
          if (enabled) {
            setStageStatus('Starting screen share...');
            await room.localParticipant.setScreenShareEnabled(true, { audio: false });
          } else {
            await room.localParticipant.setScreenShareEnabled(false);
          }
          setStageStatus(null);
          refreshTiles();
          onStageEventRef.current({
            type: 'mediaState',
            screenShareEnabled: room.localParticipant.isScreenShareEnabled,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unable to share screen.';
          setStageStatus(null);
          const cancelled =
            msg.toLowerCase().includes('cancel') ||
            msg.toLowerCase().includes('denied') ||
            msg.toLowerCase().includes('permission');
          onStageEventRef.current({
            type: 'mediaState',
            screenShareEnabled: room.localParticipant.isScreenShareEnabled,
            ...(cancelled ? {} : { warning: `Screen Share: ${msg}` }),
          });
        }
      },
      [refreshTiles],
    );

    const flipCamInternal = useCallback(async () => {
      const room = roomRef.current;
      const LK = runtime.LiveKitClient;
      const nextFront = !isFrontCameraRef.current;
      isFrontCameraRef.current = nextFront;
      setIsFrontCamera(nextFront);

      if (!room || !LK || !room.localParticipant.isCameraEnabled) return;
      try {
        const camPub = room.localParticipant.getTrackPublication(LK.Track.Source.Camera);
        const mediaTrack = camPub?.track?.mediaStreamTrack as
          | { _switchCamera?: () => void }
          | undefined;
        if (mediaTrack && typeof mediaTrack._switchCamera === 'function') {
          // Instant hardware camera switch without unpublishing track
          mediaTrack._switchCamera();
          refreshTiles();
          return;
        }
        await applyCamInternal(false);
        await applyCamInternal(true);
      } catch {
        await applyCamInternal(false);
        await applyCamInternal(true);
      }
    }, [applyCamInternal, refreshTiles, runtime.LiveKitClient]);

    const applyHandInternal = useCallback(
      async (raised: boolean) => {
        const room = roomRef.current;
        if (!room) return;
        const id = room.localParticipant.identity;
        const name = room.localParticipant.name || localName || 'You';
        if (raised) {
          raisedHandsRef.current[id] = name;
        } else {
          delete raisedHandsRef.current[id];
        }
        refreshTiles();
        onStageEventRef.current({ type: 'handEvent', identity: id, name, raised });
        try {
          const encoded = new TextEncoder().encode(
            JSON.stringify({ type: 'hand', identity: id, name, raised }),
          );
          await room.localParticipant.publishData(encoded, { reliable: true });
        } catch {
          // Ignore transient data channel errors
        }
      },
      [localName, refreshTiles],
    );

    useImperativeHandle(
      ref,
      () => ({
        setMic: (enabled) => {
          void enqueueMedia(() => applyMicInternal(enabled));
        },
        setCam: (enabled) => {
          void enqueueMedia(() => applyCamInternal(enabled));
        },
        setScreenShare: (enabled) => {
          void enqueueMedia(() => applyScreenShareInternal(enabled));
        },
        flipCam: () => {
          void enqueueMedia(() => flipCamInternal());
        },
        setSpeakerMuted: (muted) => {
          speakerMutedRef.current = muted;
          syncSpeakerVolume(muted);
        },
        setHand: (raised) => {
          void applyHandInternal(raised);
        },
        disconnect: () => {
          stopAiCapture();
          const room = roomRef.current;
          roomRef.current = null;
          if (room) {
            void room.disconnect(true).catch(() => {});
          }
        },
      }),
      [
        applyCamInternal,
        applyHandInternal,
        applyMicInternal,
        applyScreenShareInternal,
        enqueueMedia,
        flipCamInternal,
        stopAiCapture,
        syncSpeakerVolume,
      ],
    );

    useEffect(() => {
      const LK = runtime.LiveKitClient;
      const LKRN = runtime.LiveKitRN;
      if (!LK || !LKRN) return;

      unmountedRef.current = false;
      let activeRoom: Room | null = null;

      const connectRoom = async (forceRelay: boolean): Promise<void> => {
        if (unmountedRef.current) return;
        setConnecting(true);
        setStageStatus(forceRelay ? 'Connecting via TURN/TLS relay...' : null);

        try {
          // Configure Android communication audio session (speakerphone + bluetooth + hardware AEC)
          await LKRN.AudioSession.configureAudio({
            android: {
              preferredOutputList: ['bluetooth', 'headset', 'speaker', 'earpiece'],
              audioTypeOptions: LKRN.AndroidAudioTypePresets.communication,
            },
            ios: {
              defaultOutput: 'speaker',
            },
          }).catch(() => {});
          await LKRN.AudioSession.startAudioSession().catch(() => {});

          const room = new LK.Room({
            adaptiveStream: false,
            dynacast: false,
            stopLocalTrackOnUnpublish: true,
            publishDefaults: {
              simulcast: false,
              stopMicTrackOnMute: false,
            },
          });
          activeRoom = room;
          roomRef.current = room;

          const { RoomEvent, Track } = LK;

          room.on(RoomEvent.ParticipantConnected, refreshTiles);
          room.on(RoomEvent.ParticipantDisconnected, (p) => {
            if (p?.identity) {
              delete raisedHandsRef.current[p.identity];
            }
            refreshTiles();
          });
          room.on(RoomEvent.TrackSubscribed, () => {
            syncSpeakerVolume(speakerMutedRef.current);
            refreshTiles();
          });
          room.on(RoomEvent.TrackUnsubscribed, refreshTiles);
          room.on(RoomEvent.TrackPublished, refreshTiles);
          room.on(RoomEvent.TrackUnpublished, refreshTiles);
          room.on(RoomEvent.TrackMuted, (pub, participant) => {
            if (participant?.identity === room.localParticipant.identity) {
              if (pub.source === Track.Source.Microphone) {
                desiredMicRef.current = false;
                onStageEventRef.current({ type: 'mediaState', micEnabled: false });
              } else if (pub.source === Track.Source.Camera) {
                desiredCamRef.current = false;
                onStageEventRef.current({ type: 'mediaState', camEnabled: false });
              }
            }
            refreshTiles();
          });
          room.on(RoomEvent.TrackUnmuted, (pub, participant) => {
            if (participant?.identity === room.localParticipant.identity) {
              if (pub.source === Track.Source.Microphone) {
                desiredMicRef.current = true;
                onStageEventRef.current({ type: 'mediaState', micEnabled: true });
              } else if (pub.source === Track.Source.Camera) {
                desiredCamRef.current = true;
                onStageEventRef.current({ type: 'mediaState', camEnabled: true });
              }
            }
            refreshTiles();
          });
          room.on(RoomEvent.LocalTrackPublished, refreshTiles);
          room.on(RoomEvent.LocalTrackUnpublished, (pub) => {
            if (pub.source === Track.Source.Microphone) {
              onStageEventRef.current({
                type: 'mediaState',
                micEnabled: room.localParticipant.isMicrophoneEnabled,
              });
            } else if (pub.source === Track.Source.Camera) {
              onStageEventRef.current({
                type: 'mediaState',
                camEnabled: room.localParticipant.isCameraEnabled,
              });
            } else if (pub.source === Track.Source.ScreenShare) {
              onStageEventRef.current({
                type: 'mediaState',
                screenShareEnabled: room.localParticipant.isScreenShareEnabled,
              });
            }
            refreshTiles();
          });
          room.on(RoomEvent.ActiveSpeakersChanged, refreshTiles);
          room.on(RoomEvent.DataReceived, (payload, participant) => {
            try {
              const decoded = JSON.parse(new TextDecoder().decode(payload)) as {
                type?: string;
                speaker?: string;
                text?: string;
                active?: boolean;
                by?: string;
                identity?: string;
                name?: string;
                raised?: boolean;
              };
              if (decoded.type === 'caption' && decoded.text) {
                setCaption({
                  speaker: decoded.speaker || participant?.name || 'Speaker',
                  text: decoded.text,
                });
                if (captionTimerRef.current) clearTimeout(captionTimerRef.current);
                captionTimerRef.current = setTimeout(() => setCaption(null), 6000);
              } else if (decoded.type === 'recording') {
                setRecordingBy(decoded.active ? decoded.by || 'Host' : null);
              } else if (decoded.type === 'hand') {
                const idKey = decoded.identity || participant?.identity || '';
                const who = decoded.name || participant?.name || 'A participant';
                if (idKey) {
                  if (decoded.raised) {
                    raisedHandsRef.current[idKey] = who;
                  } else {
                    delete raisedHandsRef.current[idKey];
                  }
                  refreshTiles();
                  onStageEventRef.current({
                    type: 'handEvent',
                    identity: idKey,
                    name: who,
                    raised: Boolean(decoded.raised),
                  });
                }
              }
            } catch {
              // Ignore malformed packets
            }
          });
          room.on(RoomEvent.Disconnected, () => {
            if (!unmountedRef.current) {
              onStageEventRef.current({ type: 'disconnected' });
            }
          });

          await room.connect(
            url,
            token,
            forceRelay ? { rtcConfig: { iceTransportPolicy: 'relay' } } : undefined,
          );

          if (unmountedRef.current) {
            await room.disconnect(true).catch(() => {});
            return;
          }

          setConnecting(false);
          setStageStatus(null);
          onStageEventRef.current({ type: 'connected' });
          refreshTiles();

          if (desiredMicRef.current) {
            await enqueueMedia(() => applyMicInternal(true));
          }
          if (desiredCamRef.current) {
            await enqueueMedia(() => applyCamInternal(true));
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unable to connect to live room.';
          if (!forceRelay && !unmountedRef.current && isNetworkRelayError(msg)) {
            if (activeRoom) {
              await activeRoom.disconnect(true).catch(() => {});
              activeRoom = null;
              roomRef.current = null;
            }
            await connectRoom(true);
            return;
          }
          if (!unmountedRef.current) {
            setConnecting(false);
            setStageStatus(null);
            onStageEventRef.current({ type: 'error', message: msg });
          }
        }
      };

      void connectRoom(false);

      return () => {
        unmountedRef.current = true;
        stopAiCapture();
        if (captionTimerRef.current) {
          clearTimeout(captionTimerRef.current);
          captionTimerRef.current = null;
        }
        const toClose = roomRef.current || activeRoom;
        roomRef.current = null;
        if (toClose) {
          void toClose.disconnect(true).catch(() => {});
        }
        void LKRN.AudioSession.stopAudioSession().catch(() => {});
      };
    }, [
      applyCamInternal,
      applyMicInternal,
      enqueueMedia,
      refreshTiles,
      runtime.LiveKitClient,
      runtime.LiveKitRN,
      stopAiCapture,
      syncSpeakerVolume,
      token,
      url,
    ]);

    const VideoViewComponent = runtime.LiveKitRN?.VideoView;

    const isRemotePresenting = Boolean(screenShare && !screenShare.isLocal && VideoViewComponent);
    const isSelfPresenting = Boolean(screenShare && screenShare.isLocal);
    const remoteSharerTile = isRemotePresenting
      ? tiles.find((t) => t.identity === screenShare?.identity) ?? null
      : null;

    // Cap visible tiles to 6 on mobile so 50-100 student classes never freeze the phone GPU
    // Priority: Active speakers -> Host -> Local user -> Camera ON -> Others
    const MAX_VISIBLE_MOBILE_TILES = 6;
    const prioritizedTiles =
      tiles.length > MAX_VISIBLE_MOBILE_TILES
        ? [...tiles]
            .sort((a, b) => {
              const score = (t: TileSnapshot) =>
                (t.isSpeaking ? 8 : 0) +
                (t.isHost ? 4 : 0) +
                (t.isLocal ? 2 : 0) +
                (t.videoTrack ? 1 : 0);
              return score(b) - score(a);
            })
            .slice(0, MAX_VISIBLE_MOBILE_TILES)
        : tiles;
    const hiddenTilesCount = Math.max(0, tiles.length - prioritizedTiles.length);

    // Build exact flex rows so participant blocks NEVER overflow outside the screen
    const tileRows: TileSnapshot[][] = [];
    if (prioritizedTiles.length <= 2) {
      for (const t of prioritizedTiles) tileRows.push([t]);
    } else if (prioritizedTiles.length === 3) {
      tileRows.push([prioritizedTiles[0], prioritizedTiles[1]], [prioritizedTiles[2]]);
    } else {
      for (let i = 0; i < prioritizedTiles.length; i += 2) {
        tileRows.push(prioritizedTiles.slice(i, i + 2));
      }
    }

    if (connecting && tiles.length === 0) {
      return (
        <View style={styles.connectingWrap}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.connectingText}>
            {stageStatus || 'Connecting to native HD audio & video...'}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.stageRoot}>
        {stageStatus && (
          <View style={styles.statusBanner}>
            <Text style={styles.statusBannerText}>{stageStatus}</Text>
          </View>
        )}

        {recordingBy && (
          <View style={styles.recBanner}>
            <View style={styles.recDot} />
            <Text style={styles.recBannerText}>{recordingBy} is recording this meeting</Text>
          </View>
        )}

        {/* Presenter View: when YOU are sharing, never mirror your own screen — show clean banner + participants */}
        {isSelfPresenting && (
          <View style={styles.selfShareBanner}>
            <View style={styles.selfShareLeft}>
              <View style={styles.selfShareDot} />
              <Text style={styles.selfShareText}>You are sharing your screen</Text>
            </View>
            <Pressable
              style={styles.selfShareStopBtn}
              onPress={() => void enqueueMedia(() => applyScreenShareInternal(false))}
            >
              <Text style={styles.selfShareStopText}>Stop</Text>
            </Pressable>
          </View>
        )}

        {/* Viewer Presentation Mode: 100% full-stage shared screen + compact top-right Host/Sharer PiP */}
        {isRemotePresenting && screenShare && VideoViewComponent ? (
          <View style={styles.viewerScreenFull}>
            <View style={[styles.tile, styles.screenTile]}>
              <VideoViewComponent
                videoTrack={screenShare.videoTrack}
                style={styles.videoFill}
                objectFit="contain"
              />
              <View style={styles.tileFooter}>
                <View style={styles.namePill}>
                  <Text style={styles.namePillText} numberOfLines={1}>
                    {screenShare.name} · Presenting
                  </Text>
                </View>
              </View>
            </View>

            {/* Compact Top-Right Floating Host / Sharer PiP Block */}
            {remoteSharerTile && (
              <View
                style={[
                  styles.sharerPipCard,
                  remoteSharerTile.isSpeaking && styles.tileSpeaking,
                ]}
              >
                {remoteSharerTile.videoTrack ? (
                  <VideoViewComponent
                    videoTrack={remoteSharerTile.videoTrack}
                    style={styles.videoFill}
                    objectFit="cover"
                  />
                ) : (
                  <View style={styles.pipAvatarCircle}>
                    {avatars[remoteSharerTile.identity] ? (
                      <Image
                        source={{ uri: avatars[remoteSharerTile.identity] }}
                        style={styles.avatarImg}
                      />
                    ) : (
                      <Text style={styles.pipAvatarInitials}>
                        {getInitials(remoteSharerTile.name)}
                      </Text>
                    )}
                  </View>
                )}
                <View style={styles.pipFooter}>
                  <Text style={styles.pipNameText} numberOfLines={1}>
                    {remoteSharerTile.name}
                  </Text>
                </View>
              </View>
            )}
          </View>
        ) : (
          <>
            <View style={styles.grid}>
              {tileRows.map((row, rowIdx) => (
                <View key={`row-${rowIdx}`} style={styles.gridRow}>
                  {row.map((tile) => {
                    const photoUrl = avatars[tile.identity] || null;
                    return (
                      <View
                        key={tile.identity}
                        style={[
                          styles.tile,
                          styles.tileFlex,
                          tile.isLocal && styles.tileLocal,
                          tile.isSpeaking && styles.tileSpeaking,
                          tile.isHandRaised && styles.tileHandRaised,
                        ]}
                      >
                        {tile.videoTrack && VideoViewComponent ? (
                          <VideoViewComponent
                            videoTrack={tile.videoTrack}
                            style={styles.videoFill}
                            objectFit="cover"
                            mirror={tile.isLocal && isFrontCamera}
                          />
                        ) : (
                          <View style={styles.avatarCircle}>
                            {photoUrl ? (
                              <Image source={{ uri: photoUrl }} style={styles.avatarImg} />
                            ) : (
                              <Text style={styles.avatarInitials}>{getInitials(tile.name)}</Text>
                            )}
                          </View>
                        )}

                        {tile.isHandRaised && (
                          <View style={styles.handPill}>
                            <Text style={styles.handPillText}>✋ Hand Raised</Text>
                          </View>
                        )}

                        <View style={styles.tileFooter}>
                          <View style={styles.namePill}>
                            <Text style={styles.namePillText} numberOfLines={1}>
                              {tile.isLocal ? `${tile.name} (You)` : tile.name}
                            </Text>
                          </View>
                          <View style={styles.badges}>
                            {tile.isHost && (
                              <View style={styles.hostTag}>
                                <Text style={styles.hostTagText}>Host</Text>
                              </View>
                            )}
                            {!tile.micOn && (
                              <View style={styles.mutedChip}>
                                <MicSymbol color="#FFFFFF" muted />
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>

            {hiddenTilesCount > 0 && (
              <View style={styles.overflowCountPill}>
                <Text style={styles.overflowCountText}>
                  +{hiddenTilesCount} more participants in class
                </Text>
              </View>
            )}
          </>
        )}

        {caption && (
          <View style={styles.captionBar}>
            <Text style={styles.captionText} numberOfLines={2}>
              <Text style={styles.captionSpeaker}>{caption.speaker}: </Text>
              {caption.text}
            </Text>
          </View>
        )}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  stageRoot: {
    flex: 1,
    backgroundColor: '#070B14',
    padding: 10,
    gap: 10,
  },
  connectingWrap: {
    flex: 1,
    backgroundColor: '#070B14',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  connectingText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  statusBanner: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  statusBannerText: {
    color: '#FDE68A',
    fontSize: 12,
    fontWeight: '600',
  },
  recBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.45)',
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  recBannerText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '700',
  },
  screenWrap: {
    flex: 1.4,
    minHeight: 0,
  },
  screenTile: {
    flex: 1,
    borderColor: '#3B82F6',
    backgroundColor: '#020617',
  },
  grid: {
    flex: 1,
    gap: 8,
    overflow: 'hidden',
  },
  gridRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 0,
  },
  tile: {
    position: 'relative',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#111827',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileFlex: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  tileLocal: {
    borderColor: 'rgba(59, 130, 246, 0.6)',
  },
  tileSpeaking: {
    borderColor: '#22C55E',
    borderWidth: 2.5,
  },
  tileHandRaised: {
    borderColor: '#F59E0B',
    borderWidth: 2.5,
  },
  videoFill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
  },
  handPill: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(245, 158, 11, 0.95)',
  },
  handPillText: {
    color: '#090D16',
    fontSize: 11,
    fontWeight: '800',
  },
  tileFooter: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  namePill: {
    maxWidth: '72%',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(7, 11, 20, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  namePillText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hostTag: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(34, 197, 94, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.5)',
  },
  hostTagText: {
    color: '#4ADE80',
    fontSize: 10,
    fontWeight: '800',
  },
  mutedChip: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(220, 38, 38, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ scale: 0.78 }],
  },
  captionBar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  captionSpeaker: {
    color: '#93C5FD',
    fontWeight: '700',
  },
  captionText: {
    color: '#F8FAFC',
    fontSize: 12.5,
    lineHeight: 17,
  },
  overflowCountPill: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  overflowCountText: {
    color: '#CBD5E1',
    fontSize: 11.5,
    fontWeight: '700',
  },
  viewerScreenFull: {
    flex: 1,
    position: 'relative',
    minHeight: 0,
  },
  sharerPipCard: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 106,
    height: 138,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
    zIndex: 25,
  },
  pipAvatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pipAvatarInitials: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  pipFooter: {
    position: 'absolute',
    left: 5,
    right: 5,
    bottom: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(7, 11, 20, 0.82)',
  },
  pipNameText: {
    color: '#F8FAFC',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  selfShareBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 34,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.65)',
  },
  selfShareLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  selfShareDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  selfShareText: {
    color: '#F8FAFC',
    fontSize: 12.5,
    fontWeight: '700',
  },
  selfShareStopBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#DC2626',
  },
  selfShareStopText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
});
