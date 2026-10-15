import { createHash } from "node:crypto";
import { z } from "zod";
import { NIGHT_GAMES } from "./catalog";

export const MAX_INVITE_ATTENDEES = 32;
export const MAX_INVITE_MUTATIONS_PER_MINUTE = 60;
export const inviteInputSchema = z.object({
  scheduledAt: z.iso.datetime({ offset: true }),
  timezone: z.string().min(3).max(64),
}).strict();
export const rsvpInputSchema = z.object({
  name: z.string().min(2).max(60),
  rsvp: z.enum(["YES", "NO"]),
  gameVote: z.enum(["top-list", "ordering-challenge", "survey-show"]).nullable(),
}).strict();
export type RsvpInput = z.infer<typeof rsvpInputSchema>;
export const digestCapability = (value: string) => createHash("sha256").update(value).digest("hex");
export const inviteCodePattern = /^[a-f0-9]{64}$/i;
export const attendeeCookieName = (id: string) => `quddam_night_rsvp_${id}`;

export function validateSchedule(input: z.infer<typeof inviteInputSchema>, now: Date) {
  const when = new Date(input.scheduledAt);
  if (!Number.isFinite(when.getTime()) || when.getTime() < now.getTime() + 15 * 60_000 ||
      when.getTime() > now.getTime() + 90 * 86400_000)
    throw new InviteInputError("حدد موعدًا بين 15 دقيقة و90 يومًا من الآن", 400);
  try { new Intl.DateTimeFormat("en", { timeZone: input.timezone }).format(now); }
  catch { throw new InviteInputError("المنطقة الزمنية غير صالحة", 400); }
  return when;
}
export function normalizeAttendeeName(name: unknown) {
  if (typeof name !== "string" || /[\p{Cc}\p{Cf}]/u.test(name))
    throw new InviteInputError("اسم الحاضر غير صالح", 400);
  const cleaned = name.normalize("NFC").trim().replace(/\s+/gu, " ");
  if (cleaned.length < 2 || cleaned.length > 60) throw new InviteInputError("اسم الحاضر بين حرفين و60 حرفًا", 400);
  return { display: cleaned, key: cleaned.toLocaleLowerCase("ar") };
}
export function validVote(vote: RsvpInput["gameVote"], choices: readonly string[], rsvp: RsvpInput["rsvp"]) {
  if (rsvp === "NO" && vote !== null) throw new InviteInputError("التصويت للحاضرين فقط", 400);
  if (vote !== null && (!NIGHT_GAMES.some(game => game.game === vote) || !choices.includes(vote)))
    throw new InviteInputError("اللعبة المختارة غير متاحة في هذه السهرة", 400);
}
export class InviteInputError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
export function invitationResponse(input: {
  scheduledAt: Date; timezone: string; expiresAt: Date; status: string; nightPhase: string;
  games: { gameSlug: string }[];
  guests: { rsvp: string; gameVote: string | null }[];
  mine?: { name: string; rsvp: string; gameVote: string | null } | null;
}, now: Date) {
  const choices = input.games.map(g => g.gameSlug);
  return {
    scheduledAt: input.scheduledAt.toISOString(), timezone: input.timezone,
    open: input.status === "open" && input.nightPhase === "preparing" && input.expiresAt > now,
    games: NIGHT_GAMES.filter(g => choices.includes(g.game)).map(g => ({
      game: g.game, title: g.title, votes: input.guests.filter(x => x.rsvp === "YES" && x.gameVote === g.game).length,
    })),
    coming: input.guests.filter(g => g.rsvp === "YES").length,
    declined: input.guests.filter(g => g.rsvp === "NO").length,
    mine: input.mine ?? null,
  };
}
