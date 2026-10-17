import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// Exercise the actual component callbacks without adding a DOM test dependency.
// Real browser delivery ordering is covered separately by the PostgreSQL E2E test.
const harness = vi.hoisted(() => {
  type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void };
  const slots: Slot[] = [];
  const pending: Array<() => void> = [];
  let cursor = 0;
  return {
    slots, pending,
    reset() { slots.splice(0); pending.splice(0); cursor = 0; },
    render() { cursor = 0; },
    state<T>(initial: T | (() => T)) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === "function" ? (initial as () => T)() : initial };
      return [slots[index].value as T, (next: T | ((previous: T) => T)) => {
        slots[index].value = typeof next === "function" ? (next as (previous: T) => T)(slots[index].value as T) : next;
      }] as const;
    },
    ref<T>(value: T) { const index = cursor++; return (slots[index] ??= { value: { current: value } }).value as { current: T }; },
    effect(effect: () => void | (() => void), deps?: readonly unknown[]) {
      const index = cursor++, previous = slots[index];
      if (previous && deps && previous.deps?.length === deps.length && deps.every((item, i) => Object.is(item, previous.deps?.[i]))) return;
      slots[index] = { deps };
      pending.push(() => { previous?.cleanup?.(); slots[index].cleanup = effect() || undefined; });
    },
    effects() { while (pending.length) pending.shift()!(); },
    cleanup() { for (const slot of slots) slot.cleanup?.(); },
  };
});
const live = vi.hoisted(() => ({ connect: vi.fn() }));
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(), useState: harness.state, useRef: harness.ref, useEffect: harness.effect,
  useCallback: <T,>(callback: T) => callback }));
vi.mock("@/lib/realtime/client", () => ({ connectLive: live.connect }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: { children: import("react").ReactNode }) => <a {...props}>{children}</a> }));
vi.mock("next/image", () => ({ default: () => null }));

import { RoomLive } from "./room-live";
import { RoomHostPanel } from "./room-host-panel";
import type { roomView } from "@/lib/rooms/service";

type View = Awaited<ReturnType<typeof roomView>>;
type LiveOptions = { apply: (value: View, sentAt: number) => void; terminal: () => void };
function view(roomVersion: number, gameVersion: number, round = 1): View {
  return {
    code: "ABCDEF", version: `${roomVersion}:${gameVersion}`, serverNow: "2026-10-16T12:00:00Z", host: false, selfId: "guest-1",
    participants: [{ id: "guest-1", name: "ضيف اصطناعي", teamId: "team-a", ready: true }], submitted: false, voted: false, voteCount: 0, responses: undefined,
    session: { id: "session-1", status: "IN_PROGRESS", version: gameVersion, round,
      categories: [{ id: "c1", title: "فئة اصطناعية" }], cells: [], turnTeamId: "team-a", timerSeconds: 30,
      teams: [{ id: "team-a", name: "الفريق الأول", color: "#123456", score: round === 1 ? 0 : 200, position: 0 }],
      active: { categoryId: "c1", value: 200, question: `سؤال الجولة ${round}`, type: "TEXT", imageUrl: null, options: null,
        answer: null, explanation: null, revealed: false, answeringTeamId: "team-a", phase: "QUESTION", double: false,
        shield: false, remainingMs: 30000, deadlineAt: null, questionId: undefined, originalTeamId: undefined },
    },
  };
}
const flush = async () => { for (let index = 0; index < 8; index++) await Promise.resolve(); };
function renderGuest(initial: View) { harness.render(); return RoomLive({ initial }); }
function renderHost() { harness.render(); return RoomHostPanel({ sessionId: "session-1" }); }
function markup(tree: import("react").ReactNode) { return renderToStaticMarkup(tree).replace(/<!--.*?-->/g, ""); }
function findForm(tree: import("react").ReactNode): import("react").ReactElement<{ onSubmit: (event: { preventDefault: () => void }) => void }> {
  if (tree && typeof tree === "object" && "type" in tree) {
    const element = tree as import("react").ReactElement<{ children?: import("react").ReactNode }>;
    if (element.type === "form") return element as ReturnType<typeof findForm>;
    for (const child of [element.props.children].flat(Infinity)) { try { return findForm(child); } catch { /* search siblings */ } }
  }
  throw Error("The response form was not rendered");
}

describe("room snapshots preserve authoritative monotonic state", () => {
  beforeEach(() => {
    harness.reset(); vi.clearAllMocks();
    vi.stubGlobal("window", { setInterval: vi.fn(() => 1), clearInterval: vi.fn() });
    vi.stubGlobal("document", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    live.connect.mockReturnValue({ close: vi.fn() });
  });
  afterEach(() => { harness.cleanup(); vi.unstubAllGlobals(); });

  it("does not let a delayed successful answer POST replace a later live question or score", async () => {
    const initial = view(1, 2);
    let deliver!: (value: { ok: boolean; json: () => Promise<View> }) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise(resolve => { deliver = resolve; })));
    findForm(renderGuest(initial)).props.onSubmit({ preventDefault() {} });
    harness.effects();
    const options = live.connect.mock.calls[0][0] as LiveOptions;
    options.apply(view(2, 4, 2), Date.now());
    expect(markup(renderGuest(initial))).toContain("سؤال الجولة 2");
    deliver({ ok: true, json: async () => ({ ...view(2, 2), submitted: true }) });
    await flush();
    const after = markup(renderGuest(initial));
    expect(after).toContain("سؤال الجولة 2");
    expect(after).not.toContain("سؤال الجولة 1");
    expect(after).toContain(">200</b>");
  });

  it("rejects old room and game dimensions, but accepts an equal-version own-response refresh", () => {
    const initial = view(3, 4, 2);
    renderGuest(initial); harness.effects();
    const options = live.connect.mock.calls[0][0] as LiveOptions;
    options.apply(view(2, 5, 3), Date.now());
    expect(markup(renderGuest(initial))).toContain("سؤال الجولة 2");
    options.apply(view(4, 3, 1), Date.now());
    expect(markup(renderGuest(initial))).toContain("سؤال الجولة 2");
    options.apply({ ...initial, submitted: true }, Date.now());
    expect(markup(renderGuest(initial))).toContain("وصلت إجابتك");
  });

  it("ignores snapshots belonging to another room or session", () => {
    const initial = view(1, 2);
    renderGuest(initial); harness.effects();
    const options = live.connect.mock.calls[0][0] as LiveOptions;
    options.apply({ ...view(4, 5, 3), code: "UVWXYZ" }, Date.now());
    options.apply({ ...view(4, 5, 3), session: { ...view(4, 5, 3).session, id: "session-other" } }, Date.now());
    expect(markup(renderGuest(initial))).toContain("سؤال الجولة 1");
  });

  it("does not restore a question from an in-flight successful POST after terminal access loss", async () => {
    const initial = view(1, 2);
    let deliver!: (value: { ok: boolean; json: () => Promise<View> }) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise(resolve => { deliver = resolve; })));
    findForm(renderGuest(initial)).props.onSubmit({ preventDefault() {} });
    harness.effects();
    (live.connect.mock.calls[0][0] as LiveOptions).terminal();
    expect(markup(renderGuest(initial))).not.toContain("سؤال الجولة 1");
    deliver({ ok: true, json: async () => ({ ...initial, submitted: true }) });
    await flush();
    expect(markup(renderGuest(initial))).not.toContain("سؤال الجولة 1");
  });

  it("does not regress the host roster or displayed answers when an older snapshot arrives", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ code: "ABCDEF" }) })));
    renderHost(); harness.effects(); await flush();
    renderHost(); harness.effects();
    const options = live.connect.mock.calls[0][0] as LiveOptions;
    const newer = { ...view(3, 4), host: true, participants: [...view(3, 4).participants, { id: "guest-2", name: "ضيف ثان", teamId: "team-a", ready: true }], responses: [{ name: "ضيف ثان", teamId: "team-a", response: { text: "إجابة حديثة" } }] };
    options.apply(newer, Date.now());
    expect(markup(renderHost())).toContain("2 لاعب في الغرفة · 2 جاهزون");
    options.apply({ ...view(2, 3), host: true, responses: [] }, Date.now());
    const after = markup(renderHost());
    expect(after).toContain("2 لاعب في الغرفة · 2 جاهزون");
    expect(after).toContain("إجابة حديثة");
  });
});
