/** Verification process lifetime only; never changes a query, assertion or product. */
import{existsSync,readFileSync}from'node:fs';
const report=process.env.HISTORY_CONTENT_REPORT,expected=Number(process.env.NATIVE_EXPECTED_CASES??11);
if(!report||!Number.isSafeInteger(expected)||expected<1)throw Error('Native completion guard requires expected identities and report');
const timer=setInterval(()=>{if(!existsSync(report))return;let data;try{data=JSON.parse(readFileSync(report,'utf8'));}catch{return;}if(data.failed||data.cases?.length===expected)clearInterval(timer);},250);
const bound=setTimeout(()=>{clearInterval(timer);process.exitCode=1;console.error('Native verification did not complete all required identities within bounded harness lifetime');},30000);bound.unref();process.on('beforeExit',()=>clearTimeout(bound));
