import {neon} from '@neondatabase/serverless';
import {readFile} from 'node:fs/promises';
const [ticket,filename]=process.argv.slice(2),url=process.env.DATABASE_URL??process.env.POSTGRES_URL;
if(!url||!/^[a-f0-9-]{36}$/.test(ticket??'')||!filename)throw Error('Set DATABASE_URL, then provide a ticket UUID and a local reply text file.');
const reply=(await readFile(filename,'utf8')).trim();if(!reply||reply.length>2000)throw Error('Reply must be 1–2000 characters.');
const sql=neon(url);const rows=await sql`UPDATE portova_support SET response=${reply},status='answered' WHERE id=${ticket}::uuid RETURNING id`;
console.log(rows.length?'Reply saved for the requesting wallet.':'Ticket not found.');
