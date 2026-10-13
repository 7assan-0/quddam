// Isolated staging contract. Read-only; never connects to remote systems.
// Configuration-shape success is NOT deployment or network isolation proof.
const placeholder = /replace[-_ ]?with|change[-_ ]?me|^example$|^test$|^password$/i;
const paymentKeys = ["MOYASAR_SECRET_KEY","MOYASAR_CALLBACK_TOKEN","MOYASAR_PUBLISHABLE_KEY","BILLING_CRON_SECRET"];
const outboundKeys = ["SMTP_HOST","SMTP_USER","SMTP_PASSWORD","SMTP_FROM","ANALYTICS_CRON_SECRET"];
const bootstrapKeys = ["BOOTSTRAP_ADMIN_EMAIL","BOOTSTRAP_ADMIN_PASSWORD","SEED_ADMIN_EMAIL","SEED_ADMIN_PASSWORD","SEED_USER_EMAIL","SEED_USER_PASSWORD"];

function httpsOrigin(raw) {
  try {
    const u = new URL(raw ?? "");
    if (u.protocol !== "https:" || !u.hostname || u.username || u.password ||
      u.pathname !== "/" || u.search || u.hash || u.origin !== raw?.replace(/\/$/, "")) return null;
    if (["localhost","127.0.0.1","[::1]"].includes(u.hostname)) return null;
    return u.origin;
  } catch { return null; }
}

/** Only error codes and setting names are returned, never values. */
export function inspectStagingConfiguration(env) {
  const errors = [], warnings = [];
  const fail = code => errors.push(code);
  if (env.STAGING_CONTEXT !== "isolated-preparation") fail("STAGING_CONTEXT_NOT_EXPLICIT");
  if (env.NODE_ENV !== "production") fail("NODE_ENV_NOT_PRODUCTION");
  const origin = httpsOrigin(env.APP_URL), expected = httpsOrigin(env.STAGING_EXPECTED_ORIGIN);
  if (!origin || !expected || origin !== expected) fail("STAGING_HTTPS_ORIGIN_MISMATCH");
  if (!["private-network","authenticated-ingress"].includes(env.STAGING_ACCESS_MODE)) fail("STAGING_ACCESS_NOT_PRIVATE");
  let database;
  try {
    database = new URL(env.DATABASE_URL ?? "");
    if (!["postgres:","postgresql:"].includes(database.protocol) || !database.hostname ||
      !database.pathname || database.pathname === "/" || !database.username) throw Error();
  } catch { database = null; fail("STAGING_DATABASE_URL_INVALID"); }
  if (database) {
    let dbName = "";
    try { dbName = decodeURIComponent(database.pathname.slice(1)); }
    catch { fail("STAGING_DATABASE_URL_INVALID"); }
    if (!env.STAGING_EXPECTED_DATABASE || dbName !== env.STAGING_EXPECTED_DATABASE)
      fail("STAGING_DATABASE_IDENTITY_MISMATCH");
    if (/^(postgres|template0|template1|qalba|production|prod)$/i.test(env.STAGING_EXPECTED_DATABASE ?? ""))
      fail("STAGING_DATABASE_NAME_UNSAFE");
    if (!["localhost","127.0.0.1","[::1]"].includes(database.hostname) &&
       !["require","verify-full"].includes(database.searchParams.get("sslmode")))
      fail("STAGING_DATABASE_TLS_NOT_EXPLICIT");
  }
  if (env.STAGING_ISOLATION_OWNER_APPROVED !== "true") fail("STAGING_ISOLATION_NOT_ATTESTED");
  if (!env.AUTH_RATE_LIMIT_SECRET || env.AUTH_RATE_LIMIT_SECRET.length < 32 ||
      placeholder.test(env.AUTH_RATE_LIMIT_SECRET)) fail("AUTH_RATE_LIMIT_SECRET_INVALID");
  if (env.PUBLIC_WELCOME_CREDITS_ENABLED !== "false") fail("WELCOME_CREDITS_NOT_DISABLED");
  for (const name of paymentKeys) if (env[name]) fail(name + "_MUST_BE_ABSENT");
  for (const name of outboundKeys) if (env[name]) fail(name + "_MUST_BE_ABSENT");
  for (const name of bootstrapKeys) if (env[name]) fail(name + "_MUST_BE_ABSENT");
  if (!["true","false"].includes(env.AUTH_TRUST_PROXY ?? "")) fail("AUTH_TRUST_PROXY_NOT_EXPLICIT");
  if (env.AUTH_TRUST_PROXY === "true") {
    if (env.AUTH_CLIENT_IP_HEADER !== "x-quddam-client-ip") fail("TRUSTED_IP_HEADER_MISMATCH");
    if (!env.STAGING_PROXY_EVIDENCE_ID || !env.STAGING_DIRECT_INGRESS_EVIDENCE_ID)
      fail("TRUSTED_PROXY_EVIDENCE_MISSING");
    warnings.push("PROXY_EVIDENCE_REQUIRES_INDEPENDENT_OPERATOR_REVIEW");
  } else warnings.push("UNKNOWN_CLIENT_SHARED_BUCKET_UNTIL_PROXY_VERIFIED");
  warnings.push("CONFIGURATION_SHAPE_ONLY_NO_DEPLOYMENT_OR_NETWORK_PROOF");
  warnings.push("RUN_EXISTING_OPS_VALIDATE_AND_DATABASE_LIFECYCLE_GATES");
  return { valid: errors.length === 0, errors, warnings };
}
if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  const report = inspectStagingConfiguration(process.env);
  process.stdout.write(JSON.stringify({ status: report.valid ? "CONFIGURATION_PRECHECK_PASS" : "CONFIGURATION_PRECHECK_FAIL", ...report }) + "\n");
  if (!report.valid) process.exitCode = 1;
}
