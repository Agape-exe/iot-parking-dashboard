import {
  rfidEnrollmentErrorResponse,
  startRfidEnrollment,
} from "@/lib/rfid-enrollment-service";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const userId = typeof body.userId === "string" ? body.userId : "";
    const vehicleId = typeof body.vehicleId === "string" ? body.vehicleId : "";
    const enrollment = await startRfidEnrollment(userId, vehicleId);

    return Response.json({
      ok: true,
      enrollmentId: enrollment.id,
      expiresAt: enrollment.expires_at,
      message: "Acerque su tarjeta RFID al lector de entrada",
    });
  } catch (error) {
    return rfidEnrollmentErrorResponse("[api/mobile/rfid-enrollments/start]", error);
  }
}
