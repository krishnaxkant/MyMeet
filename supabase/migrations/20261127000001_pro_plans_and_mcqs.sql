-- MyMeet Pro Plans, Credits, Pro Master Notes & Interactive Session MCQs
-- Run once in Supabase SQL Editor.

create table if not exists public.user_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_code text not null default 'free'
    check (plan_code in ('free', 'single_9', 'pack_49', 'pro_monthly_349', 'pro_yearly_899')),
  credits_remaining integer not null default 0 check (credits_remaining >= 0),
  credits_total integer not null default 0 check (credits_total >= 0),
  is_unlimited boolean not null default false,
  mcq_enabled boolean not null default false,
  started_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.meeting_pro_notes (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  unlock_source text not null,
  environment_label text not null,
  pro_overview text not null,
  deep_sections jsonb not null default '[]'::jsonb,
  comparison_table jsonb,
  exam_traps jsonb not null default '[]'::jsonb,
  cheat_sheet jsonb not null default '[]'::jsonb,
  pro_markdown text not null,
  model_used text not null,
  created_at timestamptz not null default now(),
  unique (meeting_id, user_id)
);

create index if not exists idx_meeting_pro_notes_user_meeting
  on public.meeting_pro_notes (user_id, meeting_id);

create table if not exists public.meeting_mcqs (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null unique references public.meetings(id) on delete cascade,
  topic_label text not null,
  questions jsonb not null default '[]'::jsonb,
  model_used text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_code text not null
    check (plan_code in ('single_9', 'pack_49', 'pro_monthly_349', 'pro_yearly_899')),
  meeting_code text,
  amount_inr integer not null check (amount_inr > 0),
  currency text not null default 'INR',
  provider text not null default 'demo' check (provider in ('razorpay', 'demo')),
  provider_order_id text not null,
  provider_payment_id text,
  status text not null default 'created' check (status in ('created', 'paid', 'failed')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists idx_payment_orders_user
  on public.payment_orders (user_id, created_at desc);

alter table public.user_subscriptions enable row level security;
alter table public.meeting_pro_notes enable row level security;
alter table public.meeting_mcqs enable row level security;
alter table public.payment_orders enable row level security;

drop policy if exists "Users can view own subscription" on public.user_subscriptions;
create policy "Users can view own subscription"
  on public.user_subscriptions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can view own pro notes" on public.meeting_pro_notes;
create policy "Users can view own pro notes"
  on public.meeting_pro_notes for select
  using (auth.uid() = user_id);

drop policy if exists "Participants can view meeting mcqs" on public.meeting_mcqs;
create policy "Participants can view meeting mcqs"
  on public.meeting_mcqs for select
  using (
    exists (
      select 1 from public.meetings m
      where m.id = meeting_mcqs.meeting_id and m.host_id = auth.uid()
    )
    or exists (
      select 1 from public.meeting_participants mp
      where mp.meeting_id = meeting_mcqs.meeting_id and mp.user_id = auth.uid()
    )
  );

drop policy if exists "Users can view own payment orders" on public.payment_orders;
create policy "Users can view own payment orders"
  on public.payment_orders for select
  using (auth.uid() = user_id);

grant all on public.user_subscriptions to service_role;
grant all on public.meeting_pro_notes to service_role;
grant all on public.meeting_mcqs to service_role;
grant all on public.payment_orders to service_role;

grant select on public.user_subscriptions to authenticated;
grant select on public.meeting_pro_notes to authenticated;
grant select on public.meeting_mcqs to authenticated;
grant select on public.payment_orders to authenticated;
