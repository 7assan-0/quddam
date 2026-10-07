import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { Context, Game } from "../../scripts/database-lifecycle-fixtures";

test.describe("F1 populated PostgreSQL production lifecycle", () => {
  test.beforeEach(async ({ context }) => {
    expect(process.env.LIFECYCLE_TEST_DATABASE).toBe("1");
    const f = JSON.parse(readFileSync(`${process.env.LIFECYCLE_OUTPUT}/fixture-private.json`, "utf8")) as Context;
    await context.addCookies([{ name: "qalba_session", value: f.hostToken, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
  });
  test("F1 01 upgraded production app preserves all ten historical results and routes", async ({ page }, info) => {
    test.setTimeout(150_000);
    const f = JSON.parse(readFileSync(`${process.env.LIFECYCLE_OUTPUT}/fixture-private.json`, "utf8")) as Context;
    const routes = JSON.parse(readFileSync(`${process.env.LIFECYCLE_OUTPUT}/historical-routes.json`, "utf8")) as { id: string; game: Game; href: string }[];
    expect(f.completed).toHaveLength(10); expect(routes).toHaveLength(10);
    const selectors: Record<Game, string> = { board: ".host-game .victory", social: ".social-result", letter: ".letter-page", survey: ".survey-host", forbidden: ".forbidden-host", bluff: ".bluff-host", ranked: ".ranked-host", lightning: ".lightning-host", ordering: ".ordering-host", court: ".court-host" };
    for (const r of routes) {
      await page.goto("/profile");
      const link = page.locator(`.history-row a[href="${r.href}"]`); await expect(link).toBeVisible(); await link.click();
      await expect(page).toHaveURL(`http://127.0.0.1:3000${r.href}`);
      const result = page.locator(selectors[r.game]); await expect(result).toBeVisible();
      if (!["board", "social"].includes(r.game)) await expect(result).toHaveAttribute("data-phase", "COMPLETED");
      await expect(page.locator("body")).not.toContainText("المباراة غير موجودة");
      if (["court", "social", "letter", "board"].includes(r.game)) await page.screenshot({ path: info.outputPath(`${r.game}-upgraded-history.png`), fullPage: true });
    }
    const count = JSON.parse(readFileSync(`${process.env.LIFECYCLE_OUTPUT}/profile-count.json`, "utf8")) as { count: number };
    await page.goto("/profile"); await expect(page.locator(".history-row")).toHaveCount(count.count);
  });
  test("F1 02 PostgreSQL outage recovers Host realtime without access-ended or reload", async ({ page }) => {
    test.setTimeout(120_000);
    const f = JSON.parse(readFileSync(`${process.env.LIFECYCLE_OUTPUT}/fixture-private.json`, "utf8")) as Context;
    const court = f.active.find(g => g.game === "court")!;
    await page.goto(`/court/host/${court.id}`); await expect(page.locator(".court-host")).toHaveAttribute("data-phase", "VERDICT");
    await page.evaluate(id => {
      const events = { states: 0, ended: 0, transient: 0, source: new EventSource(`/api/court/${id}/events?audience=host`) };
      (window as unknown as { f1Events: typeof events }).f1Events = events;
      events.source.addEventListener("state", () => events.states++);
      events.source.addEventListener("access-ended", () => events.ended++);
      events.source.addEventListener("connection-error", () => events.transient++);
    }, court.id);
    const observed = () => page.evaluate(() => { const e = (window as unknown as { f1Events: { states: number; ended: number; transient: number } }).f1Events; return { states: e.states, ended: e.ended, transient: e.transient }; });
    await expect.poll(async () => (await observed()).states).toBe(1);
    writeFileSync(`${process.env.LIFECYCLE_OUTPUT}/browser-outage-ready.json`, JSON.stringify({ ready: true }));
    await expect.poll(async () => (await observed()).transient, { timeout: 40_000 }).toBeGreaterThanOrEqual(1);
    await expect.poll(async () => (await observed()).states, { timeout: 60_000 }).toBeGreaterThanOrEqual(2);
    expect((await observed()).ended).toBe(0);
    const current = await page.request.get(`/api/court/${court.id}`); expect(current.status()).toBe(200); const v = await current.json();
    const next = await page.request.post(`/api/court/${court.id}/commands`, { headers: { Origin: "http://127.0.0.1:3000" }, data: { key: randomUUID(), expectedVersion: v.version, action: { type: "ADVANCE_RESULT" } } }); expect(next.status()).toBe(200);
    await expect(page.locator(".court-host")).toHaveAttribute("data-phase", "ROUND_RESULTS");
    expect((await observed()).ended).toBe(0); await expect(page.locator("body")).not.toContainText("انتهى الوصول");
    await page.evaluate(() => (window as unknown as { f1Events: { source: EventSource } }).f1Events.source.close());
  });
});
