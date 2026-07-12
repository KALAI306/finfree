-- Chit Funds
create table if not exists chit_funds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  total_value decimal not null,
  total_members integer not null,
  monthly_contribution decimal not null,
  frequency text not null default 'monthly',
  frequency_days integer,
  start_date date not null,
  my_turn_number integer,
  commission_percent decimal default 0,
  status text default 'active',
  notes text,
  created_at timestamptz default now()
);

create table if not exists chit_members (
  id uuid primary key default gen_random_uuid(),
  chit_id uuid references chit_funds(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  phone text,
  turn_number integer not null,
  collection_date date,
  collected_amount decimal,
  status text default 'pending',
  created_at timestamptz default now()
);

create table if not exists chit_payments (
  id uuid primary key default gen_random_uuid(),
  chit_id uuid references chit_funds(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  round_number integer not null,
  alem_date date not null,
  amount_paid decimal not null,
  paid_by_member_id uuid references chit_members(id),
  payment_status text default 'pending',
  notes text,
  created_at timestamptz default now()
);

-- Money Lending
create table if not exists money_lending (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  type text not null,
  person_name text not null,
  person_phone text,
  amount decimal not null,
  remaining_amount decimal not null,
  reason text,
  lent_date date not null,
  due_date date,
  status text default 'active',
  notes text,
  created_at timestamptz default now()
);

create table if not exists lending_payments (
  id uuid primary key default gen_random_uuid(),
  lending_id uuid references money_lending(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  amount decimal not null,
  payment_date date not null,
  notes text,
  created_at timestamptz default now()
);

-- RLS
alter table chit_funds enable row level security;
alter table chit_members enable row level security;
alter table chit_payments enable row level security;
alter table money_lending enable row level security;
alter table lending_payments enable row level security;

create policy "Users manage own chit_funds" on chit_funds for all using (auth.uid() = user_id);
create policy "Users manage own chit_members" on chit_members for all using (auth.uid() = user_id);
create policy "Users manage own chit_payments" on chit_payments for all using (auth.uid() = user_id);
create policy "Users manage own money_lending" on money_lending for all using (auth.uid() = user_id);
create policy "Users manage own lending_payments" on lending_payments for all using (auth.uid() = user_id);

-- Indexes
create index idx_chit_funds_user on chit_funds(user_id, status);
create index idx_chit_members_chit on chit_members(chit_id);
create index idx_chit_payments_chit on chit_payments(chit_id, round_number);
create index idx_money_lending_user on money_lending(user_id, status);
create index idx_lending_payments_lending on lending_payments(lending_id);
