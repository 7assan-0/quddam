import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { newToken, tokenHash } from "@/lib/auth/crypto";
import { currentUser } from "@/lib/auth/session";
import { getBoardSession } from "@/lib/games/category-board/service";
import { recordEvent } from "@/lib/analytics/events";
import type { BoardState } from "@/lib/games/category-board/module";
import { boardPhoneResponseOpen } from "./board-response-policy";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const roomCode = () => Array.from(randomBytes(6), (byte) => alphabet[byte % alphabet.length]).join("");
const cookieName = (code: string) => `qalba_room_${code}`;
export class RoomError extends Error { constructor(message: string, public status = 400) { super(message); } }
const codePattern = /^[A-HJ-NP-Z2-9]{6}$/;
export function normalizeCode(code: string) {
  const normalized = code.trim().toUpperCase();
  if (!codePattern.test(normalized)) throw new RoomError("رمز الغرفة غير صحيح", 404);
  return normalized;
}

export async function previewRoom(code: string) {
  const room = await db().room.findUnique({ where: { code: normalizeCode(code) }, include: {
    session: { include: { teams: { select: { id: true, name: true, color: true } } } },
  } });
  if (!room || room.expiresAt <= new Date() || !room.session || ["COMPLETED", "ABANDONED"].includes(room.session.status)) throw new RoomError("الغرفة غير متاحة", 404);
  return { code: room.code, status: room.session.status, teams: room.session.teams };
}

export async function createRoom(hostId: string, sessionId: string) {
  const session = await db().gameSession.findUnique({ where: { id: sessionId }, include: { gameType: true, room: true } });
  if (!session || session.gameType.slug !== "category-board") throw new RoomError("المباراة غير موجودة", 404);
  if (session.hostId !== hostId) throw new RoomError("غير مصرح لك", 403);
  if (["COMPLETED", "ABANDONED"].includes(session.status)) throw new RoomError("انتهت المباراة", 409);
  if (session.room) return { code: session.room.code };
  for (let i = 0; i < 8; i++) {
    try {
      const room = await db().$transaction(async tx => { const created = await tx.room.create({ data: { code: roomCode(), hostId, sessionId, expiresAt: new Date(Date.now() + 8 * 3600_000) } });
        await recordEvent(tx, "ROOM_CREATED", hostId, { sessionId }); return created; });
      return { code: room.code };
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
        const existing = await db().room.findUnique({ where: { sessionId } });
        if (existing) return { code: existing.code };
        continue;
      }
      throw error;
    }
  }
  throw new RoomError("تعذّر إنشاء الرمز. حاول مجددًا", 503);
}

export async function joinRoom(code: string, name: string, teamId: string) {
  const normalized = normalizeCode(code);
  const cleanName = name.trim().replace(/\s+/g, " ");
  if (cleanName.length < 2 || cleanName.length > 60) throw new RoomError("اسم اللاعب بين حرفين و٦٠ حرفًا");
  const preview = await previewRoom(normalized);
  if (!preview.teams.some((team) => team.id === teamId)) throw new RoomError("اختر فريقًا من الغرفة");
  const user = await currentUser();
  const cookieStore = await cookies();
  const existingToken = cookieStore.get(cookieName(normalized))?.value;
  const token = newToken();
  const joined = await db().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Room" WHERE "code" = ${normalized} FOR UPDATE`;
    const room = await tx.room.findUniqueOrThrow({ where: { code: normalized }, include: { session: true } });
    if (room.expiresAt <= new Date() || !room.session || ["COMPLETED", "ABANDONED"].includes(room.session.status)) throw new RoomError("الغرفة غير متاحة", 404);
    if (user?.id === room.hostId) throw new RoomError("المضيف يدير الغرفة من لوحة المباراة", 409);
    // A retained guest capability identifies its existing seat, including when
    // a successful join response was lost. Do not rotate it into a second seat.
    if (existingToken) {
      const existing = await tx.roomParticipant.findFirst({ where: { roomId: room.id, tokenHash: tokenHash(existingToken) },
        select: { name: true, teamId: true } });
      if (existing) {
        if (existing.name.toLocaleLowerCase("ar") !== cleanName.toLocaleLowerCase("ar") || existing.teamId !== teamId)
          throw new RoomError("أنت منضم بالفعل. عد إلى مقعدك الحالي في الغرفة", 409);
        return { room, token: existingToken };
      }
    }
    const participants = await tx.roomParticipant.findMany({ where: { roomId: room.id }, select: { name: true } });
    if (participants.length >= 20) throw new RoomError("اكتملت الغرفة", 409);
    if (participants.some((person) => person.name.toLocaleLowerCase("ar") === cleanName.toLocaleLowerCase("ar"))) throw new RoomError("الاسم مستخدم في هذه الغرفة", 409);
    const team = await tx.team.findFirst({ where: { id: teamId, sessionId: room.sessionId! } });
    if (!team) throw new RoomError("الفريق غير متاح", 400);
    const player = await tx.player.create({ data: { sessionId: room.sessionId!, userId: user?.id, teamId, name: cleanName } });
    await tx.roomParticipant.create({ data: { roomId: room.id, userId: user?.id, playerId: player.id, tokenHash: tokenHash(token), teamId, name: cleanName } });
    await tx.room.update({ where: { id: room.id }, data: { version: { increment: 1 } } });
    await recordEvent(tx, "ROOM_JOINED", user?.id ?? null, { roomId: room.id });
    return { room, token };
  });
  cookieStore.set(cookieName(normalized), joined.token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: joined.room.expiresAt });
  return { code: normalized };
}

export async function roomAccess(code: string) {
  const room = await db().room.findUnique({ where: { code: normalizeCode(code) }, include: { participants: { orderBy: { joinedAt: "asc" }, select: {
    id: true, name: true, teamId: true, ready: true, playerId: true, tokenHash: true,
  } } } });
  if (!room || !room.sessionId || room.expiresAt <= new Date()) throw new RoomError("الغرفة غير متاحة", 404);
  const user = await currentUser();
  const host = user?.id === room.hostId;
  const token = (await cookies()).get(cookieName(room.code))?.value;
  const participant = token ? room.participants.find((item) => item.tokenHash === tokenHash(token)) : undefined;
  if (!host && !participant) throw new RoomError("انضم إلى الغرفة أولًا", 403);
  return { room, host, participant };
}

export async function roomView(code: string) {
  const { room, host, participant } = await roomAccess(code);
  const board = await getBoardSession(room.hostId, room.sessionId!);
  const round = board.round ? await db().gameRound.findUnique({ where: { sessionId_number: { sessionId: room.sessionId!, number: board.round } } }) : null;
  const responses = host && round ? await db().playerResponse.findMany({ where: { roundId: round.id }, include: { player: { select: { name: true, teamId: true } } }, orderBy: { submittedAt: "asc" } }) : [];
  const votes = round ? await db().roomVote.findMany({ where: { roundId: round.id }, select: { participantId: true } }) : [];
  const ownResponse = !host && participant && round ? await db().playerResponse.findFirst({ where: { roundId: round.id, playerId: participant.playerId! } }) : null;
  return { code: room.code, version: `${room.version}:${board.version}`, serverNow: board.serverNow, host,
    selfId: participant?.id ?? null, participants: room.participants.map(({ id, name, teamId, ready }) => ({ id, name, teamId, ready })),
    session: { id: board.id, status: board.status, version: board.version, round: board.round, categories: board.categories,
      cells: board.cells, teams: board.teams, turnTeamId: board.turnTeamId, timerSeconds: board.timerSeconds,
      active: board.active && { ...board.active, questionId: undefined, originalTeamId: undefined } },
    submitted: Boolean(ownResponse), voted: votes.some((vote) => vote.participantId === participant?.id),
    voteCount: votes.length,
    responses: host ? responses.map((item) => ({ name: item.player.name, teamId: item.player.teamId, response: item.response })) : undefined,
  };
}

export async function setReady(code: string, ready: boolean) {
  const { room, participant } = await roomAccess(code);
  if (!participant) throw new RoomError("الجاهزية للاعبين فقط", 403);
  await db().$transaction(async (tx) => {
    await tx.roomParticipant.update({ where: { id: participant.id }, data: { ready } });
    await tx.room.update({ where: { id: room.id }, data: { version: { increment: 1 } } });
  });
  return roomView(code);
}

export async function submitResponse(code: string, response: string, vote: boolean) {
  const { room, participant } = await roomAccess(code);
  if (!participant) throw new RoomError("المشاركة للاعبين فقط", 403);
  const board = await getBoardSession(room.hostId, room.sessionId!);
  if (board.status !== "IN_PROGRESS" || !board.active || board.active.revealed || board.active.phase === "CHALLENGE") throw new RoomError("السؤال غير مفتوح للإجابات", 409);
  const clean = response.trim();
  if (!clean || clean.length > 300) throw new RoomError("الإجابة بين حرف و٣٠٠ حرف");
  if (vote && (!board.active.options || !board.active.options.includes(clean))) throw new RoomError("اختر إجابة ظاهرة", 400);
  const round = await db().gameRound.findUniqueOrThrow({ where: { sessionId_number: { sessionId: room.sessionId!, number: board.round } } });
  try {
    await db().$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "GameSession" WHERE "id" = ${room.sessionId!} FOR UPDATE`;
      const session = await tx.gameSession.findUniqueOrThrow({ where: { id: room.sessionId! } });
      if (session.stateVersion !== board.version) throw new RoomError("تغير السؤال. حدّث الغرفة", 409);
      // Waiting for the session lock must not admit a response past the persisted deadline.
      if (!boardPhoneResponseOpen(session.status, session.state as unknown as BoardState, new Date())) throw new RoomError("انتهى وقت الإجابة أو أُغلق السؤال", 409);
      if (vote) await tx.roomVote.create({ data: { roundId: round.id, participantId: participant.id, option: clean } });
      else await tx.playerResponse.create({ data: { roundId: round.id, playerId: participant.playerId!, questionId: session.currentQuestionId,
        response: { text: clean } } });
      await tx.room.update({ where: { id: room.id }, data: { version: { increment: 1 } } });
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") throw new RoomError("أرسلت مشاركتك لهذا السؤال بالفعل", 409);
    throw error;
  }
  return roomView(code);
}
