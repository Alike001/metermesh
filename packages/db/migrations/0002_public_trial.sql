alter table work_units
  drop constraint if exists work_units_status_check;

alter table work_units
  add constraint work_units_status_check
  check (status in ('requested', 'delivered', 'accepted', 'rejected', 'failed'));

create table if not exists public_trial_budget (
  id smallint primary key check (id = 1),
  global_limit integer not null check (global_limit between 1 and 1000),
  used_count integer not null default 0 check (used_count >= 0 and used_count <= global_limit),
  activated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public_trial_budget
  add column if not exists activated_at timestamptz not null default now();

create table if not exists public_trial_requests (
  request_message_id text primary key,
  request_hash text not null check (request_hash ~ '^0x[0-9A-Fa-f]{64}$'),
  signer_address text not null unique check (signer_address ~ '^0x[0-9A-Fa-f]{40}$'),
  transaction_hash text not null check (transaction_hash ~ '^0x[0-9A-Fa-f]{64}$'),
  created_at timestamptz not null default now()
);

alter table public_trial_requests
  add column if not exists request_hash text;
