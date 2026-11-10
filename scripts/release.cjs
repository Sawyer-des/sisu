const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,12);
const sources=Object.fromEntries(['styles.css','data.js','app.js'].map(n=>[n,fs.readFileSync(path.join(dist,n),'utf8').replace(/^\uFEFF/,'')]));
const version=hash(Object.values(sources).join('\n'));
fs.mkdirSync(path.join(dist,'assets'),{recursive:true});
let html=fs.readFileSync(path.join(root,'index.template.html'),'utf8');
for(const [name,body] of Object.entries(sources)){
 const ext=path.extname(name),base=path.basename(name,ext),file=`assets/${base}.${hash(body)}${ext}`;
 fs.writeFileSync(path.join(dist,file),body);html=html.replace(`{{${name}}}`,file);
}
html=html.replace('{{version}}',version);fs.writeFileSync(path.join(dist,'index.html'),html);
const seed=JSON.parse(sources['data.js'].slice('window.SEED='.length).trim().replace(/;$/,''));
const books={1:seed.entries.filter(e=>e.book===1).length,2:seed.entries.filter(e=>e.book===2).length};
if(books[1]+books[2]!==seed.entries.length)throw Error('Book totals do not add up to the vocabulary total.');
fs.writeFileSync(path.join(dist,'release.json'),JSON.stringify({version,total:seed.entries.length,books}));
let portable=html.replace(/<link rel="stylesheet" href="[^"]+">/,()=>'<style>'+sources['styles.css']+'</style>');
for(const name of ['data','app'])portable=portable.replace(new RegExp(`<script src="assets/${name}\\.[^"]+"></script>`),()=>'<script>'+sources[name+'.js'].replace(/<\/script/gi,'<\\/script')+'</script>');
fs.writeFileSync(path.resolve(root,'Sisu.html'),portable);
console.log(JSON.stringify({version,total:seed.entries.length,books}));

const docs=path.join(root,'docs');fs.mkdirSync(docs,{recursive:true});fs.writeFileSync(path.join(docs,'index.html'),html);fs.writeFileSync(path.join(docs,'release.json'),fs.readFileSync(path.join(dist,'release.json')));fs.writeFileSync(path.join(docs,'.nojekyll'),'');
for(const match of html.matchAll(/(?:src|href)="(assets\/[^\"]+)"/g)){const target=path.join(docs,match[1]);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(dist,match[1]),target)}
