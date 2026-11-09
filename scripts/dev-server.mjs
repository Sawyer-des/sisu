import {adapter} from '../server/local-db.mjs';
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import {DatabaseSync} from 'node:sqlite';import worker from '../server/worker.mjs';
const root=path.resolve(import.meta.dirname,'..');fs.mkdirSync(path.join(root,'.local'),{recursive:true});
const sqlite=new DatabaseSync(path.join(root,'.local/sisu.sqlite'));sqlite.exec('PRAGMA foreign_keys=ON');
if(!sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get())sqlite.exec(fs.readFileSync(path.join(root,'drizzle/0000_accounts.sql'),'utf8').replaceAll('--> statement-breakpoint',''));
const DB=adapter(sqlite);
const server=http.createServer(async(req,res)=>{try{const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>2_000_000){res.writeHead(413);res.end();return}chunks.push(c)}const request=new Request(`http://127.0.0.1:8766${req.url}`,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});const response=await worker.fetch(request,{DB,DEV_MODE:true});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()))}catch{res.writeHead(500);res.end('Local server error')}});
server.listen(8766,'127.0.0.1',()=>console.log('Sisu preview: http://127.0.0.1:8766'));
