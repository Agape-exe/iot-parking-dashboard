import { requireAdmin } from "@/lib/auth-server";
import { getSettings, updateSettings } from "@/lib/settings-service";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    return Response.json({ settings: await getSettings() });
  } catch (error) {
    console.error("[api/admin/settings]", error);
    return Response.json({ message: "No se pudo cargar la configuracion." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const settings = await updateSettings({
      use_simulated_date: Boolean(body.useSimulatedDate),
      simulated_date: body.simulatedDate || null,
      reservation_test_duration_minutes: Number(body.reservationTestDurationMinutes ?? 1),
    });
    return Response.json({ message: "Configuracion actualizada", settings });
  } catch (error) {
    console.error("[api/admin/settings:patch]", error);
    return Response.json({ message: "No se pudo guardar la configuracion." }, { status: 500 });
  }
}
