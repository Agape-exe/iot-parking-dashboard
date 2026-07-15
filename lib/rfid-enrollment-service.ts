import { supabaseAdmin } from "@/lib/supabase-server";
import type { AppUser, RfidEnrollment, Vehicle } from "@/lib/types";

const ENROLLMENT_DURATION_MS = 60_000;

export class RfidEnrollmentError extends Error {
  constructor(
    message: string,
    public readonly status = 500,
  ) {
    super(message);
    this.name = "RfidEnrollmentError";
  }
}

function enrollmentMessage(enrollment: RfidEnrollment) {
  if (enrollment.message) return enrollment.message;
  switch (enrollment.status) {
    case "PENDING":
      return "Esperando lectura RFID";
    case "COMPLETED":
      return "RFID registrada correctamente";
    case "EXPIRED":
      return "El tiempo para registrar la RFID venció.";
    case "CANCELLED":
      return "Registro cancelado.";
    case "FAILED":
      return "No se pudo registrar la RFID.";
  }
}

export function toEnrollmentPayload(enrollment: RfidEnrollment) {
  return {
    id: enrollment.id,
    status: enrollment.status,
    uid: enrollment.uid,
    message: enrollmentMessage(enrollment),
    expiresAt: enrollment.expires_at,
    createdAt: enrollment.created_at,
    completedAt: enrollment.completed_at,
    cancelledAt: enrollment.cancelled_at,
  };
}

export async function startRfidEnrollment(userId: string, vehicleId: string) {
  const normalizedUserId = userId.trim();
  const normalizedVehicleId = vehicleId.trim();
  if (!normalizedUserId || !normalizedVehicleId) {
    throw new RfidEnrollmentError("Usuario y vehículo son requeridos.", 400);
  }

  const db = supabaseAdmin();
  const [{ data: user, error: userError }, { data: vehicle, error: vehicleError }] = await Promise.all([
    db.from("app_users").select("id").eq("id", normalizedUserId).maybeSingle<Pick<AppUser, "id">>(),
    db
      .from("vehicles")
      .select("id, user_id")
      .eq("id", normalizedVehicleId)
      .maybeSingle<Pick<Vehicle, "id" | "user_id">>(),
  ]);

  if (userError) throw userError;
  if (vehicleError) throw vehicleError;
  if (!user) throw new RfidEnrollmentError("El usuario no existe.", 404);
  if (!vehicle) throw new RfidEnrollmentError("El vehículo no existe.", 404);
  if (vehicle.user_id !== normalizedUserId) {
    throw new RfidEnrollmentError("El vehículo no pertenece al usuario.", 403);
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + ENROLLMENT_DURATION_MS).toISOString();

  const { error: expireError } = await db
    .from("rfid_enrollments")
    .update({ status: "EXPIRED", message: "El tiempo para registrar la RFID venció." })
    .eq("user_id", normalizedUserId)
    .eq("vehicle_id", normalizedVehicleId)
    .eq("status", "PENDING")
    .lte("expires_at", nowIso);
  if (expireError) throw expireError;

  const { error: cancelError } = await db
    .from("rfid_enrollments")
    .update({
      status: "CANCELLED",
      cancelled_at: nowIso,
      message: "Registro cancelado por una nueva solicitud.",
    })
    .eq("user_id", normalizedUserId)
    .eq("vehicle_id", normalizedVehicleId)
    .eq("status", "PENDING");
  if (cancelError) throw cancelError;

  const { data: enrollment, error: insertError } = await db
    .from("rfid_enrollments")
    .insert({
      user_id: normalizedUserId,
      vehicle_id: normalizedVehicleId,
      status: "PENDING",
      expires_at: expiresAt,
      message: "Esperando lectura RFID",
    })
    .select("*")
    .single<RfidEnrollment>();
  if (insertError) throw insertError;

  return enrollment;
}

export async function getRfidEnrollment(id: string) {
  const enrollmentId = id.trim();
  if (!enrollmentId) throw new RfidEnrollmentError("Solicitud RFID no válida.", 400);

  const db = supabaseAdmin();
  const nowIso = new Date().toISOString();
  const { error: expireError } = await db
    .from("rfid_enrollments")
    .update({ status: "EXPIRED", message: "El tiempo para registrar la RFID venció." })
    .eq("id", enrollmentId)
    .eq("status", "PENDING")
    .lte("expires_at", nowIso);
  if (expireError) throw expireError;

  const { data: enrollment, error } = await db
    .from("rfid_enrollments")
    .select("*")
    .eq("id", enrollmentId)
    .maybeSingle<RfidEnrollment>();
  if (error) throw error;
  if (!enrollment) throw new RfidEnrollmentError("La solicitud RFID no existe.", 404);
  return enrollment;
}

export async function cancelRfidEnrollment(id: string) {
  const enrollment = await getRfidEnrollment(id);
  if (enrollment.status !== "PENDING") return enrollment;

  const db = supabaseAdmin();
  const cancelledAt = new Date().toISOString();
  const { data, error } = await db
    .from("rfid_enrollments")
    .update({ status: "CANCELLED", cancelled_at: cancelledAt, message: "Registro cancelado." })
    .eq("id", enrollment.id)
    .eq("status", "PENDING")
    .select("*")
    .maybeSingle<RfidEnrollment>();
  if (error) throw error;
  return data ?? getRfidEnrollment(enrollment.id);
}

export type RfidScanResult = {
  mode: "NORMAL_ENTRY" | "RFID_ENROLLMENT";
  handled: boolean;
  ok?: boolean;
  message: string;
  uid?: string;
  plate?: string;
  ownerName?: string;
  enrollmentId?: string;
};

export async function completeRfidEnrollment(uid: string, deviceId: string | null, point: string | null) {
  const normalizedUid = uid.trim().toUpperCase();
  if (!normalizedUid) throw new RfidEnrollmentError("UID requerido.", 400);

  const { data, error } = await supabaseAdmin().rpc("complete_rfid_enrollment", {
    _uid: normalizedUid,
    _device_id: deviceId,
    _point: point ?? "entrada",
  });
  if (error) throw error;
  if (!data || typeof data !== "object") {
    throw new Error("La base de datos no devolvió el resultado de la vinculación RFID.");
  }
  return data as RfidScanResult;
}

export function rfidEnrollmentErrorResponse(context: string, error: unknown) {
  console.error(context, error);
  const status = error instanceof RfidEnrollmentError ? error.status : 500;
  const message =
    error instanceof RfidEnrollmentError
      ? error.message
      : "No se pudo procesar la solicitud RFID. Revisa la configuración de base de datos.";
  return Response.json({ ok: false, message }, { status });
}
