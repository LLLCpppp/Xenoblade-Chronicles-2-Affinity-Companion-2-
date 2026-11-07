'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),D=JSON.parse(fs.readFileSync(path.join(root,'data.json'),'utf8'));
require(path.join(root,'merc-engine.js'));const E=globalThis.XB2_MERC_ENGINE;
const KEY='xb2-mercenary-progress-v1',HUNT='xb2-affinity-done-v1',BACKUP='xb2-variant-backup-v1',RULE='xb2-node-labels-v1',FROZEN='xb2-confirmed-node-rules-v1';
let checks=0;const check=fn=>{fn();checks++;};
function full(name){const b=D.mercenary.blades.find(b=>b.name===name),p=E.defaults(b);p.tier=5;p.confirmed=true;for(const t of b.tracks)p.completed[t.name]=t.rows.length;return p;}
const hunter=D.blades.find(b=>b.name==='八重切'),hunt={...hunter.rows[0],blade:hunter.name},labels={[(D.mercenary.ruleGroups||[])[0].id]:'manual'};
function fixture(){return new Map([[KEY,JSON.stringify({format:'xb2-mercenary-progress',version:2,records:[full('焰'),full('宫比罗'),full('宫比罗(觉醒)')],labels})],[RULE,JSON.stringify(labels)],[FROZEN,JSON.stringify(labels)],[HUNT,JSON.stringify({[hunt.id]:true})],['xb2-language-v1','ja'],['xb2-roster-view-v1',JSON.stringify({sort:'ratio'})],['xb2-hunt-linked-migration-v1','true']]);}
function boot(storage,fail){const events=[],ctx={XB2_DATA:D,XB2_MERC_ENGINE:E,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>{if(fail?.(k,'set'))throw Error('Storage blocked');storage.set(k,v);},removeItem:k=>{if(fail?.(k,'remove'))throw Error('Storage blocked');storage.delete(k);}},CustomEvent:class{constructor(type){this.type=type;}},dispatchEvent:e=>events.push(e.type)};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'player-store.js'),'utf8'),ctx);return {S:ctx.XB2_PLAYER,events};}
const storage=fixture(),{S,events}=boot(storage);
check(()=>{assert(S.snapshot().records.length);assert(S.getVariantBackup()?.records.length===2);assert(S.isHuntDone(hunt));assert(S.createProfile(hunter.name).tier>1);});
const preserved=[RULE,FROZEN,'xb2-language-v1','xb2-roster-view-v1','xb2-hunt-linked-migration-v1'].map(k=>[k,storage.get(k)]);
check(()=>assert.equal(S.resetProgress(),true));
check(()=>{assert.equal(S.snapshot().records.length,0);assert.equal(S.getVariantBackup(),null);assert.equal(S.getWarning(),'');assert.equal(S.isHuntDone(hunt),false);assert(!storage.has(BACKUP));assert.equal(storage.get(HUNT),'{}');assert.equal(S.exportData().variantBackup,undefined);assert.equal(JSON.stringify(S.getLabels()),JSON.stringify(labels));assert.equal(events.at(-1),'xb2-player-change');});
for(const [key,value]of preserved)check(()=>assert.equal(storage.get(key),value));
const reloaded=boot(storage).S;
check(()=>{assert.equal(reloaded.snapshot().records.length,0);assert.equal(reloaded.getVariantBackup(),null);assert.equal(reloaded.isHuntDone(hunt),false);assert.equal(JSON.stringify(reloaded.createProfile(hunter.name)),JSON.stringify(E.defaults(D.mercenary.blades.find(b=>b.name===hunter.name))));assert.equal(JSON.stringify(reloaded.getLabels()),JSON.stringify(labels));});
check(()=>assert.equal(reloaded.resetProgress(),true));
for(const failure of [[KEY,'set'],[HUNT,'set'],[BACKUP,'remove']]){
 const testStorage=fixture();let armed=false;const {S:testStore,events:testEvents}=boot(testStorage,(key,op)=>{if(armed&&key===failure[0]&&op===failure[1]){armed=false;return true;}return false;});
 const before=new Map(testStorage),stateBefore=JSON.stringify(testStore.exportData()),eventCount=testEvents.length;armed=true;
 check(()=>assert.equal(testStore.resetProgress(),false));
 check(()=>{assert.equal(JSON.stringify(testStore.exportData()),stateBefore);assert.deepEqual(testStorage,before);assert.equal(testEvents.length,eventCount);});
}
console.log(`Reset: ${checks} checks passed; records, legacy hunts and form backups cleared; rules retained; reload and storage failures checked.`);
