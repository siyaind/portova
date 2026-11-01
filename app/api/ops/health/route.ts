import {assertOperator} from '@/lib/server/ops';
import {storageHealth} from '@/lib/server/health';
import {database} from '@/lib/server/project-db';
import {apiError} from '@/lib/server/http';
import {chainApi} from '@/lib/server/chain';
import {TESTNET_GENESIS} from '@/lib/network';
export const runtime='nodejs';
export const maxDuration=30;
export async function GET(request:Request) {
  try {assertOperator(request);const storage=await storageHealth();let rpc=false,finalized:number|null=null,indexer=null;
    try {const api=await chainApi();finalized=(await api.rpc.chain.getHeader(await api.rpc.chain.getFinalizedHead())).number.toNumber();rpc=api.isConnected;}catch{}
    if(storage.schema){const sql=database();const [row]=await sql`SELECT height,start_height,updated_at FROM portova_indexer WHERE genesis=${TESTNET_GENESIS}`;indexer=row?{...row,lag:finalized===null?null:finalized-Number(row.height)}:null;}
    const good=storage.available&&rpc;return Response.json({...storage,rpc,finalized,indexer,checkedAt:new Date().toISOString()},{status:good?200:503,headers:{'Cache-Control':'no-store'}});
  }catch(cause){return apiError(cause);}
}
