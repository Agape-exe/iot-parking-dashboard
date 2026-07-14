import { requireAdmin } from "@/lib/auth-server";
import { cancelReservation, createReservation, listReservations } from "@/lib/admin-data-service";
import { expireReservations } from "@/lib/parking-service";
import { getOperationalNow } from "@/lib/settings-service";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    return Response.json({
      reservations: await listReservations({
        search: url.searchParams.get("search") ?? "",
        status: url.searchParams.get("status") ?? "",
      }),
    });
  } catch (error) {
    console.error("[api/admin/reservations]", error);
    return Response.json({ reservations: [] });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => null);
    if (!body?.userId || !body?.vehicleId) {
      return Response.json({ ok: false, message: "Usuario y vehiculo son requeridos" }, { status: 400 });
    }
    const result = await createReservation({
      userId: body.userId,
      vehicleId: body.vehicleId,
      durationMinutes: body.durationMinutes,
      startTime: body.startTime,
    });
    return Response.json(result, { status: result.ok ? 200 : 409 });
  } catch (error) {
    console.error("[api/admin/reservations:post]", error);
    return Response.json({ ok: false, message: "No se pudo crear la reserva." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => null);
    if (!body) return Response.json({ message: "Solicitud invalida" }, { status: 400 });
    if (body.action === "EXPIRE") {
      const expired = await expireReservations(await getOperationalNow());
      return Response.json({ message: "Reservas vencidas actualizadas", expired });
    }
    const reservation = await cancelReservation(body.reservationId);
    return Response.json({ message: "Reserva cancelada", reservation });
  } catch (error) {
    console.error("[api/admin/reservations:patch]", error);
    return Response.json({ message: "No se pudo actualizar la reserva." }, { status: 500 });
  }
}
