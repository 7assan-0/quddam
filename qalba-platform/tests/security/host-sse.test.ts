import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync, readdirSync } from "node:fs";
const { lookup, auth, view, marker } = vi.hoisted(() => ({ lookup: vi.fn(), auth: vi.fn(), view: vi.fn(), marker: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ currentAuthSession: auth }));
vi.mock("@/lib/db", () => ({ db: () => ({ authSession: { findUnique: lookup }, gameSession: { findUnique: marker } }) }));
vi.mock("@/lib/games/social-deduction/service", () => ({ getSocialView: view, cookieName: () => "player" }));
vi.mock("@/lib/games/letter-network/service", () => ({ getLetterView: view }));
vi.mock("@/lib/games/survey-battle/service", () => ({ getSurveyView: view }));
vi.mock("@/lib/games/forbidden-word/service", () => ({ getForbiddenView: view }));
vi.mock("@/lib/games/bluff/service", () => ({ getBluffView: view, cookieName: () => "player" }));
vi.mock("@/lib/games/ranked/service", () => ({ getRankedView: view }));
vi.mock("@/lib/games/lightning/service", () => ({ getLightningView: view }));
vi.mock("@/lib/games/ordering/service", () => ({ getOrderingView: view }));
vi.mock("@/lib/games/court/service", () => ({ getCourtView: view, cookieName: () => "juror" }));
const routes = [
  ["social", () => import("@/app/api/social/[id]/events/route")],
  ["letter-network", () => import("@/app/api/letter-network/[id]/events/route")],
  ["survey-show", () => import("@/app/api/survey-show/[id]/events/route")],
  ["secret-word", () => import("@/app/api/secret-word/[id]/events/route")],
  ["bluff", () => import("@/app/api/bluff/[id]/events/route")],
  ["ranked", () => import("@/app/api/ranked/[id]/events/route")],
  ["lightning", () => import("@/app/api/lightning/[id]/events/route")],
  ["ordering", () => import("@/app/api/ordering/[id]/events/route")],
  ["court", () => import("@/app/api/court/[id]/events/route")],
] as const;
const now = new Date("2026-10-05T12:00:00Z"), expiresAt = new Date(now.getTime()+120_000);
let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(now); lookup.mockReset().mockResolvedValue({ userId:"host", revokedAt:null, expiresAt, user:{id:"host",suspendedAt:null} });
  auth.mockReset().mockResolvedValue({ sessionId:"original",user:{id:"host"},expiresAt });
  view.mockReset().mockResolvedValue({ version:1,phase:"READY",privateAnswer:"host-private-sentinel" }); marker.mockReset().mockResolvedValue({stateVersion:1});
});
afterEach(async () => { await reader?.cancel(); reader=undefined; vi.useRealTimers(); });
async function open(load: typeof routes[number][1], signal?: AbortSignal, audience="host") {
  const route=await load(); const request=new NextRequest(`http://localhost/api/game/id/events?audience=${audience}`,{signal});
  const response=await route.GET(request,{params:Promise.resolve({id:"game"})}); expect(response.status).toBe(200);
  reader=response.body!.getReader(); expect(new TextDecoder().decode((await reader.read()).value)).toContain("host-private-sentinel"); return request;
}
it.each(routes)("%s already-open Host stream revalidates exact session, closes and stops all polling", async (_name,load) => {
  await open(load); expect(view).toHaveBeenCalledWith("game",{kind:"HOST",id:"host"});
  lookup.mockResolvedValue({userId:"host",revokedAt:now,expiresAt,user:{id:"host",suspendedAt:null}});
  // A future private projection is ready, but the invalid boundary must precede its read.
  await vi.advanceTimersByTimeAsync(19_999); view.mockResolvedValue({version:2,phase:"READY",privateAnswer:"future-secret"});marker.mockResolvedValue({stateVersion:2});
  const reads=view.mock.calls.length; await vi.advanceTimersByTimeAsync(1);
  const chunks:string[]=[];for(;;){const next=await reader!.read();if(next.done)break;chunks.push(new TextDecoder().decode(next.value));}
  expect(chunks.join("")).toContain("event: access-ended");expect(chunks.join("")).not.toContain("future-secret");
  expect(lookup).toHaveBeenCalledTimes(1);expect(lookup.mock.calls[0][0].where).toEqual({id:"original"});expect(view).toHaveBeenCalledTimes(reads);
  const polls=marker.mock.calls.length;await vi.advanceTimersByTimeAsync(60_000);expect(view).toHaveBeenCalledTimes(reads);expect(marker).toHaveBeenCalledTimes(polls);expect(vi.getTimerCount()).toBe(0);
});
it("fast Lightning stream performs three auth lookups per minute, not 240",async()=>{
  await open(routes[6][1]);
  // A healthy consumer drains heartbeat frames; bounded slow-client queues are covered separately.
  const drain = (async () => { while (!(await reader!.read()).done) { /* consume */ } })();
  await vi.advanceTimersByTimeAsync(60_000);expect(lookup).toHaveBeenCalledTimes(3);
  expect(marker.mock.calls.length).toBeGreaterThan(230);expect(view.mock.calls.length).toBeLessThanOrEqual(7);
  await reader!.cancel();await drain;
});
it("transient auth lookup closes with retry, not access-ended or a private payload",async()=>{
  await open(routes[8][1]);lookup.mockRejectedValue(new Error("temporary DB outage"));await vi.advanceTimersByTimeAsync(20_000);
  let text="";for(;;){const next=await reader!.read();if(next.done)break;text+=new TextDecoder().decode(next.value);}
  expect(text).toContain("retry: 5000");expect(text).not.toContain("access-ended");expect(vi.getTimerCount()).toBe(0);
});
it("cancel clears scheduled work and detaches the abort listener",async()=>{
  const signal=new AbortController();const request=await open(routes[6][1],signal.signal);const detach=vi.spyOn(request.signal,"removeEventListener");
  await reader!.cancel();await Promise.resolve();expect(vi.getTimerCount()).toBe(0);expect(detach).toHaveBeenCalledWith("abort",expect.any(Function));const polls=view.mock.calls.length;await vi.advanceTimersByTimeAsync(30_000);expect(view).toHaveBeenCalledTimes(polls);
});
it("abort wakes an outstanding delay and stops polling immediately",async()=>{
  const signal=new AbortController();await open(routes[8][1],signal.signal);signal.abort();await Promise.resolve();await Promise.resolve();expect(vi.getTimerCount()).toBe(0);const polls=view.mock.calls.length;await vi.advanceTimersByTimeAsync(30_000);expect(view).toHaveBeenCalledTimes(polls);
});
it("non-Host streams retain token authorization and never perform auth-session queries",async()=>{
  await open(routes[6][1],undefined,"display");await vi.advanceTimersByTimeAsync(30_000);expect(auth).not.toHaveBeenCalled();expect(lookup).not.toHaveBeenCalled();expect(view).toHaveBeenCalledWith("game",{kind:"DISPLAY",token:""});
});
it("post-read validation catches revocation when a pending private read crosses the cadence",async()=>{
  await open(routes[6][1]);await vi.advanceTimersByTimeAsync(19_000);
  let resolve!: (value:unknown)=>void;view.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));marker.mockResolvedValue({stateVersion:2});await vi.advanceTimersByTimeAsync(250);
  lookup.mockResolvedValue(null);vi.setSystemTime(now.getTime()+20_000);resolve({version:2,privateAnswer:"delayed-secret"});await Promise.resolve();await Promise.resolve();
  let text="";for(;;){const next=await reader!.read();if(next.done)break;text+=new TextDecoder().decode(next.value);}
  expect(text).toContain("access-ended");expect(text).not.toContain("delayed-secret");expect(vi.getTimerCount()).toBe(0);
});
it("every dedicated retained Host route binds and checks the original session",()=>{
  const root="src/app/api";const found:string[]=[];
  for(const name of readdirSync(root)){try{const text=readFileSync(`${root}/${name}/[id]/events/route.ts`,"utf8");if(text.includes('kind:"HOST"')||text.includes('kind: "HOST"')){found.push(name);expect(text).toContain("currentAuthSession()");expect(text).toContain("createHostSessionGuard(auth)");expect(text.match(/hostSession\?\.assertActive\(\)/g)).toHaveLength(1);expect(text).toContain("realtimeResponse");}}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;}}
  expect(found.sort()).toEqual(routes.map(([name])=>name).sort());
  const transport=readFileSync("src/lib/realtime/stream.ts","utf8");expect(transport.match(/await options\.assertActive\?\.\(\)/g)).toHaveLength(3);
});
