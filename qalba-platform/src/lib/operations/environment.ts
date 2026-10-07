import { cspImageOrigins } from "../security/browser-headers";
type Environment = Record<string, string | undefined>;
const placeholder = /replace[-_ ]?with|change[-_ ]?me|^example$|^test$|^password$/i;
/** Operator validation only: never expose values, and never manufacture application secrets. */
export function productionEnvironment(env: Environment) {
  const errors: string[] = [], warnings: string[] = [];
  try { cspImageOrigins(env.CSP_IMAGE_ORIGINS); }
  catch { errors.push("CSP_IMAGE_ORIGINS: use at most eight exact HTTPS origins without credentials, paths, queries or wildcards"); }
  const secret = (name: string, required: boolean) => {
    const value = env[name];
    if (required || value) if (!value || value.length < 32 || placeholder.test(value)) errors.push(`${name}: configure a non-placeholder secret of at least 32 characters`);
  };
  let database: URL | undefined;
  try { database = new URL(env.DATABASE_URL ?? ""); if (!["postgres:", "postgresql:"].includes(database.protocol) || !database.hostname || database.pathname === "/") throw Error(); }
  catch { errors.push("DATABASE_URL: configure a PostgreSQL database URL"); }
  if (database && database.hostname !== "localhost" && database.hostname !== "127.0.0.1" && !database.searchParams.get("sslmode")) warnings.push("Database transport TLS must be configured and verified for the deployment network");
  try { const url = new URL(env.APP_URL ?? ""); if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw Error(); }
  catch { errors.push("APP_URL: configure the canonical HTTPS origin with no path, credentials, query or fragment"); }
  const max = Number(env.DATABASE_POOL_MAX ?? "10");
  if (!Number.isInteger(max) || max < 1 || max > 20) errors.push("DATABASE_POOL_MAX: integer between 1 and 20 required");
  secret("AUTH_RATE_LIMIT_SECRET", true);
  if (env.AUTH_TRUST_PROXY && !["true", "false"].includes(env.AUTH_TRUST_PROXY)) errors.push("AUTH_TRUST_PROXY: use true or false explicitly");
  if (env.AUTH_TRUST_PROXY === "true") {
    if (!/^[a-z0-9-]+$/.test(env.AUTH_CLIENT_IP_HEADER?.toLowerCase() ?? "")) errors.push("AUTH_CLIENT_IP_HEADER: configure the single-IP ingress-overwritten header");
    warnings.push("Trusted proxy mode requires blocked direct ingress and an overwritten single-client-IP header");
  } else warnings.push("Untrusted ingress uses the shared unknown-client abuse budget; configure a trusted ingress before public signup");
  if (env.PUBLIC_WELCOME_CREDITS_ENABLED && !["true", "false"].includes(env.PUBLIC_WELCOME_CREDITS_ENABLED)) errors.push("PUBLIC_WELCOME_CREDITS_ENABLED: use true or false");
  const billing = Boolean(env.MOYASAR_SECRET_KEY || env.MOYASAR_CALLBACK_TOKEN);
  if (billing) {
    if (!env.MOYASAR_SECRET_KEY || placeholder.test(env.MOYASAR_SECRET_KEY)) errors.push("MOYASAR_SECRET_KEY: configure the merchant credential");
    secret("MOYASAR_CALLBACK_TOKEN", true); secret("BILLING_CRON_SECRET", true);
  } else { secret("BILLING_CRON_SECRET", false); warnings.push("Payment provider is disabled; do not enable checkout until merchant credentials and callback/cron configuration are verified"); }
  secret("ANALYTICS_CRON_SECRET", false);
  if (!env.ANALYTICS_CRON_SECRET) warnings.push("Analytics HTTP cron is disabled; retention remains an authenticated operator CLI job");
  if (env.SMTP_HOST) {
    const port = Number(env.SMTP_PORT ?? "587");
    if (!Number.isInteger(port) || port < 1 || port > 65535 || !env.SMTP_FROM) errors.push("SMTP_PORT/SMTP_FROM: configure a valid port and sender for password recovery");
    if (Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASSWORD)) errors.push("SMTP_USER/SMTP_PASSWORD: configure both or neither");
  } else warnings.push("SMTP is disabled; password recovery will report unavailable until configured");
  return { valid: errors.length === 0, errors, warnings, paymentConfigured: billing && !errors.some(e => /MOYASAR|BILLING/.test(e)), secureCookies: true, environmentMode: "production" };
}
