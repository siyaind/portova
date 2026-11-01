import "server-only";
import {database,databaseConfigured} from './project-db';
import {redis,redisConfigured} from './redis';
export async function storageHealth() {
  const started=Date.now();let db=false,cache=false,schema=false;
  await Promise.allSettled([
    (async()=>{if(!databaseConfigured())return;const sql=database();const rows=await sql.query("SELECT to_regprocedure('portova_execute(uuid)') IS NOT NULL AND to_regprocedure('portova_ingest(text,bigint,bigint,text,text,jsonb)') IS NOT NULL AS ready",[],{fetchOptions:{signal:AbortSignal.timeout(4000)}});db=true;schema=rows[0]?.ready===true;})(),
    (async()=>{if(redisConfigured())cache=(await redis<string>('PING'))==='PONG';})(),
  ]);
  return {available:db&&schema&&cache,database:db,schema,redis:cache,latencyMs:Date.now()-started};
}
