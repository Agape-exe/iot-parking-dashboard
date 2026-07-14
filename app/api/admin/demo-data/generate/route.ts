import { requireAdmin } from "@/lib/auth-server";
import { getDemoDataStats, insertDemoData, resetDemoAssociations } from "@/lib/demo-data-service";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    return Response.json({ stats: await getDemoDataStats() });
  } catch (error) {
    console.error("[api/admin/demo-data:stats]", error);
    return Response.json({ message: "No se pudo consultar el estado de los datos demo." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const result = await insertDemoData(Number(body.count ?? 20));
    return Response.json({ message: "Datos demo listos", ...result, stats: await getDemoDataStats() });
  } catch (error) {
    console.error("[api/admin/demo-data/generate]", error);
    return Response.json({ message: "No se pudieron generar los datos demo." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const result = await resetDemoAssociations();
    return Response.json({
      message: result.resetCount ? `${result.resetCount} asociaciones demo reiniciadas.` : "No hay asociaciones demo disponibles para reiniciar.",
      ...result,
      stats: await getDemoDataStats(),
    });
  } catch (error) {
    console.error("[api/admin/demo-data:reset]", error);
    return Response.json({ message: "No se pudieron reiniciar las asociaciones demo." }, { status: 500 });
  }
}
