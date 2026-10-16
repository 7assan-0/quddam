import { randomUUID } from "node:crypto";
import { expect, test, type BrowserContext } from "@playwright/test";
import { behindSessionLock, cellControl, createBoardRoom, inspectDatabase, mobileGuest, readBoard, readRoom, hostAction } from "./category-board-acceptance-helpers";

test.use({ actionTimeout: 30_000 });

test("twenty independent mobile guests retain their seats and submit concurrently; the twenty-first is rejected", async ({ browser, page }, info) => {
  test.setTimeout(360_000);
  const contexts: BrowserContext[] = [];
  try {
    const { id, code, board } = await createBoardRoom(page, "board-capacity");
    // Real first-attempt-anchored admission windows: never raise budgets or forge IP headers.
    await page.waitForTimeout(61_000);
    const guests = [];
    for (let index = 0; index < 20; index++) {
      if (index === 12) await page.waitForTimeout(61_000);
      const guest = await mobileGuest(browser, page, code, `لاعب السعة ${index + 1}`, board.teams[index % 2].id);
      contexts.push(guest.context); guests.push(guest);
    }
    await expect(page.getByText("20 لاعب في الغرفة · 20 جاهزون")).toBeVisible();
    const roster = await readRoom(page, code);
    expect(roster.host).toBe(true); expect(roster.selfId).toBeNull();
    expect(roster.participants).toHaveLength(20);
    expect(new Set(roster.participants.map(person => person.id)).size).toBe(20);
    roster.participants.forEach((person, index) => {
      expect(person.name).toBe(`لاعب السعة ${index + 1}`);
      expect(person.teamId).toBe(board.teams[index % 2].id); expect(person.ready).toBe(true);
    });
    const rejectedContext = await browser.newContext({ baseURL: new URL(page.url()).origin,
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); contexts.push(rejectedContext);
    const rejectedPage = await rejectedContext.newPage(); await rejectedPage.goto(`/join?code=${code}`);
    await rejectedPage.getByLabel("اسمك في اللعب", { exact: true }).fill("المشارك الحادي والعشرون");
    await rejectedPage.getByLabel("فريقك", { exact: true }).selectOption(board.teams[0].id);
    const admission = rejectedPage.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/join"));
    await rejectedPage.getByRole("button", { name: "انضم إلى الغرفة", exact: true }).click();
    expect((await admission).status()).toBe(409);
    await expect(rejectedPage.getByRole("alert")).toContainText("اكتملت الغرفة");
    expect((await readRoom(page, code)).participants).toEqual(roster.participants);
    const before = await readRoom(guests[19].page, code);
    await guests[19].context.setOffline(true);
    expect(await guests[19].page.evaluate(async code => {
      try { await fetch(`/api/rooms/${code}`, { cache: "no-store" }); return false; } catch { return true; }
    }, code)).toBe(true);
    await guests[19].context.setOffline(false); await guests[19].page.reload();
    const restored = await readRoom(guests[19].page, code);
    expect(restored.selfId).toBe(before.selfId); expect(restored.host).toBe(false);
    expect(restored.participants).toEqual(roster.participants);
    const fullRoomRetry = await guests[19].context.request.post(`/api/rooms/${code}/join`, {
      headers: { Origin: new URL(page.url()).origin }, data: { name: "لاعب السعة 20", teamId: board.teams[1].id },
    });
    expect(fullRoomRetry.status()).toBe(201);
    expect((await readRoom(guests[19].page, code)).selfId).toBe(before.selfId);
    await page.reload();
    await expect(page.getByText("20 لاعب في الغرفة · 20 جاهزون")).toBeVisible();
    await hostAction(page, id, page.getByRole("button", { name: "ابدأ المباراة", exact: true }), "START");
    await hostAction(page, id, cellControl(page, board, board.cells[0]), "OPEN");
    const question = (await readBoard(page, id)).active!.question;
    for (const guest of guests) await expect(guest.page.locator(".room-question h2")).toHaveText(question);
    const statuses = await Promise.all(guests.map((guest, index) => guest.page.evaluate(async ({ code, index }) => {
      const response = await fetch(`/api/rooms/${code}/responses`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: `إجابة اصطناعية ${index}`, vote: false }) }); return response.status;
    }, { code, index })));
    expect(statuses).toEqual(Array(20).fill(200));
    expect((await readRoom(page, code)).responses).toHaveLength(20);
    const replay = await guests[0].page.evaluate(async code => (await fetch(`/api/rooms/${code}/responses`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ response: "محاولة مكررة", vote: false }) })).status, code);
    expect(replay).toBe(409);
    const denied = await guests[0].context.request.post(`/api/games/category-board/${id}/commands`, {
      headers: { Origin: new URL(page.url()).origin }, data: { key: randomUUID(), expectedVersion: (await readBoard(page, id)).version, action: { type: "CORRECT" } },
    }); expect(denied.status()).toBe(403);
    const state = await readBoard(page, id), key = randomUUID();
    const race = await behindSessionLock(id, () => page.evaluate(async ({ id, version, key }) => Promise.all([1, 2].map(async () => {
      const response = await fetch(`/api/games/category-board/${id}/commands`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, expectedVersion: version, action: { type: "CORRECT" } }) });
      return { status: response.status, duplicate: (await response.json()).duplicate };
    })), { id, version: state.version, key }));
    expect(race.result.map(result => result.status)).toEqual([200, 200]);
    expect(race.result.map(result => result.duplicate).sort()).toEqual([false, true]);
    const after = await readBoard(page, id);
    expect(after.version).toBe(state.version + 1);
    expect(after.teams.reduce((sum, team) => sum + team.score, 0)).toBe(board.cells[0].value);
    expect(after.cells.filter(cell => cell.completed)).toHaveLength(1);
    await page.reload();
    const next = (await hostAction(page, id, cellControl(page, board, board.cells[1]), "OPEN")).session;
    const competing = await behindSessionLock(id, () => page.evaluate(async ({ id, version }) => Promise.all([1, 2].map(async () => {
      const response = await fetch(`/api/games/category-board/${id}/commands`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: crypto.randomUUID(), expectedVersion: version, action: { type: "CORRECT" } }) });
      return response.status;
    })), { id, version: next.version }));
    expect(competing.result.sort()).toEqual([200, 409]);
    const latest = await readBoard(page, id);
    expect(latest.version).toBe(next.version + 1);
    expect(latest.cells.filter(cell => cell.completed)).toHaveLength(2);
    expect(latest.teams.reduce((sum, team) => sum + team.score, 0)).toBe(board.cells[0].value + board.cells[1].value);
    for (const guest of guests) await expect(guest.page.locator(".scorebar .team-score b")).toHaveText(latest.teams.map(team => String(team.score)));
    const counts = await inspectDatabase<{ participants: number; responses: number; debits: number }>(`SELECT
      (SELECT count(*)::int FROM "RoomParticipant" WHERE "roomId"=(SELECT id FROM "Room" WHERE code=$1)) AS participants,
      (SELECT count(*)::int FROM "PlayerResponse" WHERE "roundId" IN (SELECT id FROM "GameRound" WHERE "sessionId"=$2)) AS responses,
      (SELECT count(*)::int FROM "GameCredit" WHERE "idempotencyKey"='game-start:' || $2 AND delta<0) AS debits`, [code, id]);
    expect(counts).toEqual([{ participants: 20, responses: 20, debits: 1 }]);
    await info.attach("native-capacity-concurrency", { body: JSON.stringify({ guests: 20, rejected: 1, restoredSameSeat: true,
      identicalKeyRace: race.evidence, differentKeyRace: competing.evidence }), contentType: "application/json" });
  } finally { await Promise.all(contexts.map(context => context.close())); }
});

test("an existing guest cookie keeps the same seat across retried and conflicting joins", async ({ browser, page }) => {
  test.setTimeout(90000);
  const { code, board } = await createBoardRoom(page, "board-join-retry");
  const guest = await mobileGuest(browser, page, code, "ضيف إعادة الانضمام", board.teams[0].id);
  try {
    const before = await readRoom(guest.page, code);
    const send = (name: string) => guest.context.request.post(`/api/rooms/${code}/join`, {
      headers: { Origin: new URL(page.url()).origin }, data: { name, teamId: board.teams[0].id },
    });
    const retry = await send("ضيف إعادة الانضمام");
    const changed = await send("اسم آخر للمقعد نفسه");
    expect([retry.status(), changed.status()]).toEqual([201, 409]);
    expect((await readRoom(guest.page, code)).selfId).toBe(before.selfId);
    const raced = await Promise.all([send("ضيف إعادة الانضمام"), send("ضيف إعادة الانضمام")]);
    expect(raced.map(response => response.status())).toEqual([201, 201]);
    await guest.page.reload();
    const after = await readRoom(guest.page, code);
    expect(after.selfId).toBe(before.selfId); expect(after.host).toBe(false);
    expect(after.participants).toEqual(before.participants);
    expect(after.participants).toHaveLength(1);
    const rows = await inspectDatabase<{ participants: number; players: number }>(`SELECT
      (SELECT count(*)::int FROM "RoomParticipant" WHERE "roomId"=(SELECT id FROM "Room" WHERE code=$1)) AS participants,
      (SELECT count(*)::int FROM "Player" WHERE "sessionId"=(SELECT "sessionId" FROM "Room" WHERE code=$1)) AS players`, [code]);
    expect(rows).toEqual([{ participants: 1, players: 1 }]);
  } finally { await guest.context.close(); }
});
