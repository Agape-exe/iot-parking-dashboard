import {
  cancelRfidEnrollment,
  rfidEnrollmentErrorResponse,
  toEnrollmentPayload,
} from "@/lib/rfid-enrollment-service";

export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const enrollment = await cancelRfidEnrollment(id);
    return Response.json({
      ...toEnrollmentPayload(enrollment),
      message: enrollment.status === "CANCELLED" ? "Registro cancelado." : toEnrollmentPayload(enrollment).message,
    });
  } catch (error) {
    return rfidEnrollmentErrorResponse("[api/mobile/rfid-enrollments/cancel]", error);
  }
}
