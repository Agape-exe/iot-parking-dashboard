import { createReservation, listReservations } from "@/lib/admin-data-service";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    const reservations = await listReservations();
    return Response.json({ reservations: userId ? reservations.filter((item) => item.user_id === userId) : reservations });
  } catch (error) {
    console.error("[api/mobile/reservations:get]", error);
    return Response.json({ reservations: [] });
  }
}

export async function POST(request: Request) {
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
    console.error("[api/mobile/reservations:post]", error);
    return Response.json({ ok: false, message: "No se pudo crear la reserva." }, { status: 500 });
  }
}
