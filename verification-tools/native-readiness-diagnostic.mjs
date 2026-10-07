/** Read-only diagnostic metadata: no payloads, tokens or canonical assertions. */
import {appendFileSync} from 'node:fs';
let assigned,number=0;
function note(event,detail={}){appendFileSync(process.env.NATIVE_DIAGNOSTIC_LOG,JSON.stringify({event,...detail})+'\n');}
Object.defineProperty(globalThis,'prisma',{configurable:true,get(){return assigned;},set(value){assigned=new Proxy(value,{get(target,property,receiver){const method=Reflect.get(target,property,receiver);if(property!=='$transaction'||typeof method!=='function')return method;return(...args)=>{if(typeof args[0]!=='function')return method.apply(target,args);const callback=args[0],id=++number;note('transaction-start',{id});return method.call(target,tx=>{note('delegate-type',{id,type:typeof tx.secretWord});const observed=new Proxy(tx,{get(t,k,r){const v=Reflect.get(t,k,r);if(typeof v==='function')return v.bind(t);if(!v||typeof v!=='object'||typeof k!=='string')return v;return new Proxy(v,{get(model,operation,mr){const f=Reflect.get(model,operation,mr);if(typeof f!=='function')return f;return(...a)=>{note('model-call',{id,model:k,operation:String(operation)});return f.apply(model,a);};}});}});return callback(observed);},...args.slice(1)).then(v=>{note('transaction-fulfilled',{id});return v;},e=>{note('transaction-rejected',{id,errorName:e.name,status:e.status,code:e.code});throw e;});};}});}});
const keepAlive=setInterval(()=>{},1000);
const deadline=setTimeout(()=>{note('diagnostic-time-bound-reached');clearInterval(keepAlive);},20000);
process.on('beforeExit',()=>{clearTimeout(deadline);note('before-exit');});
