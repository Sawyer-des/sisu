import { accountRequest } from './accounts.mjs';
import { assets,csp } from './assets.generated.mjs';
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(url.pathname.startsWith('/api/'))return accountRequest(request,env);
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 const file=assets[url.pathname==='/'?'/index.html':url.pathname];
 if(!file)return new Response('Not found',{status:404});
 return new Response(request.method==='HEAD'?null:file.body,{headers:{'Content-Type':file.type,'Cache-Control':url.pathname.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-cache','Content-Security-Policy':csp,'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'SAMEORIGIN'}});
}};
