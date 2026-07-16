import { requireAdmin } from "@/lib/auth-server";
import { listReportRows } from "@/lib/admin-data-service";
import { dateKeyInLima, resolveReportRange } from "@/lib/report-period";
import { getOperationalNow } from "@/lib/settings-service";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);

  try {
    const range = resolveReportRange(
      {
        period: url.searchParams.get("period"),
        date: url.searchParams.get("date"),
        from: url.searchParams.get("from"),
        to: url.searchParams.get("to"),
      },
      dateKeyInLima(await getOperationalNow()),
    );
    const events = await listReportRows({
      uid: url.searchParams.get("uid"),
      plate: url.searchParams.get("plate"),
      user: url.searchParams.get("user"),
      eventType: url.searchParams.get("eventType"),
      start: range.start,
      endExclusive: range.endExclusive,
    });
    return Response.json({ events, range });
  } catch (error) {
    console.error("[api/admin/events]", error);
    return Response.json({ message: error instanceof Error ? error.message : "No se pudo generar el reporte." }, { status: 400 });
  }
}
