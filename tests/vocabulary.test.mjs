import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {webcrypto} from 'node:crypto';
const root=new URL('../',import.meta.url),seed=JSON.parse(fs.readFileSync(new URL('vocabulary.json',root),'utf8'));
test('headwords are unique within every chapter and all merged senses have grammatical labels',()=>{
 const keys=seed.entries.map(e=>`${e.book}|${e.chapter}|${e.fi.normalize('NFC').trim().toLocaleLowerCase('fi')}`);assert.equal(new Set(keys).size,keys.length);assert.equal(keys.length,2358);
 assert.equal(seed.entries.filter(e=>e.book===1).length,1253);assert.equal(seed.entries.filter(e=>e.book===2).length,1105);
 for(const e of seed.entries.filter(e=>e.senses)){assert.ok(e.senses.length>1);for(const sense of e.senses){assert.ok(e.en.includes(sense.en));assert.ok(e.pos.split('+').includes(sense.pos));}}
 assert.equal(Object.keys(seed.entryAliases).length,27);for(const id of Object.values(seed.entryAliases))assert.ok(seed.entries.some(e=>e.id===id));
 const nature=seed.entries.filter(e=>e.section==='sm2-c3-nature'&&e.fi==='kuusi');assert.equal(nature.length,1);assert.equal(nature[0].en,'spruce tree');assert.equal(nature[0].sourcePage,89);
 const number=seed.entries.find(e=>e.id==='e1658');assert.equal(number.section,'sm1-c1-numbers');assert.equal(number.en,'six');assert.equal(number.sourcePage,15);
});
function app(){const element=()=>({innerHTML:'',textContent:'',style:{},dataset:{},classList:{toggle(){}},setAttribute(){},focus(){},showModal(){},close(){},querySelectorAll(){return []}}),nodes=new Map();const document={querySelector(q){if(!nodes.has(q))nodes.set(q,element());return nodes.get(q)},querySelectorAll(){return []},addEventListener(){}};const context={document,localStorage:{getItem(){return null},setItem(){}},setTimeout(){},clearTimeout(){},console,Date,crypto:webcrypto,Blob,URL,scrollTo(){}};context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('dist/data.js',root),'utf8'),context);vm.runInContext(fs.readFileSync(new URL('dist/app.js',root),'utf8'),context);return code=>vm.runInContext(code,context)}
test('combined senses work in quizzes; legacy progress and stars remain available',()=>{
 const run=app();run("session={direction:'fi-en'}");assert.ok(run("accepted('hello',SEED.entries.find(e=>e.fi==='terve'&&e.chapter==='sm1-1'))"));assert.ok(run("accepted('healthy',SEED.entries.find(e=>e.fi==='terve'&&e.chapter==='sm1-1'))"));assert.ok(run("posLabel('A+IN').includes('Adjective')&&posLabel('A+IN').includes('Interjection')"));
 run("const merged=SEED.entries.find(e=>e.id==='e0020');const oldKey=SEED.legacyProgressKeys.e0020[1];state.progress[oldKey]={level:3,seen:8,right:6,last:123};state.stars=['e0021'];account.user={id:'learner',username:'Learner'}");assert.equal(run('prog(merged).level'),3);assert.ok(run("isStarred('e0020')"));run('record(merged,1)');assert.equal(run('prog(merged).level'),4);assert.equal(run('prog(merged).seen'),9);assert.equal(run('totalToday()'),1);
 run("state.overrides.e0020={id:'e0020',fi:'terve',en:'healthy; well',pos:'A',notes:'Saved personal note'}");assert.ok(run("entries().find(e=>e.id==='e0020').en.includes('hello')"));assert.equal(run("entries().find(e=>e.id==='e0020').notes"),'Saved personal note');
 const before=run('entries().length');run("state.custom.push({id:'custom-dupe',fi:'terve',en:'greetings',pos:'IN',book:1,chapter:'sm1-1',section:'sm1-c1-main'})");assert.equal(run('entries().length'),before);assert.ok(run("entries().find(e=>e.id==='e0020').en.includes('greetings')"));
});
test('the interface and English data use American English',()=>{
 const app=fs.readFileSync(new URL('dist/app.js',root),'utf8'),template=fs.readFileSync(new URL('index.template.html',root),'utf8');assert.match(template,/lang="en-US"/);assert.doesNotMatch(app,/\b(?:practise|practising|colour|favourite|neighbour)\b/i);
 for(const e of seed.entries)assert.doesNotMatch(e.en,/\b(?:grey|trousers|lorry|practise|colour|favourite|neighbour)\b/i);
});

test('restoring a removed word preserves unrelated hidden words and all progress',()=>{
 const run=app();run("account.user={id:'owner',username:'Sawyer',canEditVocabulary:true};state.hidden=['e1658','e0021'];state.stars=['e1658'];state.progress['kuusi|NU|six']={level:3,seen:7,right:5};state.history['2026-11-10']={reviews:7,right:5};const beforeRecovery=JSON.stringify({progress:state.progress,history:state.history,stars:state.stars,overrides:state.overrides,custom:state.custom});view='manage'");
 assert.ok(!run("entries().some(e=>e.id==='e1658')"));assert.ok(run("removedWordsPanel().includes('kuusi')&&removedWordsPanel().includes('six')"));assert.ok(run("restoreRemovedWord('e1658')"));assert.ok(run("entries().some(e=>e.id==='e1658'&&e.chapter==='sm1-1')"));assert.deepEqual(JSON.parse(run('JSON.stringify(state.hidden)')),['e0021']);assert.equal(run('JSON.stringify({progress:state.progress,history:state.history,stars:state.stars,overrides:state.overrides,custom:state.custom})'),run('beforeRecovery'));
 assert.ok(run("restoreRemovedWord('e0021')"));assert.equal(run('state.hidden.length'),0);
 run("account.user={id:'learner',username:'Learner'};state.hidden=['e1658']");assert.equal(run("restoreRemovedWord('e1658')"),false);assert.equal(run('state.hidden.length'),1);assert.equal(run('removedWordsPanel()'),'');
});
