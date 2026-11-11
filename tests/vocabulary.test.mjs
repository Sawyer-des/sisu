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

test('marking every flashcard Still learning visits the entire fixed deck exactly once',()=>{
 const run=app();run("account.user={id:'learner',username:'Learner'};const originalDeck=SEED.entries.slice(0,80);startSession('flash',originalDeck);const seenCards=[]");
 for(let i=0;i<80;i++){assert.equal(run('session.index'),i);run('seenCards.push(session.words[session.index].id);flip();rateFlash(0)');assert.equal(run('session.words.length'),80);}
 assert.ok(run('session.complete'));assert.equal(run('session.attempts'),80);assert.equal(run('totalToday()'),80);assert.equal(run('new Set(seenCards).size'),80);assert.ok(run('seenCards.every((id,i)=>id===originalDeck[i].id)'));assert.equal(run('originalDeck.length'),80);assert.equal(run('session.misses.length'),80);
 run("document.querySelector('#retryMissed').onclick()");assert.equal(run('session.words.length'),80);assert.equal(run('session.index'),0);assert.ok(!run('session.browse'));
});
test('browse mode flips and moves both ways without modifying any account state',()=>{
 const run=app();run("account.user={id:'learner',username:'Learner'};account.dirty=false;const beforeBrowse=JSON.stringify(state);startSession('flash',SEED.entries.slice(0,116),'fi-en',SEED.entries,{browse:true})");assert.equal(run('session.direction'),'fi-en');assert.equal(run('session.words.length'),116);
 run('moveBrowse(-1)');assert.equal(run('session.index'),0);run('flip();rateFlash(1);record(session.words[0],1)');assert.equal(run('session.attempts'),0);
 for(let i=0;i<115;i++)run('moveBrowse(1)');assert.equal(run('session.index'),115);run('moveBrowse(1)');assert.equal(run('session.index'),115);assert.ok(!run('session.complete'));
 for(let i=0;i<115;i++)run('moveBrowse(-1)');assert.equal(run('session.index'),0);assert.ok(!run('session.revealed'));assert.equal(run('JSON.stringify(state)'),run('beforeBrowse'));assert.equal(run('account.dirty'),false);assert.equal(run('session.skipped'),0);
 assert.ok(run("document.querySelector('#app').innerHTML.includes('No progress is saved')"));assert.ok(!run("document.querySelector('#app').innerHTML.includes('id=\"rateAgain\"')"));
});
test('rapid clicks and old animation completions do not skip or rate extra cards',()=>{
 const run=app();run("account.user={id:'learner',username:'Learner'};startSession('flash',SEED.entries.slice(0,5));document.querySelector('.flashcard-shell').animate=()=>({finished:{then(done){window.endMotion=done}}});flip();rateFlash(0);rateFlash(0);skipFlash()");assert.equal(run('session.index'),1);assert.equal(run('session.attempts'),1);assert.equal(run('totalToday()'),1);
 run("startSession('flash',SEED.entries.slice(5,10));window.endMotion()");assert.equal(run('session.index'),0);assert.equal(run('session.attempts'),0);
});
test('Learn and Write use fixed queues and ignore duplicate continuation events',()=>{
 for(const mode of ['learn','write']){const run=app();run(`account.user={id:'learner',username:'Learner'};startSession('${mode}',SEED.entries.slice(0,6))`);
 for(let i=0;i<6;i++){run("submitAnswer('definitely incorrect');nextQuestion();nextQuestion()");assert.equal(run('session.words.length'),6);assert.equal(run('session.index'),i+1);}
 assert.ok(run('session.complete'));assert.equal(run('session.attempts'),6);assert.equal(run('totalToday()'),6);}
});
test('guest studying stays untracked; matching cannot count the same pair twice',()=>{
 const run=app();run("const guestState=JSON.stringify(state);startSession('flash',SEED.entries.slice(0,3));flip();rateFlash(0);flip();rateFlash(1);skipFlash()");assert.equal(run('JSON.stringify(state)'),run('guestState'));
 run("account.user={id:'learner',username:'Learner'};startSession('match',SEED.entries.slice(0,4));const pair=session.board[0].id;selectMatch(pair,'fi');selectMatch(pair,'en');selectMatch(pair,'fi');selectMatch(pair,'en')");assert.equal(run('session.correct'),1);assert.equal(run('totalToday()'),1);
});

test('Listen and Test preserve grading and cannot submit twice',()=>{
 const run=app();run("account.user={id:'learner',username:'Learner'};startSession('listen',SEED.entries.slice(0,2));submitAnswer(session.words[0].fi);nextQuestion();nextQuestion()");assert.equal(run('session.correct'),1);assert.equal(run('session.attempts'),1);assert.equal(run('totalToday()'),1);
 run("startSession('test',SEED.entries.slice(0,3));session.testAnswers={0:'hi',1:'and',2:'welcome'};const submitTest=document.querySelector('#testForm').onsubmit;submitTest({preventDefault(){}});submitTest({preventDefault(){}})");assert.equal(run('session.correct'),3);assert.equal(run('session.attempts'),3);assert.equal(run('totalToday()'),4);
});
