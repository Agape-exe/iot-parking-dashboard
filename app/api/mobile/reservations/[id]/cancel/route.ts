import { cancelReservation } from "@/lib/admin-data-service";

export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const reservation = await cancelReservation(id);
    return Response.json({ message: "Reserva cancelada", reservation });
  } catch (error) {
    console.error("[api/mobile/reservations/cancel]", error);
    return Response.json({ message: "No se pudo cancelar la reserva." }, { status: 500 });
  }
}
