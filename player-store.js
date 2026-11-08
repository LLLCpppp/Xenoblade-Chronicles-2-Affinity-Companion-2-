(function(root){
'use strict';
const D=root.XB2_DATA,M=D.mercenary,E=root.XB2_MERC_ENGINE,KEY='xb2-mercenary-progress-v1',RULE_KEY='xb2-node-labels-v1',FROZEN_KEY='xb2-confirmed-node-rules-v1',HUNT_KEY='xb2-affinity-done-v1',BACKUP_KEY='xb2-variant-backup-v1';
let state={records:[]},labels={},legacy={},backup=null,warning='';const huntRows=D.blades.flatMap(b=>b.rows.map(r=>({...r,blade:b.name})));const groups=new Set((M.ruleGroups||M.reviewGroups||[]).map(g=>g.id));
function read(k,f){try{return JSON.parse(localStorage.getItem(k)||'null')||f;}catch{return f;}}
const savedPayload=read(KEY,null);labels={...(savedPayload?.labels||{}),...read(FROZEN_KEY,{}),...read(RULE_KEY,{})};for(const k of Object.keys(labels))if(!groups.has(k)||!['manual','eligible','unknown'].includes(labels[k]))delete labels[k];legacy=read(HUNT_KEY,savedPayload?.huntDone||{});backup=read(BACKUP_KEY,savedPayload?.variantBackup||null);
try{const saved=savedPayload;if(saved)state=E.parseImport(saved,M.blades,{allowVariantConflict:true});}catch(err){warning='本地进度未载入：'+err.message;}
function normalizedHunts(records,flags){return Object.fromEntries(huntRows.map(r=>[r.id,!!E.huntState(M.blades,records,r,flags).done]));}
function exportData(){return {format:'xb2-mercenary-progress',version:2,records:state.records.map(p=>({...p,completed:{...p.completed}})),labels:{...labels},huntDone:normalizedHunts(state.records,legacy),...(backup?{variantBackup:JSON.parse(JSON.stringify(backup))}:{})};}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(exportData()));localStorage.setItem(RULE_KEY,JSON.stringify(labels));localStorage.setItem(FROZEN_KEY,JSON.stringify(labels));localStorage.setItem(HUNT_KEY,JSON.stringify(legacy));if(backup)localStorage.setItem(BACKUP_KEY,JSON.stringify(backup));return true;}catch{return false;}}
function emit(reason){root.dispatchEvent(new CustomEvent('xb2-player-change',reason?{detail:{reason}}:undefined));}
function syncFlags(name){for(const r of huntRows){if(name&&r.blade!==name)continue;const p=state.records.find(p=>p.name===r.blade);if(p)legacy[r.id]=E.huntState(M.blades,state.records,r,{}).done;}}
if(E.variantConflict(state.records)){const found=state.records.filter(p=>E.variants.includes(p.name));backup={records:found};const keep=found[0].name;state.records=state.records.filter(p=>!E.variants.includes(p.name)||p.name===keep);warning='历史记录同时含宫比罗两种形态，当前保留最近录入的 '+keep+'；另一种进度已单独备份，可切换保留形态。';}
// One-time merge of older hunting checkmarks into the corresponding recorded branch.
if(!read('xb2-hunt-linked-migration-v1',false)){for(const r of huntRows){if(!legacy[r.id])continue;const loc=E.locateHunt(M.blades,r),p=state.records.find(p=>p.name===r.blade);if(loc&&p){p.tier=Math.max(p.tier,loc.row.stage);p.completed[loc.track.name]=Math.max(p.completed[loc.track.name],loc.index+1);}}try{localStorage.setItem('xb2-hunt-linked-migration-v1','true');}catch{}}
syncFlags();persist();
const snapshot=()=>JSON.parse(JSON.stringify(state));
function replaceState(next){const valid=E.parseImport({format:'xb2-mercenary-progress',version:2,records:next.records},M.blades);const removed=state.records.filter(p=>!valid.records.some(x=>x.name===p.name)).map(p=>p.name);for(const r of huntRows)if(removed.includes(r.blade))legacy[r.id]=false;state=valid;syncFlags();const ok=persist();emit();return ok;}
function createProfile(name){const b=M.blades.find(b=>b.name===name);if(!b)throw Error('未找到圆环数据。');const other=E.variants.find(n=>n!==name&&E.variants.includes(name)&&state.records.some(p=>p.name===n));if(other)throw Error('已录入 '+other+'，请先移除该形态再添加 '+name+'。');const p=E.defaults(b);for(const r of huntRows.filter(r=>r.blade===name&&legacy[r.id])){const loc=E.locateHunt(M.blades,r);if(loc){p.tier=Math.max(p.tier,loc.row.stage);p.completed[loc.track.name]=Math.max(p.completed[loc.track.name],loc.index+1);}}return p;}
function setHunt(r,checked){const loc=E.locateHunt(M.blades,r),p=loc&&state.records.find(p=>p.name===loc.blade.name);if(p){if(checked){p.tier=Math.max(p.tier,loc.row.stage);p.completed[loc.track.name]=Math.max(p.completed[loc.track.name],loc.index+1);}else p.completed[loc.track.name]=Math.min(p.completed[loc.track.name],loc.index);syncFlags(p.name);}else legacy[r.id]=checked;persist();emit();}
function validateFile(x){
 const object=value=>value!==null&&Object.prototype.toString.call(value)==='[object Object]';
 if(!object(x)||!Array.isArray(x.records)||x.records.some(p=>!object(p)))throw Error('不是受支持的进度备份。');
 const parsed=E.parseImport(x,M.blades),incomingLabels=x.labels===undefined?{}:x.labels,incomingHunts=x.huntDone===undefined?{}:x.huntDone;
 if(!object(incomingLabels))throw Error('备份包含无效的个人规则。');
 for(const[k,v]of Object.entries(incomingLabels))if(!groups.has(k)||!['manual','eligible','unknown'].includes(v))throw Error('备份包含无效的个人规则。');
 if(!object(incomingHunts))throw Error('备份包含无效的讨伐完成记录。');
 const huntIds=new Set(huntRows.map(r=>r.id));
 for(const[k,v]of Object.entries(incomingHunts))if(!huntIds.has(k)||typeof v!=='boolean')throw Error('备份包含无效的讨伐完成记录。');
 let incomingBackup=null;
 if(x.variantBackup!==undefined&&x.variantBackup!==null){
  if(!object(x.variantBackup)||!Array.isArray(x.variantBackup.records)||x.variantBackup.records.some(p=>!object(p)))throw Error('备份包含无效的宫比罗形态记录。');
  const records=E.parseImport({format:'xb2-mercenary-progress',version:2,records:x.variantBackup.records},M.blades,{allowVariantConflict:true}).records;
  if(records.some(p=>!E.variants.includes(p.name)))throw Error('备份包含无效的宫比罗形态记录。');
  if(records.length)incomingBackup={records};
 }
 return {format:'xb2-mercenary-progress',version:2,records:parsed.records,labels:{...incomingLabels},huntDone:normalizedHunts(parsed.records,incomingHunts),...(incomingBackup?{variantBackup:incomingBackup}:{})};
}
function loadFile(x){
 const next=validateFile(x),keys=[KEY,RULE_KEY,FROZEN_KEY,HUNT_KEY,BACKUP_KEY,'xb2-hunt-linked-migration-v1'],stored=new Map();
 const previous={state,labels,legacy,backup,warning};
 try{
  for(const key of keys)stored.set(key,localStorage.getItem(key));
  state={records:next.records};labels=next.labels;legacy=next.huntDone;backup=next.variantBackup||null;warning='';
  syncFlags();
  if(!persist())throw Error('Storage failed');
  if(!backup)localStorage.removeItem(BACKUP_KEY);
  localStorage.setItem('xb2-hunt-linked-migration-v1','true');
 }catch{
  ({state,labels,legacy,backup,warning}=previous);
  for(const[key,value]of stored){try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}catch{}}
  throw Error('浏览器无法保存，未载入进度文件。');
 }
 emit('file-load');return state.records.length;
}
function importData(x){const parsed=validateFile(x),incomingLabels=parsed.labels,incomingBackup=parsed.variantBackup||null;const merged=new Map(state.records.map(p=>[p.name,p]));parsed.records.forEach(p=>merged.set(p.name,p));const records=[...merged.values()];if(E.variantConflict(records))throw Error('导入会同时保留宫比罗两种形态；请先移除当前不需要的形态。');state={records};labels={...labels,...incomingLabels};if(x.huntDone!==undefined)legacy={...legacy,...x.huntDone};if(incomingBackup)backup=incomingBackup;syncFlags();persist();emit();return parsed.records.length;}
function restoreVariant(name){const p=backup?.records?.find(p=>p.name===name);if(!p)throw Error('没有该形态备份。');const next=state.records.filter(p=>!E.variants.includes(p.name));next.unshift(p);replaceState({records:next});}
function resetProgress(){
 const previous=new Map(),keys=[KEY,HUNT_KEY,BACKUP_KEY];
 try{
  for(const key of keys)previous.set(key,localStorage.getItem(key));
  localStorage.setItem(KEY,JSON.stringify({format:'xb2-mercenary-progress',version:2,records:[],labels:{...labels}}));
  localStorage.setItem(HUNT_KEY,'{}');
  localStorage.removeItem(BACKUP_KEY);
 }catch{
  for(const[key,value]of previous){try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}catch{}}
  return false;
 }
 state={records:[]};legacy={};backup=null;warning='';emit();return true;
}
root.XB2_PLAYER={snapshot,replaceState,getLabels:()=>({...labels}),createProfile,setHunt,importData,exportData,validateFile,loadFile,huntStatus:r=>E.huntState(M.blades,state.records,r,legacy),isHuntDone:r=>E.huntState(M.blades,state.records,r,legacy).done,getWarning:()=>warning,getVariantBackup:()=>backup,restoreVariant,resetProgress};
})(globalThis);
