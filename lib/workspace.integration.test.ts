import test,{before,after} from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";
const db=new PGlite();
before(async()=> {await db.exec(await readFile(new URL('../scripts/cloud-schema.sql',import.meta.url),'utf8'));for(const file of ['002-workspaces.sql','003-indexer.sql','004-crypto-payments.sql','005-crypto-entitlements.sql','006-pilot-pricing.sql'])await db.exec(await readFile(new URL(`../scripts/migrations/${file}`,import.meta.url),'utf8'));});
after(async()=>{await db.close();});
async function command(owner:string,payload:unknown,id=crypto.randomUUID()) {
  await db.query("INSERT INTO portova_challenges(id,owner,payload,message,expires_at) VALUES($1,$2,$3,'signed by API',now()+interval '5 minutes') ON CONFLICT DO NOTHING",[id,owner,JSON.stringify(payload)]);
  const result=await db.query<{result:Record<string,unknown>}>("SELECT portova_execute($1::uuid) AS result",[id]);return result.rows[0].result;
}
const project=(id:string,name=id)=>({id,name,assetId:"1",collectionId:"",poolLpToken:"",proceeds:""});
const save=(id:string,revision=0)=>({action:"save",project:project(id),revision,description:"Example",published:false});
test("atomic save returns the original result on replay and never increments twice",async()=>{
  const id=crypto.randomUUID();const first=await command('alice',save('one'),id),second=await command('alice',save('one'),id);
  assert.deepEqual(second,first);const rows=await db.query<{revision:number}>("SELECT revision FROM portova_projects WHERE id='one'");assert.equal(rows.rows[0].revision,1);
});
test("conflicted writes roll back consumption and keep the original record",async()=>{
  const id=crypto.randomUUID();await assert.rejects(command('alice',save('one',0),id),/revision_conflict/);
  const rows=await db.query<{result:unknown}>("SELECT result FROM portova_challenges WHERE id=$1",[id]);assert.equal(rows.rows[0].result,null);
  await command('alice',save('one',1));await assert.rejects(command('alice',save('one',1)),/revision_conflict/);
});
test("unauthorized wallets cannot read dashboards, edit or delete a project",async()=>{
  for(const payload of [{action:'dashboard',projectId:'one'},save('one',2),{action:'delete',projectId:'one'}])await assert.rejects(command('mallory',payload),/permission_denied/);
});
test("collaborators explicitly accept and viewer roles cannot mutate",async()=>{
  await db.query("INSERT INTO portova_billing(account,plan,status,period_end) VALUES('alice','team','active',now()+interval '1 month')");
  await command('alice',{action:'invite',projectId:'one',account:'bob',role:'viewer'});
  await assert.rejects(command('bob',{action:'dashboard',projectId:'one'}),/permission_denied/);
  await command('bob',{action:'accept',projectId:'one'});assert.equal((await command('bob',{action:'dashboard',projectId:'one'})).role,'viewer');
  await assert.rejects(command('bob',save('one',2)),/permission_denied/);
  await command('alice',{action:'revoke',projectId:'one',account:'bob'});await assert.rejects(command('bob',{action:'dashboard',projectId:'one'}),/permission_denied/);
});
test("ownership transfers require the target wallet and invalidate the old owner",async()=>{
  await command('alice',{action:'transfer',projectId:'one',account:'carol'});
  await assert.rejects(command('mallory',{action:'accept-transfer',projectId:'one'}),/permission_denied/);
  await command('carol',{action:'accept-transfer',projectId:'one'});
  await assert.rejects(command('alice',{action:'dashboard',projectId:'one'}),/permission_denied/);
});
test("free account creation quota is enforced in the database",async()=>{
  for(const id of ['q1','q2','q3'])await command('quota',save(id));await assert.rejects(command('quota',save('q4')),/plan_limit/);
});
test("indexer rejects divergent parents and duplicate workers cannot skip blocks",async()=>{
  await assert.rejects(db.query("SELECT portova_ingest('missing',0,1,'h','parent','[]')"),/indexer_not_initialized/);
  await db.query("INSERT INTO portova_indexer VALUES('g',10,'parent',11,now())");
  await assert.rejects(db.query("SELECT portova_ingest('g',10,11,'h','wrong','[]')"),/indexer_parent_mismatch/);
  assert.equal((await db.query<{ok:boolean}>("SELECT portova_ingest('g',10,11,'h','parent','[]') AS ok")).rows[0].ok,true);
  assert.equal((await db.query<{ok:boolean}>("SELECT portova_ingest('g',10,11,'h','parent','[]') AS ok")).rows[0].ok,false);
});
test("workspace listing includes accepted permissions and only the caller's tickets",async()=>{
  await command('carol',{action:'support',category:'pilot',message:'Please help with my project launch.'});
  const listed=await command('carol',{action:'list'});
  assert.equal((listed.projects as Array<{id:string}>).some(p=>p.id==='one'),true);
  assert.equal((listed.tickets as unknown[]).length,1);
  assert.equal(((await command('mallory',{action:'list'})).tickets as unknown[]).length,0);
});
test("monitor snapshot writes reject stale project revisions and concurrent baselines",async()=>{
  const rows=await db.query<{revision:number}>("SELECT revision FROM portova_projects WHERE id='one'");const rev=rows.rows[0].revision;
  const check=async(revision:number,prior:number,height:number)=>(await db.query<{ok:boolean}>("SELECT portova_monitor('one',$1,$2,$3,'hash','{}','[]') AS ok",[revision,prior,height])).rows[0].ok;
  assert.equal(await check(rev+1,-1,100),false);
  assert.equal(await check(rev,-1,100),true);
  assert.equal(await check(rev,-1,101),false);
  assert.equal(await check(rev,100,101),true);
});

test('editors cannot publish, and subscription expiry makes them read-only',async()=>{
  await db.query("INSERT INTO portova_billing(account,plan,status,period_end) VALUES('carol','team','active',now()+interval '1 month')");
  await command('carol',{action:'invite',projectId:'one',account:'editor',role:'editor'});await command('editor',{action:'accept',projectId:'one'});
  const rows=await db.query<{revision:number}>("SELECT revision FROM portova_projects WHERE id='one'");const rev=rows.rows[0].revision;
  await assert.rejects(command('editor',{...save('one',rev),published:true}),/permission_denied/);
  await command('editor',save('one',rev));
  await db.query("UPDATE portova_billing SET status='canceled' WHERE account='carol'");
  await assert.rejects(command('editor',save('one',rev+1)),/permission_denied/);
  assert.equal((await command('editor',{action:'dashboard',projectId:'one'})).role,'viewer');
});
test('concurrent saves of one revision allow only one winner',async()=>{
  const rows=await db.query<{revision:number}>("SELECT revision FROM portova_projects WHERE id='one'");const rev=rows.rows[0].revision;
  const results=await Promise.allSettled([command('carol',save('one',rev)),command('carol',save('one',rev))]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.filter(r=>r.status==='rejected').length,1);
});

test('crypto credit is idempotent and paid terms do not overlap',async()=>{
  const first=crypto.randomUUID(),second=crypto.randomUUID();
  for(const [id,plan] of [[first,'pro'],[second,'team']])await db.query("INSERT INTO portova_crypto_invoices(id,account,plan,amount,recipient,chain_id,token,expires_at,status,tx_hash,payer) VALUES($1,'crypto-user',$2,$3,'recipient',8453,'token',now()+interval '1 hour','pending',$4,'payer')",[id,plan,plan==='pro'?49000000:149000000,'hash-'+id]);
  const paid=await db.query<{result:unknown}>("SELECT portova_credit_crypto($1,$2,'payer',now(),123) AS result",[first,'hash-'+first]);
  const repeat=await db.query<{result:unknown}>("SELECT portova_credit_crypto($1,$2,'payer',now(),123) AS result",[first,'hash-'+first]);assert.deepEqual(paid.rows[0].result,repeat.rows[0].result);
  await db.query("SELECT portova_credit_crypto($1,$2,'payer',now(),124)",[second,'hash-'+second]);
  const terms=await db.query<{plan:string;starts_at:Date;ends_at:Date}>("SELECT plan,starts_at,ends_at FROM portova_crypto_terms WHERE account='crypto-user' ORDER BY starts_at");assert.equal(terms.rows.length,2);assert.equal(new Date(terms.rows[0].ends_at).getTime(),new Date(terms.rows[1].starts_at).getTime());
  const active=await db.query<{plan:string}>("SELECT plan FROM portova_entitlements WHERE account='crypto-user'");assert.equal(active.rows[0].plan,'pro');
});
test('a payment transaction cannot be assigned twice',async()=>{
  const id=crypto.randomUUID();await assert.rejects(db.query("INSERT INTO portova_crypto_invoices(id,account,plan,amount,recipient,chain_id,token,expires_at,tx_hash) SELECT $1,'attacker','pro',49000000,'recipient',8453,'token',now()+interval '1 hour',tx_hash FROM portova_crypto_invoices WHERE account='crypto-user' LIMIT 1",[id]),/unique/);
});

test('lower pilot invoice amount is accepted while zero-value invoices are refused',async()=>{
  const id=crypto.randomUUID();await db.query("INSERT INTO portova_crypto_invoices(id,account,plan,amount,recipient,chain_id,token,expires_at) VALUES($1,'pricing-check','pro',19000000,'recipient',8453,'token',now()+interval '1 hour')",[id]);
  await assert.rejects(db.query("UPDATE portova_crypto_invoices SET amount=0 WHERE id=$1",[id]),/check constraint/);
});
