import { completeIce } from "../session";
import { parseSessionDescription } from "../lab";
import { acceptBuzz, CHANNEL, hostAction, initialState, newer, parseIntent, parseSnapshot,
  type GameState, type HostAction } from "./protocol";
import { ApiError, requestSignal, type SignalingClient } from "./client";
import type { Credentials, SignalInput, SignalPeer } from "./signaling";

export type ConnectionPhase = "idle" | "creating" | "joining" | "waiting" | "connecting" | "connected" | "failed" | "closed";
export type RoomView = { phase: ConnectionPhase; status: string; role: "host" | "guest" | null;
  code: string; slot: number; expires: number; state: GameState;
  players: { slot: number; connected: boolean }[]; retries: number };
export const emptyView = (): RoomView => ({ phase: "idle", status: "أنشئ غرفة أو انضم برمز الدعوة.",
  role: null, code: "", slot: 0, expires: 0, state: initialState(), players: [], retries: 0 });
type Link = { peer: RTCPeerConnection; channel?: RTCDataChannel; abort: AbortController;
  generation: number; slot: number; connected: boolean; failed: boolean; applying: boolean;
  deadline?: ReturnType<typeof setTimeout>; packets: number; window: number };

/** One star topology: host owns N disposable RTC links; guests each own exactly one. */
export class RoomController {
  private view = emptyView();
  private credentials?: Credentials;
  private links = new Map<number, Link>();
  private lifetime = new AbortController();
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private disposed = false;
  private errors = 0;
  private lastVersion = -1;
  private lastBuzzRound = -1;
  private retrying = false;
  constructor(private notify: (view: RoomView) => void,
    private api: SignalingClient = requestSignal,
    private factory: () => RTCPeerConnection = () => new RTCPeerConnection({ iceServers: [] }),
    private pollMs = 1_000) {}

  private publish(patch: Partial<RoomView> = {}) {
    if (this.disposed) return;
    this.view = { ...this.view, ...patch }; this.notify(this.view);
  }
  private auth() { return { code: this.credentials!.code, token: this.credentials!.token, epoch: this.credentials!.epoch }; }
  private live(link: Link) { return !this.stopped && !link.failed && this.links.get(link.slot) === link; }
  private playable(link: Link) {
    return this.live(link) && link.connected && link.peer.connectionState === "connected" && link.channel?.readyState === "open";
  }
  private closeLink(link: Link) {
    link.failed = true; link.connected = false;
    clearTimeout(link.deadline); link.abort.abort();
    if (link.channel) {
      link.channel.onopen = link.channel.onclose = link.channel.onerror = link.channel.onmessage = null;
      link.channel.close();
    }
    link.peer.onconnectionstatechange = link.peer.ondatachannel = null; link.peer.close();
  }
  private refresh() {
    if (this.stopped) return;
    const players = [...this.links.values()].map(link => ({ slot: link.slot, connected: this.playable(link) }));
    const connected = players.some(player => player.connected);
    const failed = this.view.role === "guest" && [...this.links.values()].some(link => link.failed);
    const phase = connected ? "connected" : failed ? "failed" : this.links.size ? "connecting" : "waiting";
    this.publish({ players, phase, status: connected ? "الاتصال جاهز؛ جهاز الهوست يدير الجولة." : failed
      ? "تعذر الاتصال المباشر. تحقق من الشبكة ثم اختر إعادة الاتصال." : "بانتظار اتصال اللاعبين…" });
  }
  private failLink(link: Link) {
    if (!this.live(link)) return;
    this.closeLink(link); this.refresh();
  }
  private send(link: Link, raw: string) {
    if (!this.playable(link)) return false;
    try {
      if (link.channel!.bufferedAmount > 65_536) throw new Error("backpressure");
      link.channel!.send(raw); return true;
    } catch { this.failLink(link); return false; }
  }
  private change(next: GameState) {
    if (next === this.view.state) return;
    this.publish({ state: next });
    for (const link of this.links.values()) this.send(link, JSON.stringify(next));
  }
  private activate(link: Link) {
    if (!this.live(link) || link.connected || link.channel?.readyState !== "open" || link.peer.connectionState !== "connected") return;
    clearTimeout(link.deadline); link.connected = true; this.refresh();
    if (this.view.role === "host") {
      this.send(link, JSON.stringify(this.view.state));
      void this.signal({ op: "connected", ...this.auth(), peer: link.slot, generation: link.generation }, link);
    }
  }
  private attach(link: Link, channel: RTCDataChannel) {
    if (!this.live(link) || link.channel || channel.label !== CHANNEL || !channel.ordered ||
      channel.maxRetransmits !== null || channel.maxPacketLifeTime !== null) { channel.close(); return; }
    link.channel = channel;
    channel.onopen = () => this.activate(link);
    channel.onclose = channel.onerror = () => this.failLink(link);
    channel.onmessage = event => {
      // A reliable snapshot can arrive before the browser fires peer-connected.
      // Keep guest state current, but allow host-side gameplay only on a fully live link.
      if (!this.live(link) || channel.readyState !== "open" || (this.view.role === "host" && !this.playable(link))) return;
      const now = Date.now();
      if (now - link.window >= 1_000) { link.window = now; link.packets = 0; }
      if (++link.packets > 30 || typeof event.data !== "string" || event.data.length > 1024) { this.failLink(link); return; }
      if (this.view.role === "host") {
        const intent = parseIntent(event.data);
        if (intent) this.change(acceptBuzz(this.view.state, link.slot, intent.round));
      } else {
        const next = parseSnapshot(event.data);
        if (next && newer(this.view.state, next, this.lastVersion)) {
          this.lastVersion = next.version; this.publish({ state: next });
        }
      }
    };
    this.activate(link);
  }
  private makeLink(remote: SignalPeer): Link {
    const previous = this.links.get(remote.slot);
    if (previous) this.closeLink(previous);
    const peer = this.factory();
    const link: Link = { peer, abort: new AbortController(), generation: remote.generation,
      slot: remote.slot, connected: false, failed: false, applying: false, packets: 0, window: Date.now() };
    this.links.set(remote.slot, link);
    link.deadline = setTimeout(() => this.failLink(link), 30_000);
    peer.onconnectionstatechange = () => {
      if (["failed", "disconnected", "closed"].includes(peer.connectionState)) this.failLink(link);
      else this.activate(link);
    };
    peer.ondatachannel = event => {
      if (this.view.role !== "guest") event.channel.close(); else this.attach(link, event.channel);
    };
    return link;
  }
  private async signal(input: SignalInput, link: Link) {
    if (!this.live(link)) return;
    try { await this.api(input, link.abort.signal); }
    catch { if (this.live(link)) this.failLink(link); }
  }
  private async offer(remote: SignalPeer) {
    let link: Link | undefined;
    try {
      link = this.makeLink(remote); this.refresh();
      this.attach(link, link.peer.createDataChannel(CHANNEL, { ordered: true }));
      const offer = await link.peer.createOffer();
      if (!this.live(link)) return;
      await link.peer.setLocalDescription(offer);
      if (!this.live(link)) return;
      await completeIce(link.peer, link.abort.signal);
      if (!this.live(link) || !link.peer.localDescription) return;
      await this.signal({ op: "signal", ...this.auth(), peer: link.slot, generation: link.generation,
        description: { type: "offer", sdp: link.peer.localDescription.sdp } }, link);
    } catch { if (link) this.failLink(link); else this.end("تعذر تجهيز الاتصال على هذا المتصفح."); }
  }
  private async answer(remote: SignalPeer) {
    let link: Link | undefined;
    try {
      const description = parseSessionDescription(JSON.stringify(remote.description), "offer");
      link = this.makeLink(remote); this.refresh();
      await link.peer.setRemoteDescription(description);
      if (!this.live(link)) return;
      const answer = await link.peer.createAnswer();
      if (!this.live(link)) return;
      await link.peer.setLocalDescription(answer);
      if (!this.live(link)) return;
      await completeIce(link.peer, link.abort.signal);
      if (!this.live(link) || !link.peer.localDescription) return;
      await this.signal({ op: "signal", ...this.auth(), peer: link.slot, generation: link.generation,
        description: { type: "answer", sdp: link.peer.localDescription.sdp } }, link);
    } catch { if (link) this.failLink(link); else this.end("تعذر تجهيز الاتصال على هذا المتصفح."); }
  }
  private async applyAnswer(link: Link, remote: SignalPeer) {
    link.applying = true;
    try {
      const description = parseSessionDescription(JSON.stringify(remote.description), "answer");
      await link.peer.setRemoteDescription(description);
    } catch { this.failLink(link); }
  }
  private sync(peers: SignalPeer[]) {
    for (const remote of peers) {
      const link = this.links.get(remote.slot);
      if (link && remote.generation < link.generation) continue;
      if (!remote.active) { if (link && !link.failed) this.closeLink(link); continue; }
      if (this.view.role === "host") {
        if (!link || link.generation !== remote.generation) void this.offer(remote);
        else if (remote.description && !link.applying && this.live(link)) void this.applyAnswer(link, remote);
      } else if (remote.description && (!link || link.generation !== remote.generation)) void this.answer(remote);
    }
    this.refresh();
  }
  private async poll() {
    if (this.stopped || !this.credentials) return;
    try {
      const reply = await this.api({ op: "poll", ...this.auth() }, this.lifetime.signal);
      if (this.stopped) return;
      this.errors = 0; this.sync(reply.peers ?? []);
    } catch (error) {
      if (this.stopped) return;
      if ((error instanceof ApiError && [403, 410].includes(error.status)) || ++this.errors >= 3) {
        this.end(error instanceof ApiError ? error.message : "فُقد الاتصال بالغرفة؛ أُغلقت الجلسة بأمان."); return;
      }
      this.publish({ status: "انقطع الاتصال بالغرفة مؤقتًا؛ جارٍ التحقق…" });
    }
    if (!this.stopped) this.timer = setTimeout(() => void this.poll(), this.pollMs * Math.max(1, this.errors));
  }
  async start(mode: "host" | "guest", code = "", saved?: Credentials) {
    if (this.view.phase !== "idle" || this.stopped) return;
    this.publish({ phase: mode === "host" ? "creating" : "joining", status: "جارٍ تجهيز الغرفة…" });
    try {
      const reply = await this.api(mode === "host" ? { op: "create" } : saved?.role === "guest" && saved.code === code
        ? { op: "resume", code, token: saved.token, epoch: saved.epoch } : { op: "join", code }, this.lifetime.signal);
      const credentials = reply.credentials;
      if (this.stopped) {
        if (credentials) void this.api({ op: "leave", code: credentials.code, token: credentials.token, epoch: credentials.epoch }, undefined, true).catch(() => {});
        return;
      }
      if (!credentials || credentials.role !== mode || (mode === "guest" && credentials.slot === 0)) throw new Error("invalid role");
      this.credentials = credentials;
      this.publish({ role: mode, code: credentials.code, slot: credentials.slot, expires: credentials.expires,
        retries: mode === "guest" ? credentials.epoch - 1 : 0, phase: "waiting" });
      void this.poll(); return credentials;
    } catch (error) {
      if (!this.stopped) this.end(error instanceof ApiError ? error.message : "تعذر إنشاء الاتصال بالغرفة.");
    }
  }
  async retry() {
    if (this.stopped || this.retrying || this.view.role !== "guest" || this.view.phase !== "failed" || this.view.retries >= 3) return;
    this.retrying = true;
    this.publish({ retries: this.view.retries + 1, phase: "connecting", status: "جارٍ إعادة الاتصال…" });
    try {
      const reply = await this.api({ op: "retry", ...this.auth() }, this.lifetime.signal);
      if (this.stopped) return;
      for (const link of this.links.values()) this.closeLink(link);
      this.credentials = reply.credentials!;
      this.links.clear(); this.refresh();
      return this.credentials;
    } catch (error) {
      if (!this.stopped) this.end(error instanceof ApiError ? error.message : "تعذرت إعادة الاتصال. اطلب غرفة جديدة.");
    } finally { this.retrying = false; }
  }
  action(action: HostAction) {
    if (this.stopped || this.view.role !== "host" || ![...this.links.values()].some(link => this.playable(link))) return;
    this.change(hostAction(this.view.state, action));
  }
  /** Every participant has a buzzer. Host A is a real player in slot 0, not a spectator. */
  buzz() {
    if (this.stopped || this.view.state.phase !== "open" || this.lastBuzzRound === this.view.state.round) return;
    if (this.view.role === "host") {
      // A host may only play while the room has a live guest, like opening a round.
      if (![...this.links.values()].some(link => this.playable(link))) return;
      const next = acceptBuzz(this.view.state, 0, this.view.state.round);
      if (next !== this.view.state) {
        this.lastBuzzRound = this.view.state.round;
        this.change(next);
      }
      return;
    }
    if (this.view.role !== "guest") return;
    const link = this.links.get(this.view.slot);
    if (link && this.send(link, JSON.stringify({ type: "BUZZ", round: this.view.state.round }))) this.lastBuzzRound = this.view.state.round;
  }
  private end(status: string) {
    if (this.stopped) return;
    this.stopped = true; clearTimeout(this.timer); this.lifetime.abort();
    for (const link of this.links.values()) this.closeLink(link);
    this.links.clear(); this.credentials = undefined;
    this.publish({ phase: "closed", code: "", players: [], status });
  }
  close() {
    if (this.stopped) return;
    const auth = this.credentials && this.auth();
    this.end("أُغلقت الجلسة والاتصالات. لا تنتقل صلاحيات الهوست إلى أي ضيف.");
    if (auth) void this.api({ op: "leave", ...auth }, undefined, true).catch(() => {});
  }
  dispose() { this.close(); this.disposed = true; }
}
