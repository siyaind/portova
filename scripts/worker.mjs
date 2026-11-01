// Run as a persistent worker or scheduled command. Secrets stay in environment variables.
const origin=process.env.PORTOVA_ORIGIN??'https://portova.vercel.app',secret=process.env.CRON_SECRET;
if(!secret)throw Error('Set CRON_SECRET in the worker environment.');
if(!new URL(origin).hostname.match(/^(localhost|127\.0\.0\.1)$/)&&!origin.startsWith('https://'))throw Error('Worker origin must use HTTPS.');
let stopping=false;for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopping=true;});
let cycle=0;
while(!stopping){
  for(const kind of cycle%5===0?['indexer','monitor','payments']:['indexer']){
    try {
      const response=await fetch(`${origin}/api/ops/run?kind=${kind}`,{method:'POST',headers:{Authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(65000)});
      if(!response.ok)throw Error(`status ${response.status}`);
      console.log(JSON.stringify({kind,at:new Date().toISOString(),result:await response.json()}));
    }catch {console.error(JSON.stringify({event:'worker_request_failed',kind,at:new Date().toISOString()}));}
  }
  cycle++;if(process.argv.includes('--once'))break;
  await new Promise(resolve=>{const finish=()=>{process.removeListener('SIGTERM',interrupt);process.removeListener('SIGINT',interrupt);resolve();};const timer=setTimeout(finish,10000);const interrupt=()=>{clearTimeout(timer);finish();};process.once('SIGTERM',interrupt);process.once('SIGINT',interrupt);});
}
