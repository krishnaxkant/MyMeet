import Constants from 'expo-constants';
import { Platform } from 'react-native';
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
    regenerate_count?: number;
  };
  model_used: string;
  generated_at: string;
  updated_at: string;
}

export type PlanCode = 'free' | 'single_9' | 'pack_49' | 'pro_monthly_349' | 'pro_yearly_899';
export type PaidPlanCode = Exclude<PlanCode, 'free'>;

export interface PlanDefinition {
  code: PlanCode;
  name: string;
  badge: string | null;
  price_inr: number;
  duration_days: number | null;
  credits: number | null;
  is_unlimited: boolean;
  mcq_enabled: boolean;
  tagline: string;
  highlights: string[];
}

export interface UserSubscriptionStatus {
  plan_code: PlanCode;
  plan_name: string;
  is_pro: boolean;
  is_unlimited: boolean;
  mcq_enabled: boolean;
  credits_remaining: number;
  credits_total: number;
  started_at: string | null;
  expires_at: string | null;
  is_expired: boolean;
  razorpay_live: boolean;
}

export interface ProNoteDeepSection {
  title: string;
  kind: 'concept' | 'code' | 'derivation' | 'example' | 'decision';
  explanation: string;
  code_or_formula?: string;
  bullets?: string[];
  worked_example?: string;
}

export interface ProComparisonTable {
  title?: string;
  headers: string[];
  rows: string[][];
}

export interface ProExamTrap {
  trap: string;
  fix: string;
}

export interface MeetingProNotes {
  id: string;
  meeting_id: string;
  user_id: string;
  unlock_source: string;
  environment_label: string;
  pro_overview: string;
  deep_sections: ProNoteDeepSection[];
  comparison_table: ProComparisonTable | null;
  exam_traps: ProExamTrap[];
  cheat_sheet: string[];
  pro_markdown: string;
  model_used: string;
  created_at: string;
}

export interface SessionMcqQuestion {
  id: string;
  question: string;
  options: [string, string, string, string];
  correct_index: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  concept: string;
}

export interface MeetingMcqQuiz {
  id: string;
  meeting_id: string;
  topic_label: string;
  questions: SessionMcqQuestion[];
  model_used: string;
  created_at: string;
}

export interface MeetingHistoryDetail extends MeetingHistoryItem {
  participants: MeetingParticipant[];
  messages: MeetingMessage[];
  ai_summary: MeetingAiSummary | null;
  pro_notes?: MeetingProNotes | null;
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

function isEmulatorOrLoopbackUrl(url: string): boolean {
  return (
    url.includes('://10.0.2.2') ||
    url.includes('://localhost') ||
    url.includes('://127.0.0.1')
  );
}

function sanitizeUrl(raw: string): string {
  const trimmed = raw.trim();
  // Guard against accidental double-paste like "https://a.comhttps://a.com"
  const secondHttp = trimmed.indexOf('http', 8);
  const single = secondHttp > 0 ? trimmed.slice(0, secondHttp) : trimmed;
  return single.replace(/\/+$/, '');
}

function resolveApiBaseUrl(): string {
  const extraApiUrl = ((Constants.expoConfig?.extra ?? {}) as { apiUrl?: string }).apiUrl?.trim();
  const rawConfigured = process.env.EXPO_PUBLIC_API_URL?.trim() || extraApiUrl;
  const configured = rawConfigured ? sanitizeUrl(rawConfigured) : '';

  if (configured && !isEmulatorOrLoopbackUrl(configured)) {
    return configured;
  }

  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as unknown as { manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } } })
      .manifest2?.extra?.expoGo?.debuggerHost;

  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:4000`;
    }
  }

  if (configured) {
    return configured.replace(/\/$/, '');
  }

  return Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
}

export const API_BASE_URL = resolveApiBaseUrl();

export const WEB_APP_URL = sanitizeUrl(
  process.env.EXPO_PUBLIC_WEB_URL?.trim() ||
    ((Constants.expoConfig?.extra ?? {}) as { webUrl?: string }).webUrl?.trim() ||
    'https://mymeet-live.vercel.app',
);

export function buildMeetingInviteUrl(code: string): string {
  return `${WEB_APP_URL}/meet/${encodeURIComponent(code)}`;
}

export function buildMeetingShareMessage(title: string, code: string): string {
  const link = buildMeetingInviteUrl(code);
  return `Join my MyMeet call "${title}"\n\nJoin Link: ${link}\nMeeting Code: ${code}`;
}

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

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 15000) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (err) {
      lastError = err;
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  const msg = lastError instanceof Error ? lastError.message : 'Network error';
  throw new Error(`${msg} (${API_BASE_URL})`);
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
    fetchWithTimeout(`${API_BASE_URL}${path}`, {
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
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/health`, {
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

export async function getBillingStatus(
  accessToken: string,
): Promise<{ subscription: UserSubscriptionStatus; plans: PlanDefinition[] }> {
  return authFetch<{ subscription: UserSubscriptionStatus; plans: PlanDefinition[] }>(
    '/api/billing/status',
    accessToken,
  );
}

export async function createBillingOrder(
  accessToken: string,
  planCode: PaidPlanCode,
  meetingCode?: string,
): Promise<{
  order_id: string;
  provider: 'razorpay' | 'demo';
  razorpay_key_id?: string;
  razorpay_order_id?: string;
  amount_paise: number;
  amount_inr: number;
  currency: 'INR';
  plan: PlanDefinition;
}> {
  const payload = await authFetch<{
    order: {
      order_id: string;
      provider: 'razorpay' | 'demo';
      razorpay_key_id?: string;
      razorpay_order_id?: string;
      amount_paise: number;
      amount_inr: number;
      currency: 'INR';
      plan: PlanDefinition;
    };
  }>('/api/billing/create-order', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      plan_code: planCode,
      ...(meetingCode ? { meeting_code: meetingCode } : {}),
    }),
  });
  return payload.order;
}

export async function verifyBillingPayment(
  accessToken: string,
  input: {
    order_id: string;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  },
): Promise<{
  subscription: UserSubscriptionStatus;
  plan_code: PaidPlanCode;
  meeting_code: string | null;
}> {
  return authFetch('/api/billing/verify-payment', accessToken, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function upgradeMeetingProNotes(
  accessToken: string,
  code: string,
): Promise<{ pro_notes: MeetingProNotes; subscription: UserSubscriptionStatus }> {
  return authFetch<{ pro_notes: MeetingProNotes; subscription: UserSubscriptionStatus }>(
    `/api/meetings/${encodeURIComponent(code)}/ai/pro-notes`,
    accessToken,
    { method: 'POST' },
  );
}

export async function getOrGenerateMeetingMcqs(
  accessToken: string,
  code: string,
): Promise<MeetingMcqQuiz> {
  const payload = await authFetch<{ quiz: MeetingMcqQuiz }>(
    `/api/meetings/${encodeURIComponent(code)}/ai/mcqs`,
    accessToken,
    { method: 'POST' },
  );
  return payload.quiz;
}
