"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Card, EmptyState } from "@/app/components/ui";
import { calculateAmount, formatDateTime, formatMoney, hourInLima, minutesBetween, TOTAL_SPACES } from "@/lib/config";
import { formatStatus } from "@/lib/status";
import type { AppUser, EventType, ParkingEvent, ParkingSession, ParkingSpace, Reservation, SystemSettings, Vehicle } from "@/lib/types";
import { useAuth } from "./AuthGate";

type Overview = {
  totalSpaces: number;
  occupiedSpaces: number;
  freeSpaces: number;
  vehiclesInside: number;
  paidAwaitingExit: number;
  activeReservations: number;
  reservationLimit: number;
  availableCapacity: number;
  reservationAvailable: boolean;
  usersCount: number;
  vehiclesCount: number;
  vehiclesWithUid: number;
  vehiclesWithoutUid: number;
  entriesToday: number;
  paymentsToday: number;
  exitsToday: number;
  doubleEntryAttemptsToday: number;
  deniedExitsToday: number;
  eventCounts: Record<string, number>;
  entriesByHour: Array<{ hour: number; count: number }>;
  spaces: ParkingSpace[];
  activeSessions: ParkingSession[];
  settings?: SystemSettings;
};

type VehicleWithUser = Vehicle & { app_users?: AppUser | null };
type ReservationWithRelations = Reservation & { app_users?: AppUser | null; vehicles?: Vehicle | null };
type DemoDataStats = {
  totalDemoVehicles: number;
  availableDemoVehicles: number;
  assignedDemoVehicles: number;
  resettableAssociations: number;
  protectedAssociations: number;
};

type ReportRange = {
  period: "day" | "week" | "month" | "custom";
  selectedDate: string;
  startDate: string;
  endDateInclusive: string;
  start: string;
  endExclusive: string;
  timeZone: string;
};

const emptySpaces: ParkingSpace[] = Array.from({ length: TOTAL_SPACES }, (_, index) => ({
  id: `empty-${index + 1}`,
  number: index + 1,
  status: "FREE",
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
}));

const emptyOverview: Overview = {
  totalSpaces: TOTAL_SPACES,
  occupiedSpaces: 0,
  freeSpaces: TOTAL_SPACES,
  vehiclesInside: 0,
  paidAwaitingExit: 0,
  activeReservations: 0,
  reservationLimit: Math.floor(TOTAL_SPACES * 0.5),
  availableCapacity: TOTAL_SPACES,
  reservationAvailable: true,
  usersCount: 0,
  vehiclesCount: 0,
  vehiclesWithUid: 0,
  vehiclesWithoutUid: 0,
  entriesToday: 0,
  paymentsToday: 0,
  exitsToday: 0,
  doubleEntryAttemptsToday: 0,
  deniedExitsToday: 0,
  eventCounts: {},
  entriesByHour: [],
  spaces: emptySpaces,
  activeSessions: [],
};

const eventTypes: EventType[] = [
  "INGRESO",
  "PAGO_SOLICITADO",
  "PAGO",
  "SALIDA",
  "SALIDA_DENEGADA",
  "PAGO_PENDIENTE",
  "INTENTO_DOBLE_INGRESO",
  "ESTACIONAMIENTO_LLENO",
  "RESERVA_CREADA",
  "RESERVA_USADA",
  "RESERVA_CANCELADA",
  "RESERVA_EXPIRADA",
  "UID_ASIGNADO",
];

function statusTone(status: string) {
  if (status === "FREE" || status === "ACTIVE") return "green";
  if (status === "PAID" || status === "USED") return "blue";
  if (status === "OCCUPIED" || status === "INSIDE" || status === "RESERVED") return "amber";
  if (status.includes("DENEGADA") || status.includes("PENDIENTE") || status === "EXPIRED" || status === "INACTIVE") return "red";
  return "slate";
}

function useAdminFetch() {
  const { token } = useAuth();
  return useCallback(
    async <T,>(url: string, init?: RequestInit) => {
      const response = await fetch(url, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...init?.headers,
        },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Error de solicitud");
      return payload as T;
    },
    [token],
  );
}

function Bar({ value, max, tone = "bg-slate-900" }: { value: number; max: number; tone?: string }) {
  const width = max > 0 ? Math.max(3, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 rounded bg-slate-100">
      <div className={`h-2 rounded ${tone}`} style={{ width: `${width}%` }} />
    </div>
  );
}

function Notice({ overview }: { overview: Overview | null }) {
  if (!overview?.settings?.use_simulated_date) return null;
  return (
    <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
      Fecha simulada activa: {overview.settings.simulated_date}. Los eventos y reportes usan esa fecha para pruebas.
    </div>
  );
}

export function DashboardClient() {
  const adminFetch = useAdminFetch();
  const [overview, setOverview] = useState<Overview | null>(null);

  const load = useCallback(async () => {
    try {
      const nextOverview = await adminFetch<Overview>("/api/admin/overview");
      setOverview({
        ...emptyOverview,
        ...nextOverview,
        spaces: nextOverview.spaces?.length ? nextOverview.spaces : emptyOverview.spaces,
        activeSessions: nextOverview.activeSessions ?? [],
        eventCounts: nextOverview.eventCounts ?? {},
        entriesByHour: nextOverview.entriesByHour ?? [],
      });
    } catch (error) {
      console.error(error);
      setOverview(emptyOverview);
    }
  }, [adminFetch]);

  useEffect(() => {
    queueMicrotask(() => void load());
    const id = window.setInterval(load, 15000);
    return () => window.clearInterval(id);
  }, [load]);

  if (!overview) return <EmptyState text="Cargando indicadores..." />;

  const cards = [
    ["Total de espacios", overview.totalSpaces],
    ["Espacios ocupados", overview.occupiedSpaces],
    ["Espacios libres", overview.freeSpaces],
    ["Pagados esperando salida", overview.paidAwaitingExit],
    ["Reservas activas", overview.activeReservations],
    ["Limite de reservas", overview.reservationLimit],
    ["Ingresos del dia", overview.entriesToday],
    ["Pagos del dia", overview.paymentsToday],
    ["Salidas del dia", overview.exitsToday],
    ["Intentos doble ingreso", overview.doubleEntryAttemptsToday],
    ["Salidas denegadas", overview.deniedExitsToday],
  ];
  const maxHour = Math.max(1, ...overview.entriesByHour.map((item) => item.count));

  return (
    <div className="space-y-4">
      <Notice overview={overview} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(([label, value]) => (
          <Card key={label.toString()}>
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <h3 className="text-sm font-semibold text-slate-800">Espacios ocupados vs libres</h3>
          <div className="mt-4 space-y-4">
            <div>
              <div className="mb-1 flex justify-between text-xs text-slate-500">
                <span>Ocupados</span>
                <span>{overview.occupiedSpaces}</span>
              </div>
              <Bar value={overview.occupiedSpaces} max={overview.totalSpaces} tone="bg-amber-500" />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs text-slate-500">
                <span>Libres</span>
                <span>{overview.freeSpaces}</span>
              </div>
              <Bar value={overview.freeSpaces} max={overview.totalSpaces} tone="bg-emerald-600" />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs text-slate-500">
                <span>Reservas activas</span>
                <span>
                  {overview.activeReservations}/{overview.reservationLimit}
                </span>
              </div>
              <Bar value={overview.activeReservations} max={overview.reservationLimit} tone="bg-sky-600" />
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-800">Eventos por tipo</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {eventTypes.slice(0, 8).map((type) => (
              <div key={type} className="flex items-center justify-between rounded border border-slate-100 px-3 py-2">
                <span className="text-xs text-slate-600">{formatStatus(type, "event")}</span>
                <Badge tone={statusTone(type)}>{overview.eventCounts[type] ?? 0}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <h3 className="text-sm font-semibold text-slate-800">Ingresos por hora</h3>
        <div className="mt-4 grid grid-cols-12 gap-2">
          {overview.entriesByHour.map((item) => (
            <div key={item.hour} className="flex h-32 flex-col justify-end gap-1">
              <div className="rounded-t bg-teal-600" style={{ height: `${Math.max(4, (item.count / maxHour) * 100)}%` }} />
              <span className="text-center text-[10px] text-slate-500">{String(item.hour).padStart(2, "0")}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function SpacesClient() {
  const adminFetch = useAdminFetch();
  const [overview, setOverview] = useState<Overview | null>(null);

  const load = useCallback(async () => {
    try {
      const nextOverview = await adminFetch<Overview>("/api/admin/overview");
      setOverview({ ...emptyOverview, ...nextOverview, spaces: nextOverview.spaces?.length ? nextOverview.spaces : emptyOverview.spaces });
    } catch (error) {
      console.error(error);
      setOverview(emptyOverview);
    }
  }, [adminFetch]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  if (!overview) return <EmptyState text="Cargando espacios..." />;

  const sessionsBySpace = new Map(overview.activeSessions.map((session) => [session.space_number, session]));

  return (
    <div className="space-y-4">
      <Notice overview={overview} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {overview.spaces.map((space) => {
          const session = sessionsBySpace.get(space.number);
          const state = session?.paid ? "PAID" : session ? "OCCUPIED" : space.status;
          const className =
            state === "FREE"
              ? "border-emerald-200 bg-emerald-50/60"
              : state === "PAID"
                ? "border-sky-200 bg-sky-50/70"
                : state === "RESERVED"
                  ? "border-violet-200 bg-violet-50/70"
                  : "border-amber-200 bg-amber-50/70";

          return (
            <Card key={space.id} className={className}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">Espacio</p>
                  <p className="text-3xl font-semibold">{space.number}</p>
                </div>
                <Badge tone={statusTone(state)}>{formatStatus(state, "space")}</Badge>
              </div>
              {session ? (
                <div className="mt-5 space-y-2 text-sm text-slate-700">
                  <p className="font-mono font-semibold">{session.uid}</p>
                  <p>Placa: {session.plate ?? "Sin placa"}</p>
                  <p>Propietario: {session.owner_name ?? "No asignado"}</p>
                  <p>Ingreso: {formatDateTime(session.entry_time)}</p>
                  <p>Tiempo: {minutesBetween(session.entry_time)} min</p>
                  <p>Monto estimado: {formatMoney(session.amount ?? calculateAmount(session.entry_time))}</p>
                </div>
              ) : (
                <p className="mt-5 text-sm text-emerald-700">Disponible para asignacion automatica.</p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export function SessionsClient() {
  const adminFetch = useAdminFetch();
  const [sessions, setSessions] = useState<ParkingSession[]>([]);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const payload = await adminFetch<{ sessions: ParkingSession[] }>("/api/admin/sessions");
      setSessions(payload.sessions ?? []);
    } catch (error) {
      console.error(error);
      setSessions([]);
      setMessage("No hay vehiculos dentro del estacionamiento.");
    }
  }, [adminFetch]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  async function pay(sessionId: string) {
    setMessage("");
    try {
      const payload = await adminFetch<{ message: string }>("/api/admin/payments", {
        method: "POST",
        body: JSON.stringify({ sessionId }),
      });
      setMessage(payload.message);
      await load();
    } catch (payError) {
      setMessage(payError instanceof Error ? payError.message : "No se pudo confirmar pago");
    }
  }

  if (!sessions.length) return <EmptyState text="No hay vehiculos dentro del estacionamiento." />;

  return (
    <Card>
      {message ? <p className="mb-4 rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-700">{message}</p> : null}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-3 pr-4 font-semibold">UID RFID</th>
              <th className="py-3 pr-4 font-semibold">Placa</th>
              <th className="py-3 pr-4 font-semibold">Propietario</th>
              <th className="py-3 pr-4 font-semibold">Espacio</th>
              <th className="py-3 pr-4 font-semibold">Ingreso</th>
              <th className="py-3 pr-4 font-semibold">Tiempo</th>
              <th className="py-3 pr-4 font-semibold">Monto estimado</th>
              <th className="py-3 pr-4 font-semibold">Estado</th>
              <th className="py-3 text-right font-semibold">Accion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sessions.map((session) => (
              <tr key={session.id}>
                <td className="py-3 pr-4 font-mono font-semibold">{session.uid}</td>
                <td className="py-3 pr-4">{session.plate ?? "Sin placa"}</td>
                <td className="py-3 pr-4">{session.owner_name ?? "No asignado"}</td>
                <td className="py-3 pr-4">{session.space_number}</td>
                <td className="py-3 pr-4">{formatDateTime(session.entry_time)}</td>
                <td className="py-3 pr-4">{minutesBetween(session.entry_time)} min</td>
                <td className="py-3 pr-4">{formatMoney(session.amount ?? calculateAmount(session.entry_time))}</td>
                <td className="py-3 pr-4">
                  <Badge tone={session.paid ? "blue" : "amber"}>{formatStatus(session.paid ? "PAID" : "INSIDE", "session")}</Badge>
                </td>
                <td className="py-3 text-right">
                  {!session.paid ? (
                    <button onClick={() => pay(session.id)} className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700">
                      Confirmar pago
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500">Listo para salida</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function UsersVehiclesClient() {
  const adminFetch = useAdminFetch();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<AppUser[]>([]);
  const [vehicles, setVehicles] = useState<VehicleWithUser[]>([]);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const query = search ? `?search=${encodeURIComponent(search)}` : "";
    const [usersPayload, vehiclesPayload] = await Promise.all([
      adminFetch<{ users: AppUser[] }>(`/api/admin/users${query}`),
      adminFetch<{ vehicles: VehicleWithUser[] }>(`/api/admin/vehicles${query}`),
    ]);
    setUsers(usersPayload.users ?? []);
    setVehicles(vehiclesPayload.vehicles ?? []);
  }, [adminFetch, search]);

  useEffect(() => {
    queueMicrotask(() => void load().catch((error) => console.error(error)));
  }, [load]);

  async function generateDemo() {
    setMessage("Generando datos demo...");
    try {
      const payload = await adminFetch<{ usersCreated: number; vehiclesCreated: number; message: string }>("/api/admin/demo-data/generate", {
        method: "POST",
        body: JSON.stringify({ count: 20 }),
      });
      setMessage(`${payload.message}: ${payload.usersCreated} usuarios y ${payload.vehiclesCreated} vehiculos.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo generar datos demo");
    }
  }

  async function toggleUser(user: AppUser) {
    await adminFetch("/api/admin/users", {
      method: "PATCH",
      body: JSON.stringify({ userId: user.id, status: user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }),
    });
    await load();
  }

  async function unassign(vehicleId: string) {
    await adminFetch("/api/admin/vehicles", {
      method: "PATCH",
      body: JSON.stringify({ vehicleId, action: "UNASSIGN_UID" }),
    });
    await load();
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, correo, placa o UID"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm md:max-w-md"
          />
          <button onClick={generateDemo} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Generar datos demo
          </button>
        </div>
        {message ? <p className="mt-3 rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-700">{message}</p> : null}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Usuarios registrados ({users.length})</h3>
          {!users.length ? <EmptyState text="No hay usuarios registrados." /> : null}
          <div className="max-h-[520px] overflow-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-3 pr-4">Nombre</th>
                  <th className="py-3 pr-4">Correo</th>
                  <th className="py-3 pr-4">Estado</th>
                  <th className="py-3 text-right">Accion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="py-3 pr-4 font-medium">{user.full_name}</td>
                    <td className="py-3 pr-4">{user.email}</td>
                    <td className="py-3 pr-4">
                      <Badge tone={statusTone(user.status)}>{formatStatus(user.status, "user")}</Badge>
                    </td>
                    <td className="py-3 text-right">
                      <button onClick={() => toggleUser(user)} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold">
                        {user.status === "ACTIVE" ? "Desactivar" : "Activar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Vehiculos registrados ({vehicles.length})</h3>
          {!vehicles.length ? <EmptyState text="No hay vehiculos registrados." /> : null}
          <div className="max-h-[520px] overflow-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-3 pr-4">Placa</th>
                  <th className="py-3 pr-4">Propietario</th>
                  <th className="py-3 pr-4">Marca/modelo</th>
                  <th className="py-3 pr-4">UID</th>
                  <th className="py-3 pr-4">Estado</th>
                  <th className="py-3 text-right">Accion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vehicles.map((vehicle) => (
                  <tr key={vehicle.id}>
                    <td className="py-3 pr-4 font-semibold">{vehicle.plate}</td>
                    <td className="py-3 pr-4">{vehicle.app_users?.full_name ?? "No asignado"}</td>
                    <td className="py-3 pr-4">
                      {vehicle.brand} {vehicle.model} / {vehicle.color}
                    </td>
                    <td className="py-3 pr-4">
                      {vehicle.uid ? <span className="font-mono">{vehicle.uid}</span> : <Badge>Sin UID</Badge>}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge tone={statusTone(vehicle.status)}>{formatStatus(vehicle.status, "vehicle")}</Badge>
                    </td>
                    <td className="py-3 text-right">
                      {vehicle.uid ? (
                        <button onClick={() => unassign(vehicle.id)} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold">
                          Desasociar UID
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">Disponible</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

export function ReservationsClient() {
  const adminFetch = useAdminFetch();
  const [reservations, setReservations] = useState<ReservationWithRelations[]>([]);
  const [vehicles, setVehicles] = useState<VehicleWithUser[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [duration, setDuration] = useState(1);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    const suffix = params.toString() ? `?${params}` : "";
    const [reservationPayload, vehiclePayload, overviewPayload] = await Promise.all([
      adminFetch<{ reservations: ReservationWithRelations[] }>(`/api/admin/reservations${suffix}`),
      adminFetch<{ vehicles: VehicleWithUser[] }>("/api/admin/vehicles?reservable=true"),
      adminFetch<Overview>("/api/admin/overview"),
    ]);
    setReservations(reservationPayload.reservations ?? []);
    const reservableVehicles = vehiclePayload.vehicles ?? [];
    setVehicles(reservableVehicles);
    setVehicleId((current) => (reservableVehicles.some((vehicle) => vehicle.id === current) ? current : ""));
    setOverview({ ...emptyOverview, ...overviewPayload });
    setDuration(overviewPayload.settings?.reservation_test_duration_minutes ?? 1);
  }, [adminFetch, search, status]);

  useEffect(() => {
    queueMicrotask(() => void load().catch((error) => console.error(error)));
  }, [load]);

  async function create() {
    const vehicle = vehicles.find((item) => item.id === vehicleId);
    if (!vehicle) {
      setMessage("Selecciona un vehículo disponible para reserva.");
      return;
    }
    try {
      const payload = await adminFetch<{ ok: boolean; message: string }>("/api/admin/reservations", {
        method: "POST",
        body: JSON.stringify({ userId: vehicle.user_id, vehicleId, durationMinutes: duration }),
      });
      setMessage(payload.message);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear la reserva");
    }
  }

  async function patchReservation(action: string, reservationId?: string) {
    const payload = action === "EXPIRE" ? { action } : { reservationId };
    await adminFetch("/api/admin/reservations", { method: "PATCH", body: JSON.stringify(payload) });
    await load();
  }

  const activeCount = overview?.activeReservations ?? 0;
  const limit = overview?.reservationLimit ?? 5;
  const occupiedSpaces = overview?.occupiedSpaces ?? 0;
  const freeSpaces = overview?.freeSpaces ?? 0;
  const availableCapacity = overview?.availableCapacity ?? 0;
  const reservationAvailable = overview?.reservationAvailable ?? false;
  const availabilityMessage =
    activeCount >= limit
      ? "Se alcanzó el límite de reservas activas"
      : freeSpaces <= 0 || availableCapacity <= 0
        ? "No hay espacios disponibles para reservar"
        : "";

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-3 lg:grid-cols-[1fr_160px_160px_160px]">
          <select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">{vehicles.length ? "Seleccionar vehículo disponible para reserva" : "No hay vehículos disponibles para reservar"}</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.plate} - {vehicle.app_users?.full_name ?? "Sin usuario"} {vehicle.uid ? `(${vehicle.uid})` : ""}
              </option>
            ))}
          </select>
          <input type="number" min={1} value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <button disabled={!reservationAvailable || !vehicles.length} onClick={create} className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:bg-slate-300">
            Crear reserva
          </button>
          <button onClick={() => patchReservation("EXPIRE")} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold">
            Marcar vencidas
          </button>
        </div>
        {!vehicles.length ? <p className="mt-3 text-sm text-slate-600">No hay vehículos disponibles para reservar</p> : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-md border border-slate-200 p-3 text-sm">
            <p className="font-semibold">Reservas activas</p>
            <p className="mt-1 text-2xl font-semibold">
              {activeCount}/{limit}
            </p>
          </div>
          <div className="rounded-md border border-slate-200 p-3 text-sm">
            <p className="font-semibold">Espacios ocupados</p>
            <p className="mt-1 text-2xl font-semibold">{occupiedSpaces}</p>
          </div>
          <div className="rounded-md border border-slate-200 p-3 text-sm">
            <p className="font-semibold">Espacios libres</p>
            <p className="mt-1 text-2xl font-semibold">{freeSpaces}</p>
          </div>
          <div className="rounded-md border border-slate-200 p-3 text-sm">
            <p className="font-semibold">Capacidad disponible para reserva</p>
            <p className="mt-1 text-2xl font-semibold">{Math.max(0, availableCapacity)}</p>
          </div>
          <div className="rounded-md border border-slate-200 p-3 text-sm">
            <p className="font-semibold">Estado</p>
            <p className="mt-2">
              <Badge tone={reservationAvailable ? "green" : "red"}>{reservationAvailable ? "Disponible" : "No disponible"}</Badge>
            </p>
          </div>
        </div>
        {availabilityMessage ? <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{availabilityMessage}</p> : null}
        {message ? <p className="mt-3 rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-700">{message}</p> : null}
      </Card>

      <Card>
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar placa, usuario, UID" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Todos los estados</option>
            {["ACTIVE", "USED", "CANCELLED", "EXPIRED"].map((item) => (
              <option key={item} value={item}>
                {formatStatus(item, "reservation")}
              </option>
            ))}
          </select>
        </div>
        {!reservations.length ? <EmptyState text="No hay reservas activas para los filtros seleccionados." /> : null}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-3 pr-4">Placa</th>
                <th className="py-3 pr-4">Usuario</th>
                <th className="py-3 pr-4">UID</th>
                <th className="py-3 pr-4">Inicio</th>
                <th className="py-3 pr-4">Vence</th>
                <th className="py-3 pr-4">Estado</th>
                <th className="py-3 text-right">Accion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reservations.map((reservation) => (
                <tr key={reservation.id}>
                  <td className="py-3 pr-4 font-semibold">{reservation.plate}</td>
                  <td className="py-3 pr-4">{reservation.app_users?.full_name ?? "No asignado"}</td>
                  <td className="py-3 pr-4 font-mono">{reservation.uid ?? "Sin UID"}</td>
                  <td className="py-3 pr-4">{formatDateTime(reservation.start_time)}</td>
                  <td className="py-3 pr-4">{formatDateTime(reservation.expires_at)}</td>
                  <td className="py-3 pr-4">
                    <Badge tone={statusTone(reservation.status)}>{formatStatus(reservation.status, "reservation")}</Badge>
                  </td>
                  <td className="py-3 text-right">
                    {reservation.status === "ACTIVE" ? (
                      <button onClick={() => patchReservation("CANCEL", reservation.id)} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold">
                        Cancelar
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500">Sin accion</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function ReportsClient() {
  const adminFetch = useAdminFetch();
  const [events, setEvents] = useState<ParkingEvent[]>([]);
  const [uid, setUid] = useState("");
  const [plate, setPlate] = useState("");
  const [user, setUser] = useState("");
  const [eventType, setEventType] = useState("");
  const [period, setPeriod] = useState<ReportRange["period"]>("day");
  const [selectedDate, setSelectedDate] = useState("");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [range, setRange] = useState<ReportRange | null>(null);
  const [message, setMessage] = useState("");
  const [plateReport, setPlateReport] = useState<{ sessions: ParkingSession[]; events: ParkingEvent[] }>({ sessions: [], events: [] });
  const [plateReportQuery, setPlateReportQuery] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("period", period);
    if (uid) params.set("uid", uid);
    if (plate) params.set("plate", plate);
    if (user) params.set("user", user);
    if (eventType) params.set("eventType", eventType);
    if (selectedDate) params.set("date", selectedDate);
    if (period === "custom" && customFrom) params.set("from", customFrom);
    if (period === "custom" && customTo) params.set("to", customTo);
    return params.toString();
  }, [customFrom, customTo, eventType, period, plate, selectedDate, uid, user]);

  const load = useCallback(async () => {
    try {
      const payload = await adminFetch<{ events: ParkingEvent[]; range: ReportRange }>(`/api/admin/events?${query}`);
      setEvents(payload.events ?? []);
      setRange(payload.range);
      setMessage("");
      if (!selectedDate) setSelectedDate(payload.range.selectedDate);
    } catch (error) {
      console.error(error);
      setEvents([]);
      setMessage(error instanceof Error ? error.message : "No se pudo generar el reporte.");
    }
  }, [adminFetch, query, selectedDate]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  async function searchPlateReport() {
    if (!plate) return;
    try {
      const payload = await adminFetch<{ sessions: ParkingSession[]; events: ParkingEvent[] }>(
        `/api/admin/reports/plate?plate=${encodeURIComponent(plate)}&${query}`,
      );
      setPlateReport(payload);
      setPlateReportQuery(query);
      setMessage("");
    } catch (error) {
      setPlateReport({ sessions: [], events: [] });
      setPlateReportQuery("");
      setMessage(error instanceof Error ? error.message : "No se pudo generar el reporte por placa.");
    }
  }

  function exportCsv() {
    const header = ["UID", "Placa", "Propietario", "Tipo", "Descripcion", "Fecha", "Punto"];
    const rows = events.map((event) => [
      event.uid,
      event.plate ?? "Sin placa",
      event.owner_name ?? "No asignado",
      formatStatus(event.event_type, "event"),
      event.description,
      event.created_at,
      event.point,
    ]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "reporte-estacionamiento.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const peakRows = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, "0")}:00 - ${String(hour + 1).padStart(2, "0")}:00`,
    count: events.filter((event) => event.event_type === "INGRESO" && hourInLima(event.created_at) === hour).length,
  }));
  const maxPeak = Math.max(1, ...peakRows.map((row) => row.count));
  const peak = peakRows.reduce((best, row) => (row.count > best.count ? row : best), peakRows[0]);
  const summaryCards = [
    ["Total de eventos", events.length],
    ["Total de ingresos", events.filter((event) => event.event_type === "INGRESO").length],
    ["Total de pagos", events.filter((event) => event.event_type === "PAGO").length],
    ["Total de salidas", events.filter((event) => event.event_type === "SALIDA").length],
    ["Horario pico", peak.count ? peak.label : "Sin ingresos"],
  ];
  const visiblePlateReport = plateReportQuery === query ? plateReport : { sessions: [], events: [] };

  function changePeriod(nextPeriod: ReportRange["period"]) {
    setPeriod(nextPeriod);
    setPlateReport({ sessions: [], events: [] });
    if (nextPeriod === "custom") {
      const fallback = selectedDate || range?.selectedDate || "";
      if (!customFrom) setCustomFrom(fallback);
      if (!customTo) setCustomTo(fallback);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="text-xs font-medium text-slate-600">
            Periodo
            <select value={period} onChange={(event) => changePeriod(event.target.value as ReportRange["period"])} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="day">Dia</option>
              <option value="week">Semana</option>
              <option value="month">Mes</option>
              <option value="custom">Personalizado</option>
            </select>
          </label>
          {period === "custom" ? (
            <>
              <label className="text-xs font-medium text-slate-600">
                Fecha inicio
                <input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <label className="text-xs font-medium text-slate-600">
                Fecha fin
                <input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </label>
            </>
          ) : (
            <label className="text-xs font-medium text-slate-600">
              Fecha de referencia
              <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
          )}
          <label className="text-xs font-medium text-slate-600">
            UID
            <input value={uid} onChange={(event) => setUid(event.target.value.toUpperCase())} placeholder="Todos" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Placa
            <input value={plate} onChange={(event) => setPlate(event.target.value.toUpperCase())} placeholder="Todas" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Usuario
            <input value={user} onChange={(event) => setUser(event.target.value)} placeholder="Todos" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Evento
            <select value={eventType} onChange={(event) => setEventType(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">Todos</option>
              {eventTypes.map((type) => (
                <option key={type} value={type}>
                  {formatStatus(type, "event")}
                </option>
              ))}
            </select>
          </label>
          <button disabled={!events.length} onClick={exportCsv} className="self-end rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:bg-slate-300">
            Exportar CSV
          </button>
        </div>
        {range ? <p className="mt-3 text-xs text-slate-500">Rango aplicado: {range.startDate} a {range.endDateInclusive}, zona horaria America/Lima.</p> : null}
        {message ? <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{message}</p> : null}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map(([label, value]) => (
          <Card key={label.toString()}>
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr]">
        <Card>
          <h3 className="text-sm font-semibold text-slate-800">Horarios pico</h3>
          {events.length ? (
            <>
              <p className="mt-1 text-xs text-slate-500">Mayor flujo: {peak.count ? `${peak.label} con ${peak.count} ingresos` : "sin ingresos en el periodo"}.</p>
              <div className="mt-4 grid grid-cols-12 gap-2">
                {peakRows.map((row) => (
                  <div key={row.hour} className="flex h-28 flex-col justify-end gap-1">
                    <div className="rounded-t bg-teal-600" style={{ height: `${row.count ? Math.max(4, (row.count / maxPeak) * 100) : 0}%` }} />
                    <span className="text-center text-[10px] text-slate-500">{String(row.hour).padStart(2, "0")}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState text="No hay eventos registrados para este periodo." />
          )}
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-800">Reporte por placa</h3>
          <button onClick={searchPlateReport} className="mt-3 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold">
            Buscar placa filtrada
          </button>
          <div className="mt-4 space-y-3 text-sm">
            {visiblePlateReport.sessions.slice(0, 3).map((session) => (
              <div key={session.id} className="rounded-md border border-slate-100 p-3">
                <p className="font-semibold">
                  {session.plate ?? "Sin placa"} - {session.owner_name ?? "No asignado"}
                </p>
                <p>UID: {session.uid}</p>
                <p>Ingreso: {formatDateTime(session.entry_time)}</p>
                <p>Pago: {formatDateTime(session.payment_time)}</p>
                <p>Salida: {formatDateTime(session.exit_time)}</p>
                <p>Espacio: {session.space_number}</p>
                <p>Monto: {formatMoney(session.amount ?? 0)}</p>
                <Badge tone={statusTone(session.status)}>{formatStatus(session.status, "session")}</Badge>
              </div>
            ))}
            {visiblePlateReport.events.length ? <p className="text-slate-600">Eventos de la placa en el periodo: {visiblePlateReport.events.length}</p> : null}
            {!visiblePlateReport.sessions.length ? <p className="text-slate-500">Filtra una placa y presiona buscar. El resultado usara el periodo actual.</p> : null}
          </div>
        </Card>
      </div>

      <Card>
        {!events.length ? <EmptyState text="No hay eventos registrados para este periodo." /> : (
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-3 pr-4 font-semibold">UID</th>
                <th className="py-3 pr-4 font-semibold">Placa</th>
                <th className="py-3 pr-4 font-semibold">Propietario</th>
                <th className="py-3 pr-4 font-semibold">Evento</th>
                <th className="py-3 pr-4 font-semibold">Descripcion</th>
                <th className="py-3 pr-4 font-semibold">Fecha/hora</th>
                <th className="py-3 pr-4 font-semibold">Punto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.map((event) => (
                <tr key={event.id}>
                  <td className="py-3 pr-4 font-mono font-semibold">{event.uid}</td>
                  <td className="py-3 pr-4">{event.plate ?? "Sin placa"}</td>
                  <td className="py-3 pr-4">{event.owner_name ?? "No asignado"}</td>
                  <td className="py-3 pr-4">
                    <Badge tone={statusTone(event.event_type)}>{formatStatus(event.event_type, "event")}</Badge>
                  </td>
                  <td className="py-3 pr-4">{event.description}</td>
                  <td className="py-3 pr-4">{formatDateTime(event.created_at)}</td>
                  <td className="py-3 pr-4">{event.point}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export function SettingsClient() {
  const adminFetch = useAdminFetch();
  const [useSimulatedDate, setUseSimulatedDate] = useState(false);
  const [simulatedDate, setSimulatedDate] = useState("");
  const [reservationTestDurationMinutes, setReservationTestDurationMinutes] = useState(1);
  const [message, setMessage] = useState("");
  const [demoMessage, setDemoMessage] = useState("");
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoStats, setDemoStats] = useState<DemoDataStats>({
    totalDemoVehicles: 0,
    availableDemoVehicles: 0,
    assignedDemoVehicles: 0,
    resettableAssociations: 0,
    protectedAssociations: 0,
  });

  const load = useCallback(async () => {
    const [settingsPayload, demoPayload] = await Promise.all([
      adminFetch<{ settings: SystemSettings }>("/api/admin/settings"),
      adminFetch<{ stats: DemoDataStats }>("/api/admin/demo-data/generate"),
    ]);
    setUseSimulatedDate(settingsPayload.settings.use_simulated_date);
    setSimulatedDate(settingsPayload.settings.simulated_date ?? "");
    setReservationTestDurationMinutes(settingsPayload.settings.reservation_test_duration_minutes);
    setDemoStats(demoPayload.stats);
  }, [adminFetch]);

  useEffect(() => {
    queueMicrotask(() => void load().catch((error) => console.error(error)));
  }, [load]);

  async function save(reset = false) {
    try {
      const payload = await adminFetch<{ message: string }>("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({
          useSimulatedDate: reset ? false : useSimulatedDate,
          simulatedDate: reset ? null : simulatedDate,
          reservationTestDurationMinutes,
        }),
      });
      setMessage(payload.message);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la configuracion");
    }
  }

  async function generateDemoData() {
    setDemoLoading(true);
    setDemoMessage("");
    try {
      const payload = await adminFetch<{ message: string; usersCreated: number; vehiclesCreated: number; stats: DemoDataStats }>("/api/admin/demo-data/generate", {
        method: "POST",
        body: JSON.stringify({ count: 20 }),
      });
      setDemoStats(payload.stats);
      setDemoMessage(
        payload.vehiclesCreated
          ? `${payload.message}. Se crearon ${payload.vehiclesCreated} vehiculos demo.`
          : "Los 20 datos demo ya estaban disponibles.",
      );
    } catch (error) {
      setDemoMessage(error instanceof Error ? error.message : "No se pudieron preparar los datos demo");
    } finally {
      setDemoLoading(false);
    }
  }

  async function resetAssociations() {
    if (!window.confirm("Se liberaran solo asociaciones demo sin sesiones activas. Continuar?")) return;

    setDemoLoading(true);
    setDemoMessage("");
    try {
      const payload = await adminFetch<{ message: string; stats: DemoDataStats }>("/api/admin/demo-data/generate", { method: "DELETE" });
      setDemoStats(payload.stats);
      setDemoMessage(payload.message);
    } catch (error) {
      setDemoMessage(error instanceof Error ? error.message : "No se pudieron reiniciar las asociaciones demo");
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="mb-4 text-sm font-semibold text-slate-800">Configuracion de pruebas</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex items-center gap-3 rounded-md border border-slate-200 p-3 text-sm font-medium">
            <input type="checkbox" checked={useSimulatedDate} onChange={(event) => setUseSimulatedDate(event.target.checked)} />
            Activar fecha simulada
          </label>
          <label className="text-sm font-medium text-slate-700">
            Fecha simulada
            <input type="date" value={simulatedDate} onChange={(event) => setSimulatedDate(event.target.value)} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Duracion rapida de reservas
            <input
              type="number"
              min={1}
              value={reservationTestDurationMinutes}
              onChange={(event) => setReservationTestDurationMinutes(Number(event.target.value))}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button onClick={() => save(false)} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            Guardar configuracion
          </button>
          <button onClick={() => save(true)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold">
            Restaurar fecha real
          </button>
        </div>
        {message ? <p className="mt-4 rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-700">{message}</p> : null}
      </Card>

      <div id="datos-demo" className="scroll-mt-24">
        <Card>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Datos demo</h3>
              <p className="mt-1 text-xs text-slate-500">Mantenimiento interno de asociaciones RFID.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button disabled={demoLoading} onClick={generateDemoData} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300">
                Generar 20 datos demo
              </button>
              <button
                disabled={demoLoading || demoStats.resettableAssociations === 0}
                onClick={resetAssociations}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold disabled:text-slate-400"
              >
                Reiniciar asociaciones libres
              </button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ["Vehiculos demo", demoStats.totalDemoVehicles],
              ["Disponibles", demoStats.availableDemoVehicles],
              ["RFID asignados", demoStats.assignedDemoVehicles],
              ["Reiniciables", demoStats.resettableAssociations],
              ["Protegidos por sesion", demoStats.protectedAssociations],
            ].map(([label, value]) => (
              <div key={label.toString()} className="rounded-md border border-slate-200 p-3">
                <p className="text-xs font-medium text-slate-500">{label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
              </div>
            ))}
          </div>
          {demoMessage ? <p className="mt-4 rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-700">{demoMessage}</p> : null}
        </Card>
      </div>
    </div>
  );
}

export function SimulatorClient() {
  const router = useRouter();
  const [uid, setUid] = useState("01020304");
  const [response, setResponse] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState("");
  const [httpStatus, setHttpStatus] = useState<number | null>(null);

  async function simulate(path: string, label: string) {
    if (!uid.trim()) {
      setResponse({ allowed: false, message: "Ingrese un UID RFID." });
      setHttpStatus(400);
      return;
    }

    setLoading(label);
    setHttpStatus(null);
    try {
      const isEntry = path.endsWith("/entry");
      const isPayment = path.endsWith("/payment-confirm");
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: isEntry ? "ESP32_ENTRADA_01" : isPayment ? "ESP32_PAGO_01" : "ESP32_SALIDA_01",
          uid,
          point: isEntry ? "entrada" : isPayment ? "pago" : "salida",
        }),
      });
      const rawText = await res.text();
      let payload: Record<string, unknown>;
      try {
        payload = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : { allowed: false, message: "El servidor devolvio una respuesta vacia." };
      } catch {
        payload = { allowed: false, message: "El servidor devolvio una respuesta no valida.", debug: rawText };
      }

      if (typeof payload.status === "string") {
        payload = { ...payload, status: formatStatus(payload.status, "session") };
      }
      setResponse(payload);
      setHttpStatus(res.status);
      router.refresh();
    } catch (error) {
      console.error("[simulador-rfid]", error);
      setResponse({
        allowed: false,
        message: "No se pudo conectar con el servidor.",
        ...(process.env.NODE_ENV === "development" && error instanceof Error ? { debug: error.message } : {}),
      });
      setHttpStatus(0);
    } finally {
      setLoading("");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <label className="text-sm font-medium text-slate-700" htmlFor="uid">
          UID de tarjeta RFID
        </label>
        <input id="uid" value={uid} onChange={(event) => setUid(event.target.value.toUpperCase())} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 font-mono" />
        <div className="mt-4 flex flex-wrap gap-2">
          {["01020304", "A1B2C3D4", "B2C3D4E5", "C3D4E5F6", "F0F1F2F3", "DEMO0001"].map((testUid) => (
            <button key={testUid} onClick={() => setUid(testUid)} className="rounded-md border border-slate-300 px-3 py-2 font-mono text-xs">
              {testUid}
            </button>
          ))}
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <button onClick={() => simulate("/api/iot/entry", "ingreso")} className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">
            Simular ingreso
          </button>
          <button onClick={() => simulate("/api/iot/payment-confirm", "pago")} className="rounded-md bg-sky-700 px-3 py-2 text-sm font-semibold text-white">
            Simular pago
          </button>
          <button onClick={() => simulate("/api/iot/exit", "salida")} className="rounded-md bg-amber-700 px-3 py-2 text-sm font-semibold text-white">
            Simular salida
          </button>
        </div>
        <div className="mt-5 rounded-md border border-slate-200 p-3 text-sm text-slate-600">
          <p>Flujo principal: ingreso, pago por caseta RFID y salida. Tambien puedes probar una salida directa para validar el rechazo por pago pendiente.</p>
        </div>
        {loading ? <p className="mt-4 text-sm text-slate-500">Procesando {loading}...</p> : null}
      </Card>
      <Card>
        <p className="mb-3 text-sm font-semibold text-slate-700">Respuesta JSON</p>
        {httpStatus !== null ? (
          <p className={`mb-3 rounded-md px-3 py-2 text-sm ${httpStatus >= 500 || httpStatus === 0 ? "bg-rose-50 text-rose-700" : response?.allowed === false ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>
            {httpStatus >= 500 || httpStatus === 0
              ? `Error de comunicacion${httpStatus ? ` (HTTP ${httpStatus})` : ""}.`
              : response?.allowed === false
                ? `Solicitud atendida y rechazada de forma controlada (HTTP ${httpStatus}).`
                : `Solicitud procesada correctamente (HTTP ${httpStatus}).`}
          </p>
        ) : null}
        <pre className="min-h-64 overflow-auto rounded-md bg-slate-950 p-4 text-xs leading-6 text-slate-100">{JSON.stringify(response ?? { message: "Sin solicitudes todavia" }, null, 2)}</pre>
      </Card>
    </div>
  );
}
