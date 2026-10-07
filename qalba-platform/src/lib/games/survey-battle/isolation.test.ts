import { beforeEach,it,expect,vi } from "vitest";
import { lobby } from "./module";
const mock=vi.hoisted(()=>({session:vi.fn(),receipt:vi.fn(),update:vi.fn()}));
vi.mock("@/lib/db",()=>{const tx={gameSession:{findUnique:mock.session,updateMany:mock.update},gameCommand:{findUnique:mock.receipt}};return {db:()=>({...tx,$transaction:(callback:(tx:unknown)=>unknown)=>callback(tx)})};});
import { getPartySession,applyPartyCommand } from "../party/service";
beforeEach(()=>{vi.clearAllMocks();mock.session.mockResolvedValue({id:"dedicated",hostId:"host",state:lobby(),gameType:{slug:"survey-show"},stateVersion:0});});
it("legacy Party cannot project a dedicated Survey Battle session",async()=>{await expect(getPartySession("host","dedicated")).rejects.toMatchObject({status:404});});
it("legacy generic END cannot mutate dedicated phase, credit or receipts",async()=>{await expect(applyPartyCommand("host","dedicated",crypto.randomUUID(),0,{type:"END"})).rejects.toMatchObject({status:404});expect(mock.update).not.toHaveBeenCalled();expect(mock.receipt).not.toHaveBeenCalled();});
