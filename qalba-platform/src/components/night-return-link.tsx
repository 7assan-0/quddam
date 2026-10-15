import Link from "next/link";
import { nightEnabled, type NightGameSlug } from "@/lib/night/catalog";
import { findNightForSource } from "@/lib/night/service";

/** Resolve only the persisted, owner-scoped binding; URL hints confer no access. */
export async function NightReturnLink({ ownerId, game, sourceId }: { ownerId: string; game: NightGameSlug; sourceId: string }) {
  if (!nightEnabled()) return null;
  const night = await findNightForSource(ownerId, game, sourceId);
  if (!night) return null;
  return <div className="shell" style={{ marginBlock: "1rem" }}><Link className="btn btn-secondary" href={`/night/${night.id}`} data-testid="night-return-link">العودة إلى ليلة قدّام</Link><p className="form-note">للسهرة: أكملوا جميع الجولات ثم «أكمل المباراة». إنهاء المباراة مبكرًا أو إعادة المباراة نفسها لا يُعتمد للسهرة؛ احتفظوا بنتيجتها المكتملة وعودوا إلى لوحة السهرة.</p></div>;
}
