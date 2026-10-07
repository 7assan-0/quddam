/** UTC storage, Asia/Riyadh calendar days; trailing windows are exact elapsed durations. */
export function saudiDayStart(now = new Date()) {
  const shifted = new Date(now.getTime() + 3 * 3600_000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - 3 * 3600_000);
}
export const analyticsSince = (now = new Date()) => new Date(now.getTime() - 30 * 86400_000);
export const saudiDate = (value: Date) => new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeZone: "Asia/Riyadh" }).format(value);

/** One card per durable session, describing its LATEST match, never a sum of ScoreEvent history. */
export function sessionHistorySummary(game: { gameType: { slug: string }; state: unknown; currentRoundNumber: number; teams: { id: string; name: string; score: number; position: number }[]; bluffParticipants?: { name: string; score: number; position: number }[] }) {
  const state = game.state && typeof game.state === "object" && !Array.isArray(game.state) ? game.state as Record<string, unknown> : {};
  const teams = [...game.teams].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const match = Number.isSafeInteger(state.matchNumber) ? Number(state.matchNumber) : null;
  if (game.gameType.slug === "letter-network" && Array.isArray(state.board)) {
    const cells = state.board as { ownerTeamId?: string | null }[];
    return { match, text: teams.map(team => `${team.name} ${cells.filter(cell => cell?.ownerTeamId === team.id).length} خلية`).join(" — ") };
  }
  if (state.module === "BLUFF_GAME") return { match, text: [...(game.bluffParticipants ?? [])].sort((a, b) => b.score - a.score || a.position - b.position).map(p => `${p.name} ${p.score}`).join(" — ") || "بانتظار اللاعبين" };
  if (game.gameType.slug === "out-of-the-loop" && typeof state.phase === "string") return { match: game.currentRoundNumber || null, text: state.winner === "PLAYERS" ? "فاز اللاعبون" : state.winner === "OUTSIDER" ? "فاز اللاعب خارج الجو" : "الجولة الحالية" };
  return { match, text: teams.map(team => `${team.name} ${team.score}`).join(" — ") || "الجلسة الحالية" };
}
