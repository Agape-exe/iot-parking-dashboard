import { requireAdmin } from "@/lib/auth-server";
import { getPlateReport } from "@/lib/admin-data-service";
import { dateKeyInLima, resolveReportRange } from "@/lib/report-period";
import { getOperationalNow } from "@/lib/settings-service";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const plate = url.searchParams.get("plate");
    if (!plate) return Response.json({ sessions: [], events: [] });
    const range = resolveReportRange(
      {
        period: url.searchParams.get("period"),
        date: url.searchParams.get("date"),
        from: url.searchParams.get("from"),
        to: url.searchParams.get("to"),
      },
      dateKeyInLima(await getOperationalNow()),
    );
    return Response.json({ ...(await getPlateReport(plate, range)), range });
  } catch (error) {
    console.error("[api/admin/reports/plate]", error);
    return Response.json({ message: error instanceof Error ? error.message : "No se pudo generar el reporte por placa." }, { status: 400 });
  }
}
