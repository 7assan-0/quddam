import { randomBytes, randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { nightEnabled, nightGameTitle } from "./catalog";
import { attendeeCookieName, digestCapability, invitationResponse, InviteInputError, inviteCodePattern,
  inviteInputSchema, MAX_INVITE_ATTENDEES, MAX_INVITE_MUTATIONS_PER_MINUTE, normalizeAttendeeName, rsvpInputSchema,
  validVote, validateSchedule, type RsvpInput } from "./invitation";

function enabled() { if (!nightEnabled()) throw new InviteInputError("غير متاح", 404); }
function codeHash(code: string) {
  if (!inviteCodePattern.test(code)) throw new InviteInputError("الدعوة غير موجودة", 404);
  return digestCapability(code.toLowerCase());
}
const include = {
  night: { select: { phase: true, games: { select: { gameSlug: true }, orderBy: { position: "asc" as const } } } },
  guests: { select: { capabilityHash: true, name: true, nameKey: true, rsvp: true, gameVote: true } },
} as const;
function project(invite: {
  scheduledAt: Date; timezone: string; expiresAt: Date; status: string;
  night: { phase: string; games: { gameSlug: string }[] };
  guests: { capabilityHash: string; name: string; rsvp: string; gameVote: string | null }[];
}, now: Date, capability?: string) {
  const mine = capability && /^[a-f0-9]{64}$/i.test(capability)
    ? invite.guests.find(g => g.capabilityHash === digestCapability(capability.toLowerCase())) ?? null : null;
  return invitationResponse({ scheduledAt: invite.scheduledAt, timezone: invite.timezone,
    expiresAt: invite.expiresAt, status: invite.status, nightPhase: invite.night.phase,
    games: invite.night.games, guests: invite.guests,
    mine: mine ? { name: mine.name, rsvp: mine.rsvp, gameVote: mine.gameVote } : null,
  }, now);
}
export async function createInvitation(ownerId: string, nightId: string,
  input: { scheduledAt: string; timezone: string }, now?: Date) {
  enabled();
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(nightId)) throw new InviteInputError("السهرة غير موجودة", 404);
  const parsed = inviteInputSchema.safeParse(input);
  if (!parsed.success) throw new InviteInputError("حقول موعد الدعوة غير صالحة", 400);
  const code = randomBytes(32).toString("hex");
  const result = await db().$transaction(async tx => {
    await tx.$queryRawUnsafe('SELECT "id" FROM "NightSession" WHERE "id"=$1 FOR UPDATE', nightId);
    const night = await tx.nightSession.findUnique({ where: { id: nightId }, select: { ownerId: true, phase: true } });
    if (!night || night.ownerId !== ownerId) throw new InviteInputError("السهرة غير موجودة", 404);
    if (night.phase !== "preparing") throw new InviteInputError("أنشئ الدعوة قبل بدء اللعب", 409);
    if (await tx.nightInvitation.findUnique({ where: { nightId } }))
      throw new InviteInputError("لهذه السهرة دعوة بالفعل؛ احتفظ بالرابط بعد إنشائه", 409);
    // The transaction may have waited on START or another invitation request.
    // Validate the scheduling window against the clock after acquiring its lock.
    const checkedAt = now ?? new Date();
    const scheduledAt = validateSchedule(parsed.data, checkedAt);
    const expiresAt = new Date(Math.min(scheduledAt.getTime() + 86400_000, checkedAt.getTime() + 91 * 86400_000));
    return tx.nightInvitation.create({ data: { id: randomUUID(), nightId, tokenHash: digestCapability(code),
      scheduledAt, timezone: parsed.data.timezone, expiresAt } });
  });
  // The un-hashed bearer link is revealed once to the authenticated organizer, never stored.
  return { path: `/night/invite/${code}`, scheduledAt: result.scheduledAt.toISOString(),
    timezone: result.timezone, expiresAt: result.expiresAt.toISOString() };
}
/**
 * Owner-only irreversible revocation. Uses the same Night -> Invitation lock order
 * as RSVP and START, so a concurrent RSVP is either committed before revocation
 * or rejected after it. Preserve historical guest responses and vote aggregates.
 * Never store/recover the raw bearer or create a replacement implicitly.
 */
export async function revokeInvitation(ownerId: string, nightId: string) {
  enabled();
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(nightId)) throw new InviteInputError("السهرة غير موجودة", 404);
  return db().$transaction(async tx => {
    await tx.$queryRawUnsafe('SELECT "id" FROM "NightSession" WHERE "id"=$1 FOR UPDATE', nightId);
    const night = await tx.nightSession.findUnique({ where: { id: nightId }, select: { ownerId: true } });
    if (!night || night.ownerId !== ownerId) throw new InviteInputError("السهرة غير موجودة", 404);
    const invite = await tx.nightInvitation.findUnique({ where: { nightId }, select: { id: true } });
    if (!invite) throw new InviteInputError("الدعوة غير موجودة", 404);
    await tx.$queryRawUnsafe('SELECT "id" FROM "NightInvitation" WHERE "id"=$1 FOR UPDATE', invite.id);
    const current = await tx.nightInvitation.findUnique({ where: { id: invite.id }, select: { status: true } });
    if (!current) throw new InviteInputError("الدعوة غير موجودة", 404);
    if (current.status === "open")
      await tx.nightInvitation.update({ where: { id: invite.id }, data: { status: "revoked" } });
    // Idempotent retry after a lost successful DELETE response.
    return { revoked: current.status === "open" || current.status === "revoked" };
  }, { timeout: 12_000 });
}
export async function ownerInvitation(ownerId: string, nightId: string) {
  enabled();
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(nightId)) throw new InviteInputError("السهرة غير موجودة", 404);
  const night = await db().nightSession.findUnique({ where: { id: nightId }, select: { ownerId: true,
    games: { select: { gameSlug: true }, orderBy: { position: "asc" } },
    invitation: { include: { guests: { select: { rsvp: true, gameVote: true } } } } } });
  if (!night || night.ownerId !== ownerId) throw new InviteInputError("السهرة غير موجودة", 404);
  const inv = night.invitation;
  if (!inv) return { exists: false as const };
  return { exists: true as const, status: inv.status, scheduledAt: inv.scheduledAt.toISOString(), timezone: inv.timezone,
    coming: inv.guests.filter(g => g.rsvp === "YES").length, declined: inv.guests.filter(g => g.rsvp === "NO").length,
    votes: night.games.map(slot => ({ game: slot.gameSlug, title: nightGameTitle(slot.gameSlug), count: inv.guests.filter(g => g.rsvp === "YES" && g.gameVote === slot.gameSlug).length })),
    /** Link is intentionally unavailable after one-time creation; only a hash is retained. */
    linkRecoverable: false as const };
}
export async function getPublicInvitation(code: string, capability?: string, now = new Date()) {
  enabled();
  const invite = await db().nightInvitation.findUnique({ where: { tokenHash: codeHash(code) }, include });
  if (!invite || invite.status === "revoked") throw new InviteInputError("الدعوة غير موجودة", 404);
  return { id: invite.id, view: project(invite, now, capability),
    cookieName: attendeeCookieName(invite.id), expiresAt: invite.expiresAt };
}
export async function respondToInvitation(code: string, input: RsvpInput, capability?: string, now?: Date) {
  enabled();
  if (!rsvpInputSchema.safeParse(input).success) throw new InviteInputError("حقول الرد على الدعوة غير صالحة", 400);
  const tokenHash = codeHash(code);
  const named = normalizeAttendeeName(input.name);
  const invite = await db().nightInvitation.findUnique({ where: { tokenHash }, select: { id: true, nightId: true } });
  if (!invite) throw new InviteInputError("الدعوة غير موجودة", 404);
  const suppliedHash = capability && /^[a-f0-9]{64}$/i.test(capability) ? digestCapability(capability.toLowerCase()) : null;
  // The anonymous capability may be issued on GET, so a lost first POST reply can be retried.
  const newCapability = suppliedHash ? capability!.toLowerCase() : randomBytes(32).toString("hex");
  try {
    return await db().$transaction(async tx => {
      // Match the Night command lock order: no acceptance after the organizer starts play.
      await tx.$queryRawUnsafe('SELECT "id" FROM "NightSession" WHERE "id"=$1 FOR UPDATE', invite.nightId);
      // Serialize all mutations of one invitation, including simultaneous joins and rates.
      await tx.$queryRawUnsafe('SELECT "id" FROM "NightInvitation" WHERE "id"=$1 FOR UPDATE', invite.id);
      const checkedAt = now ?? new Date();
      const current = await tx.nightInvitation.findUnique({ where: { id: invite.id }, include });
      if (!current) throw new InviteInputError("الدعوة غير موجودة", 404);
      if (current.status !== "open" || current.expiresAt <= checkedAt || current.night.phase !== "preparing")
        throw new InviteInputError("انتهى استقبال الردود على هذه الدعوة", 409);
      validVote(input.gameVote, current.night.games.map(g => g.gameSlug), input.rsvp);
      const existing = suppliedHash ? current.guests.find(g => g.capabilityHash === suppliedHash) : null;
      if (existing && existing.name !== named.display) throw new InviteInputError("لا يمكن تغيير اسم هذا الرد", 409);
      // A committed first response may have been lost on the network. An exact
      // replay is a read-only confirmation, not another vote or mutation; all
      // closure checks above still apply, including the exact expiry boundary.
      if (existing && existing.rsvp === input.rsvp && existing.gameVote === input.gameVote)
        return { view: project(current, checkedAt, capability), cookieName: attendeeCookieName(current.id),
          cookieValue: capability!, expiresAt: current.expiresAt };
      const windowReset = checkedAt.getTime() - current.rateWindowAt.getTime() >= 60_000;
      const used = windowReset ? 0 : current.rateCount;
      if (used >= MAX_INVITE_MUTATIONS_PER_MINUTE) throw new InviteInputError("طلبات كثيرة؛ حاول لاحقًا", 429);
      if (existing) {
        await tx.nightInviteGuest.update({ where: { capabilityHash: existing.capabilityHash },
          data: { rsvp: input.rsvp, gameVote: input.gameVote } });
      } else {
        if (current.guests.length >= MAX_INVITE_ATTENDEES) throw new InviteInputError("اكتمل عدد ردود الدعوة", 409);
        if (current.guests.some(g => g.nameKey === named.key)) throw new InviteInputError("الاسم مستخدم في هذه الدعوة", 409);
        await tx.nightInviteGuest.create({ data: { inviteId: current.id, capabilityHash: digestCapability(newCapability),
          name: named.display, nameKey: named.key, rsvp: input.rsvp, gameVote: input.gameVote } });
      }
      await tx.nightInvitation.update({ where: { id: current.id },
        data: { rateWindowAt: windowReset ? checkedAt : current.rateWindowAt, rateCount: used + 1 } });
      const saved = await tx.nightInvitation.findUniqueOrThrow({ where: { id: current.id }, include });
      return { view: project(saved, checkedAt, existing ? capability : newCapability),
        cookieName: attendeeCookieName(current.id), cookieValue: existing ? capability! : newCapability,
        expiresAt: current.expiresAt };
    }, { timeout: 12_000 });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002")
      throw new InviteInputError("هذا الاسم مستخدم في الدعوة", 409);
    throw error;
  }
}
