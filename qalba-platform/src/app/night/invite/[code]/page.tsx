import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { NightInviteRsvp } from "@/components/night-invite-rsvp";
import { inviteCodePattern } from "@/lib/night/invitation";

export const metadata: Metadata = { title: "دعوة ليلة قدّام", robots: { index: false, follow: false } };
export default async function NightInvitationPage({ params }: { params: Promise<{ code: string }> }) {
  if (process.env.ENABLE_NIGHT_OF_QUDDAM !== "true") notFound();
  const { code } = await params;
  if (!inviteCodePattern.test(code)) notFound();
  return <NightInviteRsvp code={code.toLowerCase()} />;
}
