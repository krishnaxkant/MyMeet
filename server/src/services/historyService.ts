import { getSupabaseAdmin } from '../config/supabase.js';
import type { MeetingMessageInfo } from './chatService.js';
import {
  HttpError,
  normalizeMeetingCode,
  type MeetingParticipantInfo,
  type MeetingStatus,
  type ParticipantRole,
  type ParticipantStatus,
} from './meetingService.js';

export interface MeetingHistoryItem {
  id: string;
  code: string;
  title: string;
  status: MeetingStatus;
  host_id: string;
  host_name: string | null;
  host_email: string | null;
  my_role: ParticipantRole;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  duration_seconds: number;
  participant_count: number;
  message_count: number;
}

export interface MeetingHistoryDetail extends MeetingHistoryItem {
  participants: MeetingParticipantInfo[];
  messages: MeetingMessageInfo[];
}

interface MeetingRow {
  id: string;
  code: string;
  title: string;
  host_id: string;
  status: MeetingStatus;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
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

interface MessageRow {
  id: string;
  meeting_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

interface ProfileMini {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

function requireSupabase() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new HttpError(503, 'Supabase is not configured on the backend.');
  }
  return supabase;
}

function computeDurationSeconds(meeting: MeetingRow): number {
  if (!meeting.started_at) return 0;
  const startMs = new Date(meeting.started_at).getTime();
  const endMs = meeting.ended_at ? new Date(meeting.ended_at).getTime() : Date.now();
  return Math.max(0, Math.round((endMs - startMs) / 1000));
}

export async function listMeetingHistory(userId: string): Promise<MeetingHistoryItem[]> {
  const supabase = requireSupabase();

  const [hostedRes, partRes] = await Promise.all([
    supabase
      .from('meetings')
      .select('id, code, title, host_id, status, started_at, ended_at, created_at')
      .eq('host_id', userId)
      .order('created_at', { ascending: false })
      .limit(40),
    supabase
      .from('meeting_participants')
      .select('meeting_id, role')
      .eq('user_id', userId)
      .limit(50),
  ]);

  if (hostedRes.error) {
    throw new HttpError(500, `Failed to load meeting history: ${hostedRes.error.message}`);
  }
  if (partRes.error) {
    throw new HttpError(500, `Failed to load participated meetings: ${partRes.error.message}`);
  }

  const hosted = (hostedRes.data ?? []) as MeetingRow[];
  const partMap = new Map(
    ((partRes.data ?? []) as Array<{ meeting_id: string; role: ParticipantRole }>).map((p) => [
      p.meeting_id,
      p.role,
    ]),
  );

  const hostedIds = new Set(hosted.map((m) => m.id));
  const extraIds = Array.from(partMap.keys()).filter((id) => !hostedIds.has(id));

  let extra: MeetingRow[] = [];
  if (extraIds.length > 0) {
    const { data, error } = await supabase
      .from('meetings')
      .select('id, code, title, host_id, status, started_at, ended_at, created_at')
      .in('id', extraIds);
    if (!error && data) {
      extra = data as MeetingRow[];
    }
  }

  const allMeetings = [...hosted, ...extra]
    .filter((m) => m.status !== 'scheduled')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 40);

  if (allMeetings.length === 0) return [];

  const meetingIds = allMeetings.map((m) => m.id);
  const hostIds = Array.from(new Set(allMeetings.map((m) => m.host_id)));

  const [profilesRes, allPartsRes, allMsgsRes] = await Promise.all([
    supabase.from('profiles').select('id, email, full_name, avatar_url').in('id', hostIds),
    supabase.from('meeting_participants').select('meeting_id').in('meeting_id', meetingIds),
    supabase.from('meeting_messages').select('meeting_id').in('meeting_id', meetingIds),
  ]);

  const hostMap = new Map<string, ProfileMini>();
  for (const p of (profilesRes.data ?? []) as ProfileMini[]) {
    hostMap.set(p.id, p);
  }

  const partCounts = new Map<string, number>();
  for (const row of (allPartsRes.data ?? []) as Array<{ meeting_id: string }>) {
    partCounts.set(row.meeting_id, (partCounts.get(row.meeting_id) ?? 0) + 1);
  }

  const msgCounts = new Map<string, number>();
  for (const row of (allMsgsRes.data ?? []) as Array<{ meeting_id: string }>) {
    msgCounts.set(row.meeting_id, (msgCounts.get(row.meeting_id) ?? 0) + 1);
  }

  return allMeetings.map((meeting) => {
    const host = hostMap.get(meeting.host_id);
    const isHost = meeting.host_id === userId;
    return {
      id: meeting.id,
      code: meeting.code,
      title: meeting.title,
      status: meeting.status,
      host_id: meeting.host_id,
      host_name: host?.full_name ?? null,
      host_email: host?.email ?? null,
      my_role: isHost ? 'host' : partMap.get(meeting.id) ?? 'participant',
      started_at: meeting.started_at,
      ended_at: meeting.ended_at,
      created_at: meeting.created_at,
      duration_seconds: computeDurationSeconds(meeting),
      participant_count: partCounts.get(meeting.id) ?? 0,
      message_count: msgCounts.get(meeting.id) ?? 0,
    };
  });
}

export async function getMeetingHistoryDetail(
  rawCode: string,
  userId: string,
): Promise<MeetingHistoryDetail> {
  const code = normalizeMeetingCode(rawCode);
  const supabase = requireSupabase();

  const { data: meeting, error: meetingErr } = await supabase
    .from('meetings')
    .select('id, code, title, host_id, status, started_at, ended_at, created_at')
    .eq('code', code)
    .maybeSingle<MeetingRow>();

  if (meetingErr) {
    throw new HttpError(500, `Failed to load meeting: ${meetingErr.message}`);
  }
  if (!meeting) {
    throw new HttpError(404, 'Meeting history record not found.');
  }

  const [partsRes, msgsRes] = await Promise.all([
    supabase
      .from('meeting_participants')
      .select('id, meeting_id, user_id, role, status, joined_at, left_at')
      .eq('meeting_id', meeting.id)
      .order('joined_at', { ascending: true }),
    supabase
      .from('meeting_messages')
      .select('id, meeting_id, sender_id, content, created_at')
      .eq('meeting_id', meeting.id)
      .order('created_at', { ascending: true })
      .limit(300),
  ]);

  if (partsRes.error) {
    throw new HttpError(500, `Failed to load participants: ${partsRes.error.message}`);
  }
  if (msgsRes.error) {
    throw new HttpError(500, `Failed to load chat transcript: ${msgsRes.error.message}`);
  }

  const partRows = (partsRes.data ?? []) as ParticipantRow[];
  const msgRows = (msgsRes.data ?? []) as MessageRow[];

  // Security check: only the host or someone who participated can view history/transcript
  const myPart = partRows.find((p) => p.user_id === userId);
  if (meeting.host_id !== userId && !myPart) {
    throw new HttpError(403, 'You do not have permission to view this meeting history.');
  }

  const profileIds = Array.from(
    new Set([meeting.host_id, ...partRows.map((p) => p.user_id), ...msgRows.map((m) => m.sender_id)]),
  );
  const { data: profilesData } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url')
    .in('id', profileIds);

  const profileMap = new Map<string, ProfileMini>();
  for (const p of (profilesData ?? []) as ProfileMini[]) {
    profileMap.set(p.id, p);
  }

  const host = profileMap.get(meeting.host_id);

  const participants: MeetingParticipantInfo[] = partRows.map((row) => {
    const prof = profileMap.get(row.user_id);
    return {
      ...row,
      full_name: prof?.full_name ?? null,
      email: prof?.email ?? '',
      avatar_url: prof?.avatar_url ?? null,
    };
  });

  const messages: MeetingMessageInfo[] = msgRows.map((row) => {
    const author = profileMap.get(row.sender_id);
    return {
      id: row.id,
      meeting_id: row.meeting_id,
      sender_id: row.sender_id,
      sender_name: author?.full_name ?? null,
      sender_email: author?.email ?? '',
      sender_avatar_url: author?.avatar_url ?? null,
      content: row.content,
      created_at: row.created_at,
    };
  });

  return {
    id: meeting.id,
    code: meeting.code,
    title: meeting.title,
    status: meeting.status,
    host_id: meeting.host_id,
    host_name: host?.full_name ?? null,
    host_email: host?.email ?? null,
    my_role: meeting.host_id === userId ? 'host' : myPart?.role ?? 'participant',
    started_at: meeting.started_at,
    ended_at: meeting.ended_at,
    created_at: meeting.created_at,
    duration_seconds: computeDurationSeconds(meeting),
    participant_count: participants.length,
    message_count: messages.length,
    participants,
    messages,
  };
}
