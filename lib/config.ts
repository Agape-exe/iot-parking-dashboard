export const TOTAL_SPACES = Number(process.env.NEXT_PUBLIC_TOTAL_SPACES ?? 9);
export const RATE_PER_MINUTE = Number(process.env.NEXT_PUBLIC_RATE_PER_MINUTE ?? 0.1);
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
export const RESERVATION_LIMIT = Math.floor(TOTAL_SPACES * 0.5);
export const IOT_DEVICE_API_KEY = process.env.IOT_DEVICE_API_KEY;

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
    timeZone: "America/Lima",
  }).format(new Date(value));
}

export function hourInLima(value: string) {
  const part = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone: "America/Lima",
  })
    .formatToParts(new Date(value))
    .find((item) => item.type === "hour")?.value;

  return Number(part ?? 0);
}

export function minutesBetween(start: string, end = new Date()) {
  return Math.max(1, Math.ceil((end.getTime() - new Date(start).getTime()) / 60000));
}

export function calculateAmount(entryTime: string, end = new Date()) {
  return Number((minutesBetween(entryTime, end) * RATE_PER_MINUTE).toFixed(2));
}

export function combineDateWithCurrentTime(date: string) {
  const now = new Date();
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const second = String(now.getSeconds()).padStart(2, "0");
  return new Date(`${date}T${hour}:${minute}:${second}`);
}
