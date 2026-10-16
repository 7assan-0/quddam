/** A deliberately narrow continuation: never accept arbitrary URLs or query strings. */
export function authReturnPath(value: unknown): string {
  if (typeof value !== "string" || !/^\/shillatak\/join\/[0-9a-f]{64}$/i.test(value)) return "/games";
  return value.toLowerCase();
}
