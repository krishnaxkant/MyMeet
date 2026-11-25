import { getSupabaseAdmin } from '../config/supabase.js';
import type { AuthenticatedUser } from '../middleware/authMiddleware.js';
import { sendPushNotificationToUser } from './deviceService.js';
import { sendMeetingInviteEmail } from './emailService.js';
import { generateMeetingCode, HttpError, type MeetingStatus } from './meetingService.js';
import { getOrCreateProfile } from './profileService.js';

export interface ScheduledMeetingInfo {
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

interface ScheduledRow {
  id: string;
  meeting_id: string | null;
  host_id: string;
  title: string;
  description: string | null;
  scheduled_start: string;
  scheduled_end: string;
  timezone: string;
  created_at: string;
}

interface MeetingMini {
  id: string;
  code: string;
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

async function hydrateSchedules(
  rows: ScheduledRow[],
  viewerId: string,
): Promise<ScheduledMeetingInfo[]> {
  if (rows.length === 0) return [];
  const supabase = requireSupabase();

  const meetingIds = Array.from(
    new Set(rows.map((r) => r.meeting_id).filter((id): id is string => Boolean(id))),
  );
  const hostIds = Array.from(new Set(rows.map((r) => r.host_id)));

  const [meetingsRes, profilesRes] = await Promise.all([
    meetingIds.length > 0
      ? supabase.from('meetings').select('id, code, status').in('id', meetingIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('profiles').select('id, email, full_name').in('id', hostIds),
  ]);

  if (meetingsRes.error) {
    throw new HttpError(500, `Failed to load scheduled rooms: ${meetingsRes.error.message}`);
  }
  if (profilesRes.error) {
    throw new HttpError(500, `Failed to load schedule hosts: ${profilesRes.error.message}`);
  }

  const meetingMap = new Map<string, MeetingMini>();
  for (const m of (meetingsRes.data ?? []) as MeetingMini[]) {
    meetingMap.set(m.id, m);
  }

  const profileMap = new Map<string, ProfileMini>();
  for (const p of (profilesRes.data ?? []) as ProfileMini[]) {
    profileMap.set(p.id, p);
  }

  return rows.map((row) => {
    const meeting = row.meeting_id ? meetingMap.get(row.meeting_id) : undefined;
    const host = profileMap.get(row.host_id);
    return {
      id: row.id,
      meeting_id: row.meeting_id,
      meeting_code: meeting?.code ?? null,
      meeting_status: meeting?.status ?? null,
      host_id: row.host_id,
      host_name: host?.full_name ?? null,
      host_email: host?.email ?? null,
      title: row.title,
      description: row.description,
      scheduled_start: row.scheduled_start,
      scheduled_end: row.scheduled_end,
      timezone: row.timezone,
      is_host: row.host_id === viewerId,
      created_at: row.created_at,
    };
  });
}

export async function createScheduledMeeting(
  user: AuthenticatedUser,
  input: {
    title: string;
    description?: string | null;
    scheduled_start: string;
    scheduled_end: string;
    timezone?: string;
    waiting_room_enabled?: boolean;
    invite_emails?: string[];
  },
): Promise<{ schedule: ScheduledMeetingInfo; invitedCount: number }> {
  const title = input.title.trim();
  if (!title || title.length > 120) {
    throw new HttpError(400, 'Meeting title must be between 1 and 120 characters.');
  }

  const startDate = new Date(input.scheduled_start);
  const endDate = new Date(input.scheduled_end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new HttpError(400, 'Please provide valid start and end times.');
  }
  if (endDate.getTime() <= startDate.getTime()) {
    throw new HttpError(400, 'End time must be after start time.');
  }

  const supabase = requireSupabase();
  const hostProfile = await getOrCreateProfile(user.id, user.email, user.fullName);

  // Create linked meeting room with unguessable code
  let createdMeeting: MeetingMini | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateMeetingCode();
    const { data, error } = await supabase
      .from('meetings')
      .insert({
        code,
        title,
        host_id: user.id,
        status: 'scheduled',
        waiting_room_enabled: Boolean(input.waiting_room_enabled),
        is_locked: false,
      })
      .select('id, code, status')
      .single<MeetingMini>();

    if (!error && data) {
      createdMeeting = data;
      break;
    }
    if (error?.code !== '23505') {
      throw new HttpError(500, `Failed to reserve meeting room: ${error?.message ?? 'Unknown'}`);
    }
  }

  if (!createdMeeting) {
    throw new HttpError(500, 'Could not generate a unique meeting code.');
  }

  // Register host in meeting_participants
  await supabase.from('meeting_participants').upsert(
    {
      meeting_id: createdMeeting.id,
      user_id: user.id,
      role: 'host',
      status: 'left',
    },
    { onConflict: 'meeting_id,user_id' },
  );

  const { data: scheduleRow, error: schedErr } = await supabase
    .from('scheduled_meetings')
    .insert({
      meeting_id: createdMeeting.id,
      host_id: user.id,
      title,
      description: input.description?.trim() || null,
      scheduled_start: startDate.toISOString(),
      scheduled_end: endDate.toISOString(),
      timezone: input.timezone?.trim() || 'UTC',
    })
    .select(
      'id, meeting_id, host_id, title, description, scheduled_start, scheduled_end, timezone, created_at',
    )
    .single<ScheduledRow>();

  if (schedErr || !scheduleRow) {
    throw new HttpError(500, `Failed to save scheduled meeting: ${schedErr?.message ?? 'Unknown'}`);
  }

  // Process optional invite emails
  const uniqueEmails = Array.from(
    new Set(
      (input.invite_emails ?? [])
        .map((e) => e.trim().toLowerCase())
        .filter((e) => EMAIL_REGEX.test(e) && e !== user.email.trim().toLowerCase()),
    ),
  ).slice(0, 25);

  let invitedCount = 0;
  const hostDisplay = hostProfile.full_name || user.email || 'A Meet host';

  for (const email of uniqueEmails) {
    const { data: inviteeProfile } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', email)
      .maybeSingle<{ id: string }>();

    const { error: invErr } = await supabase.from('meeting_invitations').insert({
      meeting_id: createdMeeting.id,
      scheduled_meeting_id: scheduleRow.id,
      inviter_id: user.id,
      invitee_email: email,
      invitee_user_id: inviteeProfile?.id ?? null,
      status: 'pending',
    });

    if (!invErr) {
      invitedCount += 1;
      void sendMeetingInviteEmail({
        to: email,
        inviterName: hostDisplay,
        meetingTitle: `${title} (${startDate.toLocaleString()})`,
        meetingCode: createdMeeting.code,
      });

      if (inviteeProfile?.id) {
        void sendPushNotificationToUser(inviteeProfile.id, {
          title: `Scheduled Meeting: ${title}`,
          body: `${hostDisplay} invited you · Code ${createdMeeting.code}`,
          data: { meetingCode: createdMeeting.code },
        });
      }
    }
  }

  const [hydrated] = await hydrateSchedules([scheduleRow], user.id);
  return { schedule: hydrated, invitedCount };
}

export async function listScheduledMeetings(
  user: AuthenticatedUser,
): Promise<ScheduledMeetingInfo[]> {
  const supabase = requireSupabase();
  const normalizedEmail = user.email.trim().toLowerCase();

  const [hostedRes, invitedByUserRes, invitedByEmailRes] = await Promise.all([
    supabase
      .from('scheduled_meetings')
      .select(
        'id, meeting_id, host_id, title, description, scheduled_start, scheduled_end, timezone, created_at',
      )
      .eq('host_id', user.id)
      .order('scheduled_start', { ascending: true })
      .limit(30),
    supabase
      .from('meeting_invitations')
      .select('scheduled_meeting_id')
      .eq('invitee_user_id', user.id)
      .not('scheduled_meeting_id', 'is', null),
    normalizedEmail
      ? supabase
          .from('meeting_invitations')
          .select('scheduled_meeting_id')
          .ilike('invitee_email', normalizedEmail)
          .not('scheduled_meeting_id', 'is', null)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (hostedRes.error) {
    throw new HttpError(500, `Failed to load scheduled meetings: ${hostedRes.error.message}`);
  }

  const hosted = (hostedRes.data ?? []) as ScheduledRow[];
  const hostedIds = new Set(hosted.map((s) => s.id));
  const invitedScheduleIds = Array.from(
    new Set(
      [
        ...((invitedByUserRes.data ?? []) as Array<{ scheduled_meeting_id: string | null }>),
        ...((invitedByEmailRes.data ?? []) as Array<{ scheduled_meeting_id: string | null }>),
      ]
        .map((r) => r.scheduled_meeting_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0 && !hostedIds.has(id)),
    ),
  );

  let invitedRows: ScheduledRow[] = [];
  if (invitedScheduleIds.length > 0) {
    const { data, error } = await supabase
      .from('scheduled_meetings')
      .select(
        'id, meeting_id, host_id, title, description, scheduled_start, scheduled_end, timezone, created_at',
      )
      .in('id', invitedScheduleIds);

    if (!error && data) {
      invitedRows = data as ScheduledRow[];
    }
  }

  const combined = [...hosted, ...invitedRows].sort(
    (a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime(),
  );

  return hydrateSchedules(combined, user.id);
}

export async function startScheduledMeeting(
  scheduleId: string,
  userId: string,
): Promise<ScheduledMeetingInfo> {
  const supabase = requireSupabase();
  const { data: sched, error } = await supabase
    .from('scheduled_meetings')
    .select(
      'id, meeting_id, host_id, title, description, scheduled_start, scheduled_end, timezone, created_at',
    )
    .eq('id', scheduleId)
    .maybeSingle<ScheduledRow>();

  if (error) {
    throw new HttpError(500, `Failed to load scheduled meeting: ${error.message}`);
  }
  if (!sched) {
    throw new HttpError(404, 'Scheduled meeting not found.');
  }
  if (sched.host_id !== userId) {
    throw new HttpError(403, 'Only the host can start a scheduled meeting.');
  }
  if (!sched.meeting_id) {
    throw new HttpError(400, 'Scheduled meeting has no associated room.');
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from('meetings')
    .update({ status: 'active', started_at: now })
    .eq('id', sched.meeting_id);

  if (updateErr) {
    throw new HttpError(500, `Failed to activate scheduled meeting: ${updateErr.message}`);
  }

  await supabase.from('meeting_participants').upsert(
    {
      meeting_id: sched.meeting_id,
      user_id: userId,
      role: 'host',
      status: 'joined',
      joined_at: now,
      left_at: null,
    },
    { onConflict: 'meeting_id,user_id' },
  );

  const [hydrated] = await hydrateSchedules([sched], userId);
  return hydrated;
}

export async function deleteScheduledMeeting(scheduleId: string, userId: string): Promise<void> {
  const supabase = requireSupabase();
  const { data: sched, error } = await supabase
    .from('scheduled_meetings')
    .select('id, meeting_id, host_id')
    .eq('id', scheduleId)
    .maybeSingle<{ id: string; meeting_id: string | null; host_id: string }>();

  if (error) {
    throw new HttpError(500, `Failed to look up scheduled meeting: ${error.message}`);
  }
  if (!sched) {
    throw new HttpError(404, 'Scheduled meeting not found.');
  }
  if (sched.host_id !== userId) {
    throw new HttpError(403, 'Only the host can cancel a scheduled meeting.');
  }

  if (sched.meeting_id) {
    await supabase
      .from('meetings')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', sched.meeting_id)
      .eq('status', 'scheduled');
  }

  const { error: delErr } = await supabase
    .from('scheduled_meetings')
    .delete()
    .eq('id', scheduleId);

  if (delErr) {
    throw new HttpError(500, `Failed to cancel scheduled meeting: ${delErr.message}`);
  }
}
