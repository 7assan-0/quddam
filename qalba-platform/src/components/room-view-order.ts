import type { roomView } from "@/lib/rooms/service";

type View = Awaited<ReturnType<typeof roomView>>;

function versions(view: View) {
  const match = /^(0|[1-9]\d*):(0|[1-9]\d*)$/.exec(view.version);
  if (!match) return null;
  const room = Number(match[1]), game = Number(match[2]);
  return Number.isSafeInteger(room) && Number.isSafeInteger(game) && game === view.session.version
    ? { room, game } : null;
}

/** Room writes and game commands advance independently. Neither may regress.
 * Equal versions remain useful for the current reader's response/clock refresh.
 */
export function acceptsRoomView(current: View, next: View) {
  const before = versions(current), after = versions(next);
  return current.code === next.code && current.session.id === next.session.id &&
    current.host === next.host && current.selfId === next.selfId && before !== null && after !== null &&
    after.room >= before.room && after.game >= before.game;
}
