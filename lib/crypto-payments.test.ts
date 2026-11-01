import test from 'node:test';
import assert from 'node:assert/strict';
import {paymentVerdict,paymentProofMessage,PAYMENT_TOKEN,type CryptoInvoice,type PaymentEvidence} from './crypto-payments.ts';
const payer='0x1111111111111111111111111111111111111111';
const invoice:CryptoInvoice={id:'i',account:'workspace',plan:'pro',amount:'49000000',recipient:'0x2222222222222222222222222222222222222222',chainId:8453,token:PAYMENT_TOKEN,createdAt:'2026-11-01T00:00:00.000Z',expiresAt:'2026-11-01T01:00:00.000Z',status:'open',txHash:null,payer:null};
const evidence:PaymentEvidence={chainId:8453,success:true,canonical:true,finalized:true,timestamp:Date.parse('2026-11-01T00:30:00Z')/1000,transfers:[{token:PAYMENT_TOKEN,from:payer,to:invoice.recipient,amount:49000000n}]};
test('only exact canonical finalized USDC payments qualify',()=>{
  assert.equal(paymentVerdict(invoice,payer,evidence),'paid');assert.equal(paymentVerdict(invoice,payer,{...evidence,finalized:false}),'pending');
  for(const change of [{chainId:1},{success:false},{canonical:false},{transfers:[]},{timestamp:0}])assert.throws(()=>paymentVerdict(invoice,payer,{...evidence,...change}));
});
test('wrong payer, amount, token and recipient never credit an invoice',()=>{
  for(const change of [{from:invoice.recipient},{to:payer},{amount:48999999n},{amount:49000001n},{token:payer}])assert.throws(()=>paymentVerdict(invoice,payer,{...evidence,transfers:[{...evidence.transfers[0],...change}]}));
});
test('payment proof binds invoice, account, network, amount, recipient and origin',()=>{
  const message=paymentProofMessage(invoice,payer,'https://portova.vercel.app');
  assert.notEqual(message,paymentProofMessage({...invoice,id:'other'},payer,'https://portova.vercel.app'));
  assert.notEqual(message,paymentProofMessage({...invoice,account:'attacker'},payer,'https://portova.vercel.app'));
  assert.notEqual(message,paymentProofMessage(invoice,payer,'https://wrong.example'));
  assert.ok(message.includes(invoice.recipient));assert.ok(message.includes(invoice.amount));
});
