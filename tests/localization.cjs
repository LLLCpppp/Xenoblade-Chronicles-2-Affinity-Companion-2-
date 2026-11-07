'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
const D=JSON.parse(read('data.json')),C=JSON.parse(read('locales.json'));let checks=0;
function check(fn){fn();checks++;}
const dataContext={window:{}};vm.createContext(dataContext);vm.runInContext(read('data.js'),dataContext);check(()=>assert.equal(JSON.stringify(dataContext.window.XB2_DATA),JSON.stringify(D)));
const localeContext={window:{}};vm.createContext(localeContext);vm.runInContext(read('locales.js'),localeContext);check(()=>assert.equal(JSON.stringify(localeContext.window.XB2_LOCALES),JSON.stringify(C)));
for(const b of D.mercenary.blades){check(()=>{assert(C.messages[b.name]?.every(x=>typeof x==='string'&&x.length));assert(['wiki','wiki-with-form-label'].includes(C.sources[b.name].kind));});for(const t of b.tracks){check(()=>assert(C.messages[t.name]?.every(x=>x.length)));for(const r of t.rows){check(()=>{for(const key of ['condition','effect']){const v=C.messages[r[key]];assert(v,r[key]);assert(v.every(x=>x.length));assert(!/[\u4e00-\u9fff]/.test(v[0]),v[0]);}for(const count of r.condition.match(/\d+\s*\/\s*\d+/g)||[])for(const v of C.messages[r.condition])assert(v.includes(count),r.condition);});}}}
for(const b of D.blades)for(const r of b.rows)for(const e of r.enemies)check(()=>{assert(C.messages[e.name]?.every(x=>x.length));assert(!/[\u4e00-\u9fff]/.test(C.messages[e.name][0]));});
check(()=>assert.equal(C.messages['韦驮天'][0],'Boreas'));
check(()=>assert.equal(C.messages['红莲'][0],'Godfrey'));
check(()=>assert.equal(C.messages['神威'][0],'Obrona'));
check(()=>assert.equal(C.messages['灵巧的萨基'][0],'Cunning Saggie'));
check(()=>assert.equal(C.messages['残忍王格尔梅斯'][0],'Atrocious Hermes'));
check(()=>assert.notEqual(C.messages['宫比罗'][0],C.messages['宫比罗(觉醒)'][0]));
// Exercise the real localization API without a browser; only the rendering surface is stubbed.
const storage=new Map([['xb2-mercenary-progress-v1','existing progress'],['xb2-node-labels-v1','existing rules']]),events=[];
const document={readyState:'loading',documentElement:{},body:{},addEventListener(){},querySelectorAll(){return[];},createTreeWalker(){return{nextNode:()=>null};}};
const context={window:null,XB2_DATA:D,XB2_LOCALES:C,document,NodeFilter:{SHOW_TEXT:4},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts.detail;}}};context.window=context;context.dispatchEvent=e=>events.push(e);vm.createContext(context);vm.runInContext(read('i18n.js'),context);const I=context.XB2_I18N,originalData=JSON.stringify(D);
for(const lang of ['en','ja','zh-CN','en','zh-CN'])check(()=>{I.setLanguage(lang);assert.equal(I.getLanguage(),lang);assert.equal(document.documentElement.lang,lang);assert.equal(storage.get('xb2-mercenary-progress-v1'),'existing progress');assert.equal(storage.get('xb2-node-labels-v1'),'existing rules');assert.equal(JSON.stringify(D),originalData);});
check(()=>{assert(I.searchText('焰').includes('pyra'));assert(I.searchText('八重切').includes('ヤエギリ'));assert(I.searchText('灵巧的萨基').includes('cunning saggie'));assert(I.searchText('光').includes('mythra'));});
check(()=>assert.equal(I.text('焰','zh-CN'),'焰'));
check(()=>assert.equal(I.text('添加异刃 焰','en'),'Add Blade Pyra'));
check(()=>assert.equal(I.text('将当前异刃的五个阶段和全部技能节点记为完成，可撤销','en'),C.ui['将当前异刃的五个阶段和全部技能节点记为完成，可撤销'][0]));
for(const [source,values] of Object.entries(C.messages))for(const value of values)check(()=>assert(!/⟦|⟧|\[ML:|undefined/.test(value),source+': '+value));
console.log(`Localization: ${checks} checks passed; ${Object.keys(C.messages).length} messages; save keys preserved.`);
