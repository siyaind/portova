import 'server-only';
import {getAddress} from 'viem';
import {database} from './project-db';
import {PLANS} from '@/lib/plans';
import {invoiceFromRow,PAYMENT_CHAIN,PAYMENT_TOKEN,validPaymentAddress} from '@/lib/crypto-payments';
export function billingConfigured(){return process.env.CRYPTO_PAYMENTS_ENABLED==='true'&&validPaymentAddress(process.env.CRYPTO_PAYMENT_RECIPIENT);}
export async function billingAction(account:string,command:{action:'billing'}|{action:'checkout';plan:'pro'|'team'},requestId:string){
  const sql=database();
  if(command.action==='billing'){
    const invoices=await sql`SELECT * FROM portova_crypto_invoices WHERE account=${account} ORDER BY created_at DESC LIMIT 20`;
    const terms=await sql`SELECT plan,starts_at,ends_at,invoice_id FROM portova_crypto_terms WHERE account=${account} ORDER BY starts_at DESC LIMIT 20`;
    const [entitlement]=await sql`SELECT plan,status,period_end FROM portova_entitlements WHERE account=${account}`;
    return {configured:billingConfigured(),invoices:invoices.map(invoiceFromRow),terms,entitlement:entitlement??null};
  }
  if(!billingConfigured())throw Object.assign(Error('Crypto checkout is awaiting configuration. No payment was requested.'),{status:503});
  const recipient=getAddress(process.env.CRYPTO_PAYMENT_RECIPIENT!.toLowerCase());
  const amount=PLANS[command.plan].monthlyUsd*1000000;
  await sql`INSERT INTO portova_crypto_invoices(id,account,plan,amount,recipient,chain_id,token,expires_at) VALUES(${requestId}::uuid,${account},${command.plan},${amount},${recipient},${PAYMENT_CHAIN},${PAYMENT_TOKEN},now()+interval '1 hour') ON CONFLICT(id) DO NOTHING`;
  const [row]=await sql`SELECT * FROM portova_crypto_invoices WHERE id=${requestId}::uuid AND account=${account}`;
  return {invoice:invoiceFromRow(row),configured:true};
}
