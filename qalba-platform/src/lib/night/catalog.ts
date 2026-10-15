/** Deliberately bounded MVP: these existing engines all use exactly two teams. */
export const NIGHT_GAMES = [
  { game: "top-list", title: "توب 100", rounds: 5 },
  { game: "ordering-challenge", title: "رتّبها", rounds: 7 },
  { game: "survey-show", title: "قالوا الناس", rounds: 5 },
] as const;
export type NightGameSlug = typeof NIGHT_GAMES[number]["game"];
export function isNightGame(value: unknown): value is NightGameSlug {
  return NIGHT_GAMES.some(entry => entry.game === value);
}
export function nightEnabled(): boolean { return process.env.ENABLE_NIGHT_OF_QUDDAM === "true"; }
export function nightGameTitle(game: string): string {
  return NIGHT_GAMES.find(entry => entry.game === game)?.title ?? game;
}
