create extension if not exists "pgcrypto";

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid,
  full_name text not null,
  email text not null unique,
  phone text,
  role text not null default 'USER',
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_users add column if not exists is_demo boolean not null default false;

create table if not exists public.parking_spaces (
  id uuid primary key default gen_random_uuid(),
  number integer not null unique check (number between 1 and 9),
  status text not null default 'FREE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  plate text not null unique,
  brand text not null,
  model text not null,
  color text not null,
  uid text unique,
  status text not null default 'AVAILABLE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vehicles add column if not exists is_demo boolean not null default false;

create table if not exists public.rfid_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  status text not null default 'PENDING',
  uid text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  message text
);

alter table public.rfid_enrollments drop constraint if exists rfid_enrollments_status_check;
alter table public.rfid_enrollments add constraint rfid_enrollments_status_check
  check (status in ('PENDING', 'COMPLETED', 'EXPIRED', 'CANCELLED', 'FAILED'));

-- Los datos demo históricos se reconocían por su correo @example.com. Esta
-- actualización permite reasignar sus RFID sin convertir usuarios reales.
update public.app_users
set is_demo = true
where lower(email) like '%@example.com' and is_demo = false;

update public.vehicles as vehicle
set is_demo = true
from public.app_users as app_user
where vehicle.user_id = app_user.id
  and app_user.is_demo = true
  and vehicle.is_demo = false;

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  plate text not null,
  uid text,
  start_time timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.parking_sessions (
  id uuid primary key default gen_random_uuid(),
  uid text not null,
  space_number integer not null references public.parking_spaces(number),
  entry_time timestamptz not null default now(),
  payment_time timestamptz,
  exit_time timestamptz,
  status text not null default 'INSIDE',
  amount numeric(10, 2),
  paid boolean not null default false,
  user_id uuid references public.app_users(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  reservation_id uuid references public.reservations(id) on delete set null,
  plate text,
  owner_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  uid text not null,
  event_type text not null,
  description text not null,
  point text not null,
  device_id text,
  user_id uuid references public.app_users(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  reservation_id uuid references public.reservations(id) on delete set null,
  plate text,
  owner_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.system_settings (
  id text primary key default 'main',
  use_simulated_date boolean not null default false,
  simulated_date date,
  reservation_test_duration_minutes integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.parking_spaces drop constraint if exists parking_spaces_status_check;
alter table public.parking_spaces add constraint parking_spaces_status_check check (status in ('FREE', 'OCCUPIED', 'PAID', 'RESERVED'));

alter table public.parking_sessions drop constraint if exists parking_sessions_status_check;
alter table public.parking_sessions add constraint parking_sessions_status_check check (status in ('INSIDE', 'PAID', 'EXITED'));
alter table public.parking_sessions add column if not exists user_id uuid references public.app_users(id) on delete set null;
alter table public.parking_sessions add column if not exists vehicle_id uuid references public.vehicles(id) on delete set null;
alter table public.parking_sessions add column if not exists reservation_id uuid references public.reservations(id) on delete set null;
alter table public.parking_sessions add column if not exists plate text;
alter table public.parking_sessions add column if not exists owner_name text;

alter table public.events drop constraint if exists events_event_type_check;
alter table public.events add constraint events_event_type_check check (
  event_type in (
    'INGRESO',
    'PAGO_SOLICITADO',
    'PAGO',
    'SALIDA',
    'SALIDA_DENEGADA',
    'PAGO_PENDIENTE',
    'INTENTO_DOBLE_INGRESO',
    'ESTACIONAMIENTO_LLENO',
    'RESERVA_CREADA',
    'RESERVA_USADA',
    'RESERVA_CANCELADA',
    'RESERVA_EXPIRADA',
    'UID_ASIGNADO'
  )
);
alter table public.events add column if not exists user_id uuid references public.app_users(id) on delete set null;
alter table public.events add column if not exists vehicle_id uuid references public.vehicles(id) on delete set null;
alter table public.events add column if not exists reservation_id uuid references public.reservations(id) on delete set null;
alter table public.events add column if not exists plate text;
alter table public.events add column if not exists owner_name text;

create index if not exists idx_app_users_email on public.app_users(email);
create index if not exists idx_app_users_status on public.app_users(status);
create index if not exists idx_vehicles_uid on public.vehicles(uid);
create index if not exists idx_vehicles_plate on public.vehicles(plate);
create index if not exists idx_vehicles_user_id on public.vehicles(user_id);
create index if not exists idx_vehicles_status on public.vehicles(status);
create index if not exists idx_reservations_status on public.reservations(status);
create index if not exists idx_reservations_user_id on public.reservations(user_id);
create index if not exists idx_reservations_vehicle_id on public.reservations(vehicle_id);
create index if not exists idx_reservations_expires_at on public.reservations(expires_at);
create index if not exists idx_parking_sessions_uid on public.parking_sessions(uid);
create index if not exists idx_parking_sessions_status on public.parking_sessions(status);
create index if not exists idx_parking_sessions_created_at on public.parking_sessions(created_at);
create index if not exists idx_parking_sessions_vehicle_id on public.parking_sessions(vehicle_id);
create index if not exists idx_parking_sessions_user_id on public.parking_sessions(user_id);
create index if not exists idx_events_uid on public.events(uid);
create index if not exists idx_events_plate on public.events(plate);
create index if not exists idx_events_event_type on public.events(event_type);
create index if not exists idx_events_created_at on public.events(created_at);
create index if not exists idx_events_vehicle_id on public.events(vehicle_id);
create index if not exists idx_events_user_id on public.events(user_id);
create index if not exists idx_parking_spaces_status on public.parking_spaces(status);
create index if not exists idx_rfid_enrollments_status_expires_at on public.rfid_enrollments(status, expires_at);
create index if not exists idx_rfid_enrollments_user_vehicle on public.rfid_enrollments(user_id, vehicle_id);

create unique index if not exists idx_one_pending_rfid_enrollment
  on public.rfid_enrollments(user_id, vehicle_id)
  where status = 'PENDING';

create unique index if not exists idx_one_active_session_per_uid
  on public.parking_sessions(uid)
  where status in ('INSIDE', 'PAID') and exit_time is null;

create unique index if not exists idx_one_uid_per_vehicle
  on public.vehicles(uid)
  where uid is not null;

insert into public.parking_spaces (number, status)
select number, 'FREE'
from generate_series(1, 9) as number
on conflict (number) do nothing;

insert into public.system_settings (id)
values ('main')
on conflict (id) do nothing;

create or replace function public.expire_reservations(_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.reservations
  set status = 'EXPIRED', updated_at = _now
  where status = 'ACTIVE' and expires_at <= _now;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.reserve_parking_entry(
  _uid text,
  _device_id text,
  _point text,
  _user_id uuid,
  _vehicle_id uuid,
  _plate text,
  _owner_name text,
  _reservation_id uuid,
  _event_time timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  free_space integer;
  session_id uuid;
begin
  perform pg_advisory_xact_lock(10001);
  perform public.expire_reservations(_event_time);

  if exists (
    select 1
    from public.parking_sessions
    where uid = _uid and status in ('INSIDE', 'PAID') and exit_time is null
  ) then
    insert into public.events (uid, event_type, description, point, device_id, user_id, vehicle_id, reservation_id, plate, owner_name, created_at)
    values (_uid, 'INTENTO_DOBLE_INGRESO', 'Tarjeta ya registrada dentro del estacionamiento.', _point, _device_id, _user_id, _vehicle_id, _reservation_id, _plate, _owner_name, _event_time);
    return jsonb_build_object('allowed', false, 'message', 'Tarjeta ya registrada dentro', 'reason', 'INTENTO_DOBLE_INGRESO');
  end if;

  select ps.number
  into free_space
  from public.parking_spaces ps
  where ps.status = 'FREE'
    and ps.number between 1 and 9
    and not exists (
      select 1
      from public.parking_sessions s
      where s.space_number = ps.number and s.status in ('INSIDE', 'PAID') and s.exit_time is null
    )
  order by ps.number
  for update skip locked
  limit 1;

  if free_space is null then
    insert into public.events (uid, event_type, description, point, device_id, user_id, vehicle_id, reservation_id, plate, owner_name, created_at)
    values (_uid, 'ESTACIONAMIENTO_LLENO', 'No hay espacios disponibles.', _point, _device_id, _user_id, _vehicle_id, _reservation_id, _plate, _owner_name, _event_time);
    return jsonb_build_object('allowed', false, 'message', 'Estacionamiento lleno', 'reason', 'ESTACIONAMIENTO_LLENO');
  end if;

  insert into public.parking_sessions (
    uid, space_number, status, paid, user_id, vehicle_id, reservation_id, plate, owner_name, entry_time, created_at, updated_at
  )
  values (
    _uid, free_space, 'INSIDE', false, _user_id, _vehicle_id, _reservation_id, _plate, _owner_name, _event_time, _event_time, _event_time
  )
  returning id into session_id;

  update public.parking_spaces
  set status = 'OCCUPIED', updated_at = _event_time
  where number = free_space;

  if _reservation_id is not null then
    update public.reservations
    set status = 'USED', updated_at = _event_time
    where id = _reservation_id and status = 'ACTIVE';

    insert into public.events (uid, event_type, description, point, device_id, user_id, vehicle_id, reservation_id, plate, owner_name, created_at)
    values (_uid, 'RESERVA_USADA', 'Reserva asociada al ingreso RFID.', _point, _device_id, _user_id, _vehicle_id, _reservation_id, _plate, _owner_name, _event_time);
  end if;

  insert into public.events (uid, event_type, description, point, device_id, user_id, vehicle_id, reservation_id, plate, owner_name, created_at)
  values (_uid, 'INGRESO', 'Ingreso autorizado en el espacio ' || free_space || '.', _point, _device_id, _user_id, _vehicle_id, _reservation_id, _plate, _owner_name, _event_time);

  return jsonb_build_object(
    'allowed', true,
    'message', 'Ingreso autorizado',
    'spaceNumber', free_space,
    'sessionId', session_id,
    'plate', _plate,
    'ownerName', _owner_name,
    'reservationId', _reservation_id
  );
end;
$$;

create or replace function public.enforce_operational_parking_space()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.space_number > 9
    and (tg_op = 'INSERT' or new.space_number is distinct from old.space_number) then
    raise exception 'El espacio % no esta operativo.', new.space_number;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_operational_parking_space on public.parking_sessions;
create trigger enforce_operational_parking_space
before insert or update of space_number on public.parking_sessions
for each row execute function public.enforce_operational_parking_space();

create or replace function public.complete_rfid_enrollment(
  _uid text,
  _device_id text default null,
  _point text default 'entrada',
  _event_time timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_uid text := upper(trim(_uid));
  enrollment public.rfid_enrollments%rowtype;
  target_vehicle public.vehicles%rowtype;
  target_user public.app_users%rowtype;
  current_vehicle public.vehicles%rowtype;
  current_owner_is_demo boolean := false;
  assignment_message text;
  event_description text;
begin
  if normalized_uid = '' then
    return jsonb_build_object(
      'mode', 'RFID_ENROLLMENT',
      'handled', true,
      'ok', false,
      'message', 'UID requerido'
    );
  end if;

  -- Serializa las lecturas para que un mismo escaneo no complete dos solicitudes.
  perform pg_advisory_xact_lock(10002);

  update public.rfid_enrollments
  set status = 'EXPIRED', message = 'El tiempo para registrar la RFID venció.'
  where status = 'PENDING' and expires_at <= _event_time;

  select *
  into enrollment
  from public.rfid_enrollments
  where status = 'PENDING' and expires_at > _event_time
  order by created_at asc
  for update skip locked
  limit 1;

  if enrollment.id is null then
    return jsonb_build_object(
      'mode', 'NORMAL_ENTRY',
      'handled', false,
      'message', 'No hay registro RFID pendiente'
    );
  end if;

  select * into target_vehicle
  from public.vehicles
  where id = enrollment.vehicle_id and user_id = enrollment.user_id
  for update;

  select * into target_user
  from public.app_users
  where id = enrollment.user_id;

  if target_vehicle.id is null or target_user.id is null then
    update public.rfid_enrollments
    set status = 'FAILED', uid = normalized_uid, message = 'El usuario o vehículo ya no existe.'
    where id = enrollment.id;

    return jsonb_build_object(
      'mode', 'RFID_ENROLLMENT',
      'handled', true,
      'ok', false,
      'message', 'El usuario o vehículo ya no existe.'
    );
  end if;

  select * into current_vehicle
  from public.vehicles
  where upper(uid) = normalized_uid
  for update
  limit 1;

  if current_vehicle.id = target_vehicle.id then
    assignment_message := 'Esta RFID ya estaba vinculada a tu vehículo.';
    event_description := 'RFID vinculada al usuario desde app móvil.';
  elsif current_vehicle.id is not null then
    select (vehicle_user.is_demo or current_vehicle.is_demo)
    into current_owner_is_demo
    from public.app_users as vehicle_user
    where vehicle_user.id = current_vehicle.user_id;

    if not coalesce(current_owner_is_demo, false) then
      update public.rfid_enrollments
      set status = 'FAILED', uid = normalized_uid,
          message = 'Esta tarjeta RFID ya está asociada a otro usuario.'
      where id = enrollment.id;

      return jsonb_build_object(
        'mode', 'RFID_ENROLLMENT',
        'handled', true,
        'ok', false,
        'message', 'Esta tarjeta RFID ya está asociada a otro usuario.'
      );
    end if;

    update public.vehicles
    set uid = null, status = 'AVAILABLE', updated_at = _event_time
    where id = current_vehicle.id;

    assignment_message := 'RFID registrada correctamente';
    event_description := 'RFID reasignada desde vehículo demo a usuario móvil.';
  else
    assignment_message := 'RFID registrada correctamente';
    event_description := 'RFID vinculada al usuario desde app móvil.';
  end if;

  update public.vehicles
  set uid = normalized_uid, status = 'ASSIGNED', is_demo = false, updated_at = _event_time
  where id = target_vehicle.id;

  update public.rfid_enrollments
  set status = 'COMPLETED', uid = normalized_uid, completed_at = _event_time,
      message = assignment_message
  where id = enrollment.id;

  insert into public.events (
    uid, event_type, description, point, device_id, user_id, vehicle_id,
    plate, owner_name, created_at
  )
  values (
    normalized_uid, 'UID_ASIGNADO', event_description,
    coalesce(nullif(trim(_point), ''), 'entrada'), _device_id,
    target_user.id, target_vehicle.id, target_vehicle.plate,
    target_user.full_name, _event_time
  );

  return jsonb_build_object(
    'mode', 'RFID_ENROLLMENT',
    'handled', true,
    'ok', true,
    'message', assignment_message,
    'uid', normalized_uid,
    'plate', target_vehicle.plate,
    'ownerName', target_user.full_name,
    'enrollmentId', enrollment.id
  );
end;
$$;

revoke all on function public.complete_rfid_enrollment(text, text, text, timestamptz) from public;
grant execute on function public.complete_rfid_enrollment(text, text, text, timestamptz) to service_role;

alter table public.app_users enable row level security;
alter table public.vehicles enable row level security;
alter table public.reservations enable row level security;
alter table public.parking_spaces enable row level security;
alter table public.parking_sessions enable row level security;
alter table public.events enable row level security;
alter table public.system_settings enable row level security;
alter table public.rfid_enrollments enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'app_users' and policyname = 'Authenticated users can read app users') then
    create policy "Authenticated users can read app users" on public.app_users for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'vehicles' and policyname = 'Authenticated users can read vehicles') then
    create policy "Authenticated users can read vehicles" on public.vehicles for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'reservations' and policyname = 'Authenticated users can read reservations') then
    create policy "Authenticated users can read reservations" on public.reservations for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'parking_spaces' and policyname = 'Authenticated users can read parking spaces') then
    create policy "Authenticated users can read parking spaces" on public.parking_spaces for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'parking_sessions' and policyname = 'Authenticated users can read parking sessions') then
    create policy "Authenticated users can read parking sessions" on public.parking_sessions for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'events' and policyname = 'Authenticated users can read events') then
    create policy "Authenticated users can read events" on public.events for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'system_settings' and policyname = 'Authenticated users can read system settings') then
    create policy "Authenticated users can read system settings" on public.system_settings for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'rfid_enrollments' and policyname = 'Authenticated users can read rfid enrollments') then
    create policy "Authenticated users can read rfid enrollments" on public.rfid_enrollments for select to authenticated using (true);
  end if;
end;
$$;
