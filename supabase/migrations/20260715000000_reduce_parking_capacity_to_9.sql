insert into public.parking_spaces (number, status)
select number, 'FREE'
from generate_series(1, 9) as number
on conflict (number) do nothing;

delete from public.parking_spaces as space
where space.number > 9
  and not exists (
    select 1
    from public.parking_sessions as session
    where session.space_number = space.number
  );

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
