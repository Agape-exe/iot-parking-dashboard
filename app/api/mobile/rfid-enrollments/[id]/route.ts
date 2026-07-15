import {
  getRfidEnrollment,
  rfidEnrollmentErrorResponse,
  toEnrollmentPayload,
} from "@/lib/rfid-enrollment-service";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const enrollment = await getRfidEnrollment(id);
    return Response.json(toEnrollmentPayload(enrollment));
  } catch (error) {
    return rfidEnrollmentErrorResponse("[api/mobile/rfid-enrollments/get]", error);
  }
}
