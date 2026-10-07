import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { RoomLive } from "@/components/room-live";
import { roomView, RoomError } from "@/lib/rooms/service";
export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  let view;
  try { view = await roomView(code); }
  catch (error) { if (error instanceof RoomError && error.status === 403) redirect(`/join?code=${encodeURIComponent(code)}`);
    if (error instanceof RoomError && error.status === 404) notFound(); throw error; }
  const joinQr = view.host && view.session.status === "LOBBY" ? await QRCode.toDataURL(new URL(`/join?code=${view.code}`, process.env.APP_URL ?? "http://localhost:3000").href, { width: 240, margin: 2 }) : undefined;
  return <RoomLive initial={view} joinQr={joinQr} />;
}
