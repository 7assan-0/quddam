import { nightGameTitle } from "./catalog";
import type { NightView } from "./types";

/** A derived, private, source-backed recap. Not a new authority for results. */
export type NightHighlights = {
  phase: "completed" | "ended";
  played: number;
  championNames: string[];
  ranking: { name: string; points: number }[];
  games: { title: string; firstNames: string[]; points: { name: string; points: number }[] }[];
  facts: string[];
};
export function deriveNightHighlights(view: NightView): NightHighlights | null {
  if (view.phase !== "completed" && view.phase !== "ended") return null;
  const teamName = (id: string) => view.teams.find(t => t.id === id)?.name ?? "فريق";
  const champions = view.phase === "completed" ? view.winnerIds.map(teamName) : [];
  const games = view.results.map(result => ({
    title: nightGameTitle(result.game),
    firstNames: (result.placements[0]?.teamIds ?? []).map(teamName),
    points: view.teams.map(team => ({ name: team.name, points: result.points[team.id] ?? 0 })),
  }));
  const facts: string[] = [`اكتملت ${view.results.length} من ${view.games.length} ألعاب`];
  const winCounts = view.teams.map(team => ({
    name: team.name,
    count: view.results.filter(result => result.placements[0]?.teamIds.includes(team.id)).length,
  }));
  if (view.results.length) {
    const max = Math.max(...winCounts.map(x => x.count));
    facts.push(`أكثر تصدّرًا في الألعاب: ${winCounts.filter(x => x.count === max).map(x => x.name).join(" و ")} (${max})`);
  }
  if (view.phase === "completed") facts.push(champions.length > 1
    ? `انتهت الليلة بتعادل: ${champions.join(" و ")}`
    : `بطل الليلة: ${champions[0]}`);
  else facts.push("سهرة غير مكتملة؛ لا يُعلَن بطل");
  return { phase: view.phase, played: view.results.length, championNames: champions,
    ranking: view.ranking.map(team => ({ name: team.name, points: team.points })), games, facts };
}
