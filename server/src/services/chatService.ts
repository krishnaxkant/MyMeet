import { getSupabaseAdmin } from '../config/supabase.js';
import type { AuthenticatedUser } from '../middleware/authMiddleware.js';
import { getMeetingByCode, HttpError } from './meetingService.js';
import { getOrCreateProfile } from './profileService.js';

export interface MeetingMessageInfo {
  id: string;
  meeting_id: string;
  sender_id: string;
  sender_name: string | null;
  sender_email: string;
  sender_avatar_url: string | null;
  content: string;
  created_at: string;
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

async function assertChatAccess(rawCode: string, userId: string) {
  const meeting = await getMeetingByCode(rawCode, userId);
  const canAccess = meeting.is_host || meeting.my_status === 'joined';
  if (!canAccess) {
    throw new HttpError(403, 'You must be admitted to this meeting to access in-meeting chat.');
  }
  return meeting;
}

export async function listMeetingMessages(
  rawCode: string,
  userId: string,
): Promise<MeetingMessageInfo[]> {
  const meeting = await assertChatAccess(rawCode, userId);
  const supabase = requireSupabase();

  const { data, error } = await supabase
    .from('meeting_messages')
    .select('id, meeting_id, sender_id, content, created_at')
    .eq('meeting_id', meeting.id)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) {
    throw new HttpError(500, `Failed to load chat messages: ${error.message}`);
  }

  const rows = (data ?? []) as MessageRow[];
  if (rows.length === 0) return [];

  const senderIds = Array.from(new Set(rows.map((r) => r.sender_id)));
  const { data: profilesData, error: profileErr } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url')
    .in('id', senderIds);

  if (profileErr) {
    throw new HttpError(500, `Failed to load message authors: ${profileErr.message}`);
  }

  const profileMap = new Map<string, ProfileMini>();
  for (const p of (profilesData ?? []) as ProfileMini[]) {
    profileMap.set(p.id, p);
  }

  return rows.map((row) => {
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
}

export async function sendMeetingMessage(
  rawCode: string,
  user: AuthenticatedUser,
  rawContent: string,
): Promise<MeetingMessageInfo> {
  const meeting = await assertChatAccess(rawCode, user.id);
  if (meeting.status === 'ended') {
    throw new HttpError(410, 'This meeting has ended. Chat is closed.');
  }

  const content = rawContent.trim();
  if (!content) {
    throw new HttpError(400, 'Message cannot be empty.');
  }
  if (content.length > 2000) {
    throw new HttpError(400, 'Message must be 2000 characters or fewer.');
  }

  const supabase = requireSupabase();
  const profile = await getOrCreateProfile(user.id, user.email, user.fullName);

  const { data, error } = await supabase
    .from('meeting_messages')
    .insert({
      meeting_id: meeting.id,
      sender_id: user.id,
      content,
    })
    .select('id, meeting_id, sender_id, content, created_at')
    .single<MessageRow>();

  if (error || !data) {
    throw new HttpError(500, `Failed to send message: ${error?.message ?? 'Unknown error'}`);
  }

  return {
    id: data.id,
    meeting_id: data.meeting_id,
    sender_id: data.sender_id,
    sender_name: profile.full_name,
    sender_email: profile.email,
    sender_avatar_url: profile.avatar_url,
    content: data.content,
    created_at: data.created_at,
  };
}
