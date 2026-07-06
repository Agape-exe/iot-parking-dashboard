import { processExit } from "@/lib/parking-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.uid) {
      return Response.json({ allowed: false, message: "UID requerido" }, { status: 400 });
    }

    const result = await processExit(body.uid, body.deviceId ?? null, body.point ?? "caseta");
    return Response.json(result, { status: result.allowed ? 200 : 409 });
  } catch (error) {
    console.error("[api/iot/exit]", error);
    return Response.json(
      { allowed: false, message: error instanceof Error ? error.message : "Error procesando salida" },
      { status: 500 },
    );
  }
}
