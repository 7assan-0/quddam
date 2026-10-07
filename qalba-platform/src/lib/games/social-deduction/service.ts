import { createHash, randomInt, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { newToken, tokenHash } from "@/lib/auth/crypto";
import { consumeGameCredit } from "@/lib/billing/credits";
import { recordEvent } from "@/lib/analytics/events";
import { roomCode } from "@/lib/rooms/service";
import { lockActiveCategories } from "@/lib/games/content-category";
import { historicalSocialVoteCount } from "@/lib/retention/policy";
import { DISPLAY_ACTIVE_LINK_LIMIT, DISPLAY_LINKS_PER_WINDOW, DISPLAY_LINK_WINDOW_MS,
  DISPLAY_TOKEN_TTL_MS, displayAccessValid, displayWindowEndsAt } from "@/lib/games/category-board/display-policy";
import { advanceTurn, assertPhase, beginDiscussion, beginVoting, guessResult, initialState, pause, resolveBallot, resume,
  startRound, timeoutGuess, validateVote, SocialError, type SocialState } from "./module";

export const cookieName = (id: string) => `qalba_social_${id}`;
const inputState = (state: SocialState) => state as unknown as Prisma.InputJsonValue;
export type SocialAction = { type: "START" | "BEGIN_DISCUSSION" | "ADVANCE_TURN" | "BEGIN_VOTING" | "CLOSE_VOTING" | "PAUSE" | "RESUME" | "END_GAME" | "COMPLETE" | "REMATCH" | "FINISH_TURN" | "EXPIRE_GUESS" }
  | { type: "SUBMIT_VOTE"; roundId: string; ballot: number; targetId: string }
  | { type: "REMOVE_PARTICIPANT"; targetId: string } | { type: "SUBMIT_GUESS"; guess: string };
export type Actor = { kind: "HOST"; id: string } | { kind: "PLAYER"; token: string };
const isUnique = (error: unknown) => typeof error === "object" && error !== null && "code" in error && ["P2002", "P2034"].includes(String(error.code));

export async function createSocialSession(hostId: string, timerSeconds = 30) {
  if (![20, 30, 45, 60].includes(timerSeconds)) throw new SocialError("مدة الدور غير صالحة", 400);
  const game = await db().gameType.findUnique({ where: { slug: "out-of-the-loop" } });
  if (!game?.enabled) throw new SocialError("اللعبة غير متاحة", 404);
  const id = randomUUID();
  let code = "";
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      code = roomCode();
      await db().$transaction(async (tx) => {
        await tx.gameSession.create({ data: { id, hostId, gameTypeId: game.id, config: { timerSeconds }, state: inputState(initialState(timerSeconds)) } });
        await tx.room.create({ data: { code, hostId, sessionId: id, expiresAt: new Date(Date.now() + 8 * 3600_000) } });
        await recordEvent(tx, "GAME_CREATED", hostId, { sessionId: id, gameSlug: "out-of-the-loop" });
        await recordEvent(tx, "ROOM_CREATED", hostId, { sessionId: id });
      });
      return getSocialView(id, { kind: "HOST", id: hostId });
    } catch (error) { if (!isUnique(error)) throw error; }
  }
  throw new SocialError("تعذّر إنشاء رمز الغرفة", 503);
}

export async function socialPreview(code: string) {
  const room = await db().room.findUnique({ where: { code: code.trim().toUpperCase() }, include: { session: { include: { gameType: { select: { slug: true } } } } } });
  if (!room?.session || room.session.gameType.slug !== "out-of-the-loop" || room.expiresAt <= new Date()) throw new SocialError("الغرفة غير متاحة", 404);
  return { id: room.sessionId!, code: room.code, status: room.session.status };
}

export async function joinSocialSession(code: string, name: string, userId?: string) {
  const cleanName = name.trim().replace(/\s+/g, " ");
  if (cleanName.length < 2 || cleanName.length > 60) throw new SocialError("اسم اللاعب بين حرفين و٦٠ حرفًا", 400);
  const preview = await socialPreview(code);
  const existingToken = (await cookies()).get(cookieName(preview.id))?.value;
  if (existingToken) {
    try {
      const view = await getSocialView(preview.id, { kind: "PLAYER", token: existingToken });
      if (view.self) return { id: preview.id };
    } catch (error) { if (!(error instanceof SocialError && error.status === 403)) throw error; }
  }
  const token = newToken();
  const expiresAt = await db().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "GameSession" WHERE "id" = ${preview.id} FOR UPDATE`;
    const room = await tx.room.findUniqueOrThrow({ where: { code: preview.code }, include: { session: { include: { socialParticipants: true } } } });
    if (!room.session || room.session.status !== "LOBBY" || room.expiresAt <= new Date()) throw new SocialError("انتهى الانضمام لهذه الجولة", 409);
    if (userId && room.hostId === userId) throw new SocialError("المضيف يدير المباراة من شاشة المضيف", 403);
    const people = room.session.socialParticipants;
    if (people.length >= 12) throw new SocialError("اكتملت الغرفة", 409, "INVALID_PLAYER_COUNT");
    if (people.some((person) => person.name.toLocaleLowerCase("ar") === cleanName.toLocaleLowerCase("ar"))) throw new SocialError("الاسم مستخدم", 409);
    await tx.socialParticipant.create({ data: { sessionId: room.sessionId!, name: cleanName, position: people.length, tokenHash: tokenHash(token) } });
    await tx.gameSession.update({ where: { id: room.sessionId! }, data: { stateVersion: { increment: 1 } } });
    await tx.room.update({ where: { id: room.id }, data: { version: { increment: 1 } } });
    await recordEvent(tx, "ROOM_JOINED", null, { sessionId: room.sessionId });
    return room.expiresAt;
  });
  (await cookies()).set(cookieName(preview.id), token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: expiresAt });
  return { id: preview.id };
}

export async function socialActor(id: string, hostId?: string): Promise<Actor> {
  if (hostId) return { kind: "HOST", id: hostId };
  const token = (await cookies()).get(cookieName(id))?.value;
  if (!token) throw new SocialError("انضم إلى الغرفة من جهازك", 403, "PLAYER_ACCESS_DENIED");
  return { kind: "PLAYER", token };
}

async function loadSession(id: string) {
  const session = await db().gameSession.findUnique({ where: { id }, include: {
    gameType: { select: { slug: true } }, room: { select: { code: true, expiresAt: true } },
    socialParticipants: { orderBy: { position: "asc" } },
    socialRounds: { orderBy: { number: "desc" }, take: 1, include: { votes: true } },
    displayAccesses: { where: { revokedAt: null, expiresAt: { gt: new Date() } }, select: { expiresAt: true }, take: 1 },
  } });
  if (!session || session.gameType.slug !== "out-of-the-loop") throw new SocialError("المباراة غير موجودة", 404);
  return session;
}

async function resolveExpiredGuess(id: string) {
  await db().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "GameSession" WHERE "id" = ${id} FOR UPDATE`;
    const session = await tx.gameSession.findUnique({ where: { id }, select: { state: true,
      socialRounds: { orderBy: { number: "desc" }, take: 1, select: { id: true } } } });
    if (!session) return;
    const state = session.state as unknown as SocialState;
    const now = Date.now();
    if (state.phase !== "OUTSIDER_GUESS" || !state.deadlineAt || new Date(state.deadlineAt).getTime() > now) return;
    const round = session.socialRounds[0];
    if (!round) throw new SocialError("الجولة غير موجودة");
    const next = timeoutGuess(state, now);
    await tx.gameSession.update({ where: { id }, data: { state: inputState(next), stateVersion: { increment: 1 } } });
    await tx.socialRound.update({ where: { id: round.id }, data: { winner: next.winner, suspectedId: next.suspectedId, endedAt: new Date(now) } });
  });
}

export async function getSocialView(id: string, actor: Actor | { kind: "DISPLAY"; token: string }) {
  let session = await loadSession(id);
  let playerId: string | undefined;
  if (actor.kind === "HOST") {
    if (session.hostId !== actor.id) throw new SocialError("غير مصرح لك بإدارة المباراة", 403);
  } else if (actor.kind === "PLAYER") {
    if (!/^[A-Za-z0-9_-]{43}$/.test(actor.token)) throw new SocialError("هوية اللاعب غير صالحة", 403);
    playerId = session.socialParticipants.find((p) => p.tokenHash === tokenHash(actor.token))?.id;
    if (!playerId || !session.room || session.room.expiresAt <= new Date()) throw new SocialError("هوية اللاعب غير صالحة", 403, "PLAYER_ACCESS_DENIED");
  } else {
    if (!/^[A-Za-z0-9_-]{43}$/.test(actor.token)) throw new SocialError("رابط العرض غير صالح", 403);
    const access = await db().displayAccess.findUnique({ where: { tokenHash: tokenHash(actor.token) } });
    if (!access || access.sessionId !== id || !displayAccessValid(access, session, new Date())) throw new SocialError("رابط العرض منتهي أو ملغى", 403, "DISPLAY_ACCESS_DENIED");
  }
  const state = session.state as unknown as SocialState;
  if (state.schemaVersion !== 1) throw new SocialError("إصدار المباراة غير مدعوم", 500);
  if (state.phase === "OUTSIDER_GUESS" && state.deadlineAt && new Date(state.deadlineAt).getTime() <= Date.now()) {
    await resolveExpiredGuess(id);
    session = await loadSession(id);
  }
  const currentState = session.state as unknown as SocialState;
  const round = session.socialRounds[0];
  const ended = currentState.phase === "RESULTS" || currentState.phase === "COMPLETED";
  const voters = round?.votes.filter((vote) => vote.ballot === currentState.ballot) ?? [];
  const playerVote = playerId ? voters.find((vote) => vote.voterId === playerId) : undefined;
  const reveal = ended && round ? { outsiderId: round.outsiderId, secretWord: round.wordSnapshot, suspectedId: currentState.suspectedId, winner: currentState.winner,
    guess: round.guess, reason: currentState.reason } : null;
  return { id, code: session.room?.code ?? "", version: session.stateVersion, serverNow: new Date().toISOString(), status: session.status,
    phase: currentState.phase, pausedPhase: currentState.pausedPhase, round: session.currentRoundNumber, roundId: round?.id ?? null, turnIndex: currentState.turnIndex,
    timerSeconds: currentState.timerSeconds, deadlineAt: currentState.deadlineAt, remainingMs: currentState.remainingMs,
    ballot: currentState.ballot, candidates: currentState.candidates, maxRunoffs: currentState.maxRunoffs, tally: currentState.phase === "RUNOFF_VOTING" || currentState.phase === "OUTSIDER_GUESS" || ended ? currentState.tally : null,
    suspectedId: currentState.phase === "OUTSIDER_GUESS" || ended ? currentState.suspectedId : null,
    voteCount: historicalSocialVoteCount(voters.length, round?.retainedVoteCounts, currentState.ballot), participants: session.socialParticipants.map((p) => ({ id: p.id, name: p.name, position: p.position })),
    self: playerId ? { id: playerId, role: round && round.outsiderId === playerId ? "OUTSIDER" as const : round ? "PLAYER" as const : null,
      secretWord: round && round.outsiderId !== playerId ? round.wordSnapshot : null, votedFor: playerVote?.targetId ?? null } : null,
    reveal, displayAccess: actor.kind === "HOST" ? { active: session.displayAccesses.length > 0, expiresAt: (session.displayAccesses[0]?.expiresAt ?? null) as Date | null } : undefined,
  };
}
export type SocialView = Awaited<ReturnType<typeof getSocialView>>;

async function selectWord(tx: Prisma.TransactionClient, hostId: string, previous?: string) {
  const words = await tx.secretWord.findMany({ where: { status: "PUBLISHED", language: "ar", category: { active: true } }, select: { id: true } });
  if (!words.length) throw new SocialError("لا توجد كلمات منشورة", 409);
  const recent = await tx.socialRound.findMany({ where: { session: { hostId } }, orderBy: { startedAt: "desc" }, take: 20, select: { secretWordId: true } });
  const excluded = new Set(recent.map((row) => row.secretWordId));
  const fresh = words.filter((word) => !excluded.has(word.id));
  const options = fresh.length ? fresh : words.filter((word) => word.id !== previous);
  const pool = options.length ? options : words;
  const id = pool[randomInt(pool.length)].id;
  // Hold the authored row stable until its round snapshot commits.
  await tx.$queryRaw`SELECT "id" FROM "SecretWord" WHERE "id" = ${id} FOR SHARE`;
  const word = await tx.secretWord.findUniqueOrThrow({ where: { id } });
  const activeCategories = await lockActiveCategories(tx, [word.categoryId]);
  if (word.status !== "PUBLISHED" || word.language !== "ar" || !activeCategories.includes(word.categoryId)) throw new SocialError("الكلمة لم تعد متاحة، حاول مجددًا", 409);
  return word;
}

export async function applySocialCommand(id: string, actor: Actor, key: string, expectedVersion: number, action: SocialAction) {
  const actorIdentity = actor.kind === "PLAYER" ? tokenHash(actor.token) : actor.id;
  const payloadHash = createHash("sha256").update(JSON.stringify({ actor: actorIdentity, action })).digest("hex");
  const receipt = () => db().gameCommand.findUnique({ where: { sessionId_key: { sessionId: id, key } } });
  const duplicateView = async () => {
    const prior = await receipt();
    if (!prior) return null;
    if (prior.payloadHash !== payloadHash) throw new SocialError("معرّف الأمر مستخدم لإجراء مختلف", 409, "COMMAND_KEY_REUSED");
    const session = await getSocialView(id, actor);
    if (action.type === "SUBMIT_VOTE" && session.roundId !== action.roundId) throw new SocialError("هذا التصويت لجولة سابقة. حدّث المباراة", 409, "STALE_ROUND");
    return { session, duplicate: true };
  };
  try {
    const duplicate = await db().$transaction(async (tx) => {
      // Serialize joins, removals, starts and ballots on this session row.
      await tx.$queryRaw`SELECT "id" FROM "GameSession" WHERE "id" = ${id} FOR UPDATE`;
      if (actor.kind === "PLAYER") {
        if (!/^[A-Za-z0-9_-]{43}$/.test(actor.token)) throw new SocialError("هوية اللاعب غير صالحة", 403, "PLAYER_ACCESS_DENIED");
        await tx.$queryRaw`SELECT "id" FROM "Room" WHERE "sessionId" = ${id} FOR SHARE`;
      }
      const session = await tx.gameSession.findUnique({ where: { id }, include: { gameType: { select: { slug: true } }, room: true,
        socialParticipants: { orderBy: { position: "asc" } }, socialRounds: { orderBy: { number: "desc" }, take: 1 } } });
      if (!session || session.gameType.slug !== "out-of-the-loop") throw new SocialError("المباراة غير موجودة", 404);
      const player = actor.kind === "PLAYER" ? session.socialParticipants.find((p) => p.tokenHash === actorIdentity) : null;
      if (actor.kind === "HOST") {
        if (actor.id !== session.hostId) throw new SocialError("غير مصرح بهذا الأمر", 403);
      } else if (!player || player.sessionId !== id || !session.room || session.room.sessionId !== id || session.room.expiresAt.getTime() <= Date.now()) {
        // Authorize before receipt lookup/insertion or any gameplay write. Removal deletes the participant row.
        throw new SocialError("هوية اللاعب غير صالحة", 403, "PLAYER_ACCESS_DENIED");
      }
      const round = session.socialRounds[0];
      // Check the immutable round before receipt recovery, version rebasing or any write.
      if (action.type === "SUBMIT_VOTE" && (!round || action.roundId !== round.id))
        throw new SocialError("هذا التصويت لجولة سابقة. حدّث المباراة", 409, "STALE_ROUND");
      const existing = await tx.gameCommand.findUnique({ where: { sessionId_key: { sessionId: id, key } } });
      if (existing) {
        if (existing.payloadHash !== payloadHash) throw new SocialError("معرّف الأمر مستخدم لإجراء مختلف", 409, "COMMAND_KEY_REUSED");
        return true;
      }
      const state = session.state as unknown as SocialState;
      if (action.type === "SUBMIT_VOTE" && action.ballot !== state.ballot)
        throw new SocialError("انتهى هذا الاقتراع. حدّث المباراة", 409, "STALE_VOTE_INTENT");
      await tx.gameCommand.create({ data: { sessionId: id, key, type: action.type, payloadHash, stateVersion: expectedVersion + 1 } });
      if (session.stateVersion !== expectedVersion) throw new SocialError("تغيرت المباراة. حدّث الحالة", 409, "STALE_GAME_STATE");
      if (state.schemaVersion !== 1) throw new SocialError("إصدار المباراة غير مدعوم", 500);
      const participants = session.socialParticipants;
      const ids = participants.map((p) => p.id);
      const now = Date.now();
      if (state.phase === "OUTSIDER_GUESS" && state.deadlineAt && new Date(state.deadlineAt).getTime() <= now && action.type !== "EXPIRE_GUESS")
        throw new SocialError("انتهت مهلة التخمين", 409, "GUESS_TIMEOUT");
      let next: SocialState;
      if (actor.kind === "HOST") {
        switch (action.type) {
          case "REMOVE_PARTICIPANT": {
            assertPhase(state, "LOBBY");
            if (!participants.some((person) => person.id === action.targetId)) throw new SocialError("اللاعب غير موجود في الغرفة", 404);
            await tx.socialParticipant.delete({ where: { id: action.targetId } });
            const remaining = participants.filter((person) => person.id !== action.targetId);
            for (const [position, person] of remaining.entries()) if (person.position !== position)
              await tx.socialParticipant.update({ where: { id: person.id }, data: { position } });
            await tx.room.updateMany({ where: { sessionId: id }, data: { version: { increment: 1 } } });
            next = state;
            break;
          }
          case "START": case "REMATCH": {
            if (action.type === "START") assertPhase(state, "LOBBY");
            else assertPhase(state, "COMPLETED");
            next = startRound(state, ids);
            if (action.type === "START") await consumeGameCredit(tx, session.hostId, id, Boolean(session.creditConsumedAt));
            const eligible = action.type === "REMATCH" && round ? ids.filter((item) => item !== round.outsiderId) : ids;
            const outsiderId = eligible[randomInt(eligible.length)];
            const word = await selectWord(tx, session.hostId, round?.secretWordId);
            await tx.socialRound.create({ data: { sessionId: id, number: session.currentRoundNumber + 1, outsiderId, secretWordId: word.id,
              wordSnapshot: word.word, alternativesSnapshot: word.alternativeAnswers, snapshotOrigin: "ROUND_CREATION" } });
            break;
          }
          case "BEGIN_DISCUSSION": next = beginDiscussion(state, now); break;
          case "ADVANCE_TURN": next = advanceTurn(state, ids.length, now); break;
          case "BEGIN_VOTING": next = beginVoting(state); break;
          case "CLOSE_VOTING": {
            assertPhase(state, "VOTING", "RUNOFF_VOTING");
            if (!round) throw new SocialError("الجولة غير موجودة");
            const votes = await tx.socialVote.findMany({ where: { roundId: round.id, ballot: state.ballot }, select: { targetId: true } });
            next = resolveBallot(state, votes.map((vote) => vote.targetId), round.outsiderId, now);
            break;
          }
          case "EXPIRE_GUESS": next = timeoutGuess(state, now); break;
          case "PAUSE": next = pause(state, now); break;
          case "RESUME": next = resume(state, now); break;
          case "END_GAME":
            if (["LOBBY", "COMPLETED", "ABANDONED"].includes(state.phase)) throw new SocialError("لا يمكن إنهاء المباراة الآن");
            next = { ...state, phase: "ABANDONED", deadlineAt: null, pausedPhase: null }; break;
          case "COMPLETE": assertPhase(state, "RESULTS"); next = { ...state, phase: "COMPLETED", deadlineAt: null }; break;
          default: throw new SocialError("هذا الإجراء للاعبين فقط", 403);
        }
      } else {
        switch (action.type) {
          case "FINISH_TURN":
            assertPhase(state, "DISCUSSION");
            if (ids[state.turnIndex] !== player!.id) throw new SocialError("ليس دورك", 403, "NOT_YOUR_TURN");
            if (state.deadlineAt && new Date(state.deadlineAt).getTime() <= now) throw new SocialError("انتهى وقت دورك", 409, "TIMER_EXPIRED");
            next = advanceTurn(state, ids.length, now); break;
          case "SUBMIT_VOTE": {
            validateVote(state, player!.id, action.targetId, ids);
            if (!round) throw new SocialError("الجولة غير موجودة");
            const previous = await tx.socialVote.findUnique({ where: { roundId_ballot_voterId: { roundId: round.id, ballot: state.ballot, voterId: player!.id } } });
            if (previous && !state.allowVoteChange) throw new SocialError("صوّتت في هذه الجولة", 409, "ALREADY_VOTED");
            await tx.socialVote.upsert({ where: { roundId_ballot_voterId: { roundId: round.id, ballot: state.ballot, voterId: player!.id } },
              create: { roundId: round.id, ballot: state.ballot, voterId: player!.id, targetId: action.targetId }, update: { targetId: action.targetId } });
            const votes = await tx.socialVote.findMany({ where: { roundId: round.id, ballot: state.ballot }, select: { targetId: true } });
            next = votes.length === ids.length ? resolveBallot(state, votes.map((vote) => vote.targetId), round.outsiderId, now) : state;
            break;
          }
          case "SUBMIT_GUESS":
            assertPhase(state, "OUTSIDER_GUESS");
            if (!round || player!.id !== round.outsiderId) throw new SocialError("التخمين مخصص للاعب خارج الجو", 403);
            if (!action.guess.trim() || action.guess.length > 100) throw new SocialError("أدخل كلمة مناسبة", 400);
            next = guessResult(state, action.guess, [round.wordSnapshot, ...round.alternativesSnapshot], now);
            await tx.socialRound.update({ where: { id: round.id }, data: { guess: action.guess.trim() } }); break;
          default: throw new SocialError("هذا الإجراء للمضيف فقط", 403);
        }
      }
      const update = await tx.gameSession.updateMany({ where: { id, stateVersion: expectedVersion }, data: {
        state: inputState(next), stateVersion: { increment: 1 },
        status: next.phase === "LOBBY" ? "LOBBY" : next.phase === "COMPLETED" ? "COMPLETED" : next.phase === "ABANDONED" ? "ABANDONED" : next.phase === "PAUSED" ? "PAUSED" : "IN_PROGRESS",
        currentRoundNumber: action.type === "START" || action.type === "REMATCH" ? { increment: 1 } : undefined,
        startedAt: action.type === "START" ? new Date(now) : undefined, creditConsumedAt: action.type === "START" ? new Date(now) : undefined,
        endedAt: next.phase === "COMPLETED" || next.phase === "ABANDONED" ? new Date(now) : action.type === "REMATCH" ? null : undefined,
      } });
      if (update.count !== 1) throw new SocialError("تغيرت المباراة. حدّث الحالة", 409, "STALE_GAME_STATE");
      if (round && next.phase === "RESULTS" && state.phase !== "RESULTS") await tx.socialRound.update({ where: { id: round.id }, data: { winner: next.winner, suspectedId: next.suspectedId, endedAt: new Date(now) } });
      if (action.type === "START" || action.type === "REMATCH") await recordEvent(tx, "GAME_STARTED", session.hostId, { sessionId: id, gameSlug: "out-of-the-loop" });
      if (next.phase === "COMPLETED" || next.phase === "ABANDONED") await recordEvent(tx, "GAME_COMPLETED", session.hostId, { sessionId: id, gameSlug: "out-of-the-loop" });
      return false;
    });
    return { session: await getSocialView(id, actor), duplicate };
  } catch (error) {
    if (isUnique(error) || error instanceof SocialError && error.code === "STALE_GAME_STATE") {
      const recovered = await duplicateView();
      if (recovered) return recovered;
      throw new SocialError("تغيرت المباراة. حدّث الحالة", 409, "STALE_GAME_STATE");
    }
    throw error;
  }
}

export async function createSocialDisplayAccess(hostId: string, id: string) {
  await getSocialView(id, { kind: "HOST", id: hostId });
  const session = await db().gameSession.findUniqueOrThrow({ where: { id }, select: { endedAt: true } });
  const now = new Date();
  const windowEndsAt = displayWindowEndsAt(session.endedAt, now);
  if (session.endedAt && !windowEndsAt) throw new SocialError("انتهت فترة عرض المباراة", 410);
  const token = newToken();
  const expiresAt = new Date(Math.min(now.getTime() + DISPLAY_TOKEN_TTL_MS, windowEndsAt?.getTime() ?? Infinity));
  await db().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "GameSession" WHERE "id" = ${id} FOR UPDATE`;
    await tx.displayAccess.deleteMany({ where: { sessionId: id, expiresAt: { lt: new Date(now.getTime() - 86400_000) } } });
    const [recent, active] = await Promise.all([
      tx.displayAccess.count({ where: { sessionId: id, createdAt: { gte: new Date(now.getTime() - DISPLAY_LINK_WINDOW_MS) } } }),
      tx.displayAccess.count({ where: { sessionId: id, revokedAt: null, expiresAt: { gt: now } } }),
    ]);
    if (recent >= DISPLAY_LINKS_PER_WINDOW || active >= DISPLAY_ACTIVE_LINK_LIMIT)
      throw new SocialError("وصلت إلى حد روابط العرض لهذه المباراة. ألغِ الروابط النشطة أو حاول لاحقًا", 429, "DISPLAY_LINK_RATE_LIMIT");
    await tx.displayAccess.create({ data: { sessionId: id, tokenHash: tokenHash(token), expiresAt } });
  });
  return { token, expiresAt };
}
export async function revokeSocialDisplayAccess(hostId: string, id: string) {
  await getSocialView(id, { kind: "HOST", id: hostId });
  await db().displayAccess.updateMany({ where: { sessionId: id, revokedAt: null }, data: { revokedAt: new Date() } });
}
