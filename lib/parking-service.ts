import { calculateAmount, TOTAL_SPACES } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabase-server";
import type { EventType, ParkingEvent, ParkingSession, ParkingSpace } from "@/lib/types";

type EventInput = {
  uid: string;
  eventType: EventType;
  description: string;
  point: string;
  deviceId?: string | null;
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

function isMissingTableError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: string; message?: string };
  return maybeError.code === "PGRST205" || maybeError.message?.includes("schema cache") || maybeError.message?.includes("does not exist");
}

async function registerEvent(input: EventInput) {
  const { error } = await supabaseAdmin().from("events").insert({
    uid: input.uid,
    event_type: input.eventType,
    description: input.description,
    point: input.point,
    device_id: input.deviceId ?? null,
  });

  if (error) {
    logSupabaseError("registerEvent", error);
    throw error;
  }
}

export async function getSpaces() {
  const { data, error } = await supabaseAdmin().from("parking_spaces").select("*").order("number", { ascending: true }).returns<ParkingSpace[]>();

  if (error) {
    logSupabaseError("getSpaces", error);
    if (isMissingTableError(error)) return defaultSpaces();
    throw error;
  }

  const spaces = data ?? [];
  if (spaces.length >= TOTAL_SPACES) return spaces;

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

export async function processEntry(uid: string, deviceId: string | null, point: string) {
  const normalizedUid = uid.trim().toUpperCase();
  const active = await getActiveSession(normalizedUid);

  if (active) {
    await registerEvent({
      uid: normalizedUid,
      eventType: "INTENTO_DOBLE_INGRESO",
      description: "Tarjeta ya registrada dentro del estacionamiento.",
      point,
      deviceId,
    });
    return { allowed: false, message: "Tarjeta ya registrada dentro" };
  }

  const spaces = await getSpaces();
  const activeSessions = await getActiveSessions();
  const occupiedNumbers = new Set(activeSessions.map((session) => session.space_number));
  const freeSpace = spaces.find((space) => space.status === "FREE" && !occupiedNumbers.has(space.number));

  if (!freeSpace || activeSessions.length >= TOTAL_SPACES) {
    await registerEvent({
      uid: normalizedUid,
      eventType: "ESTACIONAMIENTO_LLENO",
      description: "No hay espacios disponibles.",
      point,
      deviceId,
    });
    return { allowed: false, message: "Estacionamiento lleno" };
  }

  const db = supabaseAdmin();
  const { error: sessionError } = await db
    .from("parking_sessions")
    .insert({
      uid: normalizedUid,
      space_number: freeSpace.number,
      status: "INSIDE",
      paid: false,
    })
    .select("id")
    .single();

  if (sessionError) {
    logSupabaseError("processEntry:createSession", sessionError);
    throw sessionError;
  }

  const { error: spaceError } = await db.from("parking_spaces").update({ status: "OCCUPIED", updated_at: new Date().toISOString() }).eq("number", freeSpace.number);
  if (spaceError) {
    logSupabaseError("processEntry:updateSpace", spaceError);
    throw spaceError;
  }

  await registerEvent({
    uid: normalizedUid,
    eventType: "INGRESO",
    description: `Ingreso autorizado en el espacio ${freeSpace.number}.`,
    point,
    deviceId,
  });

  return {
    allowed: true,
    message: "Ingreso autorizado",
    spaceNumber: freeSpace.number,
  };
}

export async function requestPayment(uid: string, deviceId: string | null, point: string) {
  const normalizedUid = uid.trim().toUpperCase();
  const active = await getActiveSession(normalizedUid);

  if (!active) {
    return { allowed: false, message: "No existe una sesion activa para esta tarjeta" };
  }

  const minutes = Math.max(1, Math.ceil((Date.now() - new Date(active.entry_time).getTime()) / 60000));
  const amount = calculateAmount(active.entry_time);

  await registerEvent({
    uid: normalizedUid,
    eventType: "PAGO_SOLICITADO",
    description: `Consulta de pago: ${minutes} minuto(s), monto S/ ${amount.toFixed(2)}.`,
    point,
    deviceId,
  });

  return {
    allowed: true,
    message: "Monto calculado",
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

  if (session.paid) {
    return { message: "El pago ya estaba confirmado", session };
  }

  const amount = calculateAmount(session.entry_time);
  const { data: updated, error: updateError } = await db
    .from("parking_sessions")
    .update({
      paid: true,
      status: "PAID",
      payment_time: new Date().toISOString(),
      amount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id)
    .select("*")
    .single<ParkingSession>();

  if (updateError) {
    logSupabaseError("confirmPayment:updateSession", updateError);
    throw updateError;
  }

  await registerEvent({
    uid: session.uid,
    eventType: "PAGO",
    description: `Pago confirmado por S/ ${amount.toFixed(2)}.`,
    point: "dashboard",
    deviceId: "WEB_ADMIN",
  });

  return { message: "Pago confirmado", session: updated };
}

export async function processExit(uid: string, deviceId: string | null, point: string) {
  const normalizedUid = uid.trim().toUpperCase();
  const active = await getActiveSession(normalizedUid);

  if (!active) {
    return { allowed: false, message: "No existe una sesion activa para esta tarjeta" };
  }

  if (!active.paid) {
    await registerEvent({
      uid: normalizedUid,
      eventType: "PAGO_PENDIENTE",
      description: "Salida denegada: pago pendiente.",
      point,
      deviceId,
    });
    return { allowed: false, message: "Pago pendiente. Salida no autorizada" };
  }

  const db = supabaseAdmin();
  const amount = active.amount ?? calculateAmount(active.entry_time);
  const now = new Date().toISOString();

  const { error: updateError } = await db
    .from("parking_sessions")
    .update({
      exit_time: now,
      status: "EXITED",
      amount,
      updated_at: now,
    })
    .eq("id", active.id);

  if (updateError) {
    logSupabaseError("processExit:updateSession", updateError);
    throw updateError;
  }

  const { error: spaceError } = await db.from("parking_spaces").update({ status: "FREE", updated_at: now }).eq("number", active.space_number);
  if (spaceError) {
    logSupabaseError("processExit:updateSpace", spaceError);
    throw spaceError;
  }

  await registerEvent({
    uid: normalizedUid,
    eventType: "SALIDA",
    description: "Salida autorizada. Espacio liberado.",
    point,
    deviceId,
  });

  return { allowed: true, message: "Salida autorizada", spaceNumber: active.space_number };
}

export async function getEventsToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data, error } = await supabaseAdmin().from("events").select("*").gte("created_at", today.toISOString()).returns<ParkingEvent[]>();

  if (error) {
    logSupabaseError("getEventsToday", error);
    if (isMissingTableError(error)) return [];
    throw error;
  }

  return data ?? [];
}

export async function getOverview() {
  const [spaces, activeSessions, events] = await Promise.all([getSpaces(), getActiveSessions(), getEventsToday()]);
  const occupiedSpaces = activeSessions.length;

  return {
    totalSpaces: TOTAL_SPACES,
    occupiedSpaces,
    freeSpaces: Math.max(0, TOTAL_SPACES - occupiedSpaces),
    vehiclesInside: occupiedSpaces,
    entriesToday: events.filter((event) => event.event_type === "INGRESO").length,
    paymentsToday: events.filter((event) => event.event_type === "PAGO").length,
    exitsToday: events.filter((event) => event.event_type === "SALIDA").length,
    doubleEntryAttemptsToday: events.filter((event) => event.event_type === "INTENTO_DOBLE_INGRESO").length,
    spaces,
    activeSessions,
  };
}
