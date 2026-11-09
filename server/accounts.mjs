import { scrypt } from '@noble/hashes/scrypt.js';
const enc=new TextEncoder(),MAX_BODY=2_000_000,SESSION_MS=7*24*60*60*1000;
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
const bytes=s=>Uint8Array.from(s.match(/../g)||[],x=>parseInt(x,16));
const random=n=>hex(crypto.getRandomValues(new Uint8Array(n)));
const digest=async s=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s))));
export const emptyState=()=>({schemaVersion:1,progress:{},stars:[],overrides:{},custom:[],hidden:[],history:{},settings:{goal:20,size:'all',direction:'fi-en',strict:true}});
function fail(status,message){return Object.assign(new Error(message),{status})}
function json(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}})}
function cookieName(env){return env.DEV_MODE?'sisu_dev':'__Host-sisu'}
function sessionCookie(env,token,maxAge=SESSION_MS/1000){return `${cookieName(env)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${env.DEV_MODE?'':'; Secure'}`}
function cookieToken(request,env){return request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName(env)+'='))?.slice(cookieName(env).length+1)||''}
function constantEqual(a,b){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0}
export function passwordHash(password,salt){return hex(scrypt(enc.encode(password),bytes(salt),{N:32768,r:8,p:3,dkLen:32,maxmem:64*1024*1024}))}
async function body(request){
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw fail(415,'Use JSON for this request.');
 const reader=request.body?.getReader();if(!reader)throw fail(400,'A request body is required.');let size=0,chunks=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_BODY){await reader.cancel();throw fail(413,'The saved collection is too large. Export a backup and reduce its size.')}chunks.push(value)}
 const all=new Uint8Array(size);let n=0;for(const c of chunks){all.set(c,n);n+=c.length}try{return JSON.parse(new TextDecoder().decode(all))}catch{throw fail(400,'Invalid JSON.')}
}
function credentials(data,registration=false){
 const username=typeof data.username==='string'?data.username.trim():'';const password=typeof data.password==='string'?data.password:'';
 if(!/^[A-Za-z0-9][A-Za-z0-9_.-]{1,30}[A-Za-z0-9]$/.test(username))throw fail(400,'Use 3–32 letters, numbers, dots, underscores or hyphens for your username.');
 if(password.length>(128)||enc.encode(password).length>512||registration&&password.length<15||!password.length)throw fail(400,registration?'Use a password between 15 and 128 characters.':'Enter your username and password.');
 return {username,key:username.toLowerCase(),password};
}
async function limit(db,key,max,windowMs){
 const now=Date.now();const row=await db.prepare('INSERT INTO auth_limits (key,attempts,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires_at<=? THEN 1 ELSE attempts+1 END, expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING attempts').bind(key,now+windowMs,now,now).first();
 if(row.attempts>max)throw fail(429,'Too many attempts. Please try again later.');
}
async function throttle(request,env,name,key){
 const ip=await digest(request.headers.get('CF-Connecting-IP')||'local');
 await env.DB.prepare('DELETE FROM auth_limits WHERE expires_at<?').bind(Date.now()-86400000).run();
 await limit(env.DB,`${name}:ip:${ip}`,name==='register'?5:30,name==='register'?3600000:900000);
 if(name==='login')await limit(env.DB,`login:user:${await digest(key)}`,6,900000);
}
async function identity(request,env){
 const token=cookieToken(request,env);if(!/^[a-f0-9]{64}$/.test(token))return null;
 return await env.DB.prepare('SELECT users.id,users.username FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>?').bind(await digest(token),Date.now()).first();
}
async function snapshot(db,user){const row=await db.prepare('SELECT state_json,revision FROM account_state WHERE user_id=?').bind(user.id).first();return {user:{id:user.id,username:user.username},state:row?JSON.parse(row.state_json):emptyState(),revision:row?.revision||0}}
async function signIn(env,user){const token=random(32);await env.DB.prepare('DELETE FROM sessions WHERE expires_at<=?').bind(Date.now()).run();await env.DB.prepare('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').bind(await digest(token),user.id,Date.now()+SESSION_MS).run();return json(await snapshot(env.DB,user),200,{'Set-Cookie':sessionCookie(env,token)})}
function validObject(o){return o&&typeof o==='object'&&!Array.isArray(o)}
export function cleanState(s){
 if(!validObject(s)||s.schemaVersion!==1||!validObject(s.progress)||!validObject(s.history)||!validObject(s.overrides)||!Array.isArray(s.stars)||!Array.isArray(s.hidden)||!Array.isArray(s.custom)||!validObject(s.settings))throw fail(400,'Invalid saved progress.');
 if(Object.keys(s.progress).length>15000||s.custom.length>10000||Object.keys(s.overrides).length>15000||s.stars.length>15000||s.hidden.length>15000)throw fail(400,'This collection exceeds the account storage limit.');
 for(const [k,v] of Object.entries(s.progress)){if(k.length>4000||!validObject(v)||!Number.isInteger(v.level)||v.level<0||v.level>6||!Number.isSafeInteger(v.seen)||v.seen<0||!Number.isSafeInteger(v.right)||v.right<0||v.right>v.seen)throw fail(400,'Invalid word progress.')}
 for(const [d,v] of Object.entries(s.history)){if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!validObject(v)||!Number.isSafeInteger(v.reviews)||v.reviews<0||!Number.isSafeInteger(v.right)||v.right<0||v.right>v.reviews)throw fail(400,'Invalid practice history.')}
 for(const w of [...s.custom,...Object.values(s.overrides)])if(!validObject(w)||typeof w.id!=='string'||typeof w.fi!=='string'||w.fi.length>1000||typeof w.en!=='string'||w.en.length>4000)throw fail(400,'Invalid personal vocabulary.');
 if(!s.stars.every(x=>typeof x==='string')||!s.hidden.every(x=>typeof x==='string')||!Number.isFinite(s.settings.goal)||s.settings.goal<1||s.settings.goal>500)throw fail(400,'Invalid account settings.');
 return {schemaVersion:1,progress:s.progress,history:s.history,overrides:s.overrides,custom:s.custom,stars:s.stars,hidden:s.hidden,settings:{...s.settings,direction:'fi-en',size:'all'},categoryRevision:Number(s.categoryRevision)||0};
}
export async function accountRequest(request,env){
 try{
  if(!env.DB)return json({error:'Accounts are not configured on this host.'},503);
  const path=new URL(request.url).pathname,method=request.method;
  if(method!=='GET'&&request.headers.get('origin')!==new URL(request.url).origin)throw fail(403,'This request must come from Sisu.');
  if(method==='GET'&&path==='/api/session'){const user=await identity(request,env);return json(user?await snapshot(env.DB,user):{user:null})}
  if(method==='POST'&&['/api/register','/api/login'].includes(path)){
   const registration=path==='/api/register',c=credentials(await body(request),registration);await throttle(request,env,registration?'register':'login',c.key);
   if(registration){
    const id=crypto.randomUUID(),salt=random(32),hash=passwordHash(c.password,salt);
    try{await env.DB.batch([env.DB.prepare('INSERT INTO users (id,username_key,username,salt,password_hash,created_at) VALUES (?,?,?,?,?,?)').bind(id,c.key,c.username,salt,hash,Date.now()),env.DB.prepare('INSERT INTO account_state (user_id,state_json,revision) VALUES (?,?,0)').bind(id,JSON.stringify(emptyState()))])}catch(error){if(String(error.message).includes('UNIQUE'))throw fail(409,'That username is already taken.');throw error}
    return await signIn(env,{id,username:c.username});
   }
   const user=await env.DB.prepare('SELECT id,username,salt,password_hash FROM users WHERE username_key=?').bind(c.key).first();
   const actual=passwordHash(c.password,user?.salt||'00'.repeat(32));
   if(!user||!constantEqual(actual,user.password_hash))throw fail(401,'Incorrect username or password.');
   return await signIn(env,user);
  }
  const user=await identity(request,env);if(!user)throw fail(401,'Please sign in to save your progress.');
  if(method==='POST'&&path==='/api/logout'){const data=await body(request);if(data.accountId!==user.id)throw fail(401,'The signed-in account changed. Reload this page.');await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(cookieToken(request,env))).run();return json({ok:true},200,{'Set-Cookie':sessionCookie(env,'',0)})}
  if(method==='PUT'&&path==='/api/state'){
   const data=await body(request);if(data.accountId!==user.id)throw fail(401,'The signed-in account changed. Reload this page.');const state=cleanState(data.state);if(!Number.isSafeInteger(data.revision)||data.revision<0)throw fail(400,'Invalid save version.');
   const row=await env.DB.prepare('UPDATE account_state SET state_json=?,revision=revision+1 WHERE user_id=? AND revision=? RETURNING revision').bind(JSON.stringify(state),user.id,data.revision).first();
   if(!row)throw fail(409,'Your account changed in another tab or device. Download a backup of this tab, then reload to get the latest progress.');return json({revision:row.revision});
  }
  throw fail(404,'Account endpoint not found.');
 }catch(error){return json({error:error.status?error.message:'Accounts are temporarily unavailable. Please try again.'},error.status||500)}
}
