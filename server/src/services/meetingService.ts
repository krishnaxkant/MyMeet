import crypto from 'node:crypto';
import {
  createLiveKitToken,
  deleteLiveKitRoom,
  disconnectLiveKitParticipant,
  isLiveKitConfigured,
  type MeetingTokenResult,
} from '../config/livekit.js';
import { getSupabaseAdmin } from '../config/supabase.js';
import type { AuthenticatedUser } from '../middleware/authMiddleware.js';
import { getOrCreateProfile } from './profileService.js';

export type MeetingStatus = 'scheduled' | 'active' | 'ended';
export type ParticipantRole = 'host' | 'co_host' | 'participant';
export type ParticipantStatus = 'waiting' | 'joined' | 'left' | 'removed';

export class HttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'HttpError';
  }
}

interface MeetingRow {
  id: string;
  code: string;
  title: string;
  host_id: string;
  status: MeetingStatus;
  waiting_room_enabled: boolean;
  is_locked: boolean;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ParticipantRow {
  id: string;
  meeting_id: string;
  user_id: string;
  role: ParticipantRole;
  status: ParticipantStatus;
  joined_at: string;
  left_at: string | null;
}

interface ProfileMini {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface MeetingParticipantInfo extends ParticipantRow {
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

export interface MeetingSummary {
  id: string;
  code: string;
  title: string;
  host_id: string;
  host_name: string | null;
  host_email: string | null;
  status: MeetingStatus;
  waiting_room_enabled: boolean;
  is_locked: boolean;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  joined_count: number;
  my_role: ParticipantRole | null;
  my_status: ParticipantStatus | null;
}

export interface MeetingDetail extends MeetingSummary {
  participants: MeetingParticipantInfo[];
  is_host: boolean;
}

// Unambiguous 32-char Crockford-like alphabet (no 0/O, 1/I/L)
// 12 chars = 32^12 = 2^60 (~1.15 quintillion) possible codes -> unguessable
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789z';
const CODE_CLEAN_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export function generateMeetingCode(): string {
  const bytes = crypto.randomBytes(12);
  let raw = '';
  for (let i = 0; i < 12; i += 1) {
    raw += CODE_CLEAN_ALPHABET[bytes[i] % CODE_CLEAN_ALPHABET.length];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

// Unused reference kept off; validate & normalize codes cleanly
void CODE_ALPHABET;

export function normalizeMeetingCode(rawInput: string): string {
  let cleaned = rawInput.trim();

  // Support pasting full meeting URLs like http://localhost:5173/meet/abcd-efgh-ijkl
  const urlMatch = cleaned.match(/\/meet\/([a-zA-Z0-9-]+)/i);
  if (urlMatch?.[1]) {
    cleaned = urlMatch[1];
  }

  const alnum = cleaned.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (alnum.length === 12) {
    return `${alnum.slice(0, 4)}-${alnum.slice(4, 8)}-${alnum.slice(8, 12)}`;
  }

  return cleaned.toLowerCase();
}

function requireSupabase() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new HttpError(503, 'Supabase is not configured on the backend.');
  }
  return supabase;
}

async function fetchProfilesMap(userIds: string[]): Promise<Map<string, ProfileMini>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  const map = new Map<string, ProfileMini>();
  if (uniqueIds.length === 0) return map;

  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url')
    .in('id', uniqueIds);

  if (error) {
    throw new HttpError(500, `Failed to load participant profiles: ${error.message}`);
  }

  for (const row of (data ?? []) as ProfileMini[]) {
    map.set(row.id, row);
  }
  return map;
}

async function fetchMeetingRowByCode(rawCode: string): Promise<MeetingRow> {
  const code = normalizeMeetingCode(rawCode);
  if (!code || code.length < 4) {
    throw new HttpError(400, 'Please enter a valid meeting code.');
  }

  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .eq('code', code)
    .maybeSingle<MeetingRow>();

  if (error) {
    throw new HttpError(500, `Failed to look up meeting: ${error.message}`);
  }

  if (!data) {
    throw new HttpError(404, 'Meeting not found. Check the code and try again.');
  }

  return data;
}

async function buildMeetingDetail(meeting: MeetingRow, viewerId: string): Promise<MeetingDetail> {
  const supabase = requireSupabase();
  const { data: participantRows, error } = await supabase
    .from('meeting_participants')
    .select('id, meeting_id, user_id, role, status, joined_at, left_at')
    .eq('meeting_id', meeting.id)
    .order('joined_at', { ascending: true });

  if (error) {
    throw new HttpError(500, `Failed to load meeting participants: ${error.message}`);
  }

  const rows = (participantRows ?? []) as ParticipantRow[];
  const myRow = rows.find((r) => r.user_id === viewerId) ?? null;
  const isHost = meeting.host_id === viewerId;
  const canSeeRoster = isHost || myRow?.status === 'joined';

  const profileIds = [meeting.host_id, ...(canSeeRoster ? rows.map((r) => r.user_id) : [])];
  const profilesMap = await fetchProfilesMap(profileIds);
  const hostProfile = profilesMap.get(meeting.host_id);

  const joinedCount = rows.filter((r) => r.status === 'joined').length;

  const participants: MeetingParticipantInfo[] = canSeeRoster
    ? rows
        .filter((r) => r.status === 'joined' || (isHost && r.status === 'waiting'))
        .map((r) => {
          const p = profilesMap.get(r.user_id);
          return {
            ...r,
            full_name: p?.full_name ?? null,
            email: p?.email ?? '',
            avatar_url: p?.avatar_url ?? null,
          };
        })
    : [];

  return {
    id: meeting.id,
    code: meeting.code,
    title: meeting.title,
    host_id: meeting.host_id,
    host_name: hostProfile?.full_name ?? null,
    host_email: hostProfile?.email ?? null,
    status: meeting.status,
    waiting_room_enabled: meeting.waiting_room_enabled,
    is_locked: meeting.is_locked,
    started_at: meeting.started_at,
    ended_at: meeting.ended_at,
    created_at: meeting.created_at,
    joined_count: joinedCount,
    my_role: isHost ? 'host' : myRow?.role ?? null,
    my_status: myRow?.status ?? null,
    is_host: isHost,
    participants,
  };
}

export async function createMeeting(
  user: AuthenticatedUser,
  options: { title?: string; waiting_room_enabled?: boolean },
): Promise<MeetingDetail> {
  const supabase = requireSupabase();
  await getOrCreateProfile(user.id, user.email, user.fullName);

  const title = options.title?.trim() || 'Instant Meeting';
  if (title.length > 120) {
    throw new HttpError(400, 'Meeting title must be 120 characters or fewer.');
  }

  let createdMeeting: MeetingRow | null = null;
  let lastError: string | null = null;

  // Retry code generation in the extremely unlikely case of a collision
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateMeetingCode();
    const { data, error } = await supabase
      .from('meetings')
      .insert({
        code,
        title,
        host_id: user.id,
        status: 'active',
        waiting_room_enabled: Boolean(options.waiting_room_enabled),
        is_locked: false,
        started_at: new Date().toISOString(),
      })
      .select('*')
      .single<MeetingRow>();

    if (!error && data) {
      createdMeeting = data;
      break;
    }

    lastError = error?.message ?? 'Unknown error';
    if (error?.code !== '23505') {
      break;
    }
  }

  if (!createdMeeting) {
    throw new HttpError(500, `Failed to create meeting: ${lastError ?? 'Unknown error'}`);
  }

  const { error: participantError } = await supabase.from('meeting_participants').upsert(
    {
      meeting_id: createdMeeting.id,
      user_id: user.id,
      role: 'host',
      status: 'joined',
      joined_at: new Date().toISOString(),
      left_at: null,
    },
    { onConflict: 'meeting_id,user_id' },
  );

  if (participantError) {
    throw new HttpError(500, `Failed to register host in meeting: ${participantError.message}`);
  }

  return buildMeetingDetail(createdMeeting, user.id);
}

export async function listUserMeetings(userId: string): Promise<MeetingSummary[]> {
  const supabase = requireSupabase();

  const [hostedResult, participantResult] = await Promise.all([
    supabase
      .from('meetings')
      .select('*')
      .eq('host_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('meeting_participants')
      .select('meeting_id, role, status')
      .eq('user_id', userId)
      .order('joined_at', { ascending: false })
      .limit(30),
  ]);

  if (hostedResult.error) {
    throw new HttpError(500, `Failed to load hosted meetings: ${hostedResult.error.message}`);
  }
  if (participantResult.error) {
    throw new HttpError(500, `Failed to load joined meetings: ${participantResult.error.message}`);
  }

  const hostedMeetings = (hostedResult.data ?? []) as MeetingRow[];
  const myParticipations = (participantResult.data ?? []) as Array<{
    meeting_id: string;
    role: ParticipantRole;
    status: ParticipantStatus;
  }>;

  const participationMap = new Map(myParticipations.map((p) => [p.meeting_id, p]));
  const hostedIds = new Set(hostedMeetings.map((m) => m.id));
  const extraMeetingIds = myParticipations
    .map((p) => p.meeting_id)
    .filter((id) => !hostedIds.has(id));

  let extraMeetings: MeetingRow[] = [];
  if (extraMeetingIds.length > 0) {
    const { data, error } = await supabase
      .from('meetings')
      .select('*')
      .in('id', extraMeetingIds);

    if (error) {
      throw new HttpError(500, `Failed to load meeting details: ${error.message}`);
    }
    extraMeetings = (data ?? []) as MeetingRow[];
  }

  const allMeetings = [...hostedMeetings, ...extraMeetings]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20);

  if (allMeetings.length === 0) {
    return [];
  }

  const meetingIds = allMeetings.map((m) => m.id);
  const [profilesMap, countsResult] = await Promise.all([
    fetchProfilesMap(allMeetings.map((m) => m.host_id)),
    supabase
      .from('meeting_participants')
      .select('meeting_id')
      .in('meeting_id', meetingIds)
      .eq('status', 'joined'),
  ]);

  if (countsResult.error) {
    throw new HttpError(500, `Failed to count participants: ${countsResult.error.message}`);
  }

  const joinedCounts = new Map<string, number>();
  for (const row of (countsResult.data ?? []) as Array<{ meeting_id: string }>) {
    joinedCounts.set(row.meeting_id, (joinedCounts.get(row.meeting_id) ?? 0) + 1);
  }

  return allMeetings.map((meeting) => {
    const host = profilesMap.get(meeting.host_id);
    const myPart = participationMap.get(meeting.id);
    const isHost = meeting.host_id === userId;

    return {
      id: meeting.id,
      code: meeting.code,
      title: meeting.title,
      host_id: meeting.host_id,
      host_name: host?.full_name ?? null,
      host_email: host?.email ?? null,
      status: meeting.status,
      waiting_room_enabled: meeting.waiting_room_enabled,
      is_locked: meeting.is_locked,
      started_at: meeting.started_at,
      ended_at: meeting.ended_at,
      created_at: meeting.created_at,
      joined_count: joinedCounts.get(meeting.id) ?? 0,
      my_role: isHost ? 'host' : myPart?.role ?? null,
      my_status: myPart?.status ?? null,
    };
  });
}

export async function getMeetingByCode(rawCode: string, userId: string): Promise<MeetingDetail> {
  const meeting = await fetchMeetingRowByCode(rawCode);
  return buildMeetingDetail(meeting, userId);
}

export async function joinMeeting(
  rawCode: string,
  user: AuthenticatedUser,
): Promise<MeetingDetail> {
  const supabase = requireSupabase();
  await getOrCreateProfile(user.id, user.email, user.fullName);

  const meeting = await fetchMeetingRowByCode(rawCode);
  if (meeting.status === 'ended') {
    throw new HttpError(410, 'This meeting has already ended.');
  }

  const isHost = meeting.host_id === user.id;

  const { data: existingPart, error: existingError } = await supabase
    .from('meeting_participants')
    .select('id, role, status')
    .eq('meeting_id', meeting.id)
    .eq('user_id', user.id)
    .maybeSingle<{ id: string; role: ParticipantRole; status: ParticipantStatus }>();

  if (existingError) {
    throw new HttpError(500, `Failed to check participant status: ${existingError.message}`);
  }

  if (!isHost && existingPart?.status === 'removed') {
    throw new HttpError(403, 'You were removed from this meeting by the host.');
  }

  if (!isHost && meeting.is_locked && existingPart?.status !== 'joined') {
    throw new HttpError(403, 'This meeting is locked by the host.');
  }

  const nextRole: ParticipantRole = isHost ? 'host' : existingPart?.role ?? 'participant';
  const nextStatus: ParticipantStatus = isHost
    ? 'joined'
    : existingPart?.status === 'joined'
      ? 'joined'
      : meeting.waiting_room_enabled
        ? 'waiting'
        : 'joined';

  const { error: upsertError } = await supabase.from('meeting_participants').upsert(
    {
      meeting_id: meeting.id,
      user_id: user.id,
      role: nextRole,
      status: nextStatus,
      joined_at: new Date().toISOString(),
      left_at: null,
    },
    { onConflict: 'meeting_id,user_id' },
  );

  if (upsertError) {
    throw new HttpError(500, `Failed to join meeting: ${upsertError.message}`);
  }

  return buildMeetingDetail(meeting, user.id);
}

export async function leaveMeeting(rawCode: string, userId: string): Promise<void> {
  const supabase = requireSupabase();
  const meeting = await fetchMeetingRowByCode(rawCode);

  const { error } = await supabase
    .from('meeting_participants')
    .update({
      status: 'left',
      left_at: new Date().toISOString(),
    })
    .eq('meeting_id', meeting.id)
    .eq('user_id', userId)
    .in('status', ['joined', 'waiting']);

  if (error) {
    throw new HttpError(500, `Failed to leave meeting: ${error.message}`);
  }
}

export async function updateMeetingSettings(
  rawCode: string,
  hostId: string,
  updates: { title?: string; is_locked?: boolean; waiting_room_enabled?: boolean },
): Promise<MeetingDetail> {
  const supabase = requireSupabase();
  const meeting = await fetchMeetingRowByCode(rawCode);

  if (meeting.host_id !== hostId) {
    throw new HttpError(403, 'Only the meeting host can change meeting settings.');
  }

  if (meeting.status === 'ended') {
    throw new HttpError(410, 'Cannot modify settings of an ended meeting.');
  }

  const patch: Partial<Pick<MeetingRow, 'title' | 'is_locked' | 'waiting_room_enabled'>> = {};

  if (updates.title !== undefined) {
    const trimmed = updates.title.trim();
    if (!trimmed || trimmed.length > 120) {
      throw new HttpError(400, 'Meeting title must be between 1 and 120 characters.');
    }
    patch.title = trimmed;
  }

  if (updates.is_locked !== undefined) {
    patch.is_locked = Boolean(updates.is_locked);
  }

  if (updates.waiting_room_enabled !== undefined) {
    patch.waiting_room_enabled = Boolean(updates.waiting_room_enabled);
  }

  const { data: updated, error } = await supabase
    .from('meetings')
    .update(patch)
    .eq('id', meeting.id)
    .select('*')
    .single<MeetingRow>();

  if (error || !updated) {
    throw new HttpError(500, `Failed to update meeting settings: ${error?.message ?? 'Unknown'}`);
  }

  return buildMeetingDetail(updated, hostId);
}

export async function admitParticipant(
  rawCode: string,
  hostId: string,
  targetUserId: string,
): Promise<MeetingDetail> {
  const supabase = requireSupabase();
  const meeting = await fetchMeetingRowByCode(rawCode);

  if (meeting.host_id !== hostId) {
    throw new HttpError(403, 'Only the meeting host can admit participants.');
  }

  if (meeting.status === 'ended') {
    throw new HttpError(410, 'This meeting has already ended.');
  }

  const { error } = await supabase
    .from('meeting_participants')
    .update({
      status: 'joined',
      joined_at: new Date().toISOString(),
      left_at: null,
    })
    .eq('meeting_id', meeting.id)
    .eq('user_id', targetUserId);

  if (error) {
    throw new HttpError(500, `Failed to admit participant: ${error.message}`);
  }

  return buildMeetingDetail(meeting, hostId);
}

export async function removeParticipant(
  rawCode: string,
  hostId: string,
  targetUserId: string,
): Promise<MeetingDetail> {
  const supabase = requireSupabase();
  const meeting = await fetchMeetingRowByCode(rawCode);

  if (meeting.host_id !== hostId) {
    throw new HttpError(403, 'Only the meeting host can remove participants.');
  }

  if (targetUserId === hostId) {
    throw new HttpError(400, 'The host cannot remove themselves. Use End Meeting instead.');
  }

  const { error } = await supabase
    .from('meeting_participants')
    .update({
      status: 'removed',
      left_at: new Date().toISOString(),
    })
    .eq('meeting_id', meeting.id)
    .eq('user_id', targetUserId);

  if (error) {
    throw new HttpError(500, `Failed to remove participant: ${error.message}`);
  }

  await disconnectLiveKitParticipant(meeting.code, targetUserId);

  return buildMeetingDetail(meeting, hostId);
}

export async function endMeeting(rawCode: string, hostId: string): Promise<MeetingDetail> {
  const supabase = requireSupabase();
  const meeting = await fetchMeetingRowByCode(rawCode);

  if (meeting.host_id !== hostId) {
    throw new HttpError(403, 'Only the meeting host can end the meeting for everyone.');
  }

  const now = new Date().toISOString();

  const { data: endedMeeting, error: meetingError } = await supabase
    .from('meetings')
    .update({
      status: 'ended',
      ended_at: now,
    })
    .eq('id', meeting.id)
    .select('*')
    .single<MeetingRow>();

  if (meetingError || !endedMeeting) {
    throw new HttpError(500, `Failed to end meeting: ${meetingError?.message ?? 'Unknown'}`);
  }

  const { error: partError } = await supabase
    .from('meeting_participants')
    .update({
      status: 'left',
      left_at: now,
    })
    .eq('meeting_id', meeting.id)
    .in('status', ['joined', 'waiting']);

  if (partError) {
    throw new HttpError(500, `Failed to update participants on end: ${partError.message}`);
  }

  await deleteLiveKitRoom(meeting.code);

  return buildMeetingDetail(endedMeeting, hostId);
}

export async function issueMeetingMediaToken(
  rawCode: string,
  user: AuthenticatedUser,
): Promise<MeetingTokenResult> {
  if (!isLiveKitConfigured()) {
    throw new HttpError(
      503,
      'LiveKit SFU is not configured yet. Add LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET to .env.',
    );
  }

  const supabase = requireSupabase();
  const meeting = await fetchMeetingRowByCode(rawCode);

  if (meeting.status === 'ended') {
    throw new HttpError(410, 'This meeting has already ended.');
  }

  const isHost = meeting.host_id === user.id;

  if (!isHost) {
    const { data: part, error } = await supabase
      .from('meeting_participants')
      .select('status')
      .eq('meeting_id', meeting.id)
      .eq('user_id', user.id)
      .maybeSingle<{ status: ParticipantStatus }>();

    if (error) {
      throw new HttpError(500, `Failed to verify participant access: ${error.message}`);
    }

    if (part?.status !== 'joined') {
      throw new HttpError(
        403,
        part?.status === 'waiting'
          ? 'Waiting for the host to admit you before connecting media.'
          : 'You must join the meeting before connecting audio or video.',
      );
    }
  }

  const profile = await getOrCreateProfile(user.id, user.email, user.fullName);
  const displayName = profile.full_name || user.fullName || user.email || 'Meet Participant';

  return createLiveKitToken({
    roomName: meeting.code,
    identity: user.id,
    name: displayName,
    isHost,
  });
}
