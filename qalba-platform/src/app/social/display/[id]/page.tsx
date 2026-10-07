import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getSocialView } from "@/lib/games/social-deduction/service";
import { SocialError } from "@/lib/games/social-deduction/module";
import { SocialDisplay } from "@/components/social-display";
export default async function SocialDisplayPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> }) {
  const { id } = await params; const token = (await searchParams).token ?? "";
  let view; try { view = await getSocialView(id, { kind: "DISPLAY", token }); }
  catch (error) { if (error instanceof SocialError && [403, 404].includes(error.status)) notFound(); throw error; }
  const joinUrl = new URL(`/social/join?code=${view.code}`, process.env.APP_URL ?? "http://localhost:3000").href;
  return <SocialDisplay initial={view} token={token} joinQr={await QRCode.toDataURL(joinUrl, { width: 230, margin: 2 })} />;
}
