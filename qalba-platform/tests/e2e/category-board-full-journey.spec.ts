import { randomUUID, createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { expect, test, type BrowserContext } from "@playwright/test";
import { cellControl, createBoardRoom, hostAction, inspectDatabase, mobileGuest, readBoard, readRoom } from "./category-board-acceptance-helpers";

test.use({ actionTimeout: 30_000 });

test("a real seventy-two-question match finishes with persisted results, TV, assists, undo and exactly one START debit", async ({ browser, page }, info) => {
  test.setTimeout(1_200_000);
  const contexts: BrowserContext[] = [];
  try {
    const { id, code, board, email } = await createBoardRoom(page, "board-complete");
    const before = await inspectDatabase<{ balance: number }>('SELECT balance FROM "CreditWallet" WHERE "userId"=(SELECT id FROM "User" WHERE email=$1)', [email]);
    const lobby = await page.context().newPage();
    await lobby.goto(`/rooms/${code}`);
    const joinQr = lobby.getByRole("img", { name: "رمز QR لانضمام اللاعبين", exact: true });
    await expect(joinQr).toBeVisible();
    expect(await joinQr.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    const joinHref = await lobby.getByRole("link", { name: "رابط الانضمام", exact: true }).getAttribute("href");
    expect(joinHref).toBe(`/join?code=${code}`);
    const qrData = await joinQr.getAttribute("src"); expect(qrData).toMatch(/^data:image\/png;base64,/);
    await writeFile(info.outputPath("join-qr.private.png"), Buffer.from(qrData!.split(",")[1], "base64"), { mode: 0o600 });
    // The image is decoded independently in the documented local verification;
    // this browser proof follows the actual corresponding rendered join link.
    await info.attach("join-qr-target-sha256", { body: createHash("sha256").update(new URL(joinHref!, page.url()).href).digest("hex"), contentType: "text/plain" });
    await lobby.close();
    const guest = await mobileGuest(browser, page, code, "ضيف المباراة المكتملة", board.teams[0].id); contexts.push(guest.context);
    const guestBefore = await readRoom(guest.page, code);
    const start = await hostAction(page, id, page.getByRole("button", { name: "ابدأ المباراة", exact: true }), "START");
    const retried = await page.request.post(`/api/games/category-board/${id}/commands`, { headers: { Origin: new URL(page.url()).origin }, data: start.request });
    expect(retried.status()).toBe(200); expect((await retried.json()).duplicate).toBe(true);
    await page.getByRole("button", { name: "فتح شاشة العرض", exact: true }).click();
    const modal = page.getByRole("dialog", { name: "شاشة العرض" });
    await expect(modal.getByRole("img", { name: "رمز QR لرابط شاشة العرض" })).toBeVisible();
    const [tv] = await Promise.all([page.context().waitForEvent("page"), modal.getByRole("button", { name: "فتح العرض في هذا الجهاز" }).click()]);
    await expect(tv).toHaveURL(/\/display\/[^?]+\?token=/);
    // A separate unauthenticated audience proves the token does not carry host authority.
    const tvUrl = tv.url(); await tv.close();
    const tvContext = await browser.newContext({ baseURL: new URL(page.url()).origin, viewport: { width: 1920, height: 1080 } }); contexts.push(tvContext);
    const display = await tvContext.newPage(); await display.goto(tvUrl);
    await modal.getByRole("button", { name: "إغلاق", exact: true }).click();
    expect((await tvContext.request.post(`/api/games/category-board/${id}/commands${new URL(tvUrl).search}`, {
      headers: { Origin: new URL(page.url()).origin }, data: { key: randomUUID(), expectedVersion: start.session.version, action: { type: "CORRECT" } },
    })).status()).toBe(403);
    expect((await guest.context.request.post(`/api/games/category-board/${id}/commands`, {
      headers: { Origin: new URL(page.url()).origin }, data: { key: randomUUID(), expectedVersion: start.session.version, action: { type: "EDIT_SCORE", teamId: board.teams[0].id, delta: 9999 } },
    })).status()).toBe(403);
    const expected = new Map(board.teams.map(team => [team.id, 0]));
    const questions = new Set<string>();
    for (const [index, cell] of board.cells.entries()) {
      let current = (await hostAction(page, id, cellControl(page, board, cell), "OPEN")).session;
      const question = current.active!.question;
      expect(questions.has(question), "The full match must not repeat a question").toBe(false); questions.add(question);
      await expect(guest.page.locator(".room-question h2")).toHaveText(question);
      await expect(display.locator(".display-question h1")).toHaveText(question);
      let scoredTeam = current.active!.answeringTeamId, multiplier = 1;
      if (index === 0) {
        await page.setViewportSize({ width: 390, height: 844 });
        await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
        expect(await page.locator(".question-stage button").evaluateAll(buttons => buttons.every(button => {
          const bounds = button.getBoundingClientRect();
          return bounds.width === 0 || bounds.left >= -0.5 && bounds.right <= window.innerWidth + 0.5;
        }))).toBe(true);
        expect(current.powerUps.find(power => power.slug === "double" && power.teamId === scoredTeam)?.remaining).toBeGreaterThan(0);
        await hostAction(page, id, page.getByRole("button", { name: /^ضاعف/ }), "USE_POWERUP"); multiplier = 2;
        const power = (await hostAction(page, id, page.getByRole("button", { name: /^وقت إضافي/ }), "USE_POWERUP")).session;
        expect(power.active!.remainingMs).toBe(75_000);
        await hostAction(page, id, page.getByRole("button", { name: "شغّل المؤقت", exact: true }), "TIMER_START");
        await hostAction(page, id, page.getByRole("button", { name: "إيقاف المباراة مؤقتًا", exact: true }), "PAUSE_GAME");
        const paused = await readBoard(page, id);
        expect(paused.status).toBe("PAUSED"); const saved = paused.active!.remainingMs;
        await page.waitForTimeout(1200); await page.reload();
        expect((await readBoard(page, id)).active!.remainingMs).toBe(saved);
        await hostAction(page, id, page.getByRole("button", { name: "استئناف المباراة", exact: true }), "RESUME_GAME");
        await hostAction(page, id, page.getByRole("button", { name: "أوقف المؤقت", exact: true }), "TIMER_PAUSE");
        await guest.page.reload();
        expect((await readRoom(guest.page, code)).selfId).toBe(guestBefore.selfId);
        await hostAction(page, id, page.getByRole("button", { name: "اكشف الإجابة", exact: true }), "REVEAL");
        await hostAction(page, id, page.getByRole("button", { name: /^صحيح/ }), "CORRECT");
        await page.setViewportSize({ width: 1280, height: 720 });
        const undo = (await hostAction(page, id, page.getByRole("button", { name: "تراجع عن آخر إجراء", exact: true }), "UNDO")).session;
        expect(undo.cells.filter(item => item.completed)).toHaveLength(0);
        expect(undo.teams.every(team => team.score === 0)).toBe(true);
        await hostAction(page, id, page.getByRole("button", { name: /^صحيح/ }), "CORRECT");
      } else if (index === 1) {
        const steal = (await hostAction(page, id, page.getByRole("button", { name: /^خطأ/ }), "WRONG")).session;
        expect(steal.active!.phase).toBe("STEAL");
        expect(steal.active!.answeringTeamId).not.toBe(scoredTeam); scoredTeam = steal.active!.answeringTeamId;
        await hostAction(page, id, page.getByRole("button", { name: "اكشف الإجابة", exact: true }), "REVEAL");
        await hostAction(page, id, page.getByRole("button", { name: /^صحيح/ }), "CORRECT");
      } else if (index === 2) {
        await hostAction(page, id, page.getByRole("button", { name: /^خطأ/ }), "WRONG");
        await hostAction(page, id, page.getByRole("button", { name: /^خطأ/ }), "WRONG");
      } else {
        const canonical = await inspectDatabase<{ answer: string }>('SELECT answer FROM "Question" WHERE id=$1', [current.active!.questionId]);
        expect(canonical).toHaveLength(1);
        await guest.page.getByLabel("إجابتك للمضيف", { exact: true }).fill(canonical[0].answer);
        const received = guest.page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/responses"));
        await guest.page.getByRole("button", { name: "أرسل", exact: true }).click(); expect((await received).status()).toBe(200);
        await hostAction(page, id, page.getByRole("button", { name: "اكشف الإجابة", exact: true }), "REVEAL");
        await expect(display.locator(".display-answer")).toBeVisible();
        await hostAction(page, id, page.getByRole("button", { name: /^صحيح/ }), "CORRECT");
      }
      if (index !== 2) expected.set(scoredTeam, expected.get(scoredTeam)! + cell.value * multiplier);
      current = await readBoard(page, id);
      expect(current.cells.filter(item => item.completed)).toHaveLength(index + 1);
      current.teams.forEach(team => expect(team.score).toBe(expected.get(team.id)));
    }
    const result = await readBoard(page, id);
    expect(result.status).toBe("COMPLETED"); expect(result.endedEarly).toBe(false); expect(questions.size).toBe(72);
    await page.reload(); await guest.page.reload(); await display.reload();
    expect((await readRoom(guest.page, code)).session.status).toBe("COMPLETED");
    expect((await readRoom(guest.page, code)).selfId).toBe(guestBefore.selfId);
    await expect(page.locator(".victory h2")).toBeVisible();
    await expect(display.getByRole("heading", { name: /الفائز|تعادل/ })).toBeVisible();
    await expect(display.getByRole("button", { name: /^صحيح|أضف نقاطًا/ })).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
    await expect(guest.page.locator("body")).toHaveJSProperty("scrollWidth", 390);
    await expect(display.locator("body")).toHaveJSProperty("scrollWidth", 1920);
    const ledger = await inspectDatabase<{ balance: number; debits: number; rounds: number; questions: number; netScore: number }>(`SELECT
      (SELECT balance FROM "CreditWallet" WHERE "userId"=(SELECT "hostId" FROM "GameSession" WHERE id=$1)) AS balance,
      (SELECT count(*)::int FROM "GameCredit" WHERE "idempotencyKey"='game-start:' || $1 AND delta=-1) AS debits,
      (SELECT count(*)::int FROM "GameRound" WHERE "sessionId"=$1 AND "endedAt" IS NOT NULL) AS rounds,
      (SELECT count(*)::int FROM "SessionQuestion" WHERE "sessionId"=$1) AS questions,
      (SELECT COALESCE(sum(delta),0)::int FROM "ScoreEvent" WHERE "sessionId"=$1) AS "netScore"`, [id]);
    expect(ledger).toEqual([{ balance: before[0].balance - 1, debits: 1, rounds: 72, questions: 72, netScore: [...expected.values()].reduce((sum, score) => sum + score, 0) }]);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    // Neutral viewport capture avoids Chrome's full-page stitching of sticky
    // headers and off-screen fixed skip links at the previous scroll position.
    await page.screenshot({ path: info.outputPath("completed-host-mobile.png") });
    await display.screenshot({ path: info.outputPath("completed-tv.png"), fullPage: true });
    await page.goto("/profile");
    const history = page.locator(".history-row").filter({ has: page.locator(`a[href='/play/${id}']`) });
    await expect(history).toContainText("انتهت");
    await info.attach("full-game-summary", { body: JSON.stringify({ rounds: 72, distinctQuestions: 72, scores: [...expected.values()], startDebits: 1, canonicalHistorySaved: true }), contentType: "application/json" });
  } finally { await Promise.all(contexts.map(context => context.close())); }
});

test("delayed delivery of a real committed answer cannot replace a later live question", async ({ browser, page }) => {
  test.setTimeout(150_000);
  let context: BrowserContext | undefined;
  let release = () => {};
  try {
    const { id, code, board } = await createBoardRoom(page, "board-delivery");
    const guest = await mobileGuest(browser, page, code, "ضيف ترتيب الرسائل", board.teams[0].id); context = guest.context;
    await hostAction(page, id, page.getByRole("button", { name: "ابدأ المباراة", exact: true }), "START");
    await hostAction(page, id, cellControl(page, board, board.cells[0]), "OPEN");
    let committed = () => {}, delivered = () => {};
    const committedPromise = new Promise<void>(resolve => { committed = resolve; });
    const released = new Promise<void>(resolve => { release = resolve; });
    const deliveredPromise = new Promise<void>(resolve => { delivered = resolve; });
    await guest.page.route(`**/api/rooms/${code}/responses`, async route => {
      // The real backend commits first. Preserve its response bytes/status;
      // only delivery is held. No fabricated backend success or game results.
      const real = await route.fetch(); expect(real.status()).toBe(200); committed();
      await released; await route.fulfill({ response: real }); delivered();
    });
    await guest.page.getByLabel("إجابتك للمضيف", { exact: true }).fill("إجابة فعلية برد مؤجل");
    await guest.page.getByRole("button", { name: "أرسل", exact: true }).click(); await committedPromise;
    await hostAction(page, id, page.getByRole("button", { name: /^صحيح/ }), "CORRECT");
    const next = (await hostAction(page, id, cellControl(page, board, board.cells[1]), "OPEN")).session;
    await expect(guest.page.locator(".room-question h2")).toHaveText(next.active!.question);
    release(); await deliveredPromise;
    await expect(guest.page.getByRole("button", { name: "أرسل", exact: true })).toBeEnabled();
    await expect(guest.page.locator(".room-question h2")).toHaveText(next.active!.question);
    const scores = guest.page.locator(".scorebar .team-score b");
    await expect(scores.first()).toHaveText(String(next.teams[0].score));
    await expect(scores.nth(1)).toHaveText(String(next.teams[1].score));
  } finally { release(); await context?.close(); }
});

test("a delayed display-access refresh cannot restore an already judged host question", async ({ page }) => {
  test.setTimeout(120_000);
  const { id, board } = await createBoardRoom(page, "board-host-delivery");
  await hostAction(page, id, page.getByRole("button", { name: "ابدأ المباراة", exact: true }), "START");
  await hostAction(page, id, cellControl(page, board, board.cells[0]), "OPEN");
  let release = () => {}, committed = () => {}, delivered = () => {};
  const released = new Promise<void>(resolve => { release = resolve; });
  const committedPromise = new Promise<void>(resolve => { committed = resolve; });
  const deliveredPromise = new Promise<void>(resolve => { delivered = resolve; });
  await page.route(`**/api/games/category-board/${id}`, async route => {
    if (route.request().method() !== "GET") { await route.continue(); return; }
    const real = await route.fetch(); expect(real.status()).toBe(200); committed();
    await released; await route.fulfill({ response: real }); delivered();
  });
  try {
    await page.getByRole("button", { name: "فتح شاشة العرض", exact: true }).click();
    const modal = page.getByRole("dialog", { name: "شاشة العرض" });
    await expect(modal).toBeVisible(); await committedPromise;
    await modal.getByRole("button", { name: "إغلاق", exact: true }).click();
    const judged = (await hostAction(page, id, page.getByRole("button", { name: /^صحيح/ }), "CORRECT")).session;
    await expect(page.locator(".question-stage")).toHaveCount(0);
    release(); await deliveredPromise;
    await expect(page.getByRole("button", { name: "فتح شاشة العرض", exact: true })).toBeEnabled();
    await expect(page.locator(".question-stage")).toHaveCount(0);
    await expect(page.locator(".scorebar .team-score b").first()).toHaveText(String(judged.teams[0].score));
    const category = board.categories.find(category => category.id === board.cells[0].categoryId)!;
    await expect(page.getByRole("button", { name: `${category.title} ${board.cells[0].value} مستخدم`, exact: true })).toBeDisabled();
  } finally { release(); }
});
