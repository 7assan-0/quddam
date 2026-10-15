import { notFound } from "next/navigation";
import { PlayerHostedRooms } from "@/components/player-hosted-rooms";

export const metadata = { title: "غرف قدّام التجريبية", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";
export default function Page() {
  if (process.env.ENABLE_PLAYER_HOSTED_ROOMS !== "true") notFound();
  return <PlayerHostedRooms />;
}
