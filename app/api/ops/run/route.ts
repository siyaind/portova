import { assertOperator } from "@/lib/server/ops";
import { runIndexer, monitorProjects } from "@/lib/server/indexer";
import { apiError } from "@/lib/server/http";
import {reconcileCryptoPayments} from '@/lib/server/crypto-payments';
export const runtime="nodejs";
export const maxDuration=60;
export async function POST(request:Request) {
  try {assertOperator(request);const kind=new URL(request.url).searchParams.get("kind");
    if(kind!=="indexer"&&kind!=="monitor"&&kind!=="payments")return Response.json({error:"Choose indexer, monitor or payments."},{status:400});
    const result=kind==="indexer"?await runIndexer():kind==='monitor'?await monitorProjects():await reconcileCryptoPayments();
    console.info(JSON.stringify({event:`${kind}_completed`,...result}));return Response.json(result);
  }catch(cause){return apiError(cause);}
}
