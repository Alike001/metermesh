create table if not exists sessions (
  id bigint generated always as identity primary key,
  session_id text not null unique,
  channel_id text not null unique,
  chain_id bigint not null check (chain_id > 0),
  escrow_address text not null check (escrow_address ~ '^0x[0-9A-Fa-f]{40}$'),
  token_address text not null check (token_address ~ '^0x[0-9A-Fa-f]{40}$'),
  buyer_address text not null check (buyer_address ~ '^0x[0-9A-Fa-f]{40}$'),
  buyer_inbox_id text not null,
  seller_address text not null check (seller_address ~ '^0x[0-9A-Fa-f]{40}$'),
  seller_inbox_id text not null,
  unit_price numeric(78, 0) not null check (unit_price > 0),
  cap numeric(78, 0) not null check (cap >= unit_price),
  highest_voucher_amount numeric(78, 0) not null default 0,
  accepted_units bigint not null default 0 check (accepted_units >= 0),
  rejected_units bigint not null default 0 check (rejected_units >= 0),
  status text not null check (status in ('open', 'closing', 'closed')),
  protocol_state jsonb not null check (jsonb_typeof(protocol_state) = 'object'),
  version bigint not null default 0 check (version >= 0),
  settlement_transaction_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (highest_voucher_amount >= 0),
  check (highest_voucher_amount <= cap),
  check (mod(highest_voucher_amount, unit_price) = 0),
  check (buyer_address <> seller_address),
  check (buyer_inbox_id <> seller_inbox_id),
  check (settlement_transaction_hash is null or settlement_transaction_hash ~ '^0x[0-9A-Fa-f]{64}$')
);

create table if not exists mpp_session_state (
  channel_id text primary key references sessions(channel_id) on delete restrict,
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  version bigint not null default 0 check (version >= 0),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists envelopes (
  id bigint generated always as identity primary key,
  session_id text not null references sessions(session_id) on delete restrict,
  message_id text not null unique,
  work_unit_id text,
  sender_inbox_id text not null,
  sequence bigint not null check (sequence > 0),
  envelope_type text not null,
  payload_hash text not null check (payload_hash ~ '^0x[0-9A-Fa-f]{64}$'),
  signature_signer text not null check (signature_signer ~ '^0x[0-9A-Fa-f]{40}$'),
  direction text not null check (direction in ('inbound', 'outbound')),
  processing_status text not null check (processing_status in ('accepted', 'rejected')),
  rejection_code text,
  envelope jsonb not null check (jsonb_typeof(envelope) = 'object'),
  created_at timestamptz not null default now(),
  check (
    (processing_status = 'accepted' and rejection_code is null) or
    (processing_status = 'rejected' and rejection_code is not null)
  )
);

create unique index if not exists envelopes_session_sender_sequence_accepted_idx
  on envelopes (session_id, sender_inbox_id, sequence)
  where processing_status = 'accepted';
create index if not exists envelopes_session_created_idx
  on envelopes (session_id, created_at, id);

create table if not exists envelope_rejections (
  id bigint generated always as identity primary key,
  carrier_message_id text not null unique,
  session_id text references sessions(session_id) on delete restrict,
  reason text not null,
  raw_envelope jsonb not null,
  received_at timestamptz not null default now()
);
create index if not exists envelope_rejections_session_received_idx
  on envelope_rejections (session_id, received_at)
  where session_id is not null;

create table if not exists work_units (
  id bigint generated always as identity primary key,
  session_id text not null references sessions(session_id) on delete restrict,
  work_unit_id text not null,
  transaction_hash text not null check (transaction_hash ~ '^0x[0-9A-Fa-f]{64}$'),
  status text not null check (status in ('requested', 'delivered', 'accepted', 'rejected')),
  request_message_id text not null,
  delivery_message_id text,
  delivery_payload_hash text,
  result_hash text,
  decision_message_id text,
  rejection_reason text,
  billable_amount numeric(78, 0) not null default 0 check (billable_amount >= 0),
  cumulative_amount numeric(78, 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, work_unit_id),
  check (delivery_payload_hash is null or delivery_payload_hash ~ '^0x[0-9A-Fa-f]{64}$'),
  check (result_hash is null or result_hash ~ '^0x[0-9A-Fa-f]{64}$'),
  check (cumulative_amount is null or cumulative_amount >= 0)
);
create index if not exists work_units_session_status_created_idx
  on work_units (session_id, status, created_at);

create table if not exists vouchers (
  id bigint generated always as identity primary key,
  session_id text not null references sessions(session_id) on delete restrict,
  work_unit_id text not null,
  cumulative_amount numeric(78, 0) not null check (cumulative_amount > 0),
  credential_hash text not null check (credential_hash ~ '^0x[0-9A-Fa-f]{64}$'),
  credential jsonb,
  verified_at timestamptz not null default now(),
  unique (session_id, work_unit_id),
  unique (session_id, cumulative_amount),
  foreign key (session_id, work_unit_id)
    references work_units(session_id, work_unit_id) on delete restrict
);

create table if not exists chain_operations (
  id bigint generated always as identity primary key,
  idempotency_key text not null unique,
  session_id text not null references sessions(session_id) on delete restrict,
  operation_type text not null check (operation_type in ('open', 'settle', 'close')),
  operation_state text not null check (operation_state in ('pending', 'submitted', 'confirmed', 'failed')),
  transaction_hash text unique,
  block_hash text,
  confirmations bigint not null default 0 check (confirmations >= 0),
  service_account_status text,
  receipt jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (transaction_hash is null or transaction_hash ~ '^0x[0-9A-Fa-f]{64}$'),
  check (block_hash is null or block_hash ~ '^0x[0-9A-Fa-f]{64}$')
);
create index if not exists chain_operations_session_created_idx
  on chain_operations (session_id, created_at);
create index if not exists chain_operations_pending_idx
  on chain_operations (updated_at, id)
  where operation_state in ('pending', 'submitted');

create table if not exists outbox (
  id bigint generated always as identity primary key,
  job_key text not null unique,
  session_id text references sessions(session_id) on delete restrict,
  job_type text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  attempts bigint not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  worker_id text,
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((worker_id is null) = (lease_expires_at is null)),
  check (processed_at is null or worker_id is null)
);
create index if not exists outbox_ready_idx
  on outbox (available_at, id)
  where processed_at is null;
create index if not exists outbox_session_created_idx
  on outbox (session_id, created_at)
  where session_id is not null;
