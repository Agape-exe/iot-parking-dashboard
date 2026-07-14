import { getOverview } from "@/lib/parking-service";

export async function GET() {
  try {
    const overview = await getOverview();
    return Response.json({
      totalSpaces: overview.totalSpaces,
      occupiedSpaces: overview.occupiedSpaces,
      freeSpaces: overview.freeSpaces,
      activeReservations: overview.activeReservations,
      reservationLimit: overview.reservationLimit,
      availableCapacity: overview.availableCapacity,
      reservationAvailable: overview.reservationAvailable,
    });
  } catch (error) {
    console.error("[api/mobile/availability]", error);
    return Response.json({ message: "No se pudo consultar disponibilidad." }, { status: 500 });
  }
}
