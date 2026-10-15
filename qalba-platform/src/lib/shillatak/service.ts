import { randomBytes, randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { completedSnapshot, digest, jsonDigest, shillaLeaderboard, ShillaError,
  SHILLA_INVITE_DAYS, SHILLA_MAX_ACTIVE_INVITES, SHILLA_MAX_MEMBERS, shillaEnabled,
  type ShillaSnapshot, normalizedName, validateCreate } from "./rules";
import type { z } from "zod";
import type { shillaCreateSchema } from "./rules";

const json = (value: unknown) => value as Prisma.InputJsonValue;
function requireEnabled() {
  if (!shillaEnabled()) throw new ShillaError("شلّتك غير متاحة حاليًا", 404, "FEATURE_DISABLED");
}
function deny(message = "الشلّة غير موجودة", status = 404, code = "NOT_FOUND"): never {
  throw new ShillaError(message, status, code);
}
const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
function groupId(id: string) { if (!validId(id)) deny(); }
const detailInclude = {
  teams: { orderBy: { position: "asc" as const } },
  members: { orderBy: { joinedAt: "asc" as const },
    include: { user: { select: { id: true, name: true } } } },
  nights: { orderBy: { createdAt: "desc" as const } },
};
type Detail = Prisma.ShillaGetPayload<{ include: typeof detailInclude }>;
function safeSnapshot(input: unknown, id: string): ShillaSnapshot {
  const s = input as ShillaSnapshot;
  if (!s || s.schemaVersion !== 1 || s.nightId !== id || s.gameCount !== 3 ||
    !Array.isArray(s.teams) || s.teams.length !== 2 || s.teams.some(team =>
      !team || typeof team.shillaTeamId !== "string" || !Number.isSafeInteger(team.points) ||
      team.points < 0 || team.points > 9 || typeof team.champion !== "boolean"))
    deny("تعذر التحقق من سجل السهرة", 409, "INVALID_HISTORY");
  return s;
}
function present(group: Detail, userId: string) {
  const membership = group.members.find(m => m.userId === userId);
  if (!membership) deny();
  const records = group.nights.map(record => {
    const snapshot = safeSnapshot(record.snapshot, record.nightId);
    if (snapshot.teams.some((team, i) => team.shillaTeamId !== group.teams[i]?.id))
      deny("تعذر التحقق من هوية فريق السهرة", 409, "INVALID_HISTORY");
    return { id: record.id, recordedAt: record.createdAt.toISOString(),
      teams: snapshot.teams.map(({ shillaTeamId, name, points, champion }) => ({
        id: shillaTeamId, name, points, champion,
      })) };
  });
  return { id: group.id, name: group.name, status: group.status, owner: group.ownerId === userId,
    myRole: membership.role, teams: group.teams.map(t => ({ id: t.id, name: t.name, position: t.position })),
    members: group.members.map(member => ({ id: member.id, name: member.user.name, role: member.role })),
    leaderboard: shillaLeaderboard(group.teams, group.nights.map(record => safeSnapshot(record.snapshot, record.nightId))),
    nights: records };
}
export async function listMyShillas(userId: string) {
  requireEnabled();
  const memberships = await db().shillaMembership.findMany({ where: { userId },
    orderBy: { joinedAt: "desc" }, include: { shilla: { select: { id: true, name: true, status: true,
      ownerId: true, _count: { select: { members: true, nights: true } } } } } });
  return memberships.map(item => ({ id: item.shilla.id, name: item.shilla.name,
    status: item.shilla.status, role: item.role, members: item.shilla._count.members,
    nights: item.shilla._count.nights }));
}
export async function createShilla(userId: string, input: z.infer<typeof shillaCreateSchema>) {
  requireEnabled();
  const checked = validateCreate(input);
  const id = randomUUID();
  await db().$transaction(async tx => {
    await tx.$queryRawUnsafe("SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended($1, 0))",
      `shilla-create:${userId}`);
    const owned = await tx.shilla.count({ where: { ownerId: userId } });
    if (owned >= 5) deny("حد إنشاء الشلل خمسة لكل حساب في هذه النسخة", 409, "GROUP_LIMIT");
    await tx.shilla.create({ data: { id, name: checked.name, ownerId: userId,
      members: { create: [{ userId, role: "OWNER" }] },
      teams: { create: checked.teams.map((team, position) => ({ position, name: team.name, nameKey: team.nameKey })) } } });
  });
  return getShillaView(userId, id);
}
export async function getShillaView(userId: string, id: string) {
  requireEnabled(); groupId(id);
  const group = await db().shilla.findUnique({ where: { id }, include: detailInclude });
  if (!group) deny();
  const view = present(group, userId);
  if (group.ownerId !== userId || group.status !== "active") return { ...view, eligibleNights: [] };
  const pending = await db().nightSession.findMany({
    where: { ownerId: userId, phase: "completed", shillaRecord: null },
    orderBy: { createdAt: "desc" }, take: 20,
    select: { id: true, createdAt: true, state: true },
  });
  const expected = group.teams.map(team => team.nameKey);
  const eligibleNights = pending.filter(night => {
    try {
      const state = night.state as { phase?: string; teams?: { name: string }[]; results?: unknown[] };
      return state?.phase === "completed" && state.teams?.length === 2 &&
        state.results?.length === 3 && state.teams.every((team, index) =>
          normalizedName(team.name).nameKey === expected[index]);
    } catch { return false; }
  }).map(night => ({ id: night.id, createdAt: night.createdAt.toISOString() }));
  return { ...view, eligibleNights };
}
export async function createShillaInvite(userId: string, id: string) {
  requireEnabled(); groupId(id);
  const code = randomBytes(32).toString("hex"), now = new Date();
  await db().$transaction(async tx => {
    await tx.$queryRawUnsafe('SELECT "id" FROM "Shilla" WHERE "id"=$1 FOR UPDATE', id);
    const group = await tx.shilla.findUnique({ where: { id }, include: { _count: { select: { members: true } } } });
    if (!group || group.ownerId !== userId) deny();
    if (group.status !== "active") deny("الشلّة مؤرشفة", 409, "ARCHIVED");
    if (group._count.members >= SHILLA_MAX_MEMBERS) deny("اكتمل عدد أعضاء الشلّة", 409, "FULL");
    const active = await tx.shillaInvite.count({ where: { shillaId: id, consumedAt: null, revokedAt: null, expiresAt: { gt: now } } });
    if (active >= SHILLA_MAX_ACTIVE_INVITES) deny("هناك دعوات نشطة كافية؛ انتظر انتهاء إحداها", 409, "INVITE_LIMIT");
    await tx.shillaInvite.create({ data: { shillaId: id, tokenHash: digest(code),
      expiresAt: new Date(now.getTime() + SHILLA_INVITE_DAYS * 86400_000) } });
  });
  // Revealed exactly once: only token hash is persisted.
  return { path: `/shillatak/join/${code}`, expiresAt: new Date(now.getTime() + SHILLA_INVITE_DAYS * 86400_000).toISOString() };
}
export async function previewShillaInvite(userId: string, code: string) {
  requireEnabled();
  if (!/^[0-9a-f]{64}$/i.test(code)) deny("الدعوة غير موجودة");
  const invite = await db().shillaInvite.findUnique({ where: { tokenHash: digest(code.toLowerCase()) },
    include: { shilla: { select: { name: true, status: true, _count: { select: { members: true } },
      members: { where: { userId }, select: { id: true } } } } } });
  if (!invite) deny("الدعوة غير موجودة");
  const open = !invite.consumedAt && !invite.revokedAt && invite.expiresAt > new Date() && invite.shilla.status === "active" &&
    invite.shilla._count.members < SHILLA_MAX_MEMBERS && invite.shilla.members.length === 0;
  return { name: invite.shilla.name, open, alreadyMember: invite.shilla.members.length > 0 };
}
export async function acceptShillaInvite(userId: string, code: string) {
  requireEnabled();
  if (!/^[0-9a-f]{64}$/i.test(code)) deny("الدعوة غير موجودة");
  const invite = await db().shillaInvite.findUnique({ where: { tokenHash: digest(code.toLowerCase()) },
    select: { id: true, shillaId: true } });
  if (!invite) deny("الدعوة غير موجودة");
  const joinedId = await db().$transaction(async tx => {
    await tx.$queryRawUnsafe('SELECT "id" FROM "Shilla" WHERE "id"=$1 FOR UPDATE', invite.shillaId);
    const group = await tx.shilla.findUnique({ where: { id: invite.shillaId },
      include: { _count: { select: { members: true } } } });
    if (!group || group.status !== "active") deny("الدعوة غير متاحة", 409, "INVITE_CLOSED");
    // Recheck after the lock. A forwarded token is single use.
    const current = await tx.shillaInvite.findUnique({ where: { id: invite.id } });
    if (!current || current.consumedAt || current.revokedAt || current.expiresAt <= new Date()) deny("الدعوة مستعملة أو منتهية", 409, "INVITE_CLOSED");
    if (group._count.members >= SHILLA_MAX_MEMBERS) deny("اكتمل عدد أعضاء الشلّة", 409, "FULL");
    if (await tx.shillaMembership.findUnique({ where: { shillaId_userId: { shillaId: group.id, userId } } }))
      deny("أنت عضو بالفعل", 409, "ALREADY_MEMBER");
    await tx.shillaMembership.create({ data: { shillaId: group.id, userId, role: "MEMBER" } });
    await tx.shillaInvite.update({ where: { id: current.id }, data: { consumedAt: new Date() } });
    return group.id;
  });
  return { shillaId: joinedId };
}
export async function attachShillaNight(userId: string, shillaId: string, nightId: string) {
  requireEnabled(); groupId(shillaId); groupId(nightId);
  await db().$transaction(async tx => {
    await tx.$queryRawUnsafe('SELECT "id" FROM "Shilla" WHERE "id"=$1 FOR UPDATE', shillaId);
    const group = await tx.shilla.findUnique({ where: { id: shillaId },
      include: { teams: { orderBy: { position: "asc" } } } });
    if (!group || group.ownerId !== userId) deny();
    if (group.status !== "active") deny("الشلّة مؤرشفة", 409, "ARCHIVED");
    const existing = await tx.shillaNight.findUnique({ where: { nightId } });
    if (existing) {
      if (existing.shillaId === shillaId) return; // Idempotent repeated user click.
      deny("هذه الليلة مسجلة في شلّة أخرى", 409, "ALREADY_LINKED");
    }
    // No client-authoritative score, owner ID, source ID or award fields in this POST.
    const night = await tx.nightSession.findUnique({ where: { id: nightId },
      include: { games: { orderBy: { position: "asc" } } } });
    if (!night || night.ownerId !== userId) deny("السهرة غير موجودة");
    const snapshot = completedSnapshot(night, group.teams);
    await tx.shillaNight.create({ data: { shillaId, nightId, snapshot: json(snapshot),
      sourceDigest: jsonDigest({ nightId, sourceDigests: snapshot.sourceDigests, teams: snapshot.teams }) } });
  }, { timeout: 20_000 });
  return getShillaView(userId, shillaId);
}
export async function archiveShilla(userId: string, id: string) {
  requireEnabled(); groupId(id);
  await db().$transaction(async tx => {
    await tx.$queryRawUnsafe('SELECT "id" FROM "Shilla" WHERE "id"=$1 FOR UPDATE', id);
    const group = await tx.shilla.findUnique({ where: { id } });
    if (!group || group.ownerId !== userId) deny();
    if (group.status === "active") await tx.shilla.update({ where: { id }, data: { status: "archived" } });
  });
  return getShillaView(userId, id);
}
export async function leaveShilla(userId: string, id: string) {
  requireEnabled(); groupId(id);
  await db().$transaction(async tx => {
    await tx.$queryRawUnsafe('SELECT "id" FROM "Shilla" WHERE "id"=$1 FOR UPDATE', id);
    const group = await tx.shilla.findUnique({ where: { id } });
    if (!group) deny();
    if (group.ownerId === userId) deny("لا يستطيع المالك المغادرة دون سياسة نقل ملكية", 409, "OWNER_CANNOT_LEAVE");
    const member = await tx.shillaMembership.findUnique({ where: { shillaId_userId: { shillaId: id, userId } } });
    if (!member) deny();
    await tx.shillaMembership.delete({ where: { id: member.id } });
  });
  return { left: true as const };
}
