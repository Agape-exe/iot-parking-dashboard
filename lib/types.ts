export type SpaceStatus = "FREE" | "OCCUPIED" | "PAID" | "RESERVED";
export type SessionStatus = "INSIDE" | "PAID" | "EXITED";
export type ReservationStatus = "ACTIVE" | "USED" | "CANCELLED" | "EXPIRED";
export type UserStatus = "ACTIVE" | "INACTIVE";
export type VehicleStatus = "AVAILABLE" | "ASSIGNED" | "INACTIVE";
export type RfidEnrollmentStatus = "PENDING" | "COMPLETED" | "EXPIRED" | "CANCELLED" | "FAILED";

export type EventType =
  | "INGRESO"
  | "PAGO_SOLICITADO"
  | "PAGO"
  | "SALIDA"
  | "SALIDA_DENEGADA"
  | "PAGO_PENDIENTE"
  | "INTENTO_DOBLE_INGRESO"
  | "ESTACIONAMIENTO_LLENO"
  | "RESERVA_CREADA"
  | "RESERVA_USADA"
  | "RESERVA_CANCELADA"
  | "RESERVA_EXPIRADA"
  | "UID_ASIGNADO";

export type AppUser = {
  id: string;
  auth_user_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  status: UserStatus;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
};

export type Vehicle = {
  id: string;
  user_id: string;
  plate: string;
  brand: string;
  model: string;
  color: string;
  uid: string | null;
  status: VehicleStatus;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
  app_users?: AppUser | null;
};

export type RfidEnrollment = {
  id: string;
  user_id: string;
  vehicle_id: string;
  status: RfidEnrollmentStatus;
  uid: string | null;
  expires_at: string;
  created_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  message: string | null;
};

export type Reservation = {
  id: string;
  user_id: string;
  vehicle_id: string;
  plate: string;
  uid: string | null;
  start_time: string;
  expires_at: string;
  status: ReservationStatus;
  created_at: string;
  updated_at: string;
  app_users?: AppUser | null;
  vehicles?: Vehicle | null;
};

export type SystemSettings = {
  id: string;
  use_simulated_date: boolean;
  simulated_date: string | null;
  reservation_test_duration_minutes: number;
  created_at: string;
  updated_at: string;
};

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
  user_id: string | null;
  vehicle_id: string | null;
  reservation_id: string | null;
  plate: string | null;
  owner_name: string | null;
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
  user_id: string | null;
  vehicle_id: string | null;
  reservation_id: string | null;
  plate: string | null;
  owner_name: string | null;
  created_at: string;
};

export type VehicleAssignment = {
  user: AppUser;
  vehicle: Vehicle;
};

export type ApiResult<T = unknown> = {
  allowed?: boolean;
  message: string;
  data?: T;
  [key: string]: unknown;
};
