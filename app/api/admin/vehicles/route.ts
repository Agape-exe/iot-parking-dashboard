import { requireAdmin } from "@/lib/auth-server";
import { listReservableVehicles, listVehicles, unassignVehicleUid, updateVehicle } from "@/lib/admin-data-service";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const search = url.searchParams.get("search") ?? "";
    const vehicles = url.searchParams.get("reservable") === "true" ? await listReservableVehicles(search) : await listVehicles(search);
    return Response.json({ vehicles });
  } catch (error) {
    console.error("[api/admin/vehicles]", error);
    return Response.json({ vehicles: [] });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const vehicle =
      body.action === "UNASSIGN_UID"
        ? await unassignVehicleUid(body.vehicleId)
        : await updateVehicle(body.vehicleId, {
            plate: body.plate,
            brand: body.brand,
            model: body.model,
            color: body.color,
            status: body.status,
          });
    return Response.json({ message: "Vehiculo actualizado", vehicle });
  } catch (error) {
    console.error("[api/admin/vehicles:patch]", error);
    return Response.json({ message: "No se pudo actualizar el vehiculo." }, { status: 500 });
  }
}
