import { isLaunchGameSlug, type LaunchGameSlug } from "../games/launch-policy";

/**
 * Pure, experimental "ليلة قدّام" series rules. This module neither starts games
 * nor grants permission to report results: the future server-side adapter must
 * authenticate the room host and verify each source session's FINAL result.
 */
export const MIN_NIGHT_GAMES = 3;
export const MAX_NIGHT_GAMES = 10;
export const MIN_NIGHT_TEAMS = 2;
export const MAX_NIGHT_TEAMS = 3;
export const NIGHT_POINTS = [3, 2, 1] as const;

export type NightTeam = { id: string; name: string };
export type NightPlacement = { teamIds: string[] }; // One or more teams tied at this rank.
export type NightResult = {
  game: LaunchGameSlug;
  sourceSessionId: string;
  placements: NightPlacement[];
  points: Record<string, number>;
};
export type NightState = {
  schemaVersion: 1;
  nightId: string;
  phase: "playing" | "completed";
  games: LaunchGameSlug[];
  teams: NightTeam[];
  results: NightResult[];
  totals: Record<string, number>;
  version: number;
};
export type VerifiedGameOutcome = {
  /** Trusted session ID from a server-verified completed game; never a client score. */
  sourceSessionId: string;
  game: LaunchGameSlug;
  /** Ordered placing groups: [[first-place ids], [second-place ids], ...]. */
  placements: NightPlacement[];
};
export class NightRuleError extends Error {
  constructor(message: string, readonly code: string) { super(message); }
}
function reject(message: string, code: string): never { throw new NightRuleError(message, code); }
function safeId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(value);
}
function cleanName(value: unknown): string {
  if (typeof value !== "string" || /[\p{Cc}\p{Cf}]/u.test(value))
    return reject("Invalid team name", "INVALID_TEAM");
  const name = value.normalize("NFC").trim().replace(/\s+/gu, " ");
  if (!name || name.length > 60) reject("Invalid team name", "INVALID_TEAM");
  return name;
}
export function createNight(input: {
  nightId: string; games: readonly string[]; teams: readonly NightTeam[];
}): NightState {
  if (!safeId(input.nightId)) reject("Invalid night ID", "INVALID_NIGHT_ID");
  if (!Array.isArray(input.games) || input.games.length < MIN_NIGHT_GAMES || input.games.length > MAX_NIGHT_GAMES ||
    new Set(input.games).size !== input.games.length || !input.games.every(isLaunchGameSlug))
    reject("Choose 3–10 distinct official launch games", "INVALID_GAMES");
  if (!Array.isArray(input.teams) || input.teams.length < MIN_NIGHT_TEAMS || input.teams.length > MAX_NIGHT_TEAMS)
    reject("Choose two or three teams", "INVALID_TEAMS");
  const teams = input.teams.map(team => {
    if (!team || !safeId(team.id)) reject("Invalid team ID", "INVALID_TEAM");
    return { id: team.id, name: cleanName(team.name) };
  });
  if (new Set(teams.map(team => team.id)).size !== teams.length ||
    new Set(teams.map(team => team.name.toLocaleLowerCase("ar"))).size !== teams.length)
    reject("Duplicate team ID or name", "DUPLICATE_TEAM");
  return { schemaVersion: 1, nightId: input.nightId, phase: "playing",
    games: [...input.games] as LaunchGameSlug[], teams, results: [],
    totals: Object.fromEntries(teams.map(team => [team.id, 0])) as Record<string, number>, version: 0 };
}
function normalizePlacements(teams: NightTeam[], placements: unknown): NightPlacement[] {
  if (!Array.isArray(placements) || !placements.length || placements.length > teams.length)
    reject("Invalid placements", "INVALID_RESULT");
  const allowed = new Set(teams.map(team => team.id));
  const seen = new Set<string>();
  const groups = placements.map(group => {
    if (!group || !Array.isArray(group.teamIds) || !group.teamIds.length) reject("Empty placing", "INVALID_RESULT");
    const ids: string[] = [];
    for (const id of group.teamIds) {
      if (!safeId(id) || !allowed.has(id) || seen.has(id)) reject("Unknown or repeated team", "INVALID_RESULT");
      seen.add(id); ids.push(id);
    }
    return { teamIds: ids.sort() };
  });
  if (seen.size !== teams.length) reject("Each team must have exactly one placement", "INVALID_RESULT");
  return groups;
}
function samePlacements(a: NightPlacement[], b: NightPlacement[]) {
  return JSON.stringify(a) === JSON.stringify(b);
}
/**
 * Called only after verifying authoritative game completion and its result
 * server-side. It derives normalized points; no caller can submit a point delta.
 * Competition ranking handles ties: tied first places each get 3, next rank 3 gets 1.
 */
export function acceptVerifiedResult(state: NightState, outcome: VerifiedGameOutcome): NightState {
  if (!safeId(outcome.sourceSessionId)) reject("Invalid session ID", "INVALID_RESULT");
  const placements = normalizePlacements(state.teams, outcome.placements);
  const prior = state.results.find(result => result.sourceSessionId === outcome.sourceSessionId);
  if (prior) {
    if (prior.game === outcome.game && samePlacements(prior.placements, placements)) return state;
    reject("A source session cannot be rewritten or counted twice", "CONFLICTING_REPLAY");
  }
  if (state.phase !== "playing") reject("Night already complete", "CLOSED_NIGHT");
  const game = state.games[state.results.length];
  if (!game || game !== outcome.game) reject("Unexpected game or game order", "UNEXPECTED_GAME");
  const points: Record<string, number> = {};
  let teamsAhead = 0;
  for (const group of placements) {
    const award = NIGHT_POINTS[teamsAhead] ?? 0;
    for (const teamId of group.teamIds) points[teamId] = award;
    teamsAhead += group.teamIds.length;
  }
  const result: NightResult = { game, sourceSessionId: outcome.sourceSessionId, placements,
    points };
  const totals = Object.fromEntries(state.teams.map(team =>
    [team.id, state.totals[team.id] + points[team.id]])) as Record<string, number>;
  const results = [...state.results, result];
  return { ...state, results, totals, version: state.version + 1,
    phase: results.length === state.games.length ? "completed" : "playing" };
}
/** Public-safe derived results. No private answers, session credentials or team member IDs. */
export function nightLeaderboard(state: NightState) {
  const sorted = state.teams.map(team => ({ ...team, points: state.totals[team.id] }))
    .sort((a, b) => b.points - a.points || a.id.localeCompare(b.id));
  const max = sorted[0]?.points ?? 0;
  return { completed: state.phase === "completed", played: state.results.length,
    totalGames: state.games.length, ranking: sorted,
    winnerIds: state.phase === "completed" ? sorted.filter(team => team.points === max).map(team => team.id) : [] };
}
