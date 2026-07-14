import { requireAdmin } from "@/lib/auth-server";
import { getPlateReport } from "@/lib/admin-data-service";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const plate = url.searchParams.get("plate");
    if (!plate) return Response.json({ sessions: [], events: [] });
    return Response.json(await getPlateReport(plate));
  } catch (error) {
    console.error("[api/admin/reports/plate]", error);
    return Response.json({ sessions: [], events: [] });
  }
}
