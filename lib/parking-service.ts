import { calculateAmount, hourInLima, TOTAL_SPACES } from "@/lib/config";
import { getOrAssignVehicleByUid } from "@/lib/demo-data-service";
import { dateKeyInLima, resolveReportRange } from "@/lib/report-period";
import { calculateReservationAvailability } from "@/lib/reservation-availability";
import { getOperationalNow, getSettings } from "@/lib/settings-service";
import { supabaseAdmin } from "@/lib/supabase-server";
import type { AppUser, EventType, ParkingEvent, ParkingSession, ParkingSpace, Reservation, Vehicle } from "@/lib/types";

type EventInput = {
  uid: string;
  eventType: EventType;
  description: string;
  point: string;
  deviceId?: string | null;
  userId?: string | null;
  vehicleId?: string | null;
  reservationId?: string | null;
  plate?: string | null;
  ownerName?: string | null;
  createdAt?: string;
};

type EntryIdentity = {
  userId: string | null;
  vehicleId: string | null;
  plate: string | null;
  ownerName: string | null;
};

export function defaultSpaces(): ParkingSpace[] {
  const now = new Date().toISOString();
  return Array.from({ length: TOTAL_SPACES }, (_, index) => ({
    id: `demo-space-${index + 1}`,
    number: index + 1,
    status: "FREE",
    created_at: now,
    updated_at: now,
  }));
}

function logSupabaseError(context: string, error: unknown) {
  console.error(`[Supabase:${context}]`, error);
}

function errorDetails(error: unknown) {
  if (!error || typeof error !== "object") return { code: "", message: String(error ?? "") };
  const value = error as { code?: string; message?: string; details?: string; hint?: string };
  return {
    code: value.code ?? "",
    message: [value.message, value.details, value.hint].filter(Boolean).join(" "),
  };
}

function isSchemaCompatibilityError(error: unknown) {
  const { code, message } = errorDetails(error);
  return (
    ["PGRST202", "PGRST204", "PGRST205", "42703", "42P01"].includes(code) ||
    /schema cache|does not exist|could not find|column .* not found|function .* not found/i.test(message)
  );
}

function isMissingTableError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: string; message?: string };
  return maybeError.code === "PGRST205" || maybeError.message?.includes("schema cache") || maybeError.message?.includes("does not exist");
}

function normalizeUid(uid: string) {
  return uid.trim().toUpperCase();
}

export async function registerEvent(input: EventInput) {
  const db = supabaseAdmin();
  const createdAt = input.createdAt ?? (await getOperationalNow()).toISOString();
  const { error } = await db.from("events").insert({
    uid: input.uid,
    event_type: input.eventType,
    description: input.description,
    point: input.point,
    device_id: input.deviceId ?? null,
    user_id: input.userId ?? null,
    vehicle_id: input.vehicleId ?? null,
    reservation_id: input.reservationId ?? null,
    plate: input.plate ?? null,
    owner_name: input.ownerName ?? null,
    created_at: createdAt,
  });

  if (!error) return true;
  logSupabaseError("registerEvent:enriched", error);

  if (isSchemaCompatibilityError(error)) {
    const { error: legacyError } = await db.from("events").insert({
      uid: input.uid,
      event_type: input.eventType,
      description: input.description,
      point: input.point,
      device_id: input.deviceId ?? null,
      created_at: createdAt,
    });
    if (!legacyError) return true;
    logSupabaseError("registerEvent:legacy", legacyError);
  }

  return false;
}

function temporaryIdentity(uid: string): EntryIdentity {
  let hash = 0;
  for (const character of uid) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  const letters = Array.from({ length: 3 }, (_, index) => String.fromCharCode(65 + ((hash >>> (index * 5)) % 26))).join("");
  return {
    userId: null,
    vehicleId: null,
    plate: `${letters}-${String(hash % 1000).padStart(3, "0")}`,
    ownerName: "Usuario temporal",
  };
}

async function getEntryIdentity(uid: string): Promise<EntryIdentity> {
  try {
    const assignment = await getOrAssignVehicleByUid(uid);
    return {
      userId: assignment.user.id,
      vehicleId: assignment.vehicle.id,
      plate: assignment.vehicle.plate,
      ownerName: assignment.user.full_name,
    };
  } catch (error) {
    logSupabaseError("getEntryIdentity:temporary-fallback", error);
    return temporaryIdentity(uid);
  }
}

export async function getSpaces() {
  const { data, error } = await supabaseAdmin()
    .from("parking_spaces")
    .select("*")
    .lte("number", TOTAL_SPACES)
    .order("number", { ascending: true })
    .returns<ParkingSpace[]>();

  if (error) {
    logSupabaseError("getSpaces", error);
    if (isMissingTableError(error)) return defaultSpaces();
    throw error;
  }

  const spaces = data ?? [];
  if (spaces.length >= TOTAL_SPACES) return spaces.slice(0, TOTAL_SPACES);

  const byNumber = new Map(spaces.map((space) => [space.number, space]));
  return defaultSpaces().map((fallback) => byNumber.get(fallback.number) ?? fallback);
}

export async function getActiveSessions() {
  const { data, error } = await supabaseAdmin()
    .from("parking_sessions")
    .select("*")
    .in("status", ["INSIDE", "PAID"])
    .is("exit_time", null)
    .order("entry_time", { ascending: true })
    .returns<ParkingSession[]>();

  if (error) {
    logSupabaseError("getActiveSessions", error);
    if (isMissingTableError(error)) return [];
    throw error;
  }

  return data ?? [];
}

export async function getActiveSession(uid: string) {
  const { data, error } = await supabaseAdmin()
    .from("parking_sessions")
    .select("*")
    .eq("uid", uid)
    .in("status", ["INSIDE", "PAID"])
    .is("exit_time", null)
    .maybeSingle<ParkingSession>();

  if (error) {
    logSupabaseError("getActiveSession", error);
    throw error;
  }

  return data;
}

export async function expireReservations(now = new Date()) {
  const { data, error } = await supabaseAdmin().rpc("expire_reservations", { _now: now.toISOString() });
  if (error) {
    const { code, message } = errorDetails(error);
    if (code === "PGRST202" || /function .* not found|could not find the function/i.test(message)) {
      const { data: expired, error: fallbackError } = await supabaseAdmin()
        .from("reservations")
        .update({ status: "EXPIRED", updated_at: now.toISOString() })
        .eq("status", "ACTIVE")
        .lte("expires_at", now.toISOString())
        .select("id");
      if (!fallbackError) return expired?.length ?? 0;
      if (isSchemaCompatibilityError(fallbackError)) return 0;
      console.error("[expireReservations:fallback]", fallbackError);
      return 0;
    }
    if (isSchemaCompatibilityError(error)) return 0;
    console.error("[expireReservations]", error);
    return 0;
  }
  return Number(data ?? 0);
}

async function getActiveReservation(vehicleId: string | null, now: Date) {
  if (!vehicleId) return null;
  await expireReservations(now);

  const { data, error } = await supabaseAdmin()
    .from("reservations")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .eq("status", "ACTIVE")
    .gt("expires_at", now.toISOString())
    .order("expires_at", { ascending: true })
    .limit(1)
    .maybeSingle<Reservation>();

  if (error) {
    if (isSchemaCompatibilityError(error)) {
      logSupabaseError("getActiveReservation:compatibility-fallback", error);
      return null;
    }
    throw error;
  }
  return data;
}

async function fallbackProcessEntry(uid: string, deviceId: string | null, point: string, identity: EntryIdentity, now: Date, reservation: Reservation | null) {
  const active = await getActiveSession(uid);

  if (active) {
    await registerEvent({
      uid,
      eventType: "INTENTO_DOBLE_INGRESO",
      description: "Tarjeta ya registrada dentro del estacionamiento.",
      point,
      deviceId,
      userId: active.user_id ?? identity.userId,
      vehicleId: active.vehicle_id ?? identity.vehicleId,
      plate: active.plate ?? identity.plate,
      ownerName: active.owner_name ?? identity.ownerName,
      createdAt: now.toISOString(),
    });
    return {
      allowed: false,
      message: "Tarjeta ya registrada dentro",
      uid,
      plate: active.plate ?? identity.plate,
      ownerName: active.owner_name ?? identity.ownerName,
    };
  }

  const spaces = await getSpaces();
  const activeSessions = await getActiveSessions();
  const operationalActiveSessions = activeSessions.filter((session) => session.space_number <= TOTAL_SPACES);
  const occupiedNumbers = new Set(activeSessions.map((session) => session.space_number));
  const freeSpace = spaces.find((space) => space.status === "FREE" && !occupiedNumbers.has(space.number));

  if (!freeSpace || operationalActiveSessions.length >= TOTAL_SPACES) {
    await registerEvent({
      uid,
      eventType: "ESTACIONAMIENTO_LLENO",
      description: "No hay espacios disponibles.",
      point,
      deviceId,
      userId: identity.userId,
      vehicleId: identity.vehicleId,
      plate: identity.plate,
      ownerName: identity.ownerName,
      createdAt: now.toISOString(),
    });
    return {
      allowed: false,
      message: "Estacionamiento lleno",
      uid,
      plate: identity.plate,
      ownerName: identity.ownerName,
    };
  }

  const db = supabaseAdmin();
  const enrichedInsert = await db
    .from("parking_sessions")
    .insert({
      uid,
      space_number: freeSpace.number,
      status: "INSIDE",
      paid: false,
      user_id: identity.userId,
      vehicle_id: identity.vehicleId,
      reservation_id: reservation?.id ?? null,
      plate: identity.plate,
      owner_name: identity.ownerName,
      entry_time: now.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .select("id")
    .single<{ id: string }>();

  let session = enrichedInsert.data;
  let sessionError = enrichedInsert.error;

  if (sessionError && isSchemaCompatibilityError(sessionError)) {
    logSupabaseError("fallbackProcessEntry:legacy-session", sessionError);
    const legacyInsert = await db
      .from("parking_sessions")
      .insert({
        uid,
        space_number: freeSpace.number,
        status: "INSIDE",
        paid: false,
        entry_time: now.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select("id")
      .single<{ id: string }>();
    session = legacyInsert.data;
    sessionError = legacyInsert.error;
  }

  if (sessionError) {
    const { code } = errorDetails(sessionError);
    if (code === "23505") {
      const concurrentSession = await getActiveSession(uid);
      await registerEvent({
        uid,
        eventType: "INTENTO_DOBLE_INGRESO",
        description: "Tarjeta ya registrada dentro del estacionamiento.",
        point,
        deviceId,
        plate: concurrentSession?.plate ?? identity.plate,
        ownerName: concurrentSession?.owner_name ?? identity.ownerName,
        createdAt: now.toISOString(),
      });
      return {
        allowed: false,
        message: "Tarjeta ya registrada dentro",
        uid,
        plate: concurrentSession?.plate ?? identity.plate,
        ownerName: concurrentSession?.owner_name ?? identity.ownerName,
      };
    }
    throw sessionError;
  }

  if (!session) throw new Error("La base de datos no devolvio la sesion creada.");

  const { error: spaceError } = await db.from("parking_spaces").update({ status: "OCCUPIED", updated_at: now.toISOString() }).eq("number", freeSpace.number);
  if (spaceError) logSupabaseError("fallbackProcessEntry:updateSpace", spaceError);
  if (reservation) {
    const { error: reservationError } = await db.from("reservations").update({ status: "USED", updated_at: now.toISOString() }).eq("id", reservation.id);
    if (reservationError) logSupabaseError("fallbackProcessEntry:updateReservation", reservationError);
    await registerEvent({
      uid,
      eventType: "RESERVA_USADA",
      description: "Reserva asociada al ingreso RFID.",
      point,
      deviceId,
      userId: identity.userId,
      vehicleId: identity.vehicleId,
      reservationId: reservation.id,
      plate: identity.plate,
      ownerName: identity.ownerName,
      createdAt: now.toISOString(),
    });
  }

  await registerEvent({
    uid,
    eventType: "INGRESO",
    description: `Ingreso autorizado en el espacio ${freeSpace.number}.`,
    point,
    deviceId,
    userId: identity.userId,
    vehicleId: identity.vehicleId,
    reservationId: reservation?.id ?? null,
    plate: identity.plate,
    ownerName: identity.ownerName,
    createdAt: now.toISOString(),
  });

  return {
    allowed: true,
    message: "Ingreso autorizado",
    spaceNumber: freeSpace.number,
    sessionId: session.id,
    uid,
    plate: identity.plate,
    ownerName: identity.ownerName,
    reservationId: reservation?.id ?? null,
  };
}

export async function processEntry(rawUid: string, deviceId: string | null, point: string) {
  const uid = normalizeUid(rawUid);
  const now = await getOperationalNow();
  const identity = await getEntryIdentity(uid);
  const reservation = await getActiveReservation(identity.vehicleId, now);

  const { data, error } = await supabaseAdmin().rpc("reserve_parking_entry", {
    _uid: uid,
    _device_id: deviceId,
    _point: point,
    _user_id: identity.userId,
    _vehicle_id: identity.vehicleId,
    _plate: identity.plate,
    _owner_name: identity.ownerName,
    _reservation_id: reservation?.id ?? null,
    _event_time: now.toISOString(),
  });

  if (error) {
    logSupabaseError("processEntry:rpc", error);
    if (isSchemaCompatibilityError(error)) {
      return fallbackProcessEntry(uid, deviceId, point, identity, now, reservation);
    }
    throw error;
  }

  const payload = data as Record<string, unknown>;
  return {
    ...payload,
    allowed: Boolean(payload.allowed),
    message: String(payload.message ?? "Ingreso procesado"),
    uid,
    plate: identity.plate,
    ownerName: identity.ownerName,
  };
}

export async function requestPayment(rawUid: string, deviceId: string | null, point: string) {
  const uid = normalizeUid(rawUid);
  const active = await getActiveSession(uid);

  if (!active) {
    await registerEvent({
      uid,
      eventType: "SALIDA_DENEGADA",
      description: "Consulta de pago denegada: no existe sesion activa.",
      point,
      deviceId,
    });
    return { allowed: false, message: "No hay sesion activa para esta tarjeta", uid };
  }

  const minutes = Math.max(1, Math.ceil((Date.now() - new Date(active.entry_time).getTime()) / 60000));
  const amount = calculateAmount(active.entry_time);

  await registerEvent({
    uid,
    eventType: "PAGO_SOLICITADO",
    description: `Consulta de pago: ${minutes} minuto(s), monto S/ ${amount.toFixed(2)}.`,
    point,
    deviceId,
    userId: active.user_id,
    vehicleId: active.vehicle_id,
    reservationId: active.reservation_id,
    plate: active.plate,
    ownerName: active.owner_name,
  });

  return {
    allowed: true,
    message: "Monto calculado",
    uid,
    plate: active.plate,
    ownerName: active.owner_name,
    minutes,
    amount,
    paid: active.paid,
    status: active.status,
  };
}

export async function confirmPayment(sessionId: string) {
  const db = supabaseAdmin();
  const { data: session, error } = await db
    .from("parking_sessions")
    .select("*")
    .eq("id", sessionId)
    .in("status", ["INSIDE", "PAID"])
    .is("exit_time", null)
    .single<ParkingSession>();

  if (error) {
    logSupabaseError("confirmPayment:getSession", error);
    throw error;
  }

  return applyPayment(session, "dashboard", "WEB_ADMIN");
}

async function applyPayment(session: ParkingSession, point: string, deviceId: string | null) {
  if (session.paid) {
    return { message: point === "pago" ? "Pago ya confirmado" : "El pago ya estaba confirmado", session };
  }

  const db = supabaseAdmin();
  const paymentTime = await getOperationalNow();
  const amount = calculateAmount(session.entry_time, paymentTime);
  const { data: updated, error: updateError } = await db
    .from("parking_sessions")
    .update({
      paid: true,
      status: "PAID",
      payment_time: paymentTime.toISOString(),
      amount,
      updated_at: paymentTime.toISOString(),
    })
    .eq("id", session.id)
    .eq("paid", false)
    .in("status", ["INSIDE", "PAID"])
    .is("exit_time", null)
    .select("*")
    .maybeSingle<ParkingSession>();

  if (updateError) {
    logSupabaseError("confirmPayment:updateSession", updateError);
    throw updateError;
  }

  if (!updated) {
    const refreshed = await getActiveSession(session.uid);
    if (refreshed?.paid) {
      return { message: point === "pago" ? "Pago ya confirmado" : "El pago ya estaba confirmado", session: refreshed };
    }
    throw new Error("La sesion ya no esta disponible para confirmar el pago.");
  }

  const { error: spaceError } = await db.from("parking_spaces").update({ status: "PAID", updated_at: paymentTime.toISOString() }).eq("number", session.space_number);
  if (spaceError) {
    // El esquema anterior solo permite FREE/OCCUPIED; la sesion pagada sigue siendo la fuente de verdad.
    logSupabaseError("confirmPayment:updateSpace", spaceError);
  }

  await registerEvent({
    uid: session.uid,
    eventType: "PAGO",
    description: point === "pago" ? `Pago confirmado desde caseta RFID por S/ ${amount.toFixed(2)}.` : `Pago confirmado por S/ ${amount.toFixed(2)}.`,
    point,
    deviceId,
    userId: session.user_id,
    vehicleId: session.vehicle_id,
    reservationId: session.reservation_id,
    plate: session.plate,
    ownerName: session.owner_name,
    createdAt: paymentTime.toISOString(),
  });

  return { message: "Pago confirmado", session: updated };
}

export async function confirmPaymentByUid(rawUid: string, deviceId: string | null, point: string) {
  const uid = normalizeUid(rawUid);
  const db = supabaseAdmin();
  const { data: vehicle, error: vehicleError } = await db
    .from("vehicles")
    .select("*, app_users(*)")
    .ilike("uid", uid)
    .maybeSingle<Vehicle & { app_users: AppUser | null }>();

  if (vehicleError) {
    logSupabaseError("confirmPaymentByUid:getVehicle", vehicleError);
    throw vehicleError;
  }

  if (!vehicle) {
    return { allowed: false, ok: false, paid: false, message: "UID no asociado a un vehiculo" };
  }

  const active = await getActiveSession(uid);
  if (!active) {
    const { data: latest, error: latestError } = await db
      .from("parking_sessions")
      .select("*")
      .eq("uid", uid)
      .order("entry_time", { ascending: false })
      .limit(1)
      .maybeSingle<ParkingSession>();
    if (latestError) throw latestError;
    return {
      allowed: false,
      ok: false,
      paid: false,
      message: latest?.status === "EXITED" || latest?.exit_time ? "La sesion ya fue finalizada" : "El vehiculo no tiene una sesion activa dentro",
      plate: vehicle.plate,
      ownerName: vehicle.app_users?.full_name ?? null,
    };
  }

  const result = await applyPayment(active, point || "pago", deviceId);
  const paidSession = result.session;
  const amount = paidSession.amount ?? calculateAmount(paidSession.entry_time, paidSession.payment_time ? new Date(paidSession.payment_time) : await getOperationalNow());
  return {
    allowed: true,
    ok: true,
    paid: true,
    message: result.message,
    amount,
    plate: paidSession.plate ?? vehicle.plate,
    ownerName: paidSession.owner_name ?? vehicle.app_users?.full_name ?? null,
    uid,
  };
}

export async function processExit(rawUid: string, deviceId: string | null, point: string) {
  const uid = normalizeUid(rawUid);
  const active = await getActiveSession(uid);

  if (!active) {
    await registerEvent({
      uid,
      eventType: "SALIDA_DENEGADA",
      description: "Salida denegada: no existe sesion activa.",
      point,
      deviceId,
    });
    return { allowed: false, message: "No hay sesion activa para esta tarjeta", uid };
  }

  if (!active.paid) {
    await registerEvent({
      uid,
      eventType: "PAGO_PENDIENTE",
      description: "Salida denegada: pago pendiente.",
      point,
      deviceId,
      userId: active.user_id,
      vehicleId: active.vehicle_id,
      reservationId: active.reservation_id,
      plate: active.plate,
      ownerName: active.owner_name,
    });
    return {
      allowed: false,
      message: "Pago pendiente. Salida no autorizada",
      uid,
      plate: active.plate,
      ownerName: active.owner_name,
    };
  }

  const db = supabaseAdmin();
  const exitTime = await getOperationalNow();
  const amount = active.amount ?? calculateAmount(active.entry_time, exitTime);

  const { error: updateError } = await db
    .from("parking_sessions")
    .update({
      exit_time: exitTime.toISOString(),
      status: "EXITED",
      amount,
      updated_at: exitTime.toISOString(),
    })
    .eq("id", active.id);

  if (updateError) {
    logSupabaseError("processExit:updateSession", updateError);
    throw updateError;
  }

  const { error: spaceError } = await db.from("parking_spaces").update({ status: "FREE", updated_at: exitTime.toISOString() }).eq("number", active.space_number);
  if (spaceError) {
    logSupabaseError("processExit:updateSpace", spaceError);
  }

  await registerEvent({
    uid,
    eventType: "SALIDA",
    description: "Salida autorizada. Espacio liberado.",
    point,
    deviceId,
    userId: active.user_id,
    vehicleId: active.vehicle_id,
    reservationId: active.reservation_id,
    plate: active.plate,
    ownerName: active.owner_name,
    createdAt: exitTime.toISOString(),
  });

  return {
    allowed: true,
    message: "Salida autorizada",
    spaceNumber: active.space_number,
    uid,
    plate: active.plate,
    ownerName: active.owner_name,
  };
}

export async function getEventsToday() {
  const now = await getOperationalNow();
  const range = resolveReportRange({ period: "day" }, dateKeyInLima(now));

  const { data, error } = await supabaseAdmin()
    .from("events")
    .select("*")
    .gte("created_at", range.start)
    .lt("created_at", range.endExclusive)
    .returns<ParkingEvent[]>();

  if (error) {
    logSupabaseError("getEventsToday", error);
    if (isMissingTableError(error)) return [];
    throw error;
  }

  return data ?? [];
}

async function countRows(table: string, filter?: "vehiclesWithUid" | "activeReservations", now = new Date()) {
  let query = supabaseAdmin().from(table).select("*", { count: "exact", head: true });
  if (filter === "vehiclesWithUid") query = query.not("uid", "is", null);
  if (filter === "activeReservations") query = query.eq("status", "ACTIVE").gt("expires_at", now.toISOString());
  const { count, error } = await query;
  if (error) {
    if (isSchemaCompatibilityError(error)) {
      logSupabaseError(`countRows:${table}:compatibility-fallback`, error);
      return 0;
    }
    throw error;
  }
  return count ?? 0;
}

export async function getOverview() {
  const now = await getOperationalNow();
  await expireReservations(now);
  const [spaces, activeSessions, events, settings, usersCount, vehiclesCount, vehiclesWithUid, activeReservations] = await Promise.all([
    getSpaces(),
    getActiveSessions(),
    getEventsToday(),
    getSettings(),
    countRows("app_users"),
    countRows("vehicles"),
    countRows("vehicles", "vehiclesWithUid"),
    countRows("reservations", "activeReservations", now),
  ]);

  const operationalSessions = activeSessions.filter((session) => session.space_number <= TOTAL_SPACES);
  const availability = calculateReservationAvailability(operationalSessions.length, activeReservations);
  const occupiedSpaces = availability.occupiedSpaces;
  const paidAwaitingExit = activeSessions.filter((session) => session.status === "PAID" || session.paid).length;
  const eventCounts = events.reduce<Record<string, number>>((acc, event) => {
    acc[event.event_type] = (acc[event.event_type] ?? 0) + 1;
    return acc;
  }, {});
  const entriesByHour = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: events.filter((event) => event.event_type === "INGRESO" && hourInLima(event.created_at) === hour).length,
  }));

  return {
    totalSpaces: availability.totalSpaces,
    occupiedSpaces,
    freeSpaces: availability.freeSpaces,
    vehiclesInside: occupiedSpaces,
    paidAwaitingExit,
    activeReservations: availability.activeReservations,
    reservationLimit: availability.reservationLimit,
    availableCapacity: availability.availableCapacity,
    reservationAvailable: availability.reservationAvailable,
    usersCount,
    vehiclesCount,
    vehiclesWithUid,
    vehiclesWithoutUid: Math.max(0, vehiclesCount - vehiclesWithUid),
    entriesToday: events.filter((event) => event.event_type === "INGRESO").length,
    paymentsToday: events.filter((event) => event.event_type === "PAGO").length,
    exitsToday: events.filter((event) => event.event_type === "SALIDA").length,
    doubleEntryAttemptsToday: events.filter((event) => event.event_type === "INTENTO_DOBLE_INGRESO").length,
    deniedExitsToday: events.filter((event) => event.event_type === "SALIDA_DENEGADA" || event.event_type === "PAGO_PENDIENTE").length,
    eventCounts,
    entriesByHour,
    spaces,
    activeSessions,
    settings,
  };
}
