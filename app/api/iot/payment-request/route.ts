import { requestPayment } from "@/lib/parking-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.uid) {
      return Response.json({ allowed: false, message: "UID requerido" }, { status: 400 });
    }

    const result = await requestPayment(body.uid, body.deviceId ?? null, body.point ?? "caseta");
    return Response.json(result, { status: result.allowed ? 200 : 404 });
  } catch (error) {
    console.error("[api/iot/payment-request]", error);
    return Response.json(
      { allowed: false, message: error instanceof Error ? error.message : "Error calculando pago" },
      { status: 500 },
    );
  }
}
