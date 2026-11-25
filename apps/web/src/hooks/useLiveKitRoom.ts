import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  type Participant,
  type RemoteTrack,
  type LocalTrack,
} from 'livekit-client';
import { fetchMeetingToken } from '../services/api';

export interface LiveParticipantMedia {
  identity: string;
  name: string;
  isLocal: boolean;
  isHost: boolean;
  isSpeaking: boolean;
  micEnabled: boolean;
  cameraEnabled: boolean;
  videoTrack: LocalTrack | RemoteTrack | null;
  audioTrack: LocalTrack | RemoteTrack | null;
  screenShareTrack: LocalTrack | RemoteTrack | null;
}

interface UseLiveKitRoomOptions {
  meetingCode: string;
  accessToken: string | null;
  enabled: boolean;
  initialMicEnabled: boolean;
  initialCamEnabled: boolean;
}

function parseIsHost(metadata: string | undefined): boolean {
  if (!metadata) return false;
  try {
    const parsed = JSON.parse(metadata) as { role?: string };
    return parsed.role === 'host';
  } catch {
    return false;
  }
}

function snapshotParticipant(participant: Participant, isLocal: boolean): LiveParticipantMedia {
  const camPub = participant.getTrackPublication(Track.Source.Camera);
  const micPub = participant.getTrackPublication(Track.Source.Microphone);
  const screenPub = participant.getTrackPublication(Track.Source.ScreenShare);

  const videoTrack =
    camPub?.track && !camPub.isMuted ? (camPub.track as LocalTrack | RemoteTrack) : null;
  const audioTrack =
    micPub?.track && !micPub.isMuted ? (micPub.track as LocalTrack | RemoteTrack) : null;
  const screenShareTrack =
    screenPub?.track && !screenPub.isMuted
      ? (screenPub.track as LocalTrack | RemoteTrack)
      : null;

  return {
    identity: participant.identity,
    name: participant.name || participant.identity,
    isLocal,
    isHost: parseIsHost(participant.metadata),
    isSpeaking: participant.isSpeaking,
    micEnabled: Boolean(micPub && !micPub.isMuted),
    cameraEnabled: Boolean(videoTrack),
    videoTrack,
    audioTrack,
    screenShareTrack,
  };
}

export function useLiveKitRoom({
  meetingCode,
  accessToken,
  enabled,
  initialMicEnabled,
  initialCamEnabled,
}: UseLiveKitRoomOptions) {
  const roomRef = useRef<Room | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.Disconnected,
  );
  const [participants, setParticipants] = useState<LiveParticipantMedia[]>([]);
  const [micEnabled, setMicEnabled] = useState(initialMicEnabled);
  const [camEnabled, setCamEnabled] = useState(initialCamEnabled);
  const [screenShareEnabled, setScreenShareEnabled] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [isUnconfigured, setIsUnconfigured] = useState(false);

  const syncParticipants = useCallback((room: Room) => {
    const list: LiveParticipantMedia[] = [
      snapshotParticipant(room.localParticipant, true),
      ...Array.from(room.remoteParticipants.values()).map((remote) =>
        snapshotParticipant(remote, false),
      ),
    ];
    setParticipants(list);
    setMicEnabled(room.localParticipant.isMicrophoneEnabled);
    setCamEnabled(room.localParticipant.isCameraEnabled);
    setScreenShareEnabled(room.localParticipant.isScreenShareEnabled);
  }, []);

  const disconnect = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = null;
    if (room) {
      await room.disconnect(true);
    }
    setParticipants([]);
    setConnectionState(ConnectionState.Disconnected);
    setScreenShareEnabled(false);
  }, []);

  const connect = useCallback(async () => {
    if (!enabled || !accessToken || !meetingCode) return;

    setMediaError(null);
    setIsUnconfigured(false);
    setConnectionState(ConnectionState.Connecting);

    try {
      const tokenData = await fetchMeetingToken(accessToken, meetingCode);
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      const handleUpdate = () => syncParticipants(room);

      room
        .on(RoomEvent.ConnectionStateChanged, (state) => {
          setConnectionState(state);
          if (state === ConnectionState.Connected) {
            handleUpdate();
          }
        })
        .on(RoomEvent.ParticipantConnected, handleUpdate)
        .on(RoomEvent.ParticipantDisconnected, handleUpdate)
        .on(RoomEvent.TrackSubscribed, handleUpdate)
        .on(RoomEvent.TrackUnsubscribed, handleUpdate)
        .on(RoomEvent.TrackPublished, handleUpdate)
        .on(RoomEvent.TrackUnpublished, handleUpdate)
        .on(RoomEvent.TrackMuted, handleUpdate)
        .on(RoomEvent.TrackUnmuted, handleUpdate)
        .on(RoomEvent.LocalTrackPublished, handleUpdate)
        .on(RoomEvent.LocalTrackUnpublished, handleUpdate)
        .on(RoomEvent.ActiveSpeakersChanged, handleUpdate)
        .on(RoomEvent.Disconnected, () => {
          setConnectionState(ConnectionState.Disconnected);
          setParticipants([]);
          setScreenShareEnabled(false);
        });

      roomRef.current = room;
      await room.connect(tokenData.url, tokenData.token);
      syncParticipants(room);

      // Publish initial mic & camera according to lobby selection (best-effort if hardware denied)
      if (initialMicEnabled) {
        await room.localParticipant.setMicrophoneEnabled(true).catch(() => {
          setMediaError('Microphone permission denied or unavailable.');
        });
      }
      if (initialCamEnabled) {
        await room.localParticipant.setCameraEnabled(true).catch(() => {
          setMediaError('Camera permission denied or unavailable.');
        });
      }
      syncParticipants(room);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to connect to live video.';
      setConnectionState(ConnectionState.Disconnected);
      if (msg.toLowerCase().includes('livekit sfu is not configured')) {
        setIsUnconfigured(true);
      } else {
        setMediaError(msg);
      }
    }
  }, [enabled, accessToken, meetingCode, initialMicEnabled, initialCamEnabled, syncParticipants]);

  useEffect(() => {
    if (!enabled) return;
    void connect();
    return () => {
      void disconnect();
    };
  }, [enabled, connect, disconnect]);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) {
      setMicEnabled((prev) => !prev);
      return;
    }
    setMediaError(null);
    try {
      const next = !room.localParticipant.isMicrophoneEnabled;
      await room.localParticipant.setMicrophoneEnabled(next);
      syncParticipants(room);
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : 'Unable to toggle microphone.');
    }
  }, [syncParticipants]);

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) {
      setCamEnabled((prev) => !prev);
      return;
    }
    setMediaError(null);
    try {
      const next = !room.localParticipant.isCameraEnabled;
      await room.localParticipant.setCameraEnabled(next);
      syncParticipants(room);
    } catch (err) {
      setMediaError(err instanceof Error ? err.message : 'Unable to toggle camera.');
    }
  }, [syncParticipants]);

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) {
      setMediaError('Connect LiveKit SFU first to share your screen.');
      return;
    }
    setMediaError(null);
    try {
      const next = !room.localParticipant.isScreenShareEnabled;
      await room.localParticipant.setScreenShareEnabled(next, { audio: true });
      syncParticipants(room);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to share screen.';
      if (!msg.toLowerCase().includes('permission') && !msg.toLowerCase().includes('cancel')) {
        setMediaError(msg);
      }
      syncParticipants(room);
    }
  }, [syncParticipants]);

  return {
    connectionState,
    participants,
    micEnabled,
    camEnabled,
    screenShareEnabled,
    mediaError,
    isUnconfigured,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
    disconnect,
    reconnect: connect,
  };
}
