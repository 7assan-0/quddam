import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { requireUser } from "@/lib/auth/session";
import { getSocialView } from "@/lib/games/social-deduction/service";
import { SocialError } from "@/lib/games/social-deduction/module";
import { SocialHost } from "@/components/social-host";
export default async function SocialHostPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(); let view;
  try { view = await getSocialView((await params).id, { kind: "HOST", id: user.id }); }
  catch (error) { if (error instanceof SocialError && [403, 404].includes(error.status)) notFound(); throw error; }
  const url = new URL(`/social/join?code=${view.code}`, process.env.APP_URL ?? "http://localhost:3000").href;
  return <SocialHost initial={view} joinQr={await QRCode.toDataURL(url, { width: 200, margin: 2 })} />;
}
