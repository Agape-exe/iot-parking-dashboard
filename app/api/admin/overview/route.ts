import { requireAdmin } from "@/lib/auth-server";
import { getOverview } from "@/lib/parking-service";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    return Response.json(await getOverview());
  } catch (error) {
    console.error("[api/admin/overview]", error);
    return Response.json({ message: "No se pudo cargar el resumen. Revisa que supabase/schema.sql se haya ejecutado." }, { status: 500 });
  }
}
