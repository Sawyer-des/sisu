import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {DatabaseSync} from 'node:sqlite';import {accountRequest,emptyState} from '../server/accounts.mjs';import {adapter} from '../server/local-db.mjs';
function fixture(){const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON');sqlite.exec(fs.readFileSync(new URL('../drizzle/0000_accounts.sql',import.meta.url),'utf8').replaceAll('--> statement-breakpoint',''));const env={DB:adapter(sqlite),DEV_MODE:true};let ip=0;return {sqlite,async call(path,method='GET',body,cookie,origin='http://localhost'){const req=new Request('http://localhost'+path,{method,headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'test-'+(++ip),...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});const res=await accountRequest(req,env);return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0],headers:res.headers}}}}
test('accounts isolate progress, protect passwords and enforce authenticated writes',async()=>{
 const f=fixture(),password='Synthetic test password 42!';
 assert.equal((await f.call('/api/state','PUT',{state:emptyState(),revision:0})).status,401);
 assert.deepEqual((await f.call('/api/session')).data,{user:null});
 assert.equal((await f.call('/api/register','POST',{username:'shortpass',password:'short'})).status,400);
 const a=await f.call('/api/register','POST',{username:'Test_A',password});assert.equal(a.status,200);assert.equal(a.data.user.username,'Test_A');assert.ok(!('password_hash' in a.data.user));
 const row=f.sqlite.prepare('SELECT * FROM users WHERE id=?').get(a.data.user.id);assert.notEqual(row.password_hash,password);assert.equal(row.salt.length,64);assert.ok(!Object.keys(row).some(k=>k.includes('email')));
 assert.match(a.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);assert.equal(a.headers.get('cache-control'),'no-store');
 const b=await f.call('/api/register','POST',{username:'Test_B',password});assert.equal(b.status,200);assert.notEqual(a.data.user.id,b.data.user.id);
 const state=emptyState();state.progress.word={level:1,seen:1,right:1,last:1};state.history['2026-11-10']={reviews:1,right:1};
 const saved=await f.call('/api/state','PUT',{accountId:a.data.user.id,state,revision:0},a.cookie);assert.equal(saved.status,200);assert.equal(saved.data.revision,1);
 assert.equal((await f.call('/api/session','GET',undefined,b.cookie)).data.state.progress.word,undefined);
 assert.equal((await f.call('/api/session','GET',undefined,a.cookie)).data.state.progress.word.level,1);
 assert.equal((await f.call('/api/state','PUT',{accountId:a.data.user.id,state,revision:0},a.cookie)).status,409);
 assert.equal((await f.call('/api/state','PUT',{accountId:a.data.user.id,state,revision:0},b.cookie)).status,401);
 assert.equal((await f.call('/api/state','PUT',{accountId:a.data.user.id,state,revision:1},a.cookie,'https://evil.example')).status,403);
 assert.equal((await f.call('/api/register','POST',{username:'test_a',password})).status,409);
 assert.equal((await f.call('/api/login','POST',{username:'Test_A',password:'wrong'})).status,401);
 const again=await f.call('/api/login','POST',{username:'TEST_A',password});assert.equal(again.status,200);assert.equal(again.data.state.progress.word.seen,1);
 assert.equal((await f.call('/api/logout','POST',{accountId:a.data.user.id},a.cookie)).status,200);
 assert.deepEqual((await f.call('/api/session','GET',undefined,a.cookie)).data,{user:null});
 assert.equal((await f.call('/api/session','GET',undefined,again.cookie)).data.user.id,a.data.user.id);
 f.sqlite.close();
});
test('login throttling and session expiration are enforced',async()=>{
 const f=fixture();for(let i=0;i<6;i++)assert.equal((await f.call('/api/login','POST',{username:'not_registered',password:'incorrect'})).status,401);
 assert.equal((await f.call('/api/login','POST',{username:'not_registered',password:'incorrect'})).status,429);
 const a=await f.call('/api/register','POST',{username:'Expiration',password:'Synthetic test password 42!'});assert.equal(a.status,200);
 f.sqlite.prepare('UPDATE sessions SET expires_at=0').run();assert.deepEqual((await f.call('/api/session','GET',undefined,a.cookie)).data,{user:null});f.sqlite.close();
});

test('GitHub Pages uses isolated bearer sessions and an explicit CORS origin',async()=>{
 const f=fixture(),origin='https://sawyer-des.github.io',url='http://localhost';
 const db={DB:adapter(f.sqlite),DEV_MODE:true};
 const call=async(path,method='GET',body,token,from=origin)=>accountRequest(new Request(url+path,{method,headers:{Origin:from,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})}),db);
 const preflight=await call('/api/state','OPTIONS');assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),origin);
 const response=await call('/api/register','POST',{username:'Pages_User',password:'Synthetic test password 42!'});assert.equal(response.status,200);const a=await response.json();assert.match(a.sessionToken,/^[a-f0-9]{64}$/);
 const state=emptyState();state.progress.sample={level:1,seen:1,right:1};
 assert.equal((await call('/api/state','PUT',{accountId:a.user.id,state,revision:0},a.sessionToken)).status,200);
 const login=await call('/api/login','POST',{username:'Pages_User',password:'Synthetic test password 42!'});const otherDevice=await login.json();assert.notEqual(otherDevice.sessionToken,a.sessionToken);assert.equal(otherDevice.state.progress.sample.level,1);
 assert.equal((await (await call('/api/session','GET',undefined,a.sessionToken)).json()).state.progress.sample.seen,1);
 const blocked=await call('/api/session','GET',undefined,a.sessionToken,'https://other.example');assert.equal(blocked.status,403);assert.equal(blocked.headers.get('access-control-allow-origin'),null);
 assert.equal((await call('/api/logout','POST',{accountId:a.user.id},a.sessionToken)).status,200);assert.deepEqual(await(await call('/api/session','GET',undefined,a.sessionToken)).json(),{user:null});f.sqlite.close();
});

test('vocabulary writes require the pinned Sawyer account, while everyone can save progress',async()=>{
 const f=fixture(),password='Synthetic test password 42!';
 const a=await f.call('/api/register','POST',{username:'Sawyer',password});assert.equal(a.data.user.canEditVocabulary,false);
 const changed=emptyState();changed.custom=[{id:'test-word',fi:'koe',en:'test'}];
 assert.equal((await f.call('/api/state','PUT',{accountId:a.data.user.id,state:changed,revision:0},a.cookie)).status,403);
 for(const field of ['hidden','overrides']){const state=emptyState();if(field==='hidden')state.hidden=['word'];else state.overrides.word={id:'word',fi:'koe',en:'test'};assert.equal((await f.call('/api/state','PUT',{accountId:a.data.user.id,state,revision:0},a.cookie)).status,403);}
 const progress=emptyState();progress.progress.word={level:1,seen:1,right:1};assert.equal((await f.call('/api/state','PUT',{accountId:a.data.user.id,state:progress,revision:0},a.cookie)).status,200);
 // Assign the known immutable owner identity only inside this isolated test database.
 f.sqlite.exec('PRAGMA foreign_keys=OFF');f.sqlite.prepare('UPDATE users SET id=? WHERE id=?').run('600b1225-97c5-481e-94bf-377c9096d396',a.data.user.id);f.sqlite.prepare('UPDATE account_state SET user_id=? WHERE user_id=?').run('600b1225-97c5-481e-94bf-377c9096d396',a.data.user.id);
 const owner=await f.call('/api/login','POST',{username:'Sawyer',password});assert.equal(owner.data.user.canEditVocabulary,true);
 assert.equal((await f.call('/api/state','PUT',{accountId:owner.data.user.id,state:changed,revision:1},owner.cookie)).status,200);f.sqlite.close();
});


test('unfinished study sets sync per account, survive older clients, and reject malformed data',async()=>{
 const f=fixture(),a=await f.call('/api/register','POST',{username:'Resume_A',password:'Synthetic test password 42!'}),b=await f.call('/api/register','POST',{username:'Resume_B',password:'Synthetic test password 42!'});
 const state=emptyState();state.studySessions=[{id:'draft-1',updatedAt:123,title:'SM1 Chapter 1',mode:'flash',index:0,total:1,data:JSON.stringify({mode:'flash',words:[{$entry:'e0001'}],index:0})}];
 assert.equal((await f.call('/api/state','PUT',{accountId:a.data.user.id,state,revision:0},a.cookie)).status,200);
 assert.equal((await f.call('/api/session','GET',undefined,a.cookie)).data.state.studySessions[0].id,'draft-1');assert.equal((await f.call('/api/session','GET',undefined,b.cookie)).data.state.studySessions.length,0);
 const older=emptyState();delete older.studySessions;assert.equal((await f.call('/api/state','PUT',{accountId:a.data.user.id,state:older,revision:1},a.cookie)).status,200);assert.equal((await f.call('/api/session','GET',undefined,a.cookie)).data.state.studySessions.length,1);
 state.studySessions[0].data='not json';assert.equal((await f.call('/api/state','PUT',{accountId:a.data.user.id,state,revision:2},a.cookie)).status,400);f.sqlite.close();
});

