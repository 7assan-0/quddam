import {NextResponse} from "next/server";
import {errorResponse} from "@/lib/http";
import {CreditError} from "@/lib/billing/credits";
import {BluffError} from "./module";
export function bluffResponse(error:unknown) {if(error instanceof BluffError||error instanceof CreditError)return NextResponse.json({error:error.message,...(error instanceof BluffError?{code:error.code}:{})},{status:error.status,headers:{"Cache-Control":"no-store"}});return errorResponse(error);}
export const privateHeaders={"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"};
