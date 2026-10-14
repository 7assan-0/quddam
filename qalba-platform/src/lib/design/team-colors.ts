/** Shared presentation identity used by new sessions, Host, phone, TV and results.
 * Persisted colors remain unchanged for historical sessions; renderers prefer position identity.
 * A = bolt / orange, B = wave / blue, C = square / pink.
 */
export const TEAM_COLORS = ["#FF7A45", "#4DB8FF", "#E58FC0"] as const;
export function teamColor(position: number): string {
  return TEAM_COLORS[position as 0 | 1 | 2] ?? "#E58FC0";
}
