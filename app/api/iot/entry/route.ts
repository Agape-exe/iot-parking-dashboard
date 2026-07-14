import { requireIotDevice } from "@/lib/auth-server";
import { iotErrorResponse, readIotRequest } from "@/lib/iot-route";
import { processEntry } from "@/lib/parking-service";

export async function POST(request: Request) {
  try {
    const auth = requireIotDevice(request);
    if (!auth.ok) return auth.response;

    const parsed = await readIotRequest(request);
    if (!parsed.ok) return parsed.response;

    const result = await processEntry(parsed.data.uid, parsed.data.deviceId, parsed.data.point ?? "entrada");
    return Response.json(result, { status: result.allowed ? 200 : 409 });
  } catch (error) {
    return iotErrorResponse("[api/iot/entry]", error);
  }
}
