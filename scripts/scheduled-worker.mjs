const origin=process.env.PORTOVA_ORIGIN??'https://portova.vercel.app';
const secret=process.env.CRON_SECRET;
if(!secret)throw Error('Worker credential is missing.');
async function invoke(kind){
  const response=await fetch(`${origin}/api/ops/run?kind=${kind}`,{method:'POST',headers:{Authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(65000)});
  if(!response.ok)throw Error(`Worker ${kind} failed with status ${response.status}.`);
  const data=await response.json();console.log(JSON.stringify({kind,...data}));return data;
}
// Multiple bounded invocations allow catch-up between best-effort five-minute schedules.
let failed=false;
try {for(let page=0;page<8;page++){const result=await invoke('indexer');if(result.lag===0||result.processed===0)break;}}catch{console.error('Indexer failed. Check operator health and deployment logs.');failed=true;}
try {await invoke('monitor');}catch{console.error('Monitor failed. Check operator health and deployment logs.');failed=true;}
try {await invoke('payments');}catch{console.error('Crypto reconciliation failed. Check operator health.');failed=true;}
if(failed)process.exitCode=1;
