import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {build} from 'esbuild';
const root=path.resolve(import.meta.dirname,'..'),dist=path.join(root,'dist');
const html=fs.readFileSync(path.join(dist,'index.html'),'utf8'),names=['index.html','release.json',...Array.from(html.matchAll(/(?:src|href)="(assets\/[^"]+)"/g),m=>m[1])];
const assets=Object.fromEntries(names.map(name=>['/'+name,{body:fs.readFileSync(path.join(dist,name),'utf8'),type:name.endsWith('.js')?'text/javascript; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':name.endsWith('.json')?'application/json':'text/html; charset=utf-8'}]));
const hashes=Array.from(html.matchAll(/<script>([\s\S]*?)<\/script>/g),m=>"'sha256-"+crypto.createHash('sha256').update(m[1]).digest('base64')+"'").join(' ');
const csp=`default-src 'self'; script-src 'self' ${hashes}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; object-src 'none'`;
fs.writeFileSync(path.join(root,'server/assets.generated.mjs'),'export const assets='+JSON.stringify(assets)+';export const csp='+JSON.stringify(csp)+';');
await build({entryPoints:[path.join(root,'server/worker.mjs')],outfile:path.join(dist,'server/index.js'),bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true});
if(fs.existsSync(path.join(root,'.openai/hosting.json'))){fs.mkdirSync(path.join(dist,'.openai'),{recursive:true});fs.copyFileSync(path.join(root,'.openai/hosting.json'),path.join(dist,'.openai/hosting.json'));}
console.log('Built account-enabled Worker with current static assets.');
