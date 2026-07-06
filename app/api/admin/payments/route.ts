import { requireAdmin } from "@/lib/auth-server";
import { confirmPayment } from "@/lib/parking-service";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    if (!body.sessionId) {
      return Response.json({ message: "sessionId requerido" }, { status: 400 });
    }

    return Response.json(await confirmPayment(body.sessionId));
  } catch (error) {
    console.error("[api/admin/payments]", error);
    return Response.json({ message: error instanceof Error ? error.message : "Error confirmando pago" }, { status: 500 });
  }
}
