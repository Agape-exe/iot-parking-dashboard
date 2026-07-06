create extension if not exists "pgcrypto";

drop table if exists public.events cascade;
drop table if exists public.parking_sessions cascade;
drop table if exists public.parking_spaces cascade;

create table public.parking_spaces (
  id uuid primary key default gen_random_uuid(),
  number integer not null unique check (number between 1 and 10),
  status text not null default 'FREE' check (status in ('FREE', 'OCCUPIED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.parking_sessions (
  id uuid primary key default gen_random_uuid(),
  uid text not null,
  space_number integer not null references public.parking_spaces(number),
  entry_time timestamptz not null default now(),
  payment_time timestamptz,
  exit_time timestamptz,
  status text not null default 'INSIDE' check (status in ('INSIDE', 'PAID', 'EXITED')),
  amount numeric(10, 2),
  paid boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  uid text not null,
  event_type text not null check (
    event_type in (
      'INGRESO',
      'PAGO_SOLICITADO',
      'PAGO',
      'SALIDA',
      'SALIDA_DENEGADA',
      'PAGO_PENDIENTE',
      'INTENTO_DOBLE_INGRESO',
      'ESTACIONAMIENTO_LLENO'
    )
  ),
  description text not null,
  point text not null,
  device_id text,
  created_at timestamptz not null default now()
);

create index idx_parking_sessions_uid on public.parking_sessions(uid);
create index idx_parking_sessions_status on public.parking_sessions(status);
create index idx_parking_sessions_created_at on public.parking_sessions(created_at);
create index idx_events_uid on public.events(uid);
create index idx_events_event_type on public.events(event_type);
create index idx_events_created_at on public.events(created_at);
create index idx_parking_spaces_status on public.parking_spaces(status);

create unique index idx_one_active_session_per_uid
  on public.parking_sessions(uid)
  where status in ('INSIDE', 'PAID') and exit_time is null;

insert into public.parking_spaces (number, status)
select number, 'FREE'
from generate_series(1, 10) as number
on conflict (number) do nothing;

alter table public.parking_spaces enable row level security;
alter table public.parking_sessions enable row level security;
alter table public.events enable row level security;

create policy "Authenticated users can read parking spaces"
  on public.parking_spaces for select
  to authenticated
  using (true);

create policy "Authenticated users can read parking sessions"
  on public.parking_sessions for select
  to authenticated
  using (true);

create policy "Authenticated users can read events"
  on public.events for select
  to authenticated
  using (true);
