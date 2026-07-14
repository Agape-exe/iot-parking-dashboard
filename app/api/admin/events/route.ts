import { requireAdmin } from "@/lib/auth-server";
import { listReportRows } from "@/lib/admin-data-service";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);

  try {
    const events = await listReportRows({
      uid: url.searchParams.get("uid"),
      plate: url.searchParams.get("plate"),
      user: url.searchParams.get("user"),
      eventType: url.searchParams.get("eventType"),
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
    });
    return Response.json({ events });
  } catch (error) {
    console.error("[api/admin/events]", error);
    return Response.json({ events: [] });
  }
}
