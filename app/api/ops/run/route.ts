import { assertOperator } from "@/lib/server/ops";
import { runIndexer, monitorProjects } from "@/lib/server/indexer";
import { apiError } from "@/lib/server/http";
export const runtime="nodejs";
export const maxDuration=60;
export async function POST(request:Request) {
  try {assertOperator(request);const kind=new URL(request.url).searchParams.get("kind");
    if(kind!=="indexer"&&kind!=="monitor")return Response.json({error:"Choose indexer or monitor."},{status:400});
    const result=kind==="indexer"?await runIndexer():await monitorProjects();
    console.info(JSON.stringify({event:`${kind}_completed`,...result}));return Response.json(result);
  }catch(cause){return apiError(cause);}
}
