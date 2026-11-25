export type ServiceConnectionStatus = 'connected' | 'not_configured' | 'error';

export interface SupabaseHealthInfo {
  status: ServiceConnectionStatus;
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
