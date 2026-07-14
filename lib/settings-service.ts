import { combineDateWithCurrentTime } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabase-server";
import type { SystemSettings } from "@/lib/types";

export const DEFAULT_SETTINGS: SystemSettings = {
  id: "main",
  use_simulated_date: false,
  simulated_date: null,
  reservation_test_duration_minutes: 1,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

function missingTable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybe = error as { code?: string; message?: string };
  return maybe.code === "PGRST205" || maybe.message?.includes("schema cache") || maybe.message?.includes("does not exist");
}

export async function getSettings() {
  const { data, error } = await supabaseAdmin().from("system_settings").select("*").eq("id", "main").maybeSingle<SystemSettings>();

  if (error) {
    if (missingTable(error)) return DEFAULT_SETTINGS;
    throw error;
  }

  return data ?? DEFAULT_SETTINGS;
}

export async function updateSettings(input: Partial<Pick<SystemSettings, "use_simulated_date" | "simulated_date" | "reservation_test_duration_minutes">>) {
  const payload = {
    id: "main",
    use_simulated_date: Boolean(input.use_simulated_date),
    simulated_date: input.use_simulated_date ? input.simulated_date ?? null : null,
    reservation_test_duration_minutes: Math.max(1, Number(input.reservation_test_duration_minutes ?? 1)),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin()
    .from("system_settings")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single<SystemSettings>();

  if (error) throw error;
  return data;
}

export async function getOperationalNow() {
  const settings = await getSettings();
  if (settings.use_simulated_date && settings.simulated_date) {
    return combineDateWithCurrentTime(settings.simulated_date);
  }
  return new Date();
}
