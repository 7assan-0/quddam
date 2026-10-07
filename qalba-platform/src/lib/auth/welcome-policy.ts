/** Public free entitlement is an explicit beta/operator decision, not proof of email ownership. */
export function publicWelcomeCreditsEnabled(): boolean {
  const value = process.env.PUBLIC_WELCOME_CREDITS_ENABLED;
  if (value !== undefined && value !== "true" && value !== "false") throw new Error("PUBLIC_WELCOME_CREDITS_ENABLED must be true or false");
  return value === "true";
}
