import {getAddress,isAddress} from 'viem';
export const PAYMENT_CHAIN=8453;
export const PAYMENT_TOKEN='0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;
export type CryptoInvoice={id:string;account:string;plan:'pro'|'team';amount:string;recipient:string;chainId:number;token:string;createdAt:string;expiresAt:string;status:string;txHash:string|null;payer:string|null};
export function invoiceFromRow(row:Record<string,unknown>):CryptoInvoice{return {id:String(row.id),account:String(row.account),plan:row.plan as 'pro'|'team',amount:String(row.amount),recipient:String(row.recipient),chainId:Number(row.chain_id),token:String(row.token),createdAt:new Date(String(row.created_at)).toISOString(),expiresAt:new Date(String(row.expires_at)).toISOString(),status:String(row.status),txHash:row.tx_hash?String(row.tx_hash):null,payer:row.payer?String(row.payer):null};}
export function paymentProofMessage(invoice:CryptoInvoice,payer:string,origin:string){
  return `Portova subscription payment\nSite: ${origin}\nInvoice: ${invoice.id}\nWorkspace wallet: ${invoice.account}\nPayment wallet: ${getAddress(payer)}\nNetwork: Base (${invoice.chainId})\nToken: ${invoice.token}\nAmount: ${invoice.amount} USDC base units\nRecipient: ${invoice.recipient}\nExpires: ${invoice.expiresAt}\nAuthorize verified payment credit only to this invoice. No token allowance, automatic renewal, or access to wallet funds is granted.`;
}
export function validPaymentAddress(value:unknown):value is `0x${string}`{return typeof value==='string'&&isAddress(value,{strict:false})&&value.toLowerCase()!=='0x'+'0'.repeat(40)&&value.toLowerCase()!==PAYMENT_TOKEN.toLowerCase();}
export type PaymentEvidence={chainId:number;success:boolean;canonical:boolean;finalized:boolean;timestamp:number;transfers:Array<{token:string;from:string;to:string;amount:bigint}>};
export function paymentVerdict(invoice:CryptoInvoice,payer:string,evidence:PaymentEvidence):'paid'|'pending'{
  const refuse=(message:string):never=>{throw Object.assign(Error(message),{paymentRefusal:true});};
  if(evidence.chainId!==PAYMENT_CHAIN||invoice.chainId!==PAYMENT_CHAIN||invoice.token.toLowerCase()!==PAYMENT_TOKEN.toLowerCase())refuse('Wrong payment network or token.');
  if(!evidence.success||!evidence.canonical)refuse('The payment failed or is not canonical.');
  const timestamp=evidence.timestamp*1000;
  if(timestamp<Math.floor(Date.parse(invoice.createdAt)/1000)*1000||timestamp>Date.parse(invoice.expiresAt))refuse('Payment is outside the invoice window. Contact support for late payments.');
  if(!evidence.transfers.some(t=>t.token.toLowerCase()===PAYMENT_TOKEN.toLowerCase()&&t.from.toLowerCase()===payer.toLowerCase()&&t.to.toLowerCase()===invoice.recipient.toLowerCase()&&t.amount===BigInt(invoice.amount)))refuse('The transaction does not contain the exact invoiced USDC payment from this wallet.');
  return evidence.finalized?'paid':'pending';
}
