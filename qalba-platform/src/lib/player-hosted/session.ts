import {
  awardPoint, buzz, initialLabState, isNewerHostSnapshot, openRound,
  parseGuestIntent, parseHostSnapshot, parseSessionDescription, skipRound, type LabState,
} from "./lab";

export type LabRole = "host" | "guest";
export type HostAction = "open" | "buzz" | "award" | "skip";
export type SessionView = {
  state: LabState; connected: boolean; working: boolean; ended: boolean;
  localSignal: string; remoteApplied: boolean; status: string;
};
export const CHANNEL_LABEL = "quddam-buzzer-poc-v1";
const TIMEOUT_MS = 15_000;
// Manual copy/paste needs more time than ICE gathering itself.
const PAIRING_TIMEOUT_MS = 120_000;

/** Closing/resetting must cancel ICE listeners and the pending timeout immediately. */
export function completeIce(peer: RTCPeerConnection, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer);
      peer.removeEventListener("icegatheringstatechange", changed);
      peer.removeEventListener("connectionstatechange", changed);
      signal.removeEventListener("abort", aborted);
      if (error) reject(error); else resolve();
    };
    const aborted = () => finish(new Error("أُغلقت الجلسة"));
    const changed = () => {
      if (signal.aborted) aborted();
      else if (["failed", "closed"].includes(peer.connectionState)) finish(new Error("فشل تجهيز الاتصال"));
      else if (peer.iceGatheringState === "complete") finish();
    };
    const timer = setTimeout(() => finish(new Error("انتهت مهلة جمع ICE؛ لا توجد خدمة STUN/TURN في التجربة")), TIMEOUT_MS);
    peer.addEventListener("icegatheringstatechange", changed);
    peer.addEventListener("connectionstatechange", changed);
    signal.addEventListener("abort", aborted, { once: true });
    changed();
  });
}

/** One controller owns one peer. Disposed controllers can never publish into a new React session. */
export class LabSession {
  private peer: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private abort: AbortController | null = null;
  private deadline: ReturnType<typeof setTimeout> | undefined;
  private disposed = false;
  private lastVersion = -1;
  private lastBuzzRound = -1;
  private view: SessionView = {
    state: initialLabState(), connected: false, working: false, ended: false,
    localSignal: "", remoteApplied: false, status: "الصق عرض الهوست ثم أنشئ الإجابة",
  };

  constructor(
    readonly role: LabRole,
    private readonly notify: (view: SessionView) => void,
    private readonly createPeer: () => RTCPeerConnection = () => {
      if (typeof RTCPeerConnection === "undefined") throw new Error("WebRTC غير متاح");
      return new RTCPeerConnection({ iceServers: [] });
    },
  ) {}

  private publish(patch: Partial<SessionView>) {
    if (this.disposed) return;
    this.view = { ...this.view, ...patch };
    this.notify(this.view);
  }

  private current(peer: RTCPeerConnection): boolean {
    return !this.disposed && !this.view.ended && this.peer === peer;
  }

  private cleanup() {
    const peer = this.peer, channel = this.channel;
    this.peer = null; this.channel = null;
    clearTimeout(this.deadline); this.deadline = undefined;
    this.abort?.abort(); this.abort = null;
    if (channel) {
      channel.onopen = channel.onclose = channel.onerror = channel.onmessage = null;
      channel.close();
    }
    if (peer) {
      peer.onconnectionstatechange = peer.ondatachannel = null;
      peer.close();
    }
  }

  close(status = "أُغلقت الجلسة. أعد التجربة لإنشاء اتصال جديد.") {
    if (this.disposed || this.view.ended) return;
    this.cleanup();
    this.publish({ connected: false, working: false, ended: true, localSignal: "", status });
  }

  dispose() {
    this.disposed = true;
    this.cleanup();
  }

  private makePeer(): RTCPeerConnection {
    const peer = this.createPeer();
    this.peer = peer; this.abort = new AbortController();
    peer.onconnectionstatechange = () => {
      if (this.current(peer) && ["failed", "closed", "disconnected"].includes(peer.connectionState)) {
        this.close("فُقد الاتصال المباشر؛ الجلسة انتهت ولا تُقبل أوامر أو نقاط جديدة.");
      }
    };
    peer.ondatachannel = event => {
      const channel = event.channel;
      if (!this.current(peer) || this.role !== "guest" || channel.label !== CHANNEL_LABEL ||
        !channel.ordered || channel.maxRetransmits !== null || channel.maxPacketLifeTime !== null) {
        channel.close(); return;
      }
      this.attachChannel(peer, channel);
    };
    return peer;
  }

  private playable(): boolean {
    return !this.disposed && !this.view.ended && this.view.connected &&
      this.peer?.connectionState === "connected" && this.channel?.readyState === "open";
  }

  private send(raw: string): boolean {
    if (!this.playable() || !this.channel) return false;
    try {
      if (this.channel.bufferedAmount > 64 * 1024) throw new Error("قناة مشغولة");
      this.channel.send(raw); return true;
    } catch {
      this.close("تعذر إرسال الرسالة؛ أُغلقت الجلسة دون إعادة إرسال تلقائية."); return false;
    }
  }

  private attachChannel(peer: RTCPeerConnection, channel: RTCDataChannel) {
    if (this.channel) { channel.close(); return; }
    this.channel = channel;
    const active = () => this.current(peer) && this.channel === channel;
    channel.onopen = () => {
      if (!active()) return;
      clearTimeout(this.deadline); this.deadline = undefined;
      this.publish({ connected: true, working: false, localSignal: "", status: "الاتصال المباشر جاهز" });
      if (this.role === "host") this.send(JSON.stringify(this.view.state));
    };
    channel.onclose = () => { if (active()) this.close("انقطع اتصال اللاعب؛ أعد التجربة للاتصال من جديد."); };
    channel.onerror = () => { if (active()) this.close("حدث خطأ في قناة البيانات؛ أُغلقت الجلسة."); };
    channel.onmessage = event => {
      if (!active() || !this.playable()) return;
      if (this.role === "host") {
        const intent = parseGuestIntent(event.data);
        if (intent) this.updateHost(state => buzz(state, 1, intent.round));
      } else {
        const snapshot = parseHostSnapshot(event.data);
        if (snapshot && isNewerHostSnapshot(this.view.state, snapshot, this.lastVersion)) {
          this.lastVersion = snapshot.version;
          this.publish({ state: snapshot });
        }
      }
    };
  }

  private connectionDeadline(peer: RTCPeerConnection) {
    if (!this.current(peer) || this.view.connected) return;
    clearTimeout(this.deadline);
    this.deadline = setTimeout(() => {
      if (this.current(peer) && !this.view.connected) this.close("انتهت مهلة الاتصال. لا يوجد STUN/TURN؛ أعد التجربة عند جاهزية الشبكة.");
    }, PAIRING_TIMEOUT_MS);
  }

  async startHost() {
    if (this.role !== "host" || this.disposed || this.view.ended || this.peer || this.view.working) return;
    this.publish({ working: true, status: "جاري جمع ICE وإنشاء العرض…" });
    try {
      const peer = this.makePeer();
      this.attachChannel(peer, peer.createDataChannel(CHANNEL_LABEL, { ordered: true }));
      const offer = await peer.createOffer();
      if (!this.current(peer)) return;
      await peer.setLocalDescription(offer);
      if (!this.current(peer)) return;
      await completeIce(peer, this.abort!.signal);
      if (!this.current(peer)) return;
      if (!peer.localDescription) throw new Error("عرض مفقود");
      this.publish({ working: false, localSignal: JSON.stringify({ type: "offer", sdp: peer.localDescription.sdp }),
        status: "انسخ العرض إلى الضيف ثم الصق إجابته هنا" });
    } catch {
      if (!this.disposed && !this.view.ended) this.close("فشل تجهيز العرض أو انتهت مهلة ICE؛ أغلق وأعد التجربة.");
    }
  }

  async acceptOffer(raw: string) {
    if (this.role !== "guest" || this.disposed || this.view.ended || this.peer || this.view.working) return;
    let offer: RTCSessionDescriptionInit;
    try { offer = parseSessionDescription(raw.trim(), "offer"); }
    catch (error) { this.publish({ status: (error as Error).message }); return; }
    this.publish({ working: true, status: "جاري تجهيز الإجابة وجمع ICE…" });
    try {
      const peer = this.makePeer();
      await peer.setRemoteDescription(offer);
      if (!this.current(peer)) return;
      const answer = await peer.createAnswer();
      if (!this.current(peer)) return;
      await peer.setLocalDescription(answer);
      if (!this.current(peer)) return;
      await completeIce(peer, this.abort!.signal);
      if (!this.current(peer)) return;
      if (!peer.localDescription) throw new Error("إجابة مفقودة");
      this.publish({ working: false, remoteApplied: true,
        localSignal: this.view.connected ? "" : JSON.stringify({ type: "answer", sdp: peer.localDescription.sdp }),
        status: this.view.connected ? "الاتصال المباشر جاهز" : "انسخ الإجابة إلى الهوست وانتظر الاتصال" });
      this.connectionDeadline(peer);
    } catch {
      if (!this.disposed && !this.view.ended) this.close("فشل تجهيز الإجابة أو انتهت مهلة ICE؛ أغلق وأعد التجربة.");
    }
  }

  async acceptAnswer(raw: string) {
    const peer = this.peer;
    if (this.role !== "host" || !peer || !this.current(peer) || this.view.working || this.view.remoteApplied) return;
    let answer: RTCSessionDescriptionInit;
    try { answer = parseSessionDescription(raw.trim(), "answer"); }
    catch (error) { this.publish({ status: (error as Error).message }); return; }
    this.publish({ working: true });
    try {
      await peer.setRemoteDescription(answer);
      if (!this.current(peer)) return;
      this.publish({ working: false, remoteApplied: true,
        status: this.view.connected ? "الاتصال المباشر جاهز" : "استلمنا الإجابة؛ بانتظار الاتصال المباشر…" });
      this.connectionDeadline(peer);
    } catch {
      if (this.current(peer)) this.close("لم يقبل المتصفح الإجابة؛ أغلق وأعد التجربة بعرض جديد.");
    }
  }

  private updateHost(apply: (state: LabState) => LabState) {
    if (this.role !== "host" || !this.playable()) return;
    const next = apply(this.view.state);
    if (next === this.view.state) return;
    this.publish({ state: next });
    this.send(JSON.stringify(next));
  }

  hostAction(action: HostAction) {
    if (action === "open") this.updateHost(openRound);
    else if (action === "buzz") this.updateHost(state => buzz(state, 0, state.round));
    else if (action === "award") this.updateHost(awardPoint);
    else if (action === "skip") this.updateHost(skipRound);
  }

  guestBuzz() {
    const { state } = this.view;
    if (this.role !== "guest" || !this.playable() || state.phase !== "open" || this.lastBuzzRound === state.round) return;
    if (this.send(JSON.stringify({ type: "BUZZ", round: state.round }))) this.lastBuzzRound = state.round;
  }
}
