'use strict';
// Localization only touches presentation. Chinese identifiers and storage keys stay stable.
(()=>{
const C=window.XB2_LOCALES,KEY='xb2-language-v1',supported=['zh-CN','en','ja'];
let language='zh-CN';try{const saved=localStorage.getItem(KEY);if(supported.includes(saved))language=saved;}catch{}
const escapeRE=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const uiParts={...C.terms,...C.ui,...(C.dynamic||{})};
const names=new Set(window.XB2_DATA.mercenary.blades.map(b=>b.name));
const keys=Object.keys(uiParts).filter(k=>k.length>1||names.has(k)||['个','第','位','项','只'].includes(k)).sort((a,b)=>b.length-a.length);
const partial=new RegExp(keys.map(escapeRE).join('|'),'g');
const originalText=new WeakMap(),originalAttrs=new WeakMap();
function text(value,locale=language){
 const source=String(value??'');if(locale==='zh-CN')return source;
 if(!/[\u4e00-\u9fff]/.test(source))return source;
 const i=locale==='ja'?1:0,trimmed=source.trim();
 if(C.messages[trimmed])return source.replace(trimmed,C.messages[trimmed][i]);
 const formatted=source.replace(/先录入开放第\s*(\d+)\s*阶段/g,(_,n)=>i===0?`First unlock tier ${n}`:`先に第${n}段階を解放`).replace(/开放到第\s*(\d+)\s*阶段/g,(_,n)=>i===0?`Unlocked through tier ${n}`:`第${n}段階まで解放`).replace(/圆环第\s*(\d+)\s*阶段/g,(_,n)=>i===0?`Chart tier ${n}`:`リング第${n}段階`);
 return formatted.replace(partial,k=>uiParts[k][i]);
}
function searchText(value){const v=String(value??'');return [v,text(v,'en'),text(v,'ja')].join(' ').toLocaleLowerCase();}
function skip(node){return node.parentElement?.closest('script,style,textarea,[data-no-i18n],.language-switch');}
function updateText(node){
 if(skip(node))return;
 const previous=originalText.get(node),source=previous&&node.data===previous.rendered?previous.source:node.data;
 let rendered=text(source);
 if(language!=='zh-CN'&&node.parentElement?.matches('.tile-element,.meta,.visual-editor-head .eyebrow,.blade-button small')){
  const elements={火:['Fire','火'],水:['Water','水'],地:['Earth','地'],风:['Wind','風'],雷:['Electric','雷'],冰:['Ice','氷'],光:['Light','光'],暗:['Dark','闇']};
  const roles={攻击:['Attacker','攻撃'],回复:['Healer','回復'],防御:['Tank','防御']},parts=source.split(/(\s*[\/·]\s*)/),idx=language==='ja'?1:0;
  parts[0]=elements[parts[0].replace(/属性|\*/g,'').trim()]?.[idx]||text(parts[0]);
  rendered=parts.map((s,i)=>{if(i===0)return s;const role=roles[s.replace(/\*/g,'').trim()]?.[idx];return role?role+(s.includes('*')?'*':''):text(s);}).join('');
 }
 originalText.set(node,{source,rendered});if(node.data!==rendered)node.data=rendered;
}
const attributes=['title','aria-label','placeholder','alt'];
function translateElement(el){
 if(el.closest('[data-no-i18n],.language-switch'))return;
 let saved=originalAttrs.get(el);if(!saved){saved={};originalAttrs.set(el,saved);}
 for(const key of attributes){if(!el.hasAttribute(key))continue;const current=el.getAttribute(key),prev=saved[key],source=prev&&current===prev.rendered?prev.source:current,rendered=text(source);saved[key]={source,rendered};if(current!==rendered)el.setAttribute(key,rendered);}
}
function annotate(){
 document.querySelectorAll('.info-condition,.info-effect').forEach(el=>{
  let details=el.nextElementSibling;
  if(!details?.classList.contains('wiki-original')){
   details=document.createElement('details');details.className='wiki-original';details.dataset.noI18n='';details.setAttribute('translate','no');
   const summary=document.createElement('summary'),p=document.createElement('p');details.append(summary,p);el.after(details);
  }
  const original=[...el.childNodes].map(n=>n.nodeType===3?(originalText.get(n)?.source??n.data):n.textContent).join('');
  details.querySelector('summary').textContent=text('原文（中文 Wiki）');details.querySelector('p').textContent=original;
 });
}
let observer;
function apply(){
 observer?.disconnect();
 document.documentElement.lang=language;
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode())updateText(node);
 document.querySelectorAll('[title],[aria-label],[placeholder],[alt]').forEach(translateElement);
 annotate();document.querySelectorAll('[data-language]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.language===language)));
 document.title=language==='zh-CN'?'牵绊圆环助手 · Xenoblade 2':language==='ja'?'ゼノブレイド2 キズナリング助手':'Xenoblade Chronicles 2 Affinity Companion';
 observer?.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:attributes});
}
function setLanguage(value){if(!supported.includes(value))return;language=value;try{localStorage.setItem(KEY,value);}catch{}apply();window.dispatchEvent(new CustomEvent('xb2-language-change',{detail:{language}}));}
window.XB2_I18N=Object.freeze({text,searchText,setLanguage,getLanguage:()=>language,apply});
function init(){
 document.querySelectorAll('[data-language]').forEach(button=>button.addEventListener('click',()=>setLanguage(button.dataset.language)));
 observer=new MutationObserver(()=>apply());apply();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
