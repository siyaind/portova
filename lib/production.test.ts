import test from "node:test";
import assert from "node:assert/strict";
import {effectivePlan} from "./plans.ts";
import {objectSubjects,changedFacts} from "./indexer-core.ts";
import {validateProjectRequest} from "./cloud-project.ts";
import Stripe from 'stripe';
import {securityHeaders} from './security-headers.ts';
test("entitlements require a paid active unexpired subscription",()=>{
  assert.equal(effectivePlan('team','active','2099-01-01'),'team');
  for(const status of ['past_due','canceled','incomplete',null])assert.equal(effectivePlan('team',status,'2099-01-01'),'free');
  assert.equal(effectivePlan('pro','active','2000-01-01'),'free');
});
test("workspace payloads reject role escalation and unbounded support messages",()=>{
  assert.throws(()=>validateProjectRequest({action:'invite',projectId:'one',account:'x',role:'owner'}));
  assert.throws(()=>validateProjectRequest({action:'support',category:'pilot',message:'x'.repeat(2001)}));
  assert.throws(()=>validateProjectRequest({action:'checkout',plan:'unlimited'}));
});
test("indexer subjects normalize IDs without claiming unrelated objects",()=>{
  assert.deepEqual(objectSubjects('assets',{id:7,amount:88}),['asset:7']);
  assert.deepEqual(objectSubjects('assetConversion',{path:[{native:null},{withId:12}]}),['asset:12']);
  assert.deepEqual(objectSubjects('balances',{id:7}),[]);
});
test("monitor alerts distinguish changed links, missing data and actual reserve drops",()=>{
  assert.equal(changedFacts(null,{issuer:'x'}).length,0);
  assert.equal(changedFacts({assetId:'1',issuer:'a'},{assetId:'2',issuer:'b'}).length,0);
  assert.equal(changedFacts({poolId:'1',reserve1:'100'},{poolId:'1',reserve1:null}).length,0);
  assert.equal(changedFacts({poolId:'1',reserve1:'100'},{poolId:'1',reserve1:'80'}).length,1);
});
test('billing webhook verification rejects modified bodies and expired signatures',()=>{
  const stripe=new Stripe('sk_test_local_fixture'),secret='whsec_local_fixture';
  const payload=JSON.stringify({id:'evt_fixture',object:'event',type:'customer.subscription.updated',data:{object:{id:'sub_fixture'}}});
  const header=stripe.webhooks.generateTestHeaderString({payload,secret});
  assert.equal(stripe.webhooks.constructEvent(payload,header,secret).id,'evt_fixture');
  assert.throws(()=>stripe.webhooks.constructEvent(payload+' ',header,secret));
  const stale=stripe.webhooks.generateTestHeaderString({payload,secret,timestamp:1});
  assert.throws(()=>stripe.webhooks.constructEvent(payload,stale,secret));
});
test('production document CSP uses the supplied nonce without inline script permission',()=>{
  const csp=securityHeaders(false,'unique-request').find(x=>x.key==='Content-Security-Policy')!.value;
  const script=csp.split(';').find(x=>x.trim().startsWith('script-src'))!;
  assert.ok(script.includes("'nonce-unique-request'"));assert.ok(!script.includes("'unsafe-inline'"));assert.ok(!script.includes("'unsafe-eval'"));
});

test('unreviewed runtime upgrades and alternative chains fail closed',async()=>{
  const {supportedRuntime}=await import('./network-policy.ts');const {TESTNET_GENESIS}=await import('./network.ts');
  assert.equal(supportedRuntime(TESTNET_GENESIS,'portaldot-v3',3002),true);
  assert.equal(supportedRuntime(TESTNET_GENESIS,'portaldot-v3',3003),false);
  assert.equal(supportedRuntime('0xwrong','portaldot-v3',3002),false);
});
