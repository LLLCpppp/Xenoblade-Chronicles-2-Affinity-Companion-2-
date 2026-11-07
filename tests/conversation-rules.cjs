'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');require('../merc-engine.js');
const E=globalThis.XB2_MERC_ENGINE,D=JSON.parse(fs.readFileSync(path.join(__dirname,'../data.json'),'utf8')),M=D.mercenary;
const labelSets=[{},Object.fromEntries(M.ruleGroups.map(g=>[g.id,'manual'])),Object.fromEntries(M.ruleGroups.map(g=>[g.id,'eligible']))];
let restored=0,independentManual=0,checks=0;
const check=fn=>{fn();checks++;};
for(const b of M.blades)for(const t of b.tracks.concat([{name:'阶段解锁',rows:b.gates}]))for(let i=0;i<t.rows.length;i++){
 const r=t.rows[i];
 if(E.isMercConversation(r)){
  restored++;
  for(const labels of labelSets)check(()=>{
   assert.equal(r.merc.status,'eligible');assert.equal(E.effective(r,labels).status,'eligible');
   const oldBlocked={...r,merc:{...r.merc,status:'manual'}};assert.equal(E.effective(oldBlocked,labels).status,'eligible');
   const p=E.defaults(b);p.tier=5;p.confirmed=true;for(const track of b.tracks)p.completed[track.name]=track.rows.length;p.completed[t.name]=i;
   assert.equal(E.analyze(b,p,labels).status,'eligible');const before=E.mercNodeSummary(b,p,labels).total;assert(before>=1);
   p.completed[t.name]++;assert.equal(E.mercNodeSummary(b,p,labels).total,before-1);
  });
 }else if(r.merc.rule!=='player_unique_action'&&/对话|谈话|交谈|聊天|询问|打听/.test(r.condition)){
  independentManual++;
  check(()=>{assert.equal(r.merc.status,'manual');for(const labels of labelSets)assert.equal(E.effective(r,labels).status,'manual');});
 }
}
check(()=>{assert.equal(restored,30);assert.equal(independentManual,62);assert.equal(M.conversation_eligible.confirmed_nodes,30);assert.equal(M.conversation_manual,undefined);assert.deepEqual(M.ruleGroups.filter(g=>g.fixed_status==='manual').map(g=>g.id),['training','steal']);assert.equal(M.ruleGroups.length,17);});
const example=M.blades.find(b=>b.name==='力男').tracks.find(t=>t.name==='怪力').rows.find(r=>r.stage===5);
check(()=>{assert.equal(example.condition,'与斯佩比亚人对话 0/20');assert.equal(E.effective(example).status,'eligible');});
console.log(`Conversation rules: ${checks} checks passed; ${restored} restored Merc nodes, ${independentManual} independent exclusions preserved; old labels cannot block confirmed conversation counters.`);
