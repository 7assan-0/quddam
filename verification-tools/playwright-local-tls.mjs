/** TEST TRANSPORT ONLY. Existing canonical HTTP URLs remain unchanged in browser fixtures.
 * Playwright's Node API jar does not send Secure cookies over loopback HTTP.
 * A local TLS bridge preserves those cookies and all original Origin/negative assertions.
 * No application code, cookie attribute, credential, header or auth decision is changed.
 */
import {createRequire} from 'node:module';
import {join} from 'node:path';
const require=createRequire(join(process.cwd(),'package.json'));
const {APIRequestContext}=require(join(process.cwd(),'node_modules/playwright-core/lib/client/fetch.js'));
const original=APIRequestContext.prototype.fetch;
APIRequestContext.prototype.fetch=function(input,options){
 if(typeof input==='string'){
  const url=new URL(input,'http://127.0.0.1:3000');
  if(url.origin==='http://127.0.0.1:3000')return original.call(this,'https://127.0.0.1:3445'+url.pathname+url.search,{...options,ignoreHTTPSErrors:true});
 }
 return original.call(this,input,options);
};
