-- Meet AI Meeting Agent Schema
-- Stores voice transcript snippets, multimodal shared-screen visual notes,
-- and structured AI-generated meeting summaries per meeting.

-- 1. meeting_transcripts (captured voice captions during the meeting)
create table if not exists public.meeting_transcripts (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  speaker_id uuid references public.profiles (id) on delete set null,
  speaker_name text not null,
  content text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_meeting_transcripts_meeting_id
  on public.meeting_transcripts (meeting_id, created_at);

-- 2. meeting_screen_notes (AI-extracted notes from shared screen / whiteboard frames)
create table if not exists public.meeting_screen_notes (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  captured_by uuid references public.profiles (id) on delete set null,
  sharer_name text not null,
  extracted_text text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_meeting_screen_notes_meeting_id
  on public.meeting_screen_notes (meeting_id, created_at);

-- 3. meeting_ai_summaries (final environment-aware AI notes visible in History)
create table if not exists public.meeting_ai_summaries (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null unique references public.meetings (id) on delete cascade,
  environment_type text not null default 'general',
  environment_label text not null default 'General Meeting',
  overview text not null,
  detailed_notes_markdown text not null,
  key_points jsonb not null default '[]'::jsonb,
  action_items jsonb not null default '[]'::jsonb,
  sources_summary jsonb not null default '{}'::jsonb,
  model_used text not null default 'built-in',
  generated_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_meeting_ai_summaries_meeting_id
  on public.meeting_ai_summaries (meeting_id);

create trigger trg_meeting_ai_summaries_updated_at
before update on public.meeting_ai_summaries
for each row execute function public.set_updated_at();

-- Row Level Security
alter table public.meeting_transcripts enable row level security;
alter table public.meeting_screen_notes enable row level security;
alter table public.meeting_ai_summaries enable row level security;

create policy "Participants can view meeting transcripts"
  on public.meeting_transcripts for select
  using (
    exists (
      select 1 from public.meeting_participants mp
      where mp.meeting_id = meeting_transcripts.meeting_id and mp.user_id = auth.uid()
    )
    or exists (
      select 1 from public.meetings m
      where m.id = meeting_transcripts.meeting_id and m.host_id = auth.uid()
    )
  );

create policy "Participants can view screen notes"
  on public.meeting_screen_notes for select
  using (
    exists (
      select 1 from public.meeting_participants mp
      where mp.meeting_id = meeting_screen_notes.meeting_id and mp.user_id = auth.uid()
    )
    or exists (
      select 1 from public.meetings m
      where m.id = meeting_screen_notes.meeting_id and m.host_id = auth.uid()
    )
  );

create policy "Participants can view AI summaries"
  on public.meeting_ai_summaries for select
  using (
    exists (
      select 1 from public.meeting_participants mp
      where mp.meeting_id = meeting_ai_summaries.meeting_id and mp.user_id = auth.uid()
    )
    or exists (
      select 1 from public.meetings m
      where m.id = meeting_ai_summaries.meeting_id and m.host_id = auth.uid()
    )
  );

-- Explicit table grants for service_role and authenticated
grant all privileges on public.meeting_transcripts to service_role;
grant all privileges on public.meeting_screen_notes to service_role;
grant all privileges on public.meeting_ai_summaries to service_role;

grant select, insert, update, delete on public.meeting_transcripts to authenticated;
grant select, insert, update, delete on public.meeting_screen_notes to authenticated;
grant select, insert, update, delete on public.meeting_ai_summaries to authenticated;
