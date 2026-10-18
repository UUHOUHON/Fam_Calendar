import {
  addDays,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
} from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

export function zonedDateTimeToUtc(
  dateStr: string,
  timeStr: string,
  timezone: string,
): Date {
  return fromZonedTime(`${dateStr}T${timeStr}:00`, timezone);
}

export function utcToZonedParts(date: Date | string, timezone: string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return {
    date: formatInTimeZone(d, timezone, "yyyy-MM-dd"),
    time: formatInTimeZone(d, timezone, "HH:mm"),
    weekday: formatInTimeZone(d, timezone, "EEEE"),
    label: formatInTimeZone(d, timezone, "MMM d, yyyy · h:mm a"),
    shortLabel: formatInTimeZone(d, timezone, "h:mm a"),
    dayLabel: formatInTimeZone(d, timezone, "EEE, MMM d"),
  };
}

export function formatOffsetLabel(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, "xxx");
}

export function getMonthDays(anchor: Date) {
  const start = startOfMonth(anchor);
  const end = endOfMonth(anchor);
  return eachDayOfInterval({ start, end });
}

export function getCalendarGrid(anchor: Date) {
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const gridStart = addDays(monthStart, -monthStart.getDay());
  const gridEnd = addDays(monthEnd, 6 - monthEnd.getDay());
  return eachDayOfInterval({ start: gridStart, end: gridEnd });
}

export function dayKeyInZone(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, "yyyy-MM-dd");
}

export function localDayBoundsUtc(dayKey: string, timezone: string) {
  const start = fromZonedTime(`${dayKey}T00:00:00`, timezone);
  const end = fromZonedTime(`${dayKey}T23:59:59.999`, timezone);
  return { start, end };
}

export function overlaps(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function monthLabel(date: Date) {
  return format(date, "MMMM yyyy");
}

export function viewerNowParts(timezone: string) {
  const now = new Date();
  return {
    now,
    dayKey: dayKeyInZone(now, timezone),
    zoned: toZonedTime(now, timezone),
    start: startOfDay(toZonedTime(now, timezone)),
    end: endOfDay(toZonedTime(now, timezone)),
  };
}
