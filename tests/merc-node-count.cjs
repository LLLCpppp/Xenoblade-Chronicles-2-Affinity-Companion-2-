'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
require('../merc-engine.js');const E=globalThis.XB2_MERC_ENGINE,D=JSON.parse(fs.readFileSync(path.join(__dirname,'../data.json'),'utf8')),M=D.mercenary;
let checks=0;const check=fn=>{fn();checks++;};
// Independent oracle: repeatedly complete only currently eligible next nodes.
// No new tiers are unlocked and no Wiki rows or requirements are altered.
function simulate(blade,profile,labels){
 const current=JSON.parse(JSON.stringify(profile));let count=0,trust=0;
 const limit=blade.tracks.reduce((n,t)=>n+t.rows.length,0);
 for(let step=0;step<=limit;step++){
  const next=E.analyze(blade,current,labels);assert.notEqual(next.status,'invalid');
  if(!next.eligible.length)return {total:count,trust};
  for(const item of next.eligible){current.completed[item.track]++;count++;if(/信[赖賴]度/.test(item.row.condition))trust++;}
 }
 throw Error('Simulation failed to terminate');
}
const groups=M.ruleGroups||[],labelSets=[{},Object.fromEntries(groups.map(g=>[g.id,'manual'])),Object.fromEntries(groups.map(g=>[g.id,'eligible']))];
for(const blade of M.blades){
 const sourceBefore=JSON.stringify(blade);
 for(let tier=1;tier<=5;tier++)for(const mode of ['initial','middle','open_complete'])for(const labels of labelSets){
  const profile=E.defaults(blade);profile.tier=tier;profile.confirmed=true;
  if(mode!=='initial')for(const t of blade.tracks){const maximum=E.maxRank(t,tier);profile.completed[t.name]=mode==='middle'?Math.floor(maximum/2):maximum;}
  const before=JSON.stringify(profile),expected=simulate(blade,profile,labels),summary=E.mercNodeSummary(blade,profile,labels),count=E.countMercNodes(blade,profile,labels);
  check(()=>{assert.deepEqual(summary,expected,`${blade.name}, tier ${tier}, ${mode}`);assert.equal(count,summary.total);assert(summary.trust>=0&&summary.trust<=summary.total);assert.equal(JSON.stringify(profile),before);const remaining=blade.tracks.reduce((n,t)=>n+E.maxRank(t,tier)-profile.completed[t.name],0);assert(count>=0&&count<=remaining);if(mode==='open_complete')assert.equal(count,0);});
 }
 check(()=>assert.equal(JSON.stringify(blade),sourceBefore));
 const invalid=E.defaults(blade);invalid.tier=0;check(()=>assert.equal(E.countMercNodes(blade,invalid),0));
}
let skillTrust=0,gateTrust=0;
for(const b of M.blades){
 gateTrust+=b.gates.filter(r=>/信[赖賴]度/.test(r.condition)).length;
 for(const t of b.tracks)for(let i=0;i<t.rows.length;i++)if(/信[赖賴]度/.test(t.rows[i].condition)){
  skillTrust++;const p=E.defaults(b);p.tier=5;p.confirmed=true;for(const track of b.tracks)p.completed[track.name]=track.rows.length;p.completed[t.name]=i;
  const before=E.mercNodeSummary(b,p);p.completed[t.name]++;const after=E.mercNodeSummary(b,p);
  check(()=>{assert.equal(before.total,after.total+1);assert.equal(before.trust,after.trust+1);});
  p.tier=t.rows[i].stage-1;for(const track of b.tracks)p.completed[track.name]=E.maxRank(track,p.tier);
  check(()=>assert.deepEqual(E.mercNodeSummary(b,p),{total:0,trust:0}));
 }
}
check(()=>{assert.equal(skillTrust,12);assert.equal(gateTrust,175);});
console.log(`Merc capacity: ${checks} checks passed; Trust subset covers ${skillTrust} skill nodes and excludes ${gateTrust} tier conditions.`);
