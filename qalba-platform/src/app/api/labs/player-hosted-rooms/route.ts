import { SignalingStore, signalingRequest } from "@/lib/player-hosted/rooms/signaling";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const processStore = globalThis as typeof globalThis & {
  quddamRooms?: SignalingStore; quddamRoomsSweep?: ReturnType<typeof setInterval>;
};
const store = processStore.quddamRooms ??= new SignalingStore();
// Expire SDP/capabilities even when no more requests arrive. One unref'd timer per process.
processStore.quddamRoomsSweep ??= setInterval(() => store.expire(), 5_000).unref();
export async function POST(request: Request) {
  return signalingRequest(request, store, process.env.ENABLE_PLAYER_HOSTED_ROOMS === "true"
    ? process.env.PLAYER_HOSTED_SIGNALING_ORIGIN : undefined);
}
