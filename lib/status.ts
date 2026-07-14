export type StatusContext = "session" | "space" | "reservation" | "vehicle" | "user" | "event";

const commonLabels: Record<string, string> = {
  INSIDE: "Dentro",
  PAID: "Pagado",
  EXITED: "Salio",
  CANCELLED: "Cancelado",
  FREE: "Libre",
  OCCUPIED: "Ocupado",
  RESERVED: "Reservado",
  USED: "Usada",
  EXPIRED: "Vencida",
  AVAILABLE: "Disponible",
  ASSIGNED: "Asignado",
  INACTIVE: "Inactivo",
  INGRESO: "Ingreso",
  PAGO_SOLICITADO: "Pago solicitado",
  PAGO: "Pago",
  SALIDA: "Salida",
  INTENTO_DOBLE_INGRESO: "Intento de doble ingreso",
  ESTACIONAMIENTO_LLENO: "Estacionamiento lleno",
  SALIDA_DENEGADA: "Salida denegada",
  PAGO_PENDIENTE: "Pago pendiente",
  RESERVA_CREADA: "Reserva creada",
  RESERVA_USADA: "Reserva usada",
  RESERVA_CANCELADA: "Reserva cancelada",
  RESERVA_EXPIRADA: "Reserva vencida",
  UID_ASIGNADO: "UID asignado",
};

export function formatStatus(status: string | null | undefined, context?: StatusContext) {
  if (!status) return "Sin estado";
  if (status === "ACTIVE") {
    return context === "reservation" ? "Activa" : "Activo";
  }
  if (status === "CANCELLED" && context === "reservation") return "Cancelada";
  if (status === "INACTIVE" && context === "vehicle") return "Inactivo";
  if (status === "INACTIVE" && context === "user") return "Inactivo";
  return commonLabels[status] ?? status;
}
