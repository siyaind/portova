import {assertOrigin,readJson,apiError} from '@/lib/server/http';
import {clientLimit} from '@/lib/server/redis';
import {submitCryptoProof} from '@/lib/server/crypto-payments';
import {validPaymentAddress} from '@/lib/crypto-payments';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request:Request){try{
  assertOrigin(request);await clientLimit(request,'payment-confirm',20);const data=await readJson(request);
  if(!data||typeof data.invoiceId!=='string'||!/^[0-9a-f-]{36}$/.test(data.invoiceId)||!validPaymentAddress(data.payer)||typeof data.signature!=='string'||!/^0x(?:[0-9a-fA-F]{2}){64,2048}$/.test(data.signature)||typeof data.txHash!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(data.txHash))return Response.json({error:'Invalid payment proof.'},{status:400});
  const result=await submitCryptoProof(data.invoiceId,data.payer,data.signature,data.txHash);
  return Response.json(result,{status:result.status==='pending'?202:200,headers:{'Cache-Control':'no-store'}});
}catch(cause){return apiError(cause);}}
