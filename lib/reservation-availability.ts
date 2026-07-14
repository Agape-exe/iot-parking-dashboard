import { RESERVATION_LIMIT, TOTAL_SPACES } from "@/lib/config";

export type ReservationAvailability = {
  totalSpaces: number;
  occupiedSpaces: number;
  freeSpaces: number;
  activeReservations: number;
  reservationLimit: number;
  availableCapacity: number;
  reservationAvailable: boolean;
};

export function calculateReservationAvailability(occupiedSpaces: number, activeReservations: number): ReservationAvailability {
  const freeSpaces = Math.max(0, TOTAL_SPACES - occupiedSpaces);
  const availableCapacity = TOTAL_SPACES - occupiedSpaces - activeReservations;

  return {
    totalSpaces: TOTAL_SPACES,
    occupiedSpaces,
    freeSpaces,
    activeReservations,
    reservationLimit: RESERVATION_LIMIT,
    availableCapacity,
    reservationAvailable: activeReservations < RESERVATION_LIMIT && freeSpaces > 0 && availableCapacity > 0,
  };
}

export function getReservationBlockMessage(availability: ReservationAvailability) {
  if (availability.activeReservations >= availability.reservationLimit) {
    return "Se alcanzó el límite de reservas activas";
  }
  if (availability.freeSpaces <= 0 || availability.availableCapacity <= 0) {
    return "No hay espacios disponibles para reservar";
  }
  return null;
}
