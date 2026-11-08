'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),D=JSON.parse(fs.readFileSync(path.join(root,'data.json'),'utf8'));
require(path.join(root,'merc-engine.js'));const E=globalThis.XB2_MERC_ENGINE;
const source=fs.readFileSync(path.join(root,'player-store.js'),'utf8'),blades=D.mercenary.blades;
const KEY='xb2-mercenary-progress-v1',RULE='xb2-node-labels-v1',FROZEN='xb2-confirmed-node-rules-v1',HUNT='xb2-affinity-done-v1',BACKUP='xb2-variant-backup-v1',MIGRATION='xb2-hunt-linked-migration-v1';
const rows=D.blades.flatMap(b=>b.rows.map(r=>({...r,blade:b.name}))),hunter=rows.find(r=>r.blade==='八重切'),secondHunt=rows.find(r=>r.blade==='纽兹'),genericHunt=rows.find(r=>r.enemies.length===0);
const groups=D.mercenary.ruleGroups.map(g=>g.id),firstRule=groups[0],secondRule=groups[1];
const clone=value=>JSON.parse(JSON.stringify(value)),plain=clone;
let checks=0;const check=fn=>{fn();checks++;};
function profile(name,complete=false){const b=blades.find(b=>b.name===name),p=E.defaults(b);if(complete){p.tier=5;p.confirmed=true;for(const t of b.tracks)p.completed[t.name]=t.rows.length;}return p;}
const payload=(records=[],extra={})=>({format:'xb2-mercenary-progress',version:2,records,...extra});
function fixture(){return new Map([
 [KEY,JSON.stringify(payload([profile('焰',true),profile('宫比罗',true)],{labels:{[firstRule]:'manual'}}))],
 [RULE,JSON.stringify({[firstRule]:'manual'})],[FROZEN,JSON.stringify({[firstRule]:'manual'})],
 [HUNT,JSON.stringify({[hunter.id]:true,[secondHunt.id]:true})],
 [BACKUP,JSON.stringify({records:[profile('宫比罗',true),profile('宫比罗(觉醒)',true)]})],
 [MIGRATION,'true'],['xb2-language-v1','ja'],['xb2-roster-view-v1',JSON.stringify({sort:'ratio',type:'all'})]
]);}
function boot(storage=new Map(),fail=()=>false){
 const events=[],writes=[],ctx={XB2_DATA:D,XB2_MERC_ENGINE:E,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},dispatchEvent:event=>events.push(event),localStorage:{
  getItem:key=>{if(fail(key,'get'))throw Error('Read blocked');return storage.get(key)??null;},
  setItem:(key,value)=>{if(fail(key,'set'))throw Error('Write blocked');writes.push(['set',key,value]);storage.set(key,value);},
  removeItem:key=>{if(fail(key,'remove'))throw Error('Remove blocked');writes.push(['remove',key]);storage.delete(key);}
 }};
 vm.createContext(ctx);vm.runInContext(source,ctx);return {S:ctx.XB2_PLAYER,events,writes,storage};
}

// An unrecorded Blade's hunt and generic-monster hunt must survive a file round trip.
{
 const a=boot(),S=a.S;S.setHunt(hunter,true);S.setHunt(genericHunt,true);const file=S.exportData();
 check(()=>{assert.equal(file.version,2);assert.equal(file.records.length,0);assert.equal(Object.keys(file.huntDone).length,rows.length);assert.equal(file.huntDone[hunter.id],true);assert.equal(file.huntDone[genericHunt.id],true);for(const value of Object.values(file.huntDone))assert.equal(typeof value,'boolean');});
 const b=boot();check(()=>{assert.equal(b.S.loadFile(file),0);assert(b.S.isHuntDone(hunter));assert(b.S.isHuntDone(genericHunt));assert.equal(b.events.length,1);assert.equal(b.events[0].type,'xb2-player-change');assert.equal(b.events[0].detail.reason,'file-load');});
 const reopened=boot(b.storage).S;check(()=>{assert(reopened.isHuntDone(hunter));assert(reopened.isHuntDone(genericHunt));const p=reopened.createProfile(hunter.blade),loc=E.locateHunt(blades,hunter);assert(p.tier>=loc.row.stage);assert(p.completed[loc.track.name]>=loc.index+1);});
}

// Validation is pure; loading replaces all records/rules/backups rather than merging.
{
 const a=boot(fixture()),before=new Map(a.storage),stateBefore=JSON.stringify(a.S.exportData()),writesBefore=a.writes.length;
 const input=payload([profile('白虎',true)],{labels:{[secondRule]:'eligible'},huntDone:{[hunter.id]:false,[secondHunt.id]:true},variantBackup:{records:[profile('宫比罗(觉醒)',true)]}}),inputBefore=JSON.stringify(input);
 const validated=a.S.validateFile(input);
 check(()=>{assert.equal(JSON.stringify(input),inputBefore);assert.deepEqual(a.storage,before);assert.equal(a.writes.length,writesBefore);assert.equal(a.events.length,0);assert.equal(JSON.stringify(a.S.exportData()),stateBefore);assert.equal(validated.version,2);assert.equal(validated.huntDone[secondHunt.id],true);});
 validated.records[0].tier=0;validated.labels[secondRule]='manual';
 check(()=>assert.equal(JSON.stringify(input),inputBefore));
 check(()=>{assert.equal(a.S.loadFile(input),1);assert.deepEqual(plain(a.S.snapshot().records).map(p=>p.name),['白虎']);assert.deepEqual(plain(a.S.getLabels()),{[secondRule]:'eligible'});assert.equal(a.S.isHuntDone(hunter),false);assert.equal(a.S.isHuntDone(secondHunt),true);assert.deepEqual(plain(a.S.getVariantBackup()).records.map(p=>p.name),['宫比罗(觉醒)']);assert.equal(a.events.length,1);assert.equal(a.storage.get(MIGRATION),'true');assert.equal(a.storage.get('xb2-language-v1'),'ja');assert.equal(a.storage.get('xb2-roster-view-v1'),before.get('xb2-roster-view-v1'));});
 const reopened=boot(a.storage).S;
 check(()=>{assert.deepEqual(plain(reopened.exportData()),plain(a.S.exportData()));assert.deepEqual(JSON.parse(a.storage.get(RULE)),{[secondRule]:'eligible'});assert.deepEqual(JSON.parse(a.storage.get(FROZEN)),{[secondRule]:'eligible'});});
 // Exported records and backup records must not expose mutable store references.
 const snapshot=a.S.exportData(),snapshotBefore=JSON.stringify(a.S.exportData());snapshot.records[0].tier=0;snapshot.records[0].completed[Object.keys(snapshot.records[0].completed)[0]]=0;snapshot.labels[secondRule]='manual';snapshot.huntDone[secondHunt.id]=false;snapshot.variantBackup.records[0].tier=0;
 check(()=>assert.equal(JSON.stringify(a.S.exportData()),snapshotBefore));
}

// v1/v2 files lacking the new optional fields cannot resurrect old hunts or backups.
for(const version of [1,2]){
 const a=boot(fixture()),input={format:'xb2-mercenary-progress',version,records:[profile('白虎',true)],playthrough:1};
 const rawHunt=rows.find(r=>r.blade==='白虎');
 check(()=>{const normalized=a.S.validateFile(input);assert.equal(normalized.version,2);assert.deepEqual(plain(normalized.labels),{});assert.equal(normalized.variantBackup,undefined);assert.equal(normalized.huntDone[hunter.id],false);assert.equal(normalized.huntDone[rawHunt.id],true);});
 check(()=>{assert.equal(a.S.loadFile(input),1);assert.deepEqual(plain(a.S.getLabels()),{});assert.equal(a.S.getVariantBackup(),null);assert(!a.storage.has(BACKUP));assert(!a.S.isHuntDone(hunter));assert(a.S.isHuntDone(rawHunt));assert.equal(a.S.exportData().playthrough,undefined);});
 check(()=>{const next=boot(a.storage).S;assert(!next.isHuntDone(hunter));assert(next.isHuntDone(rawHunt));assert.equal(next.getVariantBackup(),null);assert.deepEqual(plain(next.createProfile(hunter.blade)),profile(hunter.blade));});
}

// Recorded chart prefixes are authoritative over contradictory hunt flags.
{
 const S=boot().S,loc=E.locateHunt(blades,hunter),p=profile(hunter.blade);p.tier=5;p.completed[loc.track.name]=0;
 check(()=>{const next=S.validateFile(payload([p],{huntDone:{[hunter.id]:true}}));assert.equal(next.huntDone[hunter.id],false);S.loadFile(next);assert.equal(S.isHuntDone(hunter),false);});
 p.completed[loc.track.name]=loc.index+1;
 check(()=>{const next=S.validateFile(payload([p],{huntDone:{[hunter.id]:false}}));assert.equal(next.huntDone[hunter.id],true);S.loadFile(next);assert.equal(S.isHuntDone(hunter),true);});
}

// A file can replace Dagas with the other form, while each primary roster stays exclusive.
{
 const a=boot(fixture());check(()=>{a.S.loadFile(payload([profile('宫比罗(觉醒)',true)],{variantBackup:{records:[profile('宫比罗',true),profile('宫比罗(觉醒)',true)]}}));assert.deepEqual(plain(a.S.snapshot().records).map(p=>p.name),['宫比罗(觉醒)']);assert.equal(a.S.getVariantBackup().records.length,2);a.S.restoreVariant('宫比罗');assert.deepEqual(plain(a.S.snapshot().records).map(p=>p.name),['宫比罗']);});
 for(const variantBackup of [undefined,null,{records:[]}])check(()=>{const current=boot(fixture());current.S.loadFile(payload([],{variantBackup}));assert.equal(current.S.getVariantBackup(),null);assert(!current.storage.has(BACKUP));});
}

// Bad files must neither change state nor write any storage key.
const invalidFiles=[
 null,[],{},payload([], {version:3}),payload([], {format:'unknown'}),payload([null]),payload([profile('焰'),profile('焰')]),payload([profile('宫比罗'),profile('宫比罗(觉醒)')]),
 payload([{...profile('焰'),tier:6}]),payload([{...profile('焰'),completed:{}}]),
 payload([],{labels:null}),payload([],{labels:[]}),payload([],{labels:{unknown:'manual'}}),payload([],{labels:{[firstRule]:'invalid'}}),
 payload([],{huntDone:null}),payload([],{huntDone:[]}),payload([],{huntDone:{unknown:true}}),payload([],{huntDone:{[hunter.id]:'true'}}),payload([],{huntDone:{[hunter.id]:1}}),
 payload([],{variantBackup:[]}),payload([],{variantBackup:{}}),payload([],{variantBackup:{records:[null]}}),payload([],{variantBackup:{records:[profile('焰')]}}),payload([],{variantBackup:{records:[profile('宫比罗'),profile('宫比罗')]}}),payload([],{variantBackup:{records:[{...profile('宫比罗'),tier:0}]}})
];
for(const file of invalidFiles){const a=boot(fixture()),before=new Map(a.storage),stateBefore=JSON.stringify(a.S.exportData()),writesBefore=a.writes.length;check(()=>{assert.throws(()=>a.S.validateFile(file));assert.throws(()=>a.S.loadFile(file));assert.equal(JSON.stringify(a.S.exportData()),stateBefore);assert.deepEqual(a.storage,before);assert.equal(a.writes.length,writesBefore);assert.equal(a.events.length,0);});}

// Atomic localStorage failure handling, including deletion of a stale form backup.
for(const [key,operation,hasBackup] of [[KEY,'get',false],[BACKUP,'get',false],[KEY,'set',true],[RULE,'set',true],[FROZEN,'set',true],[HUNT,'set',true],[BACKUP,'set',true],[BACKUP,'remove',false],[MIGRATION,'set',true]]){
 let armed=false;const a=boot(fixture(),(candidate,op)=>{if(armed&&candidate===key&&op===operation){armed=false;return true;}return false;}),before=new Map(a.storage),stateBefore=JSON.stringify(a.S.exportData()),warningBefore=a.S.getWarning();
 const incoming=payload([profile('白虎')],{labels:{[secondRule]:'unknown'},huntDone:{[hunter.id]:false},...(hasBackup?{variantBackup:{records:[profile('宫比罗(觉醒)')]}}:{})});armed=true;
 check(()=>{assert.throws(()=>a.S.loadFile(incoming),/未载入进度文件/);assert.equal(JSON.stringify(a.S.exportData()),stateBefore);assert.equal(a.S.getWarning(),warningBefore);assert.deepEqual(a.storage,before);assert.equal(a.events.length,0);});
}

// Existing import still merges; old files do not clear optional legacy state.
{
 const a=boot(fixture()),oldLabels=plain(a.S.getLabels());
 check(()=>{assert.equal(a.S.importData(payload([profile('白虎')],{labels:{[secondRule]:'eligible'}})),1);assert.deepEqual(plain(a.S.snapshot().records).map(p=>p.name),['焰','宫比罗','白虎']);assert(a.S.isHuntDone(hunter));assert(a.S.getVariantBackup());assert.deepEqual(plain(a.S.getLabels()),{...oldLabels,[secondRule]:'eligible'});});
 check(()=>{a.S.importData(payload([],{huntDone:{[hunter.id]:false,[genericHunt.id]:true}}));assert.equal(a.S.isHuntDone(hunter),false);assert(a.S.isHuntDone(secondHunt));assert(a.S.isHuntDone(genericHunt));});
 const before=JSON.stringify(a.S.exportData());check(()=>{assert.throws(()=>a.S.importData(payload([profile('宫比罗(觉醒)')])));assert.throws(()=>a.S.importData(payload([],{huntDone:{[hunter.id]:0}})));assert.equal(JSON.stringify(a.S.exportData()),before);});
 check(()=>{const expectedLabels=plain(a.S.getLabels());assert.equal(a.S.resetProgress(),true);const after=a.S.exportData();assert.equal(after.records.length,0);assert.deepEqual(plain(after.labels),expectedLabels);assert.equal(after.variantBackup,undefined);assert(Object.values(after.huntDone).every(value=>value===false));const reload=boot(a.storage).S;assert.equal(reload.snapshot().records.length,0);assert(Object.values(reload.exportData().huntDone).every(value=>value===false));assert.equal(reload.getVariantBackup(),null);});
}

// A complete payload can recover secondary keys if only its main key remains.
{
 const file=payload([],{labels:{[firstRule]:'manual'},huntDone:{[hunter.id]:true},variantBackup:{records:[profile('宫比罗',true)]}}),a=boot(new Map([[KEY,JSON.stringify(file)]]));
 check(()=>{assert(a.S.isHuntDone(hunter));assert.equal(a.S.getLabels()[firstRule],'manual');assert.equal(a.S.getVariantBackup().records[0].name,'宫比罗');});
}
console.log(`File progress: ${checks} checks passed; complete file replacement, unrecorded hunts, v1/v2 compatibility, rules/form backups and transactional failures verified.`);
