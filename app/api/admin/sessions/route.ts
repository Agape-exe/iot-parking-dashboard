import { requireAdmin } from "@/lib/auth-server";
import { getActiveSessions } from "@/lib/parking-service";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    return Response.json({ sessions: await getActiveSessions() });
  } catch (error) {
    console.error("[api/admin/sessions]", error);
    return Response.json({ message: "No se pudieron cargar las sesiones activas." }, { status: 500 });
  }
}
