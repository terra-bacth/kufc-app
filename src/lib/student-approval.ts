import type { Batch, User } from "./types";

export type BatchResolution =
  | { kind: "code"; batch: Batch }
  | { kind: "needs-choice"; batch: Batch[] }
  | { kind: "coach" };

/**
 * Decides which batch a pending student belongs to.
 *
 * The typed code is only a hint. A parent reading six characters off a
 * screenshot will get one wrong, and registrations predating batch codes carry
 * none at all — so an unresolvable code means "let the admin pick", never
 * "reject". Returning needs-choice rather than guessing is the whole point: a
 * silent wrong batch is worse than one extra click.
 */
export function resolveStudentBatch(user: User, batches: Batch[]): BatchResolution {
  if (user.role !== "student") return { kind: "coach" };

  const active = batches.filter((b) => b.status === "active");
  const code = user.requestedBatchCode?.trim().toUpperCase();

  if (code) {
    const match = active.find((b) => b.code?.toUpperCase() === code);
    if (match) return { kind: "code", batch: match };
  }

  return { kind: "needs-choice", batch: active };
}