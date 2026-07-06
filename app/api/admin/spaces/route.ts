import { requireAdmin } from "@/lib/auth-server";
import { getSpaces } from "@/lib/parking-service";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    return Response.json({ spaces: await getSpaces() });
  } catch (error) {
    console.error("[api/admin/spaces]", error);
    return Response.json({ message: "No se pudieron cargar los espacios." }, { status: 500 });
  }
}
