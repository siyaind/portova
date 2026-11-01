import 'server-only';
import {createPublicClient,http,parseEventLogs,parseAbi,type Hex} from 'viem';
import {base} from 'viem/chains';
import {database} from './project-db';
import {invoiceFromRow,paymentProofMessage,paymentVerdict,PAYMENT_CHAIN,PAYMENT_TOKEN,type CryptoInvoice} from '@/lib/crypto-payments';
export const transferAbi=parseAbi(['event Transfer(address indexed from,address indexed to,uint256 value)']);
function rpc(){return createPublicClient({chain:base,transport:http(process.env.BASE_PAYMENT_RPC_URL??'https://mainnet.base.org',{timeout:10000,retryCount:1})});}
async function evidence(invoice:CryptoInvoice,payer:string,hash:Hex){
  const client=rpc();if(await client.getChainId()!==PAYMENT_CHAIN)throw Error('Payment RPC network mismatch.');
  const receipt=await client.getTransactionReceipt({hash});
  const [block,finalized]=await Promise.all([client.getBlock({blockNumber:receipt.blockNumber}),client.getBlock({blockTag:'finalized'})]);
  const transfers=parseEventLogs({abi:transferAbi,logs:receipt.logs.filter(log=>log.address.toLowerCase()===PAYMENT_TOKEN.toLowerCase()),eventName:'Transfer'}).map(log=>({token:log.address,from:log.args.from,to:log.args.to,amount:log.args.value}));
  const verdict=paymentVerdict(invoice,payer,{chainId:PAYMENT_CHAIN,success:receipt.status==='success',canonical:block.hash===receipt.blockHash,finalized:finalized.number>=receipt.blockNumber,timestamp:Number(block.timestamp),transfers});
  return {verdict,height:receipt.blockNumber.toString(),paidAt:new Date(Number(block.timestamp)*1000).toISOString()};
}
export async function submitCryptoProof(id:string,payer:`0x${string}`,signature:Hex,hash:Hex){
  const sql=database();const [row]=await sql`SELECT * FROM portova_crypto_invoices WHERE id=${id}::uuid`;
  if(!row)throw Object.assign(Error('Invoice not found.'),{status:404});
  const invoice=invoiceFromRow(row),client=rpc();
  const origin=process.env.PORTOVA_ORIGIN??'https://portova.vercel.app';
  if(!(await client.verifyMessage({address:payer,message:paymentProofMessage(invoice,payer,origin),signature})))throw Object.assign(Error('Payment-wallet authorization is invalid.'),{status:403});
  if(invoice.status==='paid'){
    if(invoice.txHash!==hash)throw Object.assign(Error('This invoice is already paid. Do not send another transfer.'),{status:409});
    return {status:'paid',message:'This payment was already credited.'};
  }
  if(Date.now()>Date.parse(invoice.expiresAt)+7*86400000)throw Object.assign(Error('Invoice recovery window ended. Contact support with the transaction hash.'),{status:409});
  let proof;
  try{proof=await evidence(invoice,payer,hash);}catch(cause){
    if(cause instanceof Error&&cause.name==='TransactionReceiptNotFoundError')return {status:'pending',accepted:false,message:'Receipt is not visible yet. Recheck this transaction; do not pay again.'};
    if((cause as {paymentRefusal?:boolean}).paymentRefusal)throw Object.assign(Error((cause as Error).message),{status:409});
    throw Object.assign(Error('Payment verification is temporarily unavailable. Keep your transaction hash and recheck; do not pay again.'),{status:503});
  }
  try{await sql`UPDATE portova_crypto_invoices SET tx_hash=${hash},payer=${payer},proof=${signature},status='pending' WHERE id=${id}::uuid AND status IN ('open','pending')`;}
  catch{throw Object.assign(Error('This transaction is already assigned to an invoice. Contact support if necessary.'),{status:409});}
  if(proof.verdict==='pending')return {status:'pending',accepted:true,message:'USDC transfer verified. Access will be credited after Base finality; keep this hash and do not pay again.'};
  const [result]=await sql`SELECT portova_credit_crypto(${id}::uuid,${hash},${payer},${proof.paidAt}::timestamptz,${proof.height}::bigint) AS result`;
  return result.result;
}
export async function reconcileCryptoPayments(){
  const sql=database();const rows=await sql`SELECT * FROM portova_crypto_invoices WHERE status='pending' AND expires_at>now()-interval '7 days' ORDER BY last_checked_at NULLS FIRST,created_at LIMIT 5`;
  let credited=0;const start=Date.now();
  for(const row of rows){if(Date.now()-start>35000)break;
    await sql`UPDATE portova_crypto_invoices SET last_checked_at=now() WHERE id=${row.id}::uuid`;
    try{const invoice=invoiceFromRow(row);const proof=await evidence(invoice,String(row.payer),String(row.tx_hash) as Hex);if(proof.verdict==='paid'){
      await sql`SELECT portova_credit_crypto(${row.id}::uuid,${row.tx_hash},${row.payer},${proof.paidAt}::timestamptz,${proof.height}::bigint)`;credited++;
    }}catch{console.error(JSON.stringify({event:'crypto_payment_reconciliation_failed'}));}
  }
  return {checked:rows.length,credited};
}
