import {NextResponse} from "next/server";
import {errorResponse} from "@/lib/http";
import {CreditError} from "@/lib/billing/credits";
import {RankedError} from "./module";
export function rankedResponse(error:unknown) {if(error instanceof RankedError||error instanceof CreditError)return NextResponse.json({error:error.message,...(error instanceof RankedError?{code:error.code}:{})},{status:error.status,headers:{"Cache-Control":"no-store"}});return errorResponse(error);}
export const privateHeaders={"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"};

import type {NextRequest} from "next/server";
import {listSchema} from "./validation";
export async function parseList(request:NextRequest){const max=524288;if(Number(request.headers.get("content-length")??0)>max)throw new Error("BODY_TOO_LARGE");const reader=request.body?.getReader();if(!reader)throw new SyntaxError("Missing body");const chunks:Uint8Array[]=[];let length=0;try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>max){await reader.cancel();throw new Error("BODY_TOO_LARGE");}chunks.push(value);}}finally{reader.releaseLock();}const bytes=new Uint8Array(length);let pos=0;for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.length;}return listSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));}
