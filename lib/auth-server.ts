import { DEMO_MODE } from "@/lib/config";
import { supabaseAuthClient } from "@/lib/supabase-server";

export async function requireAdmin(request: Request) {
  if (DEMO_MODE) {
    return { ok: true as const, user: null };
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");

  if (!token) {
    return { ok: false as const, response: Response.json({ message: "No autenticado" }, { status: 401 }) };
  }

  const { data, error } = await supabaseAuthClient().auth.getUser(token);

  if (error || !data.user) {
    return { ok: false as const, response: Response.json({ message: "Sesion invalida" }, { status: 401 }) };
  }

  return { ok: true as const, user: data.user };
}
