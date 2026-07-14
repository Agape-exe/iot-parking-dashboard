import { supabaseAdmin } from "@/lib/supabase-server";
import type { AppUser } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const fullName = String(body.fullName ?? "").trim();
    if (!email || !fullName) return Response.json({ message: "Nombre y correo son requeridos." }, { status: 400 });

    const { data, error } = await supabaseAdmin()
      .from("app_users")
      .upsert(
        {
          full_name: fullName,
          email,
          phone: body.phone ?? null,
          role: "USER",
          status: "ACTIVE",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" },
      )
      .select("*")
      .single<AppUser>();

    if (error) throw error;
    return Response.json({ message: "Usuario registrado", user: data });
  } catch (error) {
    console.error("[api/mobile/users]", error);
    return Response.json({ message: "No se pudo registrar el usuario." }, { status: 500 });
  }
}
