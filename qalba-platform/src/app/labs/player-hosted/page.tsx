import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PlayerHostedLab } from "@/components/player-hosted-lab";

export const metadata: Metadata = {
  title: "مختبر P2P | قدّام",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/** Never expose the prototype from an ordinary production deployment. */
export default function Page() {
  if (process.env.ENABLE_PLAYER_HOSTED_LAB !== "true") notFound();
  return <PlayerHostedLab />;
}
