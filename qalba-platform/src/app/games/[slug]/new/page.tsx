import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { partySlugs, type PartySlug } from "@/lib/games/party/types";
import { PartySetup } from "@/components/party-setup";
import { isLaunchCreationAllowed } from "@/lib/games/launch-policy";
export default async function NewPartyPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireUser(); const { slug } = await params;
  if (!isLaunchCreationAllowed(slug, `/api/games/party/${slug}`) || !partySlugs.includes(slug as PartySlug)) notFound();
  const game = await db().gameType.findUnique({ where: { slug } }); if (!game?.enabled) notFound();
  return <PartySetup slug={slug as PartySlug} title={game.title} />;
}
