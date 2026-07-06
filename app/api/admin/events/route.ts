import { requireAdmin } from "@/lib/auth-server";
import { supabaseAdmin } from "@/lib/supabase-server";
import type { ParkingEvent } from "@/lib/types";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const uid = url.searchParams.get("uid")?.trim().toUpperCase();
  const eventType = url.searchParams.get("eventType");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  let query = supabaseAdmin().from("events").select("*").order("created_at", { ascending: false }).limit(300);

  if (uid) query = query.eq("uid", uid);
  if (eventType) query = query.eq("event_type", eventType);
  if (from) query = query.gte("created_at", new Date(from).toISOString());
  if (to) query = query.lte("created_at", new Date(`${to}T23:59:59`).toISOString());

  const { data, error } = await query.returns<ParkingEvent[]>();
  if (error) {
    console.error("[api/admin/events]", error);
    if (error.code === "PGRST205" || error.message.includes("schema cache") || error.message.includes("does not exist")) {
      return Response.json({ events: [] });
    }
    return Response.json({ message: "No se pudieron cargar los eventos. Revisa que la tabla events exista." }, { status: 500 });
  }
  return Response.json({ events: data ?? [] });
}
