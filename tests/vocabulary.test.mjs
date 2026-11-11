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
function app(storage=new Map()){const element=()=>({innerHTML:'',textContent:'',style:{},dataset:{},classList:{toggle(){}},setAttribute(){},focus(){},showModal(){},close(){},querySelectorAll(){return []}}),nodes=new Map();const document={querySelector(q){if(!nodes.has(q))nodes.set(q,element());return nodes.get(q)},querySelectorAll(){return []},addEventListener(){}};const context={document,localStorage:{getItem(k){return storage.get(k)??null},setItem(k,v){storage.set(k,v)}},setTimeout(){},clearTimeout(){},console,Date,crypto:webcrypto,Blob,URL,scrollTo(){}};context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('dist/data.js',root),'utf8'),context);vm.runInContext(fs.readFileSync(new URL('dist/app.js',root),'utf8'),context);return code=>vm.runInContext(code,context)}
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
test('browse mode saves only its place without modifying learning progress',()=>{
 const run=app();run("account.user={id:'learner',username:'Learner'};account.dirty=false;const beforeBrowse=JSON.stringify({...state,studySessions:[]});startSession('flash',SEED.entries.slice(0,116),'fi-en',SEED.entries,{browse:true})");assert.equal(run('session.direction'),'fi-en');assert.equal(run('session.words.length'),116);
 run('moveBrowse(-1)');assert.equal(run('session.index'),0);run('flip();rateFlash(1);record(session.words[0],1)');assert.equal(run('session.attempts'),0);
 for(let i=0;i<115;i++)run('moveBrowse(1)');assert.equal(run('session.index'),115);run('moveBrowse(1)');assert.equal(run('session.index'),115);assert.ok(!run('session.complete'));
 for(let i=0;i<115;i++)run('moveBrowse(-1)');assert.equal(run('session.index'),0);assert.ok(!run('session.revealed'));assert.equal(run('JSON.stringify({...state,studySessions:[]})'),run('beforeBrowse'));assert.equal(run('state.studySessions.length'),1);assert.equal(run('session.skipped'),0);
 assert.ok(run("document.querySelector('#app').innerHTML.includes('No progress is saved')"));assert.ok(!run("document.querySelector('#app').innerHTML.includes('id=\"rateAgain\"')"));
});
test('rapid clicks and old animation completions do not skip or rate extra cards',()=>{
 const run=app();run("account.user={id:'learner',username:'Learner'};startSession('flash',SEED.entries.slice(0,5));document.querySelector('.flashcard-shell').animate=()=>({cancel(){},finished:{then(done){window.endMotion=done}}});flip();rateFlash(0);rateFlash(0);skipFlash()");assert.equal(run('session.index'),1);assert.equal(run('session.attempts'),1);assert.equal(run('totalToday()'),1);
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


test('advancing, feedback, and summaries never request scrolling to the page top',()=>{
 const run=app();run("window.scrollCalls=0;window.scrollTo=()=>window.scrollCalls++;window.requestAnimationFrame=fn=>fn();document.querySelector('.feedback').scrollIntoView=()=>{throw Error('Unexpected forced feedback scroll')}");
 for(const mode of ['flash','learn','write','listen']){
  run(`startSession('${mode}',SEED.entries.slice(0,2));window.scrollCalls=0`);
  if(mode==='flash')run('flip();rateFlash(0);flip();rateFlash(1)');else run("submitAnswer('incorrect');nextQuestion();submitAnswer('incorrect');nextQuestion()");
  assert.equal(run('window.scrollCalls'),0,mode);assert.ok(run('session.complete'));
 }
 run("startSession('flash',SEED.entries.slice(0,3),'fi-en',SEED.entries,{browse:true});window.scrollCalls=0;moveBrowse(1);moveBrowse(-1)");assert.equal(run('window.scrollCalls'),0);
 run("startSession('test',SEED.entries.slice(0,2));window.scrollCalls=0;document.querySelector('#testForm').onsubmit({preventDefault(){}})");assert.equal(run('window.scrollCalls'),0);
});

test('account-aware home, navigation, and empty states have clear recovery paths',()=>{
 const run=app();run('account.ready=false;home()');assert.ok(!run("document.querySelector('#app').innerHTML.includes('guest-invitation')"));
 run('account.ready=true;home()');assert.ok(run("document.querySelector('#app').innerHTML.includes('guest-invitation')"));
 run("account.user={id:'learner',username:'Learner'};account.status='saved';home()");
 assert.ok(!run("document.querySelector('#app').innerHTML.includes('guest-invitation')"));assert.ok(!run("document.querySelector('#app').innerHTML.includes('Guest practice')"));assert.ok(run("document.querySelector('#app').innerHTML.includes('data-home')"));
 assert.ok(!run("document.querySelector('#app').innerHTML.includes('data-nav=\"manage\"')"));
 run('openAccount()');assert.ok(run("document.querySelector('#modal').innerHTML.includes('data-account-nav=\"manage\"')"));assert.ok(run("document.querySelector('#modal').innerHTML.includes('data-account-nav=\"progress\"')"));
 assert.ok(run("emptyVocabulary('No words').includes('data-clear-filters')&&emptyVocabulary('No words').includes('data-nav=\"library\"')"));
 run("account.user=null;view='manage';guestAccountPage('Settings')");assert.ok(run("document.querySelector('#app').innerHTML.includes('data-appearance-choice=\"system\"')"));
});

test('initial account loading preserves navigation and ignores stale identity responses',async()=>{
 const run=app();run("view='library';accountAPI=async()=>({user:{id:'learner',username:'Learner'},state:{},revision:1})");await run('loadAccount()');assert.equal(run('view'),'library');assert.equal(run('account.user.id'),'learner');
 run("accountAPI=()=>new Promise(resolve=>window.resolveOldSession=resolve);window.oldLoad=loadAccount();installAccount({user:{id:'newer',username:'Newer'},state:{},revision:2});window.resolveOldSession({user:null})");await run('window.oldLoad');assert.equal(run('account.user.id'),'newer');assert.equal(run('account.status'),'saved');
});


test('reload restores a fixed flashcard deck and its exact next card without duplicate grades',()=>{
 const storage=new Map(),run=app(storage);run("account.user={id:'resume-a',username:'ResumeA'};account.ready=true;startSession('flash',SEED.entries.slice(0,80));flip();rateFlash(0)");
 const order=run('JSON.stringify(session.words.map(e=>e.id))');assert.equal(run('session.index'),1);assert.equal(run('totalToday()'),1);
 const next=app(storage);next("installAccount({user:{id:'resume-a',username:'ResumeA'},state:freshState(),revision:0})");assert.equal(next('view'),'session');assert.equal(next('session.index'),1);assert.equal(next('JSON.stringify(session.words.map(e=>e.id))'),order);assert.equal(next('totalToday()'),1);assert.equal(next('session.transitioning'),false);assert.equal(next('session.revealed'),false);
 next("pauseSession('home')");assert.equal(next('state.studySessions.length'),1);assert.ok(next("inProgressPanel().includes('Continue set')"));next('resumeDraft(state.studySessions[0].id)');assert.equal(next('session.index'),1);
 const other=app(storage);other("installAccount({user:{id:'resume-b',username:'ResumeB'},state:freshState(),revision:0})");assert.equal(other('session'),null);assert.equal(other('state.studySessions.length'),0);
});

test('all learning modes restore pending answers, choices, and matching boards',()=>{
 for(const mode of ['learn','write','listen','match','test']){
  const storage=new Map(),run=app(storage);run(`account.user={id:'resume',username:'Resume'};startSession('${mode}',SEED.entries.slice(0,8))`);
  if(mode==='learn')run("submitAnswer(session.options[0])");
  if(['write','listen'].includes(mode))run("session.typedAnswer='hyvää';checkpointSession()");
  if(mode==='test')run("session.testAnswers={0:'hello',3:'sorry'};checkpointSession()");
  if(mode==='match')run("selectMatch(session.board[0].id,'fi');selectMatch(session.board[0].id,'en')");
  const expected=run('packSession(session)');const next=app(storage);next("installAccount({user:{id:'resume',username:'Resume'},state:freshState(),revision:0})");assert.equal(next('packSession(session)'),expected,mode);assert.equal(next('state.studySessions.length'),1);
 }
});

test('completed sessions disappear from In progress, and multiple paused sets remain independent',()=>{
 const run=app();run("account.user={id:'resume',username:'Resume'};startSession('flash',SEED.entries.slice(0,2));flip();rateFlash(1);pauseSession();const first=state.studySessions[0].id;startSession('test',SEED.entries.slice(2,5));pauseSession()");assert.equal(run('state.studySessions.length'),2);run('resumeDraft(first);flip();rateFlash(1)');assert.ok(run('session.complete'));assert.equal(run('state.studySessions.length'),1);assert.equal(run('state.studySessions[0].mode'),'test');
});


test('a tab killed during an acknowledged save recovers newer unsent cards',async()=>{
 const storage=new Map(),run=app(storage);run("account.user={id:'inflight',username:'InFlight'};startSession('flash',SEED.entries.slice(0,8));flip();rateFlash(1);accountAPI=(_p,_m,body)=>{window.sentState=body.state;return new Promise(resolve=>window.finishSave=resolve)};window.inFlight=flushAccountSave();flip();rateFlash(0)");
 assert.equal(run('session.index'),2);const serverState=run('JSON.stringify(sentState)');const next=app(storage);next(`installAccount({user:{id:'inflight',username:'InFlight'},state:${serverState},revision:1})`);assert.equal(next('session.index'),2);assert.equal(next('totalToday()'),2);assert.equal(next('account.revision'),1);
 run('accountAPI=async()=>({revision:2});window.finishSave({revision:1})');await run('window.inFlight');
});

