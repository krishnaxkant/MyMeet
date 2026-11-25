import { getSupabaseAdmin } from '../config/supabase.js';
import type { AuthenticatedUser } from '../middleware/authMiddleware.js';
import { sendPushNotificationToUser } from './deviceService.js';
import { sendMeetingInviteEmail, type EmailSendResult } from './emailService.js';
import { getMeetingByCode, HttpError, type MeetingStatus } from './meetingService.js';
import { getOrCreateProfile } from './profileService.js';

export type InvitationStatus = 'pending' | 'accepted' | 'declined';

export interface MeetingInvitationInfo {
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

interface InvitationRow {
  id: string;
  meeting_id: string | null;
  inviter_id: string;
  invitee_email: string;
  invitee_user_id: string | null;
  status: InvitationStatus;
  created_at: string;
}

interface MeetingMini {
  id: string;
  code: string;
  title: string;
  status: MeetingStatus;
}

interface ProfileMini {
  id: string;
  email: string;
  full_name: string | null;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireSupabase() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new HttpError(503, 'Supabase is not configured on the backend.');
  }
  return supabase;
}

async function hydrateInvitations(rows: InvitationRow[]): Promise<MeetingInvitationInfo[]> {
  const validRows = rows.filter((r): r is InvitationRow & { meeting_id: string } =>
    Boolean(r.meeting_id),
  );
  if (validRows.length === 0) return [];

  const supabase = requireSupabase();
  const meetingIds = Array.from(new Set(validRows.map((r) => r.meeting_id)));
  const inviterIds = Array.from(new Set(validRows.map((r) => r.inviter_id)));

  const [meetingsRes, profilesRes] = await Promise.all([
    supabase.from('meetings').select('id, code, title, status').in('id', meetingIds),
    supabase.from('profiles').select('id, email, full_name').in('id', inviterIds),
  ]);

  if (meetingsRes.error) {
    throw new HttpError(500, `Failed to load invited meetings: ${meetingsRes.error.message}`);
  }
  if (profilesRes.error) {
    throw new HttpError(500, `Failed to load inviters: ${profilesRes.error.message}`);
  }

  const meetingMap = new Map<string, MeetingMini>();
  for (const m of (meetingsRes.data ?? []) as MeetingMini[]) {
    meetingMap.set(m.id, m);
  }

  const profileMap = new Map<string, ProfileMini>();
  for (const p of (profilesRes.data ?? []) as ProfileMini[]) {
    profileMap.set(p.id, p);
  }

  return validRows
    .map((row) => {
      const meeting = meetingMap.get(row.meeting_id);
      if (!meeting) return null;
      const inviter = profileMap.get(row.inviter_id);
      return {
        id: row.id,
        meeting_id: row.meeting_id,
        meeting_code: meeting.code,
        meeting_title: meeting.title,
        meeting_status: meeting.status,
        inviter_id: row.inviter_id,
        inviter_name: inviter?.full_name ?? null,
        inviter_email: inviter?.email ?? null,
        invitee_email: row.invitee_email,
        invitee_user_id: row.invitee_user_id,
        status: row.status,
        created_at: row.created_at,
      };
    })
    .filter((item): item is MeetingInvitationInfo => item !== null);
}

export async function createMeetingInvitation(
  rawCode: string,
  inviter: AuthenticatedUser,
  rawEmail: string,
): Promise<{ invitation: MeetingInvitationInfo; emailDelivery: EmailSendResult }> {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_REGEX.test(email)) {
    throw new HttpError(400, 'Please enter a valid email address.');
  }

  if (inviter.email && email === inviter.email.trim().toLowerCase()) {
    throw new HttpError(400, 'You cannot invite yourself.');
  }

  const meeting = await getMeetingByCode(rawCode, inviter.id);
  if (!meeting.can_manage) {
    throw new HttpError(403, 'Only the host or a co-host can send meeting invitations.');
  }
  if (meeting.status === 'ended') {
    throw new HttpError(410, 'Cannot invite participants to an ended meeting.');
  }

  const supabase = requireSupabase();
  const inviterProfile = await getOrCreateProfile(inviter.id, inviter.email, inviter.fullName);
  const inviterDisplayName = inviterProfile.full_name || inviter.email || 'A Meet host';

  // Check if a pending invite already exists for this meeting + email
  const { data: existing, error: existingErr } = await supabase
    .from('meeting_invitations')
    .select('id, meeting_id, inviter_id, invitee_email, invitee_user_id, status, created_at')
    .eq('meeting_id', meeting.id)
    .ilike('invitee_email', email)
    .eq('status', 'pending')
    .maybeSingle<InvitationRow>();

  if (existingErr) {
    throw new HttpError(500, `Failed to check existing invitations: ${existingErr.message}`);
  }

  let invitationInfo: MeetingInvitationInfo | undefined;

  if (existing) {
    const hydrated = await hydrateInvitations([existing]);
    invitationInfo = hydrated[0];
  } else {
    // Link invitee_user_id automatically if they already have a Meet profile
    const { data: inviteeProfile } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', email)
      .maybeSingle<{ id: string }>();

    const { data: created, error: insertErr } = await supabase
      .from('meeting_invitations')
      .insert({
        meeting_id: meeting.id,
        inviter_id: inviter.id,
        invitee_email: email,
        invitee_user_id: inviteeProfile?.id ?? null,
        status: 'pending',
      })
      .select('id, meeting_id, inviter_id, invitee_email, invitee_user_id, status, created_at')
      .single<InvitationRow>();

    if (insertErr || !created) {
      throw new HttpError(
        500,
        `Failed to send invitation: ${insertErr?.message ?? 'Unknown error'}`,
      );
    }

    const hydrated = await hydrateInvitations([created]);
    invitationInfo = hydrated[0];
  }

  const emailDelivery = await sendMeetingInviteEmail({
    to: email,
    inviterName: inviterDisplayName,
    meetingTitle: meeting.title,
    meetingCode: meeting.code,
  });

  if (invitationInfo?.invitee_user_id) {
    void sendPushNotificationToUser(invitationInfo.invitee_user_id, {
      title: `Meeting Invite: ${meeting.title}`,
      body: `${inviterDisplayName} invited you · Code ${meeting.code}`,
      data: { meetingCode: meeting.code },
    });
  }

  return { invitation: invitationInfo, emailDelivery };
}

export async function listMeetingInvitations(
  rawCode: string,
  userId: string,
): Promise<MeetingInvitationInfo[]> {
  const meeting = await getMeetingByCode(rawCode, userId);
  if (!meeting.can_manage) {
    throw new HttpError(403, 'Only the host or a co-host can view sent invitations.');
  }

  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('meeting_invitations')
    .select('id, meeting_id, inviter_id, invitee_email, invitee_user_id, status, created_at')
    .eq('meeting_id', meeting.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    throw new HttpError(500, `Failed to load meeting invitations: ${error.message}`);
  }

  return hydrateInvitations((data ?? []) as InvitationRow[]);
}

export async function listMyIncomingInvitations(
  user: AuthenticatedUser,
): Promise<MeetingInvitationInfo[]> {
  const supabase = requireSupabase();
  const normalizedEmail = user.email.trim().toLowerCase();

  const [byUserRes, byEmailRes] = await Promise.all([
    supabase
      .from('meeting_invitations')
      .select('id, meeting_id, inviter_id, invitee_email, invitee_user_id, status, created_at')
      .eq('invitee_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(25),
    normalizedEmail
      ? supabase
          .from('meeting_invitations')
          .select('id, meeting_id, inviter_id, invitee_email, invitee_user_id, status, created_at')
          .ilike('invitee_email', normalizedEmail)
          .order('created_at', { ascending: false })
          .limit(25)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (byUserRes.error) {
    throw new HttpError(500, `Failed to load invitations: ${byUserRes.error.message}`);
  }
  if (byEmailRes.error) {
    throw new HttpError(500, `Failed to load email invitations: ${byEmailRes.error.message}`);
  }

  const uniqueMap = new Map<string, InvitationRow>();
  for (const row of [...((byUserRes.data ?? []) as InvitationRow[]), ...((byEmailRes.data ?? []) as InvitationRow[])]) {
    uniqueMap.set(row.id, row);
  }

  const sorted = Array.from(uniqueMap.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const hydrated = await hydrateInvitations(sorted);
  // Show pending active invites first, plus recent ones
  return hydrated.filter((inv) => inv.meeting_status !== 'ended' || inv.status !== 'pending');
}

export async function respondToInvitation(
  invitationId: string,
  user: AuthenticatedUser,
  action: 'accepted' | 'declined',
): Promise<MeetingInvitationInfo> {
  const supabase = requireSupabase();

  const { data: existing, error: fetchErr } = await supabase
    .from('meeting_invitations')
    .select('id, meeting_id, inviter_id, invitee_email, invitee_user_id, status, created_at')
    .eq('id', invitationId)
    .maybeSingle<InvitationRow>();

  if (fetchErr) {
    throw new HttpError(500, `Failed to fetch invitation: ${fetchErr.message}`);
  }
  if (!existing) {
    throw new HttpError(404, 'Invitation not found.');
  }

  const emailMatches =
    Boolean(user.email) &&
    existing.invitee_email.trim().toLowerCase() === user.email.trim().toLowerCase();
  const idMatches = existing.invitee_user_id === user.id;

  if (!idMatches && !emailMatches) {
    throw new HttpError(403, 'You are not the recipient of this invitation.');
  }

  const { data: updated, error: updateErr } = await supabase
    .from('meeting_invitations')
    .update({
      status: action,
      invitee_user_id: user.id,
    })
    .eq('id', invitationId)
    .select('id, meeting_id, inviter_id, invitee_email, invitee_user_id, status, created_at')
    .single<InvitationRow>();

  if (updateErr || !updated) {
    throw new HttpError(500, `Failed to update invitation: ${updateErr?.message ?? 'Unknown'}`);
  }

  const hydrated = await hydrateInvitations([updated]);
  return hydrated[0];
}
