import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getBoardSession } from "@/lib/games/category-board/service";
import { GameRuleError } from "@/lib/games/category-board/module";
import { BoardHost } from "@/components/board-host";
import { db } from "@/lib/db";
import { getPartySession } from "@/lib/games/party/service";
import { PartyError } from "@/lib/games/party/types";
import { PartyHost } from "@/components/party-host";

export default async function PlayBoardPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const kind = await db().gameSession.findUnique({ where: { id }, select: { gameType: { select: { slug: true } } } });
  if (kind && kind.gameType.slug !== "category-board") {
    let party;
    try { party = await getPartySession(user.id, id); }
    catch (error) { if (error instanceof PartyError && [403, 404].includes(error.status)) notFound(); throw error; }
    return <PartyHost initial={party} />;
  }
  let session;
  try { session = await getBoardSession(user.id, id); }
  catch (error) { if (error instanceof GameRuleError && [403, 404].includes(error.status)) notFound(); throw error; }
  return <BoardHost initial={session} />;
}
