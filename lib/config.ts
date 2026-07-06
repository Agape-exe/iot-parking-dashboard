export const TOTAL_SPACES = Number(process.env.NEXT_PUBLIC_TOTAL_SPACES ?? 10);
export const RATE_PER_MINUTE = Number(process.env.NEXT_PUBLIC_RATE_PER_MINUTE ?? 0.1);
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export function formatMoney(amount: number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(amount);
}

export function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function minutesBetween(start: string, end = new Date()) {
  return Math.max(1, Math.ceil((end.getTime() - new Date(start).getTime()) / 60000));
}

export function calculateAmount(entryTime: string, end = new Date()) {
  return Number((minutesBetween(entryTime, end) * RATE_PER_MINUTE).toFixed(2));
}
