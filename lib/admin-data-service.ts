import { calculateReservationAvailability, getReservationBlockMessage } from "@/lib/reservation-availability";
import { getOperationalNow } from "@/lib/settings-service";
import { supabaseAdmin } from "@/lib/supabase-server";
import { hourInLima, TOTAL_SPACES } from "@/lib/config";
import type { AppUser, ParkingEvent, ParkingSession, Reservation, Vehicle } from "@/lib/types";
import { expireReservations, getActiveSessions, registerEvent } from "./parking-service";

function db() {
  return supabaseAdmin();
}

export async function listUsers(search = "") {
  const term = search.trim();
  let query = db().from("app_users").select("*").order("created_at", { ascending: false }).limit(300);
  if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`);
  const { data, error } = await query.returns<AppUser[]>();
  if (error) throw error;
  return data ?? [];
}

export async function updateUserStatus(userId: string, status: "ACTIVE" | "INACTIVE") {
  const { data, error } = await db()
    .from("app_users")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select("*")
    .single<AppUser>();
  if (error) throw error;
  return data;
}

export async function listVehicles(search = "") {
  const term = search.trim();
  let query = db().from("vehicles").select("*, app_users(*)").order("created_at", { ascending: false }).limit(300);
  if (term) query = query.or(`plate.ilike.%${term}%,uid.ilike.%${term}%,brand.ilike.%${term}%,model.ilike.%${term}%,color.ilike.%${term}%`);
  const { data, error } = await query.returns<Array<Vehicle & { app_users: AppUser | null }>>();
  if (error) throw error;
  const vehicles = data ?? [];

  if (!term) return vehicles;
  const lower = term.toLowerCase();
  return vehicles.filter((vehicle) => {
    const owner = vehicle.app_users?.full_name.toLowerCase() ?? "";
    return owner.includes(lower) || vehicle.plate.toLowerCase().includes(lower) || vehicle.uid?.toLowerCase().includes(lower) || vehicle.brand.toLowerCase().includes(lower);
  });
}

export async function listReservableVehicles(search = "") {
  const now = await getOperationalNow();
  await expireReservations(now);

  const [vehicles, activeSessions, activeReservationsResult] = await Promise.all([
    listVehicles(search),
    getActiveSessions(),
    db().from("reservations").select("vehicle_id").eq("status", "ACTIVE").gt("expires_at", now.toISOString()),
  ]);

  if (activeReservationsResult.error) throw activeReservationsResult.error;

  const parkedVehicleIds = new Set(activeSessions.map((session) => session.vehicle_id).filter((id): id is string => Boolean(id)));
  const parkedUids = new Set(activeSessions.map((session) => session.uid));
  const reservedVehicleIds = new Set((activeReservationsResult.data ?? []).map((reservation) => reservation.vehicle_id));

  return vehicles.filter((vehicle) => {
    const userIsActive = vehicle.app_users?.status === "ACTIVE";
    const vehicleIsActive = vehicle.status !== "INACTIVE";
    const isParked = parkedVehicleIds.has(vehicle.id) || Boolean(vehicle.uid && parkedUids.has(vehicle.uid));
    const hasActiveReservation = reservedVehicleIds.has(vehicle.id);
    return userIsActive && vehicleIsActive && !isParked && !hasActiveReservation;
  });
}

export async function updateVehicle(vehicleId: string, input: Partial<Pick<Vehicle, "plate" | "brand" | "model" | "color" | "status">>) {
  const { data, error } = await db()
    .from("vehicles")
    .update({ ...input, plate: input.plate?.toUpperCase(), updated_at: new Date().toISOString() })
    .eq("id", vehicleId)
    .select("*")
    .single<Vehicle>();
  if (error) throw error;
  return data;
}

export async function unassignVehicleUid(vehicleId: string) {
  const { data, error } = await db()
    .from("vehicles")
    .update({ uid: null, status: "AVAILABLE", updated_at: new Date().toISOString() })
    .eq("id", vehicleId)
    .select("*")
    .single<Vehicle>();
  if (error) throw error;
  return data;
}

export async function listReservations(filters: { search?: string; status?: string } = {}) {
  await expireReservations(await getOperationalNow());
  let query = db().from("reservations").select("*, app_users(*), vehicles(*)").order("created_at", { ascending: false }).limit(300);
  if (filters.status) query = query.eq("status", filters.status);
  const { data, error } = await query.returns<Array<Reservation & { app_users: AppUser | null; vehicles: Vehicle | null }>>();
  if (error) throw error;
  const rows = data ?? [];
  const term = filters.search?.trim().toLowerCase();
  if (!term) return rows;
  return rows.filter((reservation) => {
    return (
      reservation.plate.toLowerCase().includes(term) ||
      reservation.uid?.toLowerCase().includes(term) ||
      reservation.app_users?.full_name.toLowerCase().includes(term) ||
      reservation.app_users?.email.toLowerCase().includes(term)
    );
  });
}

export async function countActiveReservations(now = new Date()) {
  await expireReservations(now);
  const { count, error } = await db().from("reservations").select("*", { count: "exact", head: true }).eq("status", "ACTIVE").gt("expires_at", now.toISOString());
  if (error) throw error;
  return count ?? 0;
}

export async function getReservationAvailability(now = new Date()) {
  const [activeSessions, activeReservations] = await Promise.all([getActiveSessions(), countActiveReservations(now)]);
  return calculateReservationAvailability(activeSessions.filter((session) => session.space_number <= TOTAL_SPACES).length, activeReservations);
}

export async function createReservation(input: { userId: string; vehicleId: string; durationMinutes?: number; startTime?: string }) {
  const now = await getOperationalNow();
  await expireReservations(now);

  const { data: vehicle, error: vehicleError } = await db().from("vehicles").select("*, app_users(*)").eq("id", input.vehicleId).single<Vehicle & { app_users: AppUser | null }>();
  if (vehicleError) throw vehicleError;
  if (vehicle.user_id !== input.userId) return { ok: false as const, message: "El vehículo no pertenece al usuario seleccionado" };
  if (vehicle.app_users?.status !== "ACTIVE") return { ok: false as const, message: "El usuario no está activo" };
  if (vehicle.status === "INACTIVE") return { ok: false as const, message: "El vehículo no está disponible para reservar" };

  const [activeSessions, activeReservationResult] = await Promise.all([
    getActiveSessions(),
    db()
      .from("reservations")
      .select("id")
      .eq("vehicle_id", input.vehicleId)
      .eq("status", "ACTIVE")
      .gt("expires_at", now.toISOString())
      .limit(1)
      .maybeSingle<Pick<Reservation, "id">>(),
  ]);

  if (activeReservationResult.error) throw activeReservationResult.error;

  const vehicleIsInside = activeSessions.some(
    (session) => session.vehicle_id === vehicle.id || Boolean(vehicle.uid && session.uid === vehicle.uid),
  );
  if (vehicleIsInside) {
    return { ok: false as const, message: "El vehículo ya se encuentra dentro del estacionamiento" };
  }
  if (activeReservationResult.data) {
    return { ok: false as const, message: "El vehículo ya tiene una reserva activa" };
  }

  const availability = calculateReservationAvailability(
    activeSessions.filter((session) => session.space_number <= TOTAL_SPACES).length,
    await countActiveReservations(now),
  );
  const blockMessage = getReservationBlockMessage(availability);
  if (blockMessage) {
    return { ok: false as const, message: blockMessage, availability };
  }

  const start = input.startTime ? new Date(input.startTime) : now;
  const duration = Math.max(1, Number(input.durationMinutes ?? 60));
  const expires = new Date(start.getTime() + duration * 60000);

  const { data: reservation, error } = await db()
    .from("reservations")
    .insert({
      user_id: input.userId,
      vehicle_id: input.vehicleId,
      plate: vehicle.plate,
      uid: vehicle.uid,
      start_time: start.toISOString(),
      expires_at: expires.toISOString(),
      status: "ACTIVE",
    })
    .select("*")
    .single<Reservation>();

  if (error) throw error;

  await registerEvent({
    uid: vehicle.uid ?? "SIN_UID",
    eventType: "RESERVA_CREADA",
    description: `Reserva creada para placa ${vehicle.plate}.`,
    point: "dashboard",
    deviceId: "WEB_ADMIN",
    userId: input.userId,
    vehicleId: input.vehicleId,
    reservationId: reservation.id,
    plate: vehicle.plate,
    ownerName: vehicle.app_users?.full_name ?? null,
  });

  return { ok: true as const, message: "Reserva creada", reservation, availability: calculateReservationAvailability(availability.occupiedSpaces, availability.activeReservations + 1) };
}

export async function cancelReservation(id: string) {
  const now = await getOperationalNow();
  const { data, error } = await db()
    .from("reservations")
    .update({ status: "CANCELLED", updated_at: now.toISOString() })
    .eq("id", id)
    .eq("status", "ACTIVE")
    .select("*")
    .single<Reservation>();
  if (error) throw error;

  await registerEvent({
    uid: data.uid ?? "SIN_UID",
    eventType: "RESERVA_CANCELADA",
    description: `Reserva cancelada para placa ${data.plate}.`,
    point: "dashboard",
    deviceId: "WEB_ADMIN",
    userId: data.user_id,
    vehicleId: data.vehicle_id,
    reservationId: data.id,
    plate: data.plate,
  });

  return data;
}

export async function listReportRows(filters: {
  uid?: string | null;
  plate?: string | null;
  user?: string | null;
  eventType?: string | null;
  start: string;
  endExclusive: string;
}) {
  let query = db().from("events").select("*").order("created_at", { ascending: false }).limit(500);
  if (filters.uid) query = query.eq("uid", filters.uid.trim().toUpperCase());
  if (filters.plate) query = query.ilike("plate", `%${filters.plate.trim()}%`);
  if (filters.user) query = query.ilike("owner_name", `%${filters.user.trim()}%`);
  if (filters.eventType) query = query.eq("event_type", filters.eventType);
  query = query.gte("created_at", filters.start).lt("created_at", filters.endExclusive);

  const { data, error } = await query.returns<ParkingEvent[]>();
  if (error) throw error;
  return data ?? [];
}

export async function getPlateReport(plate: string, range: { start: string; endExclusive: string }) {
  const normalized = plate.trim().toUpperCase();
  const { data: sessions, error: sessionError } = await db()
    .from("parking_sessions")
    .select("*")
    .eq("plate", normalized)
    .gte("entry_time", range.start)
    .lt("entry_time", range.endExclusive)
    .order("entry_time", { ascending: false })
    .limit(100)
    .returns<ParkingSession[]>();
  if (sessionError) throw sessionError;

  const { data: events, error: eventsError } = await db()
    .from("events")
    .select("*")
    .eq("plate", normalized)
    .gte("created_at", range.start)
    .lt("created_at", range.endExclusive)
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<ParkingEvent[]>();
  if (eventsError) throw eventsError;

  return { sessions: sessions ?? [], events: events ?? [] };
}

export function groupPeakHours(events: ParkingEvent[]) {
  const rows = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, "0")}:00 - ${String(hour + 1).padStart(2, "0")}:00`,
    count: 0,
  }));
  events.forEach((event) => {
    if (event.event_type === "INGRESO") rows[hourInLima(event.created_at)].count += 1;
  });
  const peak = rows.reduce((best, row) => (row.count > best.count ? row : best), rows[0]);
  return { rows, peak };
}
