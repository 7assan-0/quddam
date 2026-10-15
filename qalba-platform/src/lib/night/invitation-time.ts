/**
 * Resolve a datetime-local value in the displayed IANA zone, independently of
 * the browser/server default zone. A DST gap has no instant and a fold has two;
 * neither can safely be converted without the organizer choosing another time.
 */
export function invitationLocalInstant(local: string, timezone: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!match || /^[+-]/.test(timezone)) return null;
  const [, year, month, day, hour, minute] = match;
  const parts = [year, month, day, hour, minute].map(Number);
  const wall = new Date(0);
  wall.setUTCFullYear(parts[0], parts[1] - 1, parts[2]);
  wall.setUTCHours(parts[3], parts[4], 0, 0);
  if (wall.getUTCFullYear() !== parts[0] || wall.getUTCMonth() !== parts[1] - 1 ||
      wall.getUTCDate() !== parts[2] || wall.getUTCHours() !== parts[3] || wall.getUTCMinutes() !== parts[4]) return null;
  try {
    const formatter = new Intl.DateTimeFormat("en-US-u-ca-gregory-nu-latn", {
      timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    });
    const inZone = (instant: number) => {
      const fields = Object.fromEntries(formatter.formatToParts(instant).map(part => [part.type, part.value]));
      const date = new Date(0);
      date.setUTCFullYear(Number(fields.year), Number(fields.month) - 1, Number(fields.day));
      date.setUTCHours(Number(fields.hour), Number(fields.minute), 0, 0);
      return date.getTime();
    };
    // Current IANA offsets lie within 24 hours. Sampling both sides of the
    // local date includes the offsets before and after a DST transition.
    const offsets = new Set<number>();
    for (let hours = -36; hours <= 36; hours += 6) {
      const sample = wall.getTime() + hours * 3_600_000;
      offsets.add(inZone(sample) - sample);
    }
    const candidates = [...offsets].map(offset => wall.getTime() - offset)
      .filter(instant => inZone(instant) === wall.getTime());
    return candidates.length === 1 ? new Date(candidates[0]).toISOString() : null;
  } catch { return null; }
}
