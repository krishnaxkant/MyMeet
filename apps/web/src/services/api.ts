import { supabase } from './supabase';

export interface SupabaseHealthInfo {
  status: 'connected' | 'not_configured' | 'error';
  message: string;
}

export interface LiveKitHealthInfo {
  status: 'configured' | 'not_configured';
  message: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  environment: string;
  timestamp: string;
  uptimeSeconds: number;
  supabase: SupabaseHealthInfo;
  livekit?: LiveKitHealthInfo;
}

export interface MeetingMediaToken {
  token: string;
  url: string;
  roomName: string;
  identity: string;
  name: string;
  expiresInSeconds: number;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateProfilePayload {
  full_name?: string | null;
  avatar_url?: string | null;
}

export type MeetingStatus = 'scheduled' | 'active' | 'ended';
export type ParticipantRole = 'host' | 'co_host' | 'participant';
export type ParticipantStatus = 'waiting' | 'joined' | 'left' | 'removed';

export interface MeetingParticipant {
  id: string;
  meeting_id: string;
  user_id: string;
  role: ParticipantRole;
  status: ParticipantStatus;
  joined_at: string;
  left_at: string | null;
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
  participants: MeetingParticipant[];
  is_host: boolean;
  can_manage: boolean;
}

export interface MeetingMessage {
  id: string;
  meeting_id: string;
  sender_id: string;
  sender_name: string | null;
  sender_email: string;
  sender_avatar_url: string | null;
  content: string;
  created_at: string;
}

export type InvitationStatus = 'pending' | 'accepted' | 'declined';

export interface MeetingInvitation {
  id: string;
  meeting_id: string;
  meeting_code: string;
  meeting_title: string;
  meeting_status: MeetingStatus;
  inviter_id: string;
  inviter_name: string | null;
  inviter_email: string | null;
  invitee_email: string;
  invitee_user_id: string | null;
  status: InvitationStatus;
  created_at: string;
}

export interface ScheduledMeeting {
  id: string;
  meeting_id: string | null;
  meeting_code: string | null;
  meeting_status: MeetingStatus | null;
  host_id: string;
  host_name: string | null;
  host_email: string | null;
  title: string;
  description: string | null;
  scheduled_start: string;
  scheduled_end: string;
  timezone: string;
  is_host: boolean;
  created_at: string;
}

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

export type VisualNoteKind = 'concept' | 'formula' | 'step' | 'example' | 'takeaway';

export interface VisualNoteStep {
  title: string;
  kind: VisualNoteKind;
  body: string;
  formula?: string;
  bullets?: string[];
  show_arrow?: boolean;
  arrow_label?: string;
}

export interface MeetingAiSummary {
  id: string;
  meeting_id: string;
  environment_type: string;
  environment_label: string;
  overview: string;
  detailed_notes_markdown: string;
  key_points: string[];
  action_items: string[];
  sources_summary: {
    transcript_segments?: number;
    screen_captures?: number;
    chat_messages?: number;
    visual_flow?: VisualNoteStep[];
  };
  model_used: string;
  generated_at: string;
  updated_at: string;
}

export interface MeetingHistoryDetail extends MeetingHistoryItem {
  participants: MeetingParticipant[];
  messages: MeetingMessage[];
  ai_summary: MeetingAiSummary | null;
  transcript_count: number;
  screen_note_count: number;
}

export interface UserDevice {
  id: string;
  user_id: string;
  platform: 'android' | 'web' | 'ios';
  push_token: string;
  device_name: string | null;
  last_active_at: string;
  created_at: string;
}

export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(
  /\/$/,
  '',
);

export function extractMeetingCode(input: string): string {
  let cleaned = input.trim();
  const match = cleaned.match(/\/meet\/([a-zA-Z0-9-]+)/i);
  if (match?.[1]) {
    cleaned = match[1];
  }
  const alnum = cleaned.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (alnum.length === 12) {
    return `${alnum.slice(0, 4)}-${alnum.slice(4, 8)}-${alnum.slice(8, 12)}`;
  }
  return cleaned.toLowerCase();
}

export function buildMeetingInviteUrl(code: string): string {
  return `${window.location.origin}/meet/${code}`;
}

async function getFreshAccessToken(fallbackToken: string): Promise<string> {
  if (!supabase) return fallbackToken;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || fallbackToken;
}

async function authFetch<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<T> {
  const sendRequest = async (token: string) =>
    fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        Authorization: `Bearer ${token}`,
        ...(init.headers ?? {}),
      },
    });

  const activeToken = await getFreshAccessToken(accessToken);
  let response = await sendRequest(activeToken);

  // If token expired or was invalidated, try refreshing the session once and retrying
  if (response.status === 401 && supabase) {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session?.access_token) {
      response = await sendRequest(data.session.access_token);
    } else {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      throw new Error('Your session expired. Please sign in again.');
    }
  }

  const payload = (await response.json().catch(() => ({}))) as T & { message?: string };
  if (!response.ok) {
    throw new Error(payload.message || `Request failed (HTTP ${response.status})`);
  }

  return payload;
}

export async function fetchBackendHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/health`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok && response.status !== 503) {
    throw new Error(`Backend responded with HTTP ${response.status}`);
  }

  return (await response.json()) as HealthResponse;
}

export async function fetchProfile(accessToken: string): Promise<UserProfile> {
  const payload = await authFetch<{ profile: UserProfile }>('/api/me', accessToken);
  return payload.profile;
}

export async function updateProfile(
  accessToken: string,
  updates: UpdateProfilePayload,
): Promise<UserProfile> {
  const payload = await authFetch<{ profile: UserProfile }>('/api/me', accessToken, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
  return payload.profile;
}

export async function createMeeting(
  accessToken: string,
  options: { title?: string; waiting_room_enabled?: boolean } = {},
): Promise<MeetingDetail> {
  const payload = await authFetch<{ meeting: MeetingDetail }>('/api/meetings', accessToken, {
    method: 'POST',
    body: JSON.stringify(options),
  });
  return payload.meeting;
}

export async function listMeetings(accessToken: string): Promise<MeetingSummary[]> {
  const payload = await authFetch<{ meetings: MeetingSummary[] }>('/api/meetings', accessToken);
  return payload.meetings;
}

export async function getMeeting(accessToken: string, code: string): Promise<MeetingDetail> {
  const payload = await authFetch<{ meeting: MeetingDetail }>(
    `/api/meetings/${encodeURIComponent(code)}`,
    accessToken,
  );
  return payload.meeting;
}

export async function joinMeeting(accessToken: string, code: string): Promise<MeetingDetail> {
  const payload = await authFetch<{ meeting: MeetingDetail }>(
    `/api/meetings/${encodeURIComponent(code)}/join`,
    accessToken,
    { method: 'POST' },
  );
  return payload.meeting;
}

export async function leaveMeeting(accessToken: string, code: string): Promise<void> {
  await authFetch<{ ok: boolean }>(
    `/api/meetings/${encodeURIComponent(code)}/leave`,
    accessToken,
    { method: 'POST' },
  );
}

export async function updateMeetingSettings(
  accessToken: string,
  code: string,
  updates: { title?: string; is_locked?: boolean; waiting_room_enabled?: boolean },
): Promise<MeetingDetail> {
  const payload = await authFetch<{ meeting: MeetingDetail }>(
    `/api/meetings/${encodeURIComponent(code)}/settings`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify(updates),
    },
  );
  return payload.meeting;
}

export async function admitParticipant(
  accessToken: string,
  code: string,
  userId: string,
): Promise<MeetingDetail> {
  const payload = await authFetch<{ meeting: MeetingDetail }>(
    `/api/meetings/${encodeURIComponent(code)}/participants/${encodeURIComponent(userId)}/admit`,
    accessToken,
    { method: 'POST' },
  );
  return payload.meeting;
}

export async function removeParticipant(
  accessToken: string,
  code: string,
  userId: string,
): Promise<MeetingDetail> {
  const payload = await authFetch<{ meeting: MeetingDetail }>(
    `/api/meetings/${encodeURIComponent(code)}/participants/${encodeURIComponent(userId)}/remove`,
    accessToken,
    { method: 'POST' },
  );
  return payload.meeting;
}

export async function endMeeting(accessToken: string, code: string): Promise<MeetingDetail> {
  const payload = await authFetch<{ meeting: MeetingDetail }>(
    `/api/meetings/${encodeURIComponent(code)}/end`,
    accessToken,
    { method: 'POST' },
  );
  return payload.meeting;
}

export async function fetchMeetingToken(
  accessToken: string,
  code: string,
): Promise<MeetingMediaToken> {
  return authFetch<MeetingMediaToken>(
    `/api/meetings/${encodeURIComponent(code)}/token`,
    accessToken,
    { method: 'POST' },
  );
}

export async function admitAllParticipants(
  accessToken: string,
  code: string,
): Promise<MeetingDetail> {
  const payload = await authFetch<{ meeting: MeetingDetail }>(
    `/api/meetings/${encodeURIComponent(code)}/participants/admit-all`,
    accessToken,
    { method: 'POST' },
  );
  return payload.meeting;
}

export async function updateParticipantRole(
  accessToken: string,
  code: string,
  userId: string,
  role: 'co_host' | 'participant',
): Promise<MeetingDetail> {
  const payload = await authFetch<{ meeting: MeetingDetail }>(
    `/api/meetings/${encodeURIComponent(code)}/participants/${encodeURIComponent(userId)}/role`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    },
  );
  return payload.meeting;
}

export async function muteParticipant(
  accessToken: string,
  code: string,
  userId: string,
): Promise<{ ok: boolean; mutedTracks: number }> {
  return authFetch<{ ok: boolean; mutedTracks: number }>(
    `/api/meetings/${encodeURIComponent(code)}/participants/${encodeURIComponent(userId)}/mute`,
    accessToken,
    { method: 'POST' },
  );
}

export async function listMessages(
  accessToken: string,
  code: string,
): Promise<MeetingMessage[]> {
  const payload = await authFetch<{ messages: MeetingMessage[] }>(
    `/api/meetings/${encodeURIComponent(code)}/messages`,
    accessToken,
  );
  return payload.messages;
}

export async function sendMessage(
  accessToken: string,
  code: string,
  content: string,
): Promise<MeetingMessage> {
  const payload = await authFetch<{ message: MeetingMessage }>(
    `/api/meetings/${encodeURIComponent(code)}/messages`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({ content }),
    },
  );
  return payload.message;
}

export interface EmailDeliveryResult {
  sent: boolean;
  status: 'sent' | 'not_configured' | 'failed';
  message: string;
}

export async function sendInvitation(
  accessToken: string,
  code: string,
  email: string,
): Promise<{ invitation: MeetingInvitation; emailDelivery?: EmailDeliveryResult }> {
  return authFetch<{ invitation: MeetingInvitation; emailDelivery?: EmailDeliveryResult }>(
    `/api/meetings/${encodeURIComponent(code)}/invitations`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({ email }),
    },
  );
}

export async function listMeetingInvitations(
  accessToken: string,
  code: string,
): Promise<MeetingInvitation[]> {
  const payload = await authFetch<{ invitations: MeetingInvitation[] }>(
    `/api/meetings/${encodeURIComponent(code)}/invitations`,
    accessToken,
  );
  return payload.invitations;
}

export async function listMyInvitations(accessToken: string): Promise<MeetingInvitation[]> {
  const payload = await authFetch<{ invitations: MeetingInvitation[] }>(
    '/api/invitations',
    accessToken,
  );
  return payload.invitations;
}

export async function respondToInvitation(
  accessToken: string,
  invitationId: string,
  action: 'accepted' | 'declined',
): Promise<MeetingInvitation> {
  const payload = await authFetch<{ invitation: MeetingInvitation }>(
    `/api/invitations/${encodeURIComponent(invitationId)}/respond`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({ action }),
    },
  );
  return payload.invitation;
}

export async function listSchedules(accessToken: string): Promise<ScheduledMeeting[]> {
  const payload = await authFetch<{ schedules: ScheduledMeeting[] }>('/api/schedules', accessToken);
  return payload.schedules;
}

export async function createSchedule(
  accessToken: string,
  input: {
    title: string;
    description?: string;
    scheduled_start: string;
    scheduled_end: string;
    timezone: string;
    waiting_room_enabled?: boolean;
    invite_emails?: string[];
  },
): Promise<{ schedule: ScheduledMeeting; invitedCount: number }> {
  return authFetch<{ schedule: ScheduledMeeting; invitedCount: number }>(
    '/api/schedules',
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export async function startSchedule(
  accessToken: string,
  scheduleId: string,
): Promise<ScheduledMeeting> {
  const payload = await authFetch<{ schedule: ScheduledMeeting }>(
    `/api/schedules/${encodeURIComponent(scheduleId)}/start`,
    accessToken,
    { method: 'POST' },
  );
  return payload.schedule;
}

export async function deleteSchedule(accessToken: string, scheduleId: string): Promise<void> {
  await authFetch<{ ok: boolean }>(
    `/api/schedules/${encodeURIComponent(scheduleId)}`,
    accessToken,
    { method: 'DELETE' },
  );
}

export async function listHistory(accessToken: string): Promise<MeetingHistoryItem[]> {
  const payload = await authFetch<{ history: MeetingHistoryItem[] }>('/api/history', accessToken);
  return payload.history;
}

export async function getHistoryDetail(
  accessToken: string,
  code: string,
): Promise<MeetingHistoryDetail> {
  const payload = await authFetch<{ detail: MeetingHistoryDetail }>(
    `/api/history/${encodeURIComponent(code)}`,
    accessToken,
  );
  return payload.detail;
}

export async function listDevices(accessToken: string): Promise<UserDevice[]> {
  const payload = await authFetch<{ devices: UserDevice[] }>('/api/devices', accessToken);
  return payload.devices;
}

export async function registerDevice(
  accessToken: string,
  input: { platform: 'android' | 'web' | 'ios'; push_token: string; device_name?: string },
): Promise<UserDevice> {
  const payload = await authFetch<{ device: UserDevice }>('/api/devices', accessToken, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return payload.device;
}

export async function deleteDevice(accessToken: string, deviceId: string): Promise<void> {
  await authFetch<{ ok: boolean }>(
    `/api/devices/${encodeURIComponent(deviceId)}`,
    accessToken,
    { method: 'DELETE' },
  );
}

export async function recordMeetingTranscript(
  accessToken: string,
  code: string,
  content: string,
  speakerName?: string,
): Promise<{ ok: boolean; skipped?: boolean }> {
  return authFetch<{ ok: boolean; skipped?: boolean }>(
    `/api/meetings/${encodeURIComponent(code)}/ai/transcript`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({ content, speaker_name: speakerName }),
    },
  );
}

export async function transcribeAudioChunk(
  accessToken: string,
  code: string,
  audioBase64: string,
  mimeType: string,
  speakerName?: string,
): Promise<{ saved: boolean; skipped: boolean; usedAi: boolean; text?: string }> {
  return authFetch<{ saved: boolean; skipped: boolean; usedAi: boolean; text?: string }>(
    `/api/meetings/${encodeURIComponent(code)}/ai/audio-chunk`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        audio_base64: audioBase64,
        mime_type: mimeType,
        speaker_name: speakerName,
      }),
    },
  );
}

export async function analyzeScreenFrame(
  accessToken: string,
  code: string,
  imageBase64: string,
  sharerName?: string,
): Promise<{ extractedText: string; usedAi: boolean }> {
  return authFetch<{ extractedText: string; usedAi: boolean }>(
    `/api/meetings/${encodeURIComponent(code)}/ai/screen-frame`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        image_base64: imageBase64,
        mime_type: 'image/jpeg',
        sharer_name: sharerName,
      }),
    },
  );
}

export async function generateAiSummary(
  accessToken: string,
  code: string,
): Promise<MeetingAiSummary> {
  const payload = await authFetch<{ summary: MeetingAiSummary }>(
    `/api/meetings/${encodeURIComponent(code)}/ai/summary`,
    accessToken,
    { method: 'POST' },
  );
  return payload.summary;
}
