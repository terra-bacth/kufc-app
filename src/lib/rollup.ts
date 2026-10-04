import type { StudentRollup } from "./types";

/**
 * Ranks rollups by attendancePct, tie-broken by testAvg. A student sees only
 * their own rank number, never a classmate's mark — that is the whole point of
 * computing it at write time.
 */
export function applyRank<T extends { studentId: string; attendancePct: number; testAvg: number }>(rollups: T[]): T[] {
  const sorted = rollups.slice().sort((a, b) => b.attendancePct - a.attendancePct || b.testAvg - a.testAvg || a.studentId.localeCompare(b.studentId));
  const rankOf: Record<string, number> = {};
  const percentileOf: Record<string, number> = {};
  const n = sorted.length;

  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];
    const tied = i > 0 && sorted[i - 1].attendancePct === item.attendancePct && sorted[i - 1].testAvg === item.testAvg;
    rankOf[item.studentId] = tied ? rankOf[sorted[i - 1].studentId] : (i > 0 ? rankOf[sorted[i - 1].studentId] + 1 : 1);
    percentileOf[item.studentId] = n > 1 ? Math.round(((n - rankOf[item.studentId]) / (n - 1)) * 100) : 100;
  }

  return sorted.map((item) => ({
    ...item,
    rank: rankOf[item.studentId],
    percentile: percentileOf[item.studentId],
  }));
}

/** Merges a fresh session mark into a student's attendance counters. */
export function bumpAttendance(
  prev: { sessionsAttended: number; sessionsTotal: number; attendancePct: number },
  status: "present" | "late" | "absent",
) {
  const total = prev.sessionsTotal + 1;
  const attended = prev.sessionsAttended + (status === "present" || status === "late" ? 1 : 0);
  return {
    sessionsAttended: attended,
    sessionsTotal: total,
    attendancePct: total ? Math.round((attended / total) * 100) : 0,
  };
}
