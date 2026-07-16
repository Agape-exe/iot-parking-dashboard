import { requireIotDevice } from "@/lib/auth-server";
import { iotErrorResponse, readIotRequest } from "@/lib/iot-route";
import { confirmPaymentByUid } from "@/lib/parking-service";

export async function POST(request: Request) {
  try {
    const auth = requireIotDevice(request);
    if (!auth.ok) return auth.response;

    const parsed = await readIotRequest(request);
    if (!parsed.ok) return parsed.response;

    const result = await confirmPaymentByUid(parsed.data.uid, parsed.data.deviceId, "pago");
    return Response.json(result, { status: 200 });
  } catch (error) {
    return iotErrorResponse("[api/iot/payment-confirm]", error);
  }
}
