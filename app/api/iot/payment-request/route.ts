import { requireIotDevice } from "@/lib/auth-server";
import { iotErrorResponse, readIotRequest } from "@/lib/iot-route";
import { requestPayment } from "@/lib/parking-service";

export async function POST(request: Request) {
  try {
    const auth = requireIotDevice(request);
    if (!auth.ok) return auth.response;

    const parsed = await readIotRequest(request);
    if (!parsed.ok) return parsed.response;

    const result = await requestPayment(parsed.data.uid, parsed.data.deviceId, parsed.data.point ?? "caseta");
    return Response.json(result, { status: result.allowed ? 200 : 404 });
  } catch (error) {
    return iotErrorResponse("[api/iot/payment-request]", error);
  }
}
