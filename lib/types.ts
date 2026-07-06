export type SpaceStatus = "FREE" | "OCCUPIED";
export type SessionStatus = "INSIDE" | "PAID" | "EXITED";
export type EventType =
  | "INGRESO"
  | "PAGO_SOLICITADO"
  | "PAGO"
  | "SALIDA"
  | "SALIDA_DENEGADA"
  | "PAGO_PENDIENTE"
  | "INTENTO_DOBLE_INGRESO"
  | "ESTACIONAMIENTO_LLENO";

export type ParkingSpace = {
  id: string;
  number: number;
  status: SpaceStatus;
  created_at: string;
  updated_at: string;
};

export type ParkingSession = {
  id: string;
  uid: string;
  space_number: number;
  entry_time: string;
  payment_time: string | null;
  exit_time: string | null;
  paid: boolean;
  amount: number | null;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
};

export type ParkingEvent = {
  id: string;
  uid: string;
  event_type: EventType;
  description: string;
  point: string;
  device_id: string | null;
  created_at: string;
};

export type ApiResult<T = unknown> = {
  allowed?: boolean;
  message: string;
  data?: T;
  [key: string]: unknown;
};
