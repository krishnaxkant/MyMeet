-- Meet Initial Database Schema (Phase 1 Foundation)
-- Tables: profiles, meetings, meeting_participants, meeting_messages,
--         scheduled_meetings, meeting_invitations, user_devices
-- Includes Row Level Security (RLS) policies.

create extension if not exists "pgcrypto";

-- Helper function to keep updated_at current
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- 1. profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- 2. meetings
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null default 'Untitled Meeting',
  host_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'active' check (status in ('scheduled', 'active', 'ended')),
  waiting_room_enabled boolean not null default false,
  is_locked boolean not null default false,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_meetings_host_id on public.meetings (host_id);
create index if not exists idx_meetings_code on public.meetings (code);

create trigger trg_meetings_updated_at
before update on public.meetings
for each row execute function public.set_updated_at();

-- 3. meeting_participants
create table if not exists public.meeting_participants (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'participant' check (role in ('host', 'co_host', 'participant')),
  status text not null default 'joined' check (status in ('waiting', 'joined', 'left', 'removed')),
  joined_at timestamptz not null default timezone('utc', now()),
  left_at timestamptz,
  unique (meeting_id, user_id)
);

create index if not exists idx_meeting_participants_meeting_id on public.meeting_participants (meeting_id);
create index if not exists idx_meeting_participants_user_id on public.meeting_participants (user_id);

-- 4. meeting_messages
create table if not exists public.meeting_messages (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_meeting_messages_meeting_id on public.meeting_messages (meeting_id, created_at);

-- 5. scheduled_meetings
create table if not exists public.scheduled_meetings (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references public.meetings (id) on delete set null,
  host_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  timezone text not null default 'UTC',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (scheduled_end > scheduled_start)
);

create index if not exists idx_scheduled_meetings_host_id on public.scheduled_meetings (host_id, scheduled_start);

create trigger trg_scheduled_meetings_updated_at
before update on public.scheduled_meetings
for each row execute function public.set_updated_at();

-- 6. meeting_invitations
create table if not exists public.meeting_invitations (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references public.meetings (id) on delete cascade,
  scheduled_meeting_id uuid references public.scheduled_meetings (id) on delete cascade,
  inviter_id uuid not null references public.profiles (id) on delete cascade,
  invitee_email text not null,
  invitee_user_id uuid references public.profiles (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_meeting_invitations_invitee_email on public.meeting_invitations (invitee_email);
create index if not exists idx_meeting_invitations_invitee_user_id on public.meeting_invitations (invitee_user_id);

-- 7. user_devices
create table if not exists public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('android', 'web', 'ios')),
  push_token text not null unique,
  device_name text,
  last_active_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_user_devices_user_id on public.user_devices (user_id);

-- ==========================================
-- Row Level Security (RLS)
-- ==========================================
alter table public.profiles enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_participants enable row level security;
alter table public.meeting_messages enable row level security;
alter table public.scheduled_meetings enable row level security;
alter table public.meeting_invitations enable row level security;
alter table public.user_devices enable row level security;

-- profiles: users can read and update their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- meetings: host or participants can read; only host can update/delete
create policy "Hosts and participants can view meetings"
  on public.meetings for select
  using (
    auth.uid() = host_id
    or exists (
      select 1 from public.meeting_participants mp
      where mp.meeting_id = meetings.id and mp.user_id = auth.uid()
    )
  );

create policy "Authenticated users can create meetings"
  on public.meetings for insert
  with check (auth.uid() = host_id);

create policy "Only host can update meeting"
  on public.meetings for update
  using (auth.uid() = host_id);

-- meeting_participants: participants and hosts can view; users manage own join
create policy "Participants can view meeting participants"
  on public.meeting_participants for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.meetings m
      where m.id = meeting_participants.meeting_id and m.host_id = auth.uid()
    )
  );

-- meeting_messages: only joined participants or host can view/send
create policy "Meeting participants can view messages"
  on public.meeting_messages for select
  using (
    exists (
      select 1 from public.meeting_participants mp
      where mp.meeting_id = meeting_messages.meeting_id
        and mp.user_id = auth.uid()
        and mp.status = 'joined'
    )
    or exists (
      select 1 from public.meetings m
      where m.id = meeting_messages.meeting_id and m.host_id = auth.uid()
    )
  );

create policy "Meeting participants can send messages"
  on public.meeting_messages for insert
  with check (
    sender_id = auth.uid()
    and (
      exists (
        select 1 from public.meeting_participants mp
        where mp.meeting_id = meeting_messages.meeting_id
          and mp.user_id = auth.uid()
          and mp.status = 'joined'
      )
      or exists (
        select 1 from public.meetings m
        where m.id = meeting_messages.meeting_id and m.host_id = auth.uid()
      )
    )
  );

-- scheduled_meetings: host or invited users can view; host manages
create policy "Users can manage own scheduled meetings"
  on public.scheduled_meetings for all
  using (auth.uid() = host_id)
  with check (auth.uid() = host_id);

-- meeting_invitations: inviter or invitee can view
create policy "Inviter or invitee can view invitations"
  on public.meeting_invitations for select
  using (auth.uid() = inviter_id or auth.uid() = invitee_user_id);

create policy "Host can create invitations"
  on public.meeting_invitations for insert
  with check (auth.uid() = inviter_id);

-- user_devices: users can only manage their own devices
create policy "Users can manage own devices"
  on public.user_devices for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
