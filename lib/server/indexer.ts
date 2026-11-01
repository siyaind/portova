import "server-only";
import type { EventRecord } from "@polkadot/types/interfaces";
import type { ApiPromise } from "@polkadot/api";
import { chainApi } from "./chain";
import { database } from "./project-db";
import { TESTNET_GENESIS } from "@/lib/network";
import { objectSubjects, changedFacts, type MonitorFacts } from "@/lib/indexer-core";
import { readAssetProfile } from "@/lib/chain-read";
import { readCollectionProfile } from "@/lib/nfts";
import { readPoolPage, readReserves } from "@/lib/pools";
type Call = { section:string; method:string; args:Iterable<unknown>; meta:{args:ArrayLike<{name:{toString():string}}>}; };
function callSubjects(call: Call, depth=0): string[] {
  if(depth>8) throw Error("Nested call exceeds indexer limit.");
  const args=Array.from(call.args), named:Record<string,unknown>={};
  args.forEach((arg,i)=> { named[call.meta.args[i].name.toString()]=(arg as {toJSON?:()=>unknown})?.toJSON?.()??arg; });
  const subjects=objectSubjects(call.section,named);
  if(call.section==="utility" && ["batch","batchAll","forceBatch"].includes(call.method)) {
    for(const child of Array.from(args[0] as Iterable<Call>)) subjects.push(...callSubjects(child,depth+1));
  }
  return [...new Set(subjects)];
}
export async function runIndexer() {
  const sql=database(),api=await chainApi(),genesis=TESTNET_GENESIS;
  const finalized=await api.rpc.chain.getFinalizedHead(),tip=(await api.rpc.chain.getHeader(finalized)).number.toNumber();
  let [cursor]=await sql`SELECT * FROM portova_indexer WHERE genesis=${genesis}`;
  if(!cursor) {
    const configured=process.env.INDEXER_START_BLOCK;
    if(configured && !/^\d+$/.test(configured)) throw Error("Invalid index start block.");
    const start=configured?Number(configured):tip;
    if(!Number.isSafeInteger(start)||start<1||start>tip) throw Error("Index start must be within finalized history.");
    const hash=(await api.rpc.chain.getBlockHash(start-1)).toHex();
    await sql`INSERT INTO portova_indexer VALUES(${genesis},${start-1},${hash},${start},now()) ON CONFLICT DO NOTHING`;
    [cursor]=await sql`SELECT * FROM portova_indexer WHERE genesis=${genesis}`;
  }
  const started=Date.now(); let processed=0;
  while(Number(cursor.height)<tip && processed<20 && Date.now()-started<35000) {
    const height=Number(cursor.height)+1, hash=await api.rpc.chain.getBlockHash(height), block=await api.rpc.chain.getBlock(hash),at=await api.at(hash);
    const events=await at.query.system.events() as unknown as EventRecord[];
    const items=[];
    for(const [index,tx] of block.block.extrinsics.entries()) {
      const related=events.filter(row=>row.phase.isApplyExtrinsic&&row.phase.asApplyExtrinsic.toNumber()===index);
      const success=related.some(row=>row.event.section==="system"&&row.event.method==="ExtrinsicSuccess");
      const failed=related.some(row=>row.event.section==="system"&&row.event.method==="ExtrinsicFailed");
      if(!success&&!failed)continue;
      const subjects=callSubjects(tx.method as unknown as Call);
      for(const row of related) {
        const named:Record<string,unknown>={};
        row.event.data.forEach((v,i)=>{const name=row.event.meta.fields[i]?.name.toString();if(name)named[name]=v.toJSON();});
        subjects.push(...objectSubjects(row.event.section,named));
      }
      if(subjects.length)items.push({index,txHash:tx.hash.toHex(),call:`${tx.method.section}.${tx.method.method}`,success,subjects:[...new Set(subjects)]});
    }
    const [saved]=await sql`SELECT portova_ingest(${genesis},${cursor.height}::bigint,${height}::bigint,${hash.toHex()},${block.block.header.parentHash.toHex()},${JSON.stringify(items)}::jsonb) AS applied`;
    if(!saved.applied)break;
    cursor={...cursor,height,hash:hash.toHex()};processed++;
  }
  return {processed,height:Number(cursor.height),finalizedHeight:tip,lag:tip-Number(cursor.height),startHeight:Number(cursor.start_height)};
}
export async function monitorProjects() {
  const sql=database(),api=await chainApi(),hash=await api.rpc.chain.getFinalizedHead(),at=await api.at(hash),height=(await api.rpc.chain.getHeader(hash)).number.toNumber();
  const [job]=await sql`SELECT cursor FROM portova_jobs WHERE name='monitor'`;
  const projects=await sql`SELECT p.* FROM portova_projects p JOIN portova_billing b ON b.account=p.owner WHERE b.status='active' AND b.period_end>now() AND b.plan IN ('pro','team') AND p.id>${job?.cursor??""} ORDER BY p.id LIMIT 5`;
  const started=Date.now();let checked=0;
  for(const row of projects) {
    if(Date.now()-started>35000)break;
    try {
    const project=row.project;const facts:MonitorFacts={assetId:project.assetId,collectionId:project.collectionId,poolId:project.poolLpToken};
    if(project.assetId) {const a=await readAssetProfile(at as unknown as ApiPromise,project.assetId);if(!a.found||a.issuer===null||a.status===null)throw Error("Linked asset is unavailable.");facts.issuer=a.issuer;facts.status=a.status;}
    if(project.collectionId) {const n=await readCollectionProfile(at as unknown as ApiPromise,project.collectionId);if(!n.found||n.owner===null)throw Error("Linked collection is unavailable.");facts.owner=n.owner;}
    if(project.poolLpToken) {
      let cursor:string|null=null,found=false;
      for(let page=0;page<4;page++) {
        const data=await readPoolPage(api,cursor,hash.toHex());const pool=data.rows.find(p=>p.lpToken===project.poolLpToken);
        if(pool) {const reserves=await readReserves(at as unknown as ApiPromise,pool.asset1,pool.asset2);if(reserves[0]===null||reserves[1]===null)throw Error("Pool reserves are unavailable.");facts.reserve1=reserves[0];facts.reserve2=reserves[1];found=true;break;}
        cursor=data.nextCursor;if(!cursor)break;
      }
      if(!found)throw Error("Linked pool is unavailable or discovery exceeds monitor limit.");
    }
    const [previous]=await sql`SELECT facts,block_number FROM portova_snapshots WHERE project_id=${row.id}`;
    const changes=changedFacts(previous?.facts??null,facts);
    await sql`SELECT portova_monitor(${row.id},${row.revision}::integer,${previous?.block_number??-1}::bigint,${height}::bigint,${hash.toHex()},${JSON.stringify(facts)}::jsonb,${JSON.stringify(changes)}::jsonb)`;
    checked++;
    } catch {
      await sql.transaction([
        sql`INSERT INTO portova_alerts(project_id,fingerprint,kind,message,block_number) SELECT id,${`${row.id}:${height}:read-failed`},'read-failed','A linked object could not be read within monitor coverage. Previous facts are retained; inspect project links and refresh.',${height} FROM portova_projects WHERE id=${row.id} AND revision=${row.revision} ON CONFLICT DO NOTHING`,
        sql`INSERT INTO portova_jobs(name,cursor) VALUES('monitor',${row.id}) ON CONFLICT(name) DO UPDATE SET cursor=EXCLUDED.cursor,updated_at=now()`,
      ]);
      console.error(JSON.stringify({event:'monitor_project_read_failed'}));
      checked++;
    }
  }
  if(projects.length<5&&checked===projects.length) await sql`INSERT INTO portova_jobs(name,cursor) VALUES('monitor','') ON CONFLICT(name) DO UPDATE SET cursor='',updated_at=now()`;
  return {checked,block:height};
}
