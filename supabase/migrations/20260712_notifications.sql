create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  body text not null,
  type text not null default 'budget_alert',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_notifications_user_created on notifications(user_id, created_at desc);

alter table notifications enable row level security;

create policy "Users read own notifications"
  on notifications for select using (auth.uid() = user_id);

create policy "Users update own notifications"
  on notifications for update using (auth.uid() = user_id);

create policy "Service role inserts notifications"
  on notifications for insert with check (auth.uid() = user_id);
