import { supabaseAdmin } from "@/lib/supabase-server";
import type { Vehicle } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const plate = String(body.plate ?? "").trim().toUpperCase();
    if (!body.userId || !plate) return Response.json({ message: "Usuario y placa son requeridos." }, { status: 400 });

    const { data, error } = await supabaseAdmin()
      .from("vehicles")
      .insert({
        user_id: body.userId,
        plate,
        brand: body.brand ?? "Demo",
        model: body.model ?? "Movil",
        color: body.color ?? "Sin especificar",
        uid: body.uid ? String(body.uid).trim().toUpperCase() : null,
        status: body.uid ? "ASSIGNED" : "AVAILABLE",
      })
      .select("*")
      .single<Vehicle>();

    if (error) throw error;
    return Response.json({ message: "Vehiculo registrado", vehicle: data });
  } catch (error) {
    console.error("[api/mobile/vehicles]", error);
    return Response.json({ message: "No se pudo registrar el vehiculo." }, { status: 500 });
  }
}
