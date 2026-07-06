"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Card, EmptyState } from "@/app/components/ui";
import { calculateAmount, formatDateTime, formatMoney, minutesBetween } from "@/lib/config";
import type { EventType, ParkingEvent, ParkingSession, ParkingSpace } from "@/lib/types";
import { useAuth } from "./AuthGate";

type Overview = {
  totalSpaces: number;
  occupiedSpaces: number;
  freeSpaces: number;
  vehiclesInside: number;
  entriesToday: number;
  paymentsToday: number;
  exitsToday: number;
  doubleEntryAttemptsToday: number;
  spaces: ParkingSpace[];
  activeSessions: ParkingSession[];
};

const emptyOverview: Overview = {
  totalSpaces: 10,
  occupiedSpaces: 0,
  freeSpaces: 10,
  vehiclesInside: 0,
  entriesToday: 0,
  paymentsToday: 0,
  exitsToday: 0,
  doubleEntryAttemptsToday: 0,
  spaces: Array.from({ length: 10 }, (_, index) => ({
    id: `empty-${index + 1}`,
    number: index + 1,
    status: "FREE",
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  })),
  activeSessions: [],
};

function statusTone(status: string) {
  if (status === "FREE") return "green";
  if (status === "PAID") return "blue";
  if (status === "OCCUPIED" || status === "INSIDE") return "amber";
  if (status.includes("DENEGADA") || status.includes("PENDIENTE")) return "red";
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

export function DashboardClient() {
  const adminFetch = useAdminFetch();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const nextOverview = await adminFetch<Overview>("/api/admin/overview");
      setOverview({
        ...emptyOverview,
        ...nextOverview,
        spaces: nextOverview.spaces?.length ? nextOverview.spaces : emptyOverview.spaces,
        activeSessions: nextOverview.activeSessions ?? [],
      });
      setError("");
    } catch (loadError) {
      console.error(loadError);
      setOverview(emptyOverview);
      setError("");
    }
  }, [adminFetch]);

  useEffect(() => {
    queueMicrotask(() => void load());
    const id = window.setInterval(load, 15000);
    return () => window.clearInterval(id);
  }, [load]);

  if (error) return <EmptyState text={error} />;
  if (!overview) return <EmptyState text="Cargando indicadores..." />;

  const cards = [
    ["Total de espacios", overview.totalSpaces],
    ["Espacios ocupados", overview.occupiedSpaces],
    ["Espacios libres", overview.freeSpaces],
    ["Vehiculos dentro", overview.vehiclesInside],
    ["Ingresos del dia", overview.entriesToday],
    ["Pagos del dia", overview.paymentsToday],
    ["Salidas del dia", overview.exitsToday],
    ["Doble ingreso del dia", overview.doubleEntryAttemptsToday],
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(([label, value]) => (
        <Card key={label.toString()}>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">{value}</p>
        </Card>
      ))}
    </div>
  );
}

export function SpacesClient() {
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
      });
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
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {overview.spaces.map((space) => {
        const session = sessionsBySpace.get(space.number);
        const occupied = Boolean(session);
        return (
          <Card key={space.id} className={occupied ? "border-amber-200 bg-amber-50/60" : "border-emerald-200 bg-emerald-50/60"}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">Espacio</p>
                <p className="text-3xl font-semibold">{space.number}</p>
              </div>
              <Badge tone={occupied ? "amber" : "green"}>{occupied ? "Ocupado" : "Libre"}</Badge>
            </div>
            {session ? (
              <div className="mt-5 space-y-2 text-sm text-slate-700">
                <p className="font-mono font-semibold">{session.uid}</p>
                <p>Ingreso: {formatDateTime(session.entry_time)}</p>
              </div>
            ) : (
              <p className="mt-5 text-sm text-emerald-700">Disponible para asignacion automatica.</p>
            )}
          </Card>
        );
      })}
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
              <th className="py-3 pr-4 font-semibold">UID</th>
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
                <td className="py-3 pr-4">{session.space_number}</td>
                <td className="py-3 pr-4">{formatDateTime(session.entry_time)}</td>
                <td className="py-3 pr-4">{minutesBetween(session.entry_time)} min</td>
                <td className="py-3 pr-4">{formatMoney(session.amount ?? calculateAmount(session.entry_time))}</td>
                <td className="py-3 pr-4">
                  <Badge tone={session.paid ? "blue" : "amber"}>{session.paid ? "Pagado" : "Dentro"}</Badge>
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

export function ReportsClient() {
  const adminFetch = useAdminFetch();
  const [events, setEvents] = useState<ParkingEvent[]>([]);
  const [uid, setUid] = useState("");
  const [eventType, setEventType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const eventTypes: EventType[] = ["INGRESO", "PAGO_SOLICITADO", "PAGO", "SALIDA", "PAGO_PENDIENTE", "INTENTO_DOBLE_INGRESO", "ESTACIONAMIENTO_LLENO"];

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (uid) params.set("uid", uid);
    if (eventType) params.set("eventType", eventType);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return params.toString();
  }, [eventType, from, to, uid]);

  const load = useCallback(async () => {
    try {
      const payload = await adminFetch<{ events: ParkingEvent[] }>(`/api/admin/events${query ? `?${query}` : ""}`);
      setEvents(payload.events ?? []);
    } catch (error) {
      console.error(error);
      setEvents([]);
    }
  }, [adminFetch, query]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  function exportCsv() {
    const header = ["UID", "Tipo", "Descripcion", "Fecha", "Punto"];
    const rows = events.map((event) => [event.uid, event.event_type, event.description, event.created_at, event.point]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "eventos-estacionamiento.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-3 md:grid-cols-5">
          <input value={uid} onChange={(event) => setUid(event.target.value.toUpperCase())} placeholder="UID" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <select value={eventType} onChange={(event) => setEventType(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Todos los eventos</option>
            {eventTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <button onClick={exportCsv} className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
            Exportar CSV
          </button>
        </div>
      </Card>
      <Card>
        {!events.length ? <EmptyState text="Aun no hay eventos registrados." /> : null}
        <div className="overflow-x-auto">
          <table className={`min-w-full divide-y divide-slate-200 text-sm ${events.length ? "" : "mt-4"}`}>
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-3 pr-4 font-semibold">UID</th>
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
                  <td className="py-3 pr-4">
                    <Badge tone={statusTone(event.event_type)}>{event.event_type}</Badge>
                  </td>
                  <td className="py-3 pr-4">{event.description}</td>
                  <td className="py-3 pr-4">{formatDateTime(event.created_at)}</td>
                  <td className="py-3 pr-4">{event.point}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export function SimulatorClient() {
  const [uid, setUid] = useState("A1B2C3D4");
  const [response, setResponse] = useState<unknown>(null);
  const [loading, setLoading] = useState("");

  async function simulate(path: string, label: string) {
    setLoading(label);
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: path.includes("entry") ? "ESP32_ENTRADA_01" : "ESP32_CASETA_01",
        uid,
        point: path.includes("entry") ? "entrada" : "caseta",
      }),
    });
    setResponse(await res.json());
    setLoading("");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <label className="text-sm font-medium text-slate-700" htmlFor="uid">
          UID de tarjeta RFID
        </label>
        <input id="uid" value={uid} onChange={(event) => setUid(event.target.value.toUpperCase())} className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 font-mono" />
        <div className="mt-4 flex flex-wrap gap-2">
          {["01020304", "A1B2C3D4", "B2C3D4E5", "C3D4E5F6"].map((testUid) => (
            <button key={testUid} onClick={() => setUid(testUid)} className="rounded-md border border-slate-300 px-3 py-2 font-mono text-xs">
              {testUid}
            </button>
          ))}
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <button onClick={() => simulate("/api/iot/entry", "ingreso")} className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">
            Simular ingreso
          </button>
          <button onClick={() => simulate("/api/iot/payment-request", "pago")} className="rounded-md bg-sky-700 px-3 py-2 text-sm font-semibold text-white">
            Solicitar pago
          </button>
          <button onClick={() => simulate("/api/iot/exit", "salida")} className="rounded-md bg-amber-700 px-3 py-2 text-sm font-semibold text-white">
            Simular salida
          </button>
        </div>
        {loading ? <p className="mt-4 text-sm text-slate-500">Procesando {loading}...</p> : null}
      </Card>
      <Card>
        <p className="mb-3 text-sm font-semibold text-slate-700">Respuesta JSON</p>
        <pre className="min-h-64 overflow-auto rounded-md bg-slate-950 p-4 text-xs leading-6 text-slate-100">{JSON.stringify(response ?? { message: "Sin solicitudes todavia" }, null, 2)}</pre>
      </Card>
    </div>
  );
}
