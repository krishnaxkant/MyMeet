import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { env } from './env.js';

export type LiveKitStatus = 'configured' | 'not_configured';

export interface LiveKitHealthResult {
  status: LiveKitStatus;
  message: string;
}

export interface MeetingTokenResult {
  token: string;
  url: string;
  roomName: string;
  identity: string;
  name: string;
  expiresInSeconds: number;
}

const TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes (short-lived token per security design)

const isPlaceholder = (value: string): boolean => {
  return (
    !value ||
    value.includes('your-project') ||
    value.includes('your-livekit-') ||
    value.trim().length === 0
  );
};

export const isLiveKitConfigured = (): boolean => {
  return (
    !isPlaceholder(env.livekitUrl) &&
    !isPlaceholder(env.livekitApiKey) &&
    !isPlaceholder(env.livekitApiSecret)
  );
};

export const getLiveKitHealth = (): LiveKitHealthResult => {
  if (!isLiveKitConfigured()) {
    return {
      status: 'not_configured',
      message: 'Add LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET to .env for live video.',
    };
  }

  return {
    status: 'configured',
    message: 'LiveKit SFU credentials configured.',
  };
};

let roomServiceClient: RoomServiceClient | null = null;

function getRoomServiceClient(): RoomServiceClient | null {
  if (!isLiveKitConfigured()) return null;
  if (!roomServiceClient) {
    // RoomServiceClient uses https:// (converts wss:// -> https:// automatically if needed)
    const httpUrl = env.livekitUrl.replace(/^wss:\/\//i, 'https://').replace(/^ws:\/\//i, 'http://');
    roomServiceClient = new RoomServiceClient(httpUrl, env.livekitApiKey, env.livekitApiSecret);
  }
  return roomServiceClient;
}

export async function createLiveKitToken(params: {
  roomName: string;
  identity: string;
  name: string;
  isHost: boolean;
}): Promise<MeetingTokenResult> {
  const token = new AccessToken(env.livekitApiKey, env.livekitApiSecret, {
    identity: params.identity,
    name: params.name,
    ttl: TOKEN_TTL_SECONDS,
    metadata: JSON.stringify({ role: params.isHost ? 'host' : 'participant' }),
  });

  token.addGrant({
    room: params.roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    roomAdmin: params.isHost,
  });

  const jwt = await token.toJwt();

  return {
    token: jwt,
    url: env.livekitUrl,
    roomName: params.roomName,
    identity: params.identity,
    name: params.name,
    expiresInSeconds: TOKEN_TTL_SECONDS,
  };
}

export async function disconnectLiveKitParticipant(
  roomName: string,
  identity: string,
): Promise<void> {
  const client = getRoomServiceClient();
  if (!client) return;
  try {
    await client.removeParticipant(roomName, identity);
  } catch {
    // Best effort: participant or room may not be connected to LiveKit yet
  }
}

export async function deleteLiveKitRoom(roomName: string): Promise<void> {
  const client = getRoomServiceClient();
  if (!client) return;
  try {
    await client.deleteRoom(roomName);
  } catch {
    // Best effort: LiveKit room may not exist if no one published media yet
  }
}

export async function muteLiveKitParticipantAudio(
  roomName: string,
  identity: string,
): Promise<{ mutedTracks: number }> {
  const client = getRoomServiceClient();
  if (!client) {
    return { mutedTracks: 0 };
  }

  try {
    const participant = await client.getParticipant(roomName, identity);
    const audioTracks = (participant.tracks ?? []).filter(
      (track) => track.type === 0 || String(track.type).toUpperCase() === 'AUDIO',
    );

    let mutedTracks = 0;
    for (const track of audioTracks) {
      if (track.sid && !track.muted) {
        await client.mutePublishedTrack(roomName, identity, track.sid, true);
        mutedTracks += 1;
      }
    }
    return { mutedTracks };
  } catch {
    // Participant may not be connected to LiveKit SFU yet
    return { mutedTracks: 0 };
  }
}
