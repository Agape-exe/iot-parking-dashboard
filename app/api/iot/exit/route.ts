import { requireIotDevice } from "@/lib/auth-server";
import { iotErrorResponse, readIotRequest } from "@/lib/iot-route";
import { processExit } from "@/lib/parking-service";

export async function POST(request: Request) {
  try {
    const auth = requireIotDevice(request);
    if (!auth.ok) return auth.response;

    const parsed = await readIotRequest(request);
    if (!parsed.ok) return parsed.response;

    const result = await processExit(parsed.data.uid, parsed.data.deviceId, parsed.data.point ?? "caseta");
    return Response.json(result, { status: result.allowed ? 200 : 409 });
  } catch (error) {
    return iotErrorResponse("[api/iot/exit]", error);
  }
}
