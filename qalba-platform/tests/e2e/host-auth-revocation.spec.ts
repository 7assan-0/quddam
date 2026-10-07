import { createHash, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { expect, test, type Page } from "@playwright/test";
const origin = "http://127.0.0.1:3000";
const scenarios = [
  { name: "logout", game: "letter-network" },
  { name: "explicit revocation", game: "lightning" },
  { name: "expiry", game: "lightning" },
  { name: "account suspension", game: "court" },
  { name: "password reset", game: "letter-network" },
] as const;
type Probe = { states: { version: number; question?: { answer?: string }; privateAnswer?: { answer?: string }; canUndo?: boolean }[]; raw: string; done: boolean; error: string | null; openedAt: number; endedAt: number | null };
declare global { interface Window { hostProbe: Probe } }
async function sql(query: string, values: unknown[] = []) {
  const pool = new Pool({ connectionString: process.env.E2E_DATABASE_URL, max: 1 });
  try { return await pool.query(query, values); } finally { await pool.end(); }
}
async function send(page: Page, game: string, id: string, action: { type: string; cellId?: string }) {
  const view = await (await page.request.get(`/api/${game}/${id}`)).json();
  const response = await page.request.post(`/api/${game}/${id}/commands`, { headers: { Origin: origin }, data: { key: randomUUID(), expectedVersion: view.version, action } });
  expect(response.status(), await response.text()).toBe(200);
}
async function openProbe(page: Page, game: string, id: string) {
  await page.evaluate(({ game, id }) => {
    const probe: Probe = { states: [], raw: "", done: false, error: null, openedAt: Date.now(), endedAt: null };
    window.hostProbe = probe;
    void (async () => {
      try {
        const response = await fetch(`/api/${game}/${id}/events?audience=host`);
        if (!response.ok || !response.headers.get("content-type")?.includes("text/event-stream")) throw new Error("Host SSE not authorized");
        const reader = response.body!.getReader(), decoder = new TextDecoder(); let pending = "";
        for (;;) {
          const chunk = await reader.read(); if (chunk.done) break;
          const text = decoder.decode(chunk.value, { stream: true }); probe.raw += text; pending += text;
          let boundary: number;
          while ((boundary = pending.indexOf("\n\n")) >= 0) {
            const event = pending.slice(0, boundary); pending = pending.slice(boundary + 2);
            if (event.startsWith("event: state\n")) probe.states.push(JSON.parse(event.slice("event: state\ndata: ".length)));
          }
        }
      } catch (error) { probe.error = String(error); }
      finally { probe.done = true; probe.endedAt = Date.now(); }
    })();
  }, { game, id });
  await expect.poll(() => page.evaluate(() => window.hostProbe.states.length), { timeout: 15_000 }).toBe(1);
}
for (const scenario of scenarios) {
  test(`H01: already-open ${scenario.game} Host stream ends after ${scenario.name}`, async ({ page }, info) => {
    test.setTimeout(120_000);
    expect(process.env.E2E_DATABASE_URL, "H01 tests require the database runner").toBeTruthy();
    const email = `h01-${randomUUID()}@example.test`;
    const registered = await page.request.post("/api/auth/register", { headers: { Origin: origin }, data: { name: "مضيف تحقق الجلسة", email, password: "host-session-test-password" } });
    expect(registered.status(), await registered.text()).toBe(201);
    const cookie = (await page.context().cookies()).find(c => c.name === "qalba_session")!;
    const hash = createHash("sha256").update(cookie.value).digest("hex");
    const original = (await sql('SELECT "id","userId" FROM "AuthSession" WHERE "tokenHash"=$1', [hash])).rows[0]; expect(original).toBeTruthy();
    const created = await page.request.post(`/api/${scenario.game}`, { headers: { Origin: origin }, data: scenario.game === "letter-network" ? { names: ["فريق المرجان", "فريق البحر"] } : { teams: ["فريق المرجان", "فريق البحر"] } });
    expect(created.status(), await created.text()).toBe(201); const id = (await created.json()).id;
    if (scenario.game === "letter-network") {
      for (const action of [{ type: "START" }, { type: "SELECT_CELL", cellId: "r0c0" }, { type: "OPEN_QUESTION" }, { type: "REVEAL_ANSWER" }, { type: "PAUSE" }]) await send(page, scenario.game, id, action);
    } else if (scenario.game === "lightning") {
      for (const type of ["START", "PREPARE_QUESTION"]) await send(page, scenario.game, id, { type });
    }
    await page.goto("/games"); await openProbe(page, scenario.game, id);
    const initial = await page.evaluate(() => window.hostProbe.states[0]);
    if (scenario.game === "letter-network") expect(initial.question?.answer).toBeTruthy();
    else if (scenario.game === "lightning") expect(initial.privateAnswer?.answer).toBeTruthy();
    else expect(initial.canUndo).toBe(false); // Host-only Court controls are absent from TV/juror projections.
    if (scenario.name === "logout") {
      expect((await page.request.post("/api/auth/logout", { headers: { Origin: origin } })).status()).toBe(200);
    } else if (scenario.name === "explicit revocation") {
      await sql('UPDATE "AuthSession" SET "revokedAt"=now() WHERE "id"=$1', [original.id]);
      // Another active login for the same account must not rescue this original connection.
      await sql('INSERT INTO "AuthSession" ("id","userId","tokenHash","expiresAt") VALUES ($1,$2,$3,now()+interval \'1 day\')', [randomUUID(), original.userId, createHash("sha256").update(randomUUID()).digest("hex")]);
    } else if (scenario.name === "expiry") {
      await sql('UPDATE "AuthSession" SET "expiresAt"=(now() AT TIME ZONE \'UTC\')-interval \'1 second\' WHERE "id"=$1', [original.id]);
    } else if (scenario.name === "account suspension") {
      await sql('UPDATE "User" SET "suspendedAt"=now() WHERE "id"=$1', [original.userId]);
    } else {
      const token = randomUUID()+randomUUID();
      await sql('INSERT INTO "PasswordReset" ("id","userId","tokenHash","expiresAt") VALUES ($1,$2,$3,now()+interval \'1 hour\')', [randomUUID(), original.userId, createHash("sha256").update(token).digest("hex")]);
      const reset = await page.request.post("/api/auth/reset", { headers: { Origin: origin }, data: { token, password: "changed-host-test-password" } });
      expect(reset.status(), await reset.text()).toBe(200);
      expect((await sql('SELECT count(*)::int n FROM "AuthSession" WHERE "userId"=$1 AND "revokedAt" IS NULL', [original.userId])).rows[0].n).toBe(0);
    }
    const authState = (await sql(`SELECT "expiresAt","revokedAt","expiresAt"::text as raw_expiry,current_setting('TimeZone') as timezone FROM "AuthSession" WHERE "id"=$1`, [original.id])).rows[0];
    await info.attach("H01-auth-state", { body: JSON.stringify({ scenario: scenario.name, authState, testNow: new Date().toISOString() }), contentType: "application/json" });
    if (scenario.name === "expiry") {
      const rest = await page.request.get(`/api/${scenario.game}/${id}`);
      await info.attach("H01-expiry-diagnostic", { body: JSON.stringify({ authState, restStatus: rest.status(), rest: await rest.json(), testNow: new Date().toISOString() }), contentType: "application/json" });
      expect(new Date(authState.raw_expiry.replace(" ", "T")+"Z").getTime()).toBeLessThan(Date.now());
      expect(rest.status()).toBe(403);
    }
    await expect.poll(() => page.evaluate(() => window.hostProbe.done), { timeout: 28_000, intervals: [250, 500] }).toBe(true);
    const ended = await page.evaluate(() => window.hostProbe);
    expect(ended.error).toBeNull(); expect(ended.raw).toContain("event: access-ended");
    expect(ended.endedAt! - ended.openedAt).toBeLessThan(28_000);
    const delivered = ended.states.length;
    // Change only this disposable fixture's marker after closure: no later private state may arrive.
    await sql('UPDATE "GameSession" SET "stateVersion"="stateVersion"+1 WHERE "id"=$1', [id]);
    await page.waitForTimeout(1_500); expect(await page.evaluate(() => window.hostProbe.states.length)).toBe(delivered);
    const reconnect = await page.request.get(`/api/${scenario.game}/${id}/events?audience=host`, { headers: { Cookie: `qalba_session=${cookie.value}` } });
    expect(reconnect.status()).toBe(403);
    await info.attach("H01-auth-lifetime-evidence", { body: JSON.stringify({ scenario: scenario.name, game: scenario.game, sessionBound: original.id, initialPrivateStateReceived: true, streamClosed: true, closeAfterMs: ended.endedAt!-ended.openedAt, privateStatesAfterClosure: 0, reconnectStatus: reconnect.status() }), contentType: "application/json" });
  });
}
