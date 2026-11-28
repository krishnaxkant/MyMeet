-- ============================================================================
-- MyMeet: Per-Participant Revision MCQ Attempt Tracking (Host Scorecard)
-- Tracks Not Attempted, Left in Between, Completed Score, and Not Eligible
-- ============================================================================

create table if not exists public.meeting_mcq_attempts (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  attempted_count integer not null default 0,
  correct_count integer not null default 0,
  total_questions integer not null default 20,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meeting_id, user_id)
);

create index if not exists idx_meeting_mcq_attempts_meeting
  on public.meeting_mcq_attempts(meeting_id);

alter table public.meeting_mcq_attempts enable row level security;

drop policy if exists "Users can view their own MCQ attempts" on public.meeting_mcq_attempts;
create policy "Users can view their own MCQ attempts"
  on public.meeting_mcq_attempts for select
  using (auth.uid() = user_id);

drop policy if exists "Hosts can view MCQ attempts for their meetings" on public.meeting_mcq_attempts;
create policy "Hosts can view MCQ attempts for their meetings"
  on public.meeting_mcq_attempts for select
  using (
    exists (
      select 1 from public.meetings m
      where m.id = meeting_mcq_attempts.meeting_id
        and m.host_id = auth.uid()
    )
  );
