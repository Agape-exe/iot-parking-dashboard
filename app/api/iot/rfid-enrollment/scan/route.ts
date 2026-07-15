import { requireIotDevice } from "@/lib/auth-server";
import { iotErrorResponse, readIotRequest } from "@/lib/iot-route";
import { completeRfidEnrollment } from "@/lib/rfid-enrollment-service";

export async function POST(request: Request) {
  try {
    const parsed = await readIotRequest(request);
    if (!parsed.ok) return parsed.response;

    // El simulador temporal se habilita solo desde variables del servidor. Los
    // dispositivos físicos siguen usando x-iot-api-key.
    const manualTestEnabled =
      parsed.data.deviceId === "MOBILE_TEST" && process.env.RFID_ENROLLMENT_TEST_MODE === "true";
    if (!manualTestEnabled) {
      const auth = requireIotDevice(request);
      if (!auth.ok) return auth.response;
    }

    const result = await completeRfidEnrollment(
      parsed.data.uid,
      parsed.data.deviceId,
      parsed.data.point ?? "entrada",
    );
    return Response.json(result, { status: result.handled && result.ok === false ? 409 : 200 });
  } catch (error) {
    return iotErrorResponse("[api/iot/rfid-enrollment/scan]", error);
  }
}
