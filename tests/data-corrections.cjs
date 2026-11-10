'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),clone=value=>JSON.parse(JSON.stringify(value));
const D=JSON.parse(fs.readFileSync(path.join(root,'data.json'),'utf8'));
// Model the corrected chart independently of whether the data rebuild has run.
// These are the two schema changes relevant to stored progress; M.O.M.O. :i
// keeps its existing row order, so none of its stored prefixes are shifted.
const retired=['b15-0','b21-0','b21-2'];
D.mercenary.chart_revision=2;
D.corrections={...D.corrections,retired_hunt_ids:retired};
D.mercenary.blades.find(b=>b.name==='斩铁').tracks.find(t=>t.name==='镌刻').rows[2].stage=3;
for(const b of D.blades)b.rows=b.rows.filter(r=>!retired.includes(r.id));
require(path.join(root,'merc-engine.js'));const E=globalThis.XB2_MERC_ENGINE,blades=D.mercenary.blades;
const source=fs.readFileSync(path.join(root,'player-store.js'),'utf8');
const KEY='xb2-mercenary-progress-v1',RULE='xb2-node-labels-v1',FROZEN='xb2-confirmed-node-rules-v1',HUNT='xb2-affinity-done-v1',BACKUP='xb2-variant-backup-v1',MIGRATION='xb2-hunt-linked-migration-v1';
const huntRows=D.blades.flatMap(b=>b.rows.map(r=>({...r,blade:b.name}))),hunt=huntRows.find(r=>r.blade==='八重切'),rule=D.mercenary.ruleGroups[0].id;
let checks=0;const check=fn=>{fn();checks++;};
function profile(name,tier=1){const p=E.defaults(blades.find(b=>b.name===name));p.tier=tier;p.confirmed=true;return p;}
function oldZantetsu(){const p=profile('斩铁',2);p.completed['镌刻']=3;return p;}
function momo(n=0){const p=profile('M.O.M.O. :i',n===2?4:n===1?2:1);p.completed['暗属性之力']=n;return p;}
const payload=(records=[],extra={})=>({format:'xb2-mercenary-progress',version:2,records,...extra});
const variantBackup=()=>({records:[profile('宫比罗'),profile('宫比罗(觉醒)')]});
function fixture(file=payload([oldZantetsu(),profile('焰'),momo(2)],{labels:{[rule]:'manual'}})){
 return new Map([[KEY,JSON.stringify(file)],[RULE,JSON.stringify({[rule]:'manual'})],[FROZEN,JSON.stringify({[rule]:'manual'})],
  [HUNT,JSON.stringify({[hunt.id]:true,...Object.fromEntries(retired.map(id=>[id,true]))})],[BACKUP,JSON.stringify(variantBackup())],
  [MIGRATION,'true'],['xb2-language-v1','ja']]);
}
function boot(storage=new Map(),fail=()=>false){
 const writes=[],events=[],ctx={XB2_DATA:D,XB2_MERC_ENGINE:E,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},dispatchEvent:e=>events.push(e),localStorage:{
  getItem:key=>{if(fail(key,'get'))throw Error('Read blocked');return storage.get(key)??null;},
  setItem:(key,value)=>{if(fail(key,'set'))throw Error('Write blocked');writes.push(['set',key,value]);storage.set(key,value);},
  removeItem:key=>{if(fail(key,'remove'))throw Error('Remove blocked');writes.push(['remove',key]);storage.delete(key);}
 }};
 vm.createContext(ctx);vm.runInContext(source,ctx);return {S:ctx.XB2_PLAYER,storage,writes,events};
}
function assertCurrentHunts(flags){assert.equal(Object.keys(flags).length,huntRows.length);for(const id of retired)assert(!Object.hasOwn(flags,id));for(const value of Object.values(flags))assert.equal(typeof value,'boolean');}

// One invalid old chart must not cause other recorded Blades to disappear.
{
 const old=fixture(),original=JSON.parse(old.get(KEY)),a=boot(old),records=clone(a.S.snapshot().records),fixed=records.find(p=>p.name==='斩铁');
 check(()=>{assert.deepEqual(records.map(p=>p.name),['斩铁','焰','M.O.M.O. :i']);assert.equal(fixed.tier,3);assert.equal(fixed.confirmed,false);assert.deepEqual(fixed.completed,original.records[0].completed);assert.deepEqual(records.slice(1),original.records.slice(1));});
 check(()=>{assert.equal(a.S.exportData().chartRevision,2);assert.equal(JSON.parse(a.storage.get(KEY)).chartRevision,2);assert.equal(a.S.getLabels()[rule],'manual');assert.equal(a.storage.get('xb2-language-v1'),'ja');assert.deepEqual(clone(a.S.getVariantBackup()),variantBackup());assert(a.S.isHuntDone(hunt));assertCurrentHunts(a.S.exportData().huntDone);for(const id of retired)assert(!Object.hasOwn(JSON.parse(a.storage.get(HUNT)),id));assert.equal(a.events.length,0);});
 const again=boot(a.storage).S;check(()=>assert.deepEqual(clone(again.exportData()),clone(a.S.exportData())));
}

// File migration is pure, shared by v1/v2 imports, and safe to validate twice.
for(const version of [1,2])for(const chartRevision of [undefined,1]){
 const a=boot(),file=payload([oldZantetsu(),momo(2)],{version,...(chartRevision===undefined?{}:{chartRevision}),labels:{[rule]:'eligible'},huntDone:{[hunt.id]:true,...Object.fromEntries(retired.map((id,i)=>[id,i%2===0]))},variantBackup:variantBackup()}),before=JSON.stringify(file),stored=new Map(a.storage),writes=a.writes.length;
 const normalized=a.S.validateFile(file);
 check(()=>{assert.equal(JSON.stringify(file),before);assert.deepEqual(a.storage,stored);assert.equal(a.writes.length,writes);assert.equal(a.events.length,0);assert.equal(normalized.chartRevision,2);assert.equal(normalized.records[0].tier,3);assert.equal(normalized.records[0].confirmed,false);assert.equal(normalized.records[0].completed['镌刻'],3);assert.equal(normalized.records[1].completed['暗属性之力'],2);assertCurrentHunts(normalized.huntDone);assert.deepEqual(clone(normalized.variantBackup),variantBackup());});
 check(()=>{assert.equal(a.S.loadFile(normalized),2);assert.equal(a.S.snapshot().records[0].tier,3);assert.equal(a.S.snapshot().records[0].completed['镌刻'],3);assert.equal(a.S.snapshot().records[1].completed['暗属性之力'],2);const exported=a.S.exportData();a.S.loadFile(exported);assert.deepEqual(clone(a.S.exportData()),clone(exported));assert.deepEqual(clone(boot(a.storage).S.exportData()),clone(exported));});
 const merged=boot();merged.S.replaceState({records:[profile('焰')]});
 check(()=>{assert.equal(merged.S.importData(file),2);assert.deepEqual(clone(merged.S.snapshot().records).map(p=>p.name),['焰','斩铁','M.O.M.O. :i']);assert.equal(merged.S.snapshot().records[1].tier,3);assert.equal(merged.S.snapshot().records[2].completed['暗属性之力'],2);assertCurrentHunts(merged.S.exportData().huntDone);for(const id of retired)assert(!Object.hasOwn(JSON.parse(merged.storage.get(HUNT)),id));});
}

// Only the specific old tier-2/third-node error is repaired, not new records.
for(let tier=1;tier<=5;tier++)for(let n=0;n<=E.maxRank(blades.find(b=>b.name==='斩铁').tracks.find(t=>t.name==='镌刻'),tier);n++){
 const p=profile('斩铁',tier);p.completed['镌刻']=n;const result=boot().S.validateFile(payload([p])).records[0];
 check(()=>assert.deepEqual(clone(result),p));
}
{
 const a=boot(),bad=oldZantetsu();
 check(()=>assert.throws(()=>a.S.validateFile(payload([bad],{chartRevision:2})),/超出开放阶段/));
 check(()=>assert.throws(()=>a.S.replaceState({records:[bad]}),/超出开放阶段/));
 const p=profile('斩铁',3);p.completed['镌刻']=3;
 check(()=>{a.S.replaceState({records:[p]});assert.deepEqual(clone(a.S.snapshot().records[0]),p);assert.equal(a.S.exportData().chartRevision,2);});
}

// Appending M.O.M.O. :i's missing final row never changes existing prefixes.
for(const n of [0,1,2]){
 const p=momo(n);
 for(const version of [1,2]){
  const a=boot();check(()=>{a.S.loadFile(payload([p],{version}));assert.deepEqual(clone(a.S.snapshot().records[0]),p);});
  const cached=boot(fixture(payload([p],{version}))).S;check(()=>assert.deepEqual(clone(cached.snapshot().records[0]),p));
 }
}
{
 const p=profile('M.O.M.O. :i',5),t=blades.find(b=>b.name===p.name).tracks.find(t=>t.name==='暗属性之力');p.completed[t.name]=t.rows.length;
 const a=boot();a.S.replaceState({records:[p]});const file=a.S.exportData();check(()=>{a.S.loadFile(file);assert.deepEqual(clone(a.S.snapshot().records[0]),p);assert.equal(a.S.createProfile(p.name).completed[t.name],t.initial_completed);});
}

// Retired IDs remain accepted only as historical boolean flags, then disappear.
for(const value of [true,false]){
 const a=boot(),file=payload([],{huntDone:{[hunt.id]:true,...Object.fromEntries(retired.map(id=>[id,value]))}});
 check(()=>{a.S.loadFile(file);assert(a.S.isHuntDone(hunt));assertCurrentHunts(a.S.exportData().huntDone);for(const id of retired)assert(!Object.hasOwn(JSON.parse(a.storage.get(HUNT)),id));});
 const embedded=boot(new Map([[KEY,JSON.stringify(file)]]));check(()=>{assert(embedded.S.isHuntDone(hunt));for(const id of retired)assert(!Object.hasOwn(JSON.parse(embedded.storage.get(HUNT)),id));});
}
for(const value of ['true',0,1,null])for(const id of retired){
 const a=boot(),before=JSON.stringify(a.S.exportData()),stored=new Map(a.storage),writes=a.writes.length;
 check(()=>{assert.throws(()=>a.S.loadFile(payload([],{huntDone:{[id]:value}})),/无效的讨伐/);assert.equal(JSON.stringify(a.S.exportData()),before);assert.deepEqual(a.storage,stored);assert.equal(a.writes.length,writes);assert.equal(a.events.length,0);});
}
check(()=>assert.throws(()=>boot().S.validateFile(payload([],{huntDone:{'unknown-retired-id':true}})),/无效的讨伐/));

// Reject unknown chart revisions before touching current state or storage.
for(const chartRevision of [null,'2',true,0,-1,1.5,3,999]){
 const a=boot(fixture()),file=payload([profile('白虎')],{chartRevision}),before=JSON.stringify(a.S.exportData()),stored=new Map(a.storage),writes=a.writes.length;
 check(()=>{for(const method of ['validateFile','loadFile','importData'])assert.throws(()=>a.S[method](file),/圆环数据版本/);assert.equal(JSON.stringify(a.S.exportData()),before);assert.deepEqual(a.storage,stored);assert.equal(a.writes.length,writes);assert.equal(a.events.length,0);});
}

// Corrupt, invalid, or future caches must never be replaced by an empty cache.
const invalidCaches=['{broken','null','false','[]',JSON.stringify(payload([oldZantetsu()],{chartRevision:3})),JSON.stringify(payload([oldZantetsu()],{chartRevision:2})),JSON.stringify(payload([{...profile('焰'),tier:6}])),JSON.stringify(payload([profile('焰')],{version:3}))];
for(const raw of invalidCaches){
 const storage=fixture();storage.set(KEY,raw);storage.delete(MIGRATION);const before=new Map(storage),a=boot(storage);
 check(()=>{assert.deepEqual(a.storage,before);assert.equal(a.writes.length,0);assert.equal(a.events.length,0);assert.equal(a.S.snapshot().records.length,0);assert.match(a.S.getWarning(),/本地进度未载入/);});
}
{
 const storage=fixture(),before=new Map(storage),a=boot(storage,(key,op)=>key===KEY&&op==='get');
 check(()=>{assert.deepEqual(a.storage,before);assert.equal(a.writes.length,0);assert.match(a.S.getWarning(),/本地进度未载入/);});
}

// A failed transaction after migration still restores the previous full save.
{
 let armed=false;const a=boot(fixture(),(key,op)=>{if(armed&&key===HUNT&&op==='set'){armed=false;return true;}return false;}),before=new Map(a.storage),stateBefore=JSON.stringify(a.S.exportData()),file=payload([oldZantetsu(),momo(1)]),inputBefore=JSON.stringify(file);armed=true;
 check(()=>{assert.throws(()=>a.S.loadFile(file),/未载入进度文件/);assert.deepEqual(a.storage,before);assert.equal(JSON.stringify(a.S.exportData()),stateBefore);assert.equal(JSON.stringify(file),inputBefore);assert.equal(a.events.length,0);});
}
console.log(`Data corrections: ${checks} checks passed; chart revision, precise Zantetsu migration, unchanged M.O.M.O. prefixes, retired hunts and cache preservation verified.`);
