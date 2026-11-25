import { useEffect, useRef } from 'react';
import type { LocalTrack, RemoteTrack } from 'livekit-client';
import { MicOffIcon } from './Icons';

export type VideoEffectMode = 'none' | 'blur' | 'warm' | 'studio' | 'dim';

interface VideoTileProps {
  name: string;
  isLocal?: boolean;
  isHost?: boolean;
  isSpeaking?: boolean;
  micEnabled?: boolean;
  videoTrack?: LocalTrack | RemoteTrack | null;
  audioTrack?: LocalTrack | RemoteTrack | null;
  speakerMuted?: boolean;
  isScreenShare?: boolean;
  videoEffect?: VideoEffectMode;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'M';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function VideoTile({
  name,
  isLocal = false,
  isHost = false,
  isSpeaking = false,
  micEnabled = true,
  videoTrack = null,
  audioTrack = null,
  speakerMuted = false,
  isScreenShare = false,
  videoEffect = 'none',
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !videoTrack) return;
    videoTrack.attach(el);
    return () => {
      videoTrack.detach(el);
    };
  }, [videoTrack]);

  // Attach remote audio tracks for playback (never play back own local mic to avoid echo!)
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !audioTrack || isLocal) return;
    audioTrack.attach(el);
    return () => {
      audioTrack.detach(el);
    };
  }, [audioTrack, isLocal]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = speakerMuted;
    }
  }, [speakerMuted]);

  return (
    <div
      className={[
        'video-tile',
        isLocal ? 'video-tile-me' : '',
        isSpeaking ? 'video-tile-speaking' : '',
        isScreenShare ? 'video-tile-screen' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {videoTrack ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={[
            'video-stream',
            isLocal && !isScreenShare ? 'video-stream-mirrored' : '',
            isScreenShare ? 'video-stream-contain' : '',
            isLocal && !isScreenShare && videoEffect !== 'none' ? `video-fx-${videoEffect}` : '',
          ]
            .filter(Boolean)
            .join(' ')}
        />
      ) : (
        <div className="avatar-circle avatar-circle-lg">{getInitials(name)}</div>
      )}

      {!isLocal && audioTrack && <audio ref={audioRef} autoPlay />}

      <div className="video-tile-footer">
        <span className="video-tile-name">
          {isScreenShare ? `${name}'s screen` : `${name}${isLocal ? ' (You)' : ''}`}
        </span>
        <div className="video-tile-badges">
          {isHost && !isScreenShare && <span className="badge badge-success">Host</span>}
          {!micEnabled && !isScreenShare && (
            <span className="mic-muted-chip" title="Microphone muted">
              <MicOffIcon size={12} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
