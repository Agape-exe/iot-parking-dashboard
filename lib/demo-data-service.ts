import { supabaseAdmin } from "@/lib/supabase-server";
import type { AppUser, Vehicle, VehicleAssignment } from "@/lib/types";

export type DemoVehicleInput = {
  fullName: string;
  email: string;
  phone: string;
  plate: string;
  brand: string;
  model: string;
  color: string;
};

export type DemoDataStats = {
  totalDemoVehicles: number;
  availableDemoVehicles: number;
  assignedDemoVehicles: number;
  resettableAssociations: number;
  protectedAssociations: number;
};

type DemoVehicleRow = Pick<Vehicle, "id" | "uid" | "status" | "user_id"> & {
  app_users: Pick<AppUser, "email"> | null;
};

const firstNames = ["Alex", "Bruno", "Camila", "Daniel", "Elena", "Fabian", "Gabriela", "Hugo", "Isabel", "Jorge"];
const lastNames = ["Quispe", "Ramos", "Flores", "Torres", "Vargas", "Castillo", "Mendoza", "Salazar", "Paredes", "Lopez"];
const brands = ["Toyota", "Hyundai", "Kia", "Nissan", "Suzuki", "Chevrolet", "Volkswagen", "Mazda"];
const models = ["Yaris", "Accent", "Rio", "Sentra", "Swift", "Onix", "Gol", "CX-3"];
const colors = ["Blanco", "Plata", "Negro", "Rojo", "Azul", "Gris", "Verde", "Dorado"];

function normalizeUid(uid: string) {
  return uid.trim().toUpperCase();
}

function makePlate(index: number) {
  const a = String.fromCharCode(65 + (index % 26));
  const b = String.fromCharCode(65 + ((index + 7) % 26));
  const c = String.fromCharCode(65 + ((index + 13) % 26));
  const digits = 100 + (Math.abs(index) % 900);
  return `${a}${b}${c}-${digits}`;
}

export function generateLocalDemoData(count = 20, offset = 0): DemoVehicleInput[] {
  return Array.from({ length: count }, (_, index) => {
    const n = index + offset + 1;
    const first = firstNames[n % firstNames.length];
    const last = lastNames[(n * 3) % lastNames.length];
    return {
      fullName: `${first} ${last} Demo`,
      email: `usuario.demo.${n}@example.com`,
      phone: `999${String(100000 + n).slice(0, 6)}`,
      plate: makePlate(n),
      brand: brands[n % brands.length],
      model: models[(n * 2) % models.length],
      color: colors[(n * 5) % colors.length],
    };
  });
}

function sanitizeDemoRows(rows: unknown): DemoVehicleInput[] {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => {
      const item = row as Partial<DemoVehicleInput>;
      return {
        fullName: String(item.fullName ?? "").trim(),
        email: String(item.email ?? "").trim().toLowerCase(),
        phone: String(item.phone ?? "").trim(),
        plate: String(item.plate ?? "").trim().toUpperCase(),
        brand: String(item.brand ?? "").trim(),
        model: String(item.model ?? "").trim(),
        color: String(item.color ?? "").trim(),
      };
    })
    .filter((item) => item.fullName && item.email.includes("@") && /^[A-Z]{3}-\d{3}$/.test(item.plate) && item.brand && item.model && item.color)
    .slice(0, 20);
}

async function generateWithOpenAI() {
  if (!process.env.OPENAI_API_KEY) return [];

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input:
          "Genera exactamente 20 usuarios y vehiculos ficticios para Peru. Devuelve solo JSON con un arreglo en data. Campos: fullName, email, phone, plate con formato ABC-123, brand, model, color. Usa example.com.",
        text: { format: { type: "json_object" } },
      }),
    });

    if (!response.ok) return [];
    const payload = await response.json();
    const text = payload.output_text ?? payload.output?.[0]?.content?.[0]?.text;
    if (!text) return [];
    const parsed = JSON.parse(text);
    return sanitizeDemoRows(parsed.data);
  } catch (error) {
    console.error("[demo-data:openai]", error);
    return [];
  }
}

async function listDemoVehicles() {
  const { data, error } = await supabaseAdmin()
    .from("vehicles")
    .select("id, uid, status, user_id, app_users(email)")
    .returns<DemoVehicleRow[]>();

  if (error) throw error;
  return (data ?? []).filter((vehicle) => vehicle.app_users?.email.toLowerCase().endsWith("@example.com"));
}

async function getActiveUids() {
  const { data, error } = await supabaseAdmin()
    .from("parking_sessions")
    .select("uid")
    .in("status", ["INSIDE", "PAID"])
    .is("exit_time", null)
    .returns<Array<{ uid: string }>>();

  if (error) throw error;
  return new Set((data ?? []).map((session) => session.uid));
}

export async function getDemoDataStats(): Promise<DemoDataStats> {
  const [vehicles, activeUids] = await Promise.all([listDemoVehicles(), getActiveUids()]);
  const assigned = vehicles.filter((vehicle) => Boolean(vehicle.uid));
  const protectedAssociations = assigned.filter((vehicle) => vehicle.uid && activeUids.has(vehicle.uid)).length;

  return {
    totalDemoVehicles: vehicles.length,
    availableDemoVehicles: vehicles.filter((vehicle) => !vehicle.uid && vehicle.status === "AVAILABLE").length,
    assignedDemoVehicles: assigned.length,
    resettableAssociations: assigned.filter((vehicle) => vehicle.uid && !activeUids.has(vehicle.uid) && vehicle.status !== "INACTIVE").length,
    protectedAssociations,
  };
}

export async function resetDemoAssociations() {
  const db = supabaseAdmin();
  const [vehicles, activeUids] = await Promise.all([listDemoVehicles(), getActiveUids()]);
  const resettableIds = vehicles
    .filter((vehicle) => vehicle.uid && !activeUids.has(vehicle.uid) && vehicle.status !== "INACTIVE")
    .map((vehicle) => vehicle.id);

  if (resettableIds.length) {
    const { error } = await db
      .from("vehicles")
      .update({ uid: null, status: "AVAILABLE", updated_at: new Date().toISOString() })
      .in("id", resettableIds);
    if (error) throw error;
  }

  return {
    resetCount: resettableIds.length,
    protectedCount: vehicles.filter((vehicle) => vehicle.uid && activeUids.has(vehicle.uid)).length,
  };
}

export async function insertDemoData(count = 20, useAi = true) {
  const db = supabaseAdmin();
  const targetCount = Number.isFinite(count) ? Math.max(1, Math.min(20, Math.floor(count))) : 20;
  const existingUsers = await db.from("app_users").select("id, email").returns<Array<{ id: string; email: string }>>();
  const existingVehicles = await db.from("vehicles").select("plate, user_id").returns<Array<{ plate: string; user_id: string }>>();
  if (existingUsers.error) throw existingUsers.error;
  if (existingVehicles.error) throw existingVehicles.error;

  const usedEmails = new Set((existingUsers.data ?? []).map((item) => item.email.toLowerCase()));
  const usedPlates = new Set((existingVehicles.data ?? []).map((item) => item.plate.toUpperCase()));
  const demoUserIds = new Set((existingUsers.data ?? []).filter((item) => item.email.toLowerCase().endsWith("@example.com")).map((item) => item.id));
  const existingDemoVehicles = (existingVehicles.data ?? []).filter((vehicle) => demoUserIds.has(vehicle.user_id)).length;
  const createCount = Math.max(0, targetCount - existingDemoVehicles);

  if (!createCount) return { usersCreated: 0, vehiclesCreated: 0 };

  let rows = useAi ? await generateWithOpenAI() : [];
  if (rows.length < createCount) rows = generateLocalDemoData(createCount * 3, usedEmails.size + usedPlates.size);

  let uniqueRows = rows
    .filter((row) => !usedEmails.has(row.email.toLowerCase()) && !usedPlates.has(row.plate.toUpperCase()))
    .slice(0, createCount);

  if (uniqueRows.length < createCount) {
    const extraRows = generateLocalDemoData(createCount * 5, usedEmails.size + usedPlates.size + rows.length + 20);
    uniqueRows = [
      ...uniqueRows,
      ...extraRows.filter((row) => !usedEmails.has(row.email.toLowerCase()) && !usedPlates.has(row.plate.toUpperCase()) && !uniqueRows.some((item) => item.email === row.email || item.plate === row.plate)),
    ].slice(0, createCount);
  }

  let usersCreated = 0;
  let vehiclesCreated = 0;

  for (const row of uniqueRows) {
    const { data: user, error: userError } = await db
      .from("app_users")
      .insert({
        full_name: row.fullName,
        email: row.email,
        phone: row.phone,
        role: "USER",
        status: "ACTIVE",
        is_demo: true,
      })
      .select("*")
      .single<AppUser>();

    if (userError) {
      console.error("[demo-data:user]", userError);
      continue;
    }

    usersCreated += 1;
    const { error: vehicleError } = await db.from("vehicles").insert({
      user_id: user.id,
      plate: row.plate,
      brand: row.brand,
      model: row.model,
      color: row.color,
      status: "AVAILABLE",
      is_demo: true,
    });

    if (vehicleError) {
      console.error("[demo-data:vehicle]", vehicleError);
    } else {
      vehiclesCreated += 1;
    }
  }

  return { usersCreated, vehiclesCreated };
}

async function createOneLocalVehicleForUid(uid: string): Promise<VehicleAssignment> {
  const db = supabaseAdmin();
  const [row] = generateLocalDemoData(1, Date.now() % 100000);
  const { data: user, error: userError } = await db
    .from("app_users")
    .insert({
      full_name: row.fullName,
      email: row.email,
      phone: row.phone,
      role: "USER",
      status: "ACTIVE",
      is_demo: true,
    })
    .select("*")
    .single<AppUser>();

  if (userError) throw userError;

  const { data: vehicle, error: vehicleError } = await db
    .from("vehicles")
    .insert({
      user_id: user.id,
      plate: row.plate,
      brand: row.brand,
      model: row.model,
      color: row.color,
      uid,
      status: "ASSIGNED",
      is_demo: true,
    })
    .select("*")
    .single<Vehicle>();

  if (vehicleError) throw vehicleError;
  return { user, vehicle };
}

async function findAvailableDemoVehicle() {
  const { data, error } = await supabaseAdmin()
    .from("vehicles")
    .select("*, app_users(*)")
    .is("uid", null)
    .eq("status", "AVAILABLE")
    .order("created_at", { ascending: true })
    .limit(100)
    .returns<Array<Vehicle & { app_users: AppUser | null }>>();

  if (error) throw error;
  return (data ?? []).find((vehicle) => vehicle.app_users?.email.toLowerCase().endsWith("@example.com")) ?? null;
}

export async function getOrAssignVehicleByUid(uid: string): Promise<VehicleAssignment> {
  const normalizedUid = normalizeUid(uid);
  const db = supabaseAdmin();

  const byUid = await db
    .from("vehicles")
    .select("*, app_users(*)")
    .eq("uid", normalizedUid)
    .maybeSingle<Vehicle & { app_users: AppUser | null }>();

  if (byUid.error) throw byUid.error;
  if (byUid.data?.app_users) return { user: byUid.data.app_users, vehicle: byUid.data };

  let available = await findAvailableDemoVehicle();
  if (!available?.app_users) {
    await insertDemoData(20, false);
    available = await findAvailableDemoVehicle();
  }

  if (!available?.app_users) return createOneLocalVehicleForUid(normalizedUid);

  const { data: updated, error: updateError } = await db
    .from("vehicles")
    .update({ uid: normalizedUid, status: "ASSIGNED", updated_at: new Date().toISOString() })
    .eq("id", available.id)
    .is("uid", null)
    .select("*, app_users(*)")
    .single<Vehicle & { app_users: AppUser | null }>();

  if (updateError) throw updateError;
  if (!updated.app_users) throw new Error("Vehiculo asignado sin usuario asociado.");

  await db.from("events").insert({
    uid: normalizedUid,
    event_type: "UID_ASIGNADO",
    description: `UID asignado al vehiculo ${updated.plate}.`,
    point: "sistema",
    device_id: "AUTO_ASSIGN",
    user_id: updated.user_id,
    vehicle_id: updated.id,
    plate: updated.plate,
    owner_name: updated.app_users.full_name,
  });

  return { user: updated.app_users, vehicle: updated };
}
