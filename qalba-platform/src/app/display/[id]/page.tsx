import { notFound } from "next/navigation";
import { BoardDisplay } from "@/components/board-display";
import { getBoardDisplaySession } from "@/lib/games/category-board/display-access";
import { GameRuleError } from "@/lib/games/category-board/module";

export default async function TokenDisplayPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;
  let session;
  try { session = await getBoardDisplaySession(id, token ?? ""); }
  catch (error) { if (error instanceof GameRuleError && [403, 404].includes(error.status)) notFound(); throw error; }
  return <BoardDisplay initial={session} displayToken={token!} />;
}
