export const REPORT_TIME_ZONE = "America/Lima";
export type ReportPeriod = "day" | "week" | "month" | "custom";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function assertDateKey(value: string, label: string) {
  if (!DATE_PATTERN.test(value)) throw new Error(`${label} no es valida.`);
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new Error(`${label} no es valida.`);
  }
  return value;
}

function shiftDate(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

function firstDayOfMonth(value: string) {
  return `${value.slice(0, 7)}-01`;
}

function firstDayOfNextMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
}

function limaMidnightIso(value: string) {
  return new Date(`${value}T00:00:00-05:00`).toISOString();
}

export function dateKeyInLima(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: REPORT_TIME_ZONE,
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function resolveReportRange(
  input: { period?: string | null; date?: string | null; from?: string | null; to?: string | null },
  defaultDate: string,
) {
  const period: ReportPeriod = ["day", "week", "month", "custom"].includes(input.period ?? "")
    ? (input.period as ReportPeriod)
    : "day";
  const selectedDate = assertDateKey(input.date || defaultDate, "La fecha seleccionada");
  let startDate = selectedDate;
  let endDateExclusive = shiftDate(selectedDate, 1);

  if (period === "week") {
    const [year, month, day] = selectedDate.split("-").map(Number);
    const weekDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    startDate = shiftDate(selectedDate, -((weekDay + 6) % 7));
    endDateExclusive = shiftDate(startDate, 7);
  } else if (period === "month") {
    startDate = firstDayOfMonth(selectedDate);
    endDateExclusive = firstDayOfNextMonth(selectedDate);
  } else if (period === "custom") {
    startDate = assertDateKey(input.from || selectedDate, "La fecha inicial");
    const inclusiveEnd = assertDateKey(input.to || startDate, "La fecha final");
    if (inclusiveEnd < startDate) throw new Error("La fecha final debe ser igual o posterior a la fecha inicial.");
    endDateExclusive = shiftDate(inclusiveEnd, 1);
  }

  return {
    period,
    selectedDate,
    startDate,
    endDateInclusive: shiftDate(endDateExclusive, -1),
    start: limaMidnightIso(startDate),
    endExclusive: limaMidnightIso(endDateExclusive),
    timeZone: REPORT_TIME_ZONE,
  };
}
