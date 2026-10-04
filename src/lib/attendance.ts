import type { AttendanceStatus } from "./types";

export const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
export const WEEKDAY_INITIALS = ["S","M","T","W","T","F","S"];

/** Monday-first, matching how the schedule day names are stored ("Mon".."Sun"). */
export const WEEK_ORDER = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

export const toKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function monthLabel(year: number, month: number) {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

export type CalendarCell = { key: string; day: number | null; status?: AttendanceStatus; isToday: boolean; isFuture: boolean };

/**
 * Builds a 6x7 grid for the month. Cells outside the month are day: null so the
 * caller can render them blank instead of mislabelling them.
 */
export function buildMonthGrid(year: number, month: number, statuses: Record<string, AttendanceStatus>, today = new Date()): CalendarCell[] {
  const first = new Date(year, month - 1, 1);
  // getDay() is Sunday=0; shift so Monday=0 to match WEEK_ORDER.
  const leading = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayKey = toKey(today);
  const cells: CalendarCell[] = [];

  for (let i = 0; i < leading; i++) cells.push({ key: `pad-${i}`, day: null, isToday: false, isFuture: false });

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const key = toKey(date);
    cells.push({ key, day: d, status: statuses[key], isToday: key === todayKey, isFuture: date > today });
  }

  while (cells.length % 7 !== 0) cells.push({ key: `pad-${cells.length}`, day: null, isToday: false, isFuture: false });
  return cells;
}

export function summarise(statuses: Record<string, AttendanceStatus>) {
  const values = Object.values(statuses);
  const total = values.length;
  // Late still counts as attended, which is what a parent expects to see.
  const attended = values.filter((s) => s === "present" || s === "late").length;
  const absent = values.filter((s) => s === "absent").length;
  const late = values.filter((s) => s === "late").length;
  return {
    total,
    attended,
    absent,
    late,
    percent: total ? Math.round((attended / total) * 100) : 0,
  };
}

export function percentageOf(marks: number, total: number) {
  return total > 0 ? Math.round((marks / total) * 100) : 0;
}

/**
 * A collection group query on `scores` returns docs whose id is the student id,
 * so every row shares one id and cannot be matched to its test. The parent test
 * id only survives in the full document path: testScores/{testId}/scores/{sid}.
 */
export function testIdFromScorePath(path: string) {
  const parts = path.split("/");
  const scoresAt = parts.lastIndexOf("scores");
  return scoresAt > 0 ? parts[scoresAt - 1] : null;
}