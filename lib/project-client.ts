import {stringToHex} from "@polkadot/util";
import {canonicalAccount,projectSignMessage,validateProjectRequest,type ProjectRequest} from "./cloud-project";
type Signer = { address:string; source:string };
async function post(path:string,body:unknown) {
  const response=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
  const data=await response.json();if(!response.ok)throw Object.assign(Error(data.error??"Workspace request failed."),{status:response.status});return data;
}
export async function signedProjectRequest(payload:ProjectRequest,signer:Signer,valid:()=>boolean) {
  const normalized=validateProjectRequest(payload);
  const challenge=await post('/api/projects/challenge',{account:signer.address,payload:normalized});
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(normalized)))),b=>b.toString(16).padStart(2,'0')).join('');
  const message=projectSignMessage(window.location.origin,canonicalAccount(signer.address),challenge.id,challenge.expires,digest,payload.action);
  if(challenge.message!==message||!valid())throw Error('The wallet or reviewed request changed. Review again.');
  const {web3FromSource}=await import('@polkadot/extension-dapp');const extension=await web3FromSource(signer.source);
  if(!extension.signer?.signRaw||!valid())throw Error('This wallet cannot sign the current storage request.');
  const signature=await extension.signer.signRaw({address:signer.address,data:stringToHex(message),type:'bytes'});
  if(!valid())throw Error('The wallet changed. The storage signature was discarded.');
  // A lost response can be retried with the exact same signature; the server returns its stored result.
  for(let attempt=0;attempt<2;attempt++) {
    try {return await post('/api/projects/commit',{id:challenge.id,signature:signature.signature});}
    catch(cause) {if(attempt||!valid()||!((cause as {status?:number}).status===503 || cause instanceof TypeError || (cause instanceof DOMException && cause.name==='TimeoutError')))throw cause;}
  }
}
