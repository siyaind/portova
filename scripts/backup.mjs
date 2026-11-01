// Logical backup uses pg_dump; do not pass credentials as command arguments.
import {spawn} from 'node:child_process';
import {open,mkdir} from 'node:fs/promises';
import path from 'node:path';
const url=process.env.DATABASE_URL??process.env.POSTGRES_URL;
if(!url)throw Error('Set DATABASE_URL in the backup environment.');
const target=path.resolve(process.env.PORTOVA_BACKUP_DIR??'out/backups');await mkdir(target,{recursive:true});
const file=path.join(target,`portova-${new Date().toISOString().replaceAll(':','-')}.dump`);
const handle=await open(file,'wx',0o600);
const child=spawn('pg_dump',['--format=custom','--no-owner','--no-acl'],{env:{...process.env,PGDATABASE:url},stdio:['ignore',handle.fd,'pipe']});
// Never relay provider connection errors containing credentials to logs.
child.stderr.resume();
const code=await new Promise((resolve,reject)=>{child.on('close',resolve);child.on('error',()=>reject(Error('pg_dump is unavailable. Install the official PostgreSQL client tools.')));});
await handle.close();if(code!==0)throw Error('Backup failed; inspect connectivity privately. A partial file may remain.');
console.log(`Backup saved: ${file}. Store it in encrypted restricted storage and verify restoration into staging.`);
