import type { BoardState } from "@/lib/games/category-board/module";

/** Same deadline boundary as Host judgments; untimed/open questions retain their existing policy. */
export function boardPhoneResponseOpen(status: string, state: Pick<BoardState, "active">, now: Date): boolean {
  const active = state.active;
  return status === "IN_PROGRESS" && Boolean(active && !active.revealed && active.phase !== "CHALLENGE" &&
    (active.deadlineAt ? Date.parse(active.deadlineAt) > now.getTime() : active.remainingMs > 0));
}
