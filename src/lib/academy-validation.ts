export function validateBatch(batch: Partial<Record<string, unknown>>) {
  const name = String(batch.name ?? "").trim();
  if (!name) return "Batch name is required";
  const branchId = String(batch.branchId ?? "");
  if (!branchId) return "Branch is required";
  const coachId = String(batch.coachId ?? "");
  if (!coachId) return "Coach is required";
  const days = Array.isArray(batch.days) ? batch.days : [];
  if (days.length === 0) return "At least one day must be selected";
  const validDay = new Set(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  for (const d of days) {
    if (typeof d !== "string" || !validDay.has(d)) return "Invalid schedule day";
  }
  const startTime = String(batch.startTime ?? "");
  const endTime = String(batch.endTime ?? "");
  const timeRe = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRe.test(startTime) || !timeRe.test(endTime)) {
    return "Start and end time must be HH:MM";
  }
  if (endTime <= startTime) return "End time must be after start time";
  const fee = batch.monthlyFee;
  if (typeof fee !== "number" || !Number.isFinite(fee) || fee < 0 || !Number.isInteger(fee)) {
    return "Monthly fee must be a whole number (paise or rupees as stored)";
  }
  return null;
}

// Ambiguous glyphs (0/O, 1/I/L) are left out: codes get read aloud and typed
// from a parent's phone.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateBatchCode(length = 6) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

export function normalizeBatchCode(input: string) {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function validateBatchCode(input: string) {
  const code = normalizeBatchCode(input);
  if (code.length !== 6) return "Batch code must be 6 characters";
  if (![...code].every((c) => CODE_ALPHABET.includes(c))) return "Batch code contains an invalid character";
  return null;
}