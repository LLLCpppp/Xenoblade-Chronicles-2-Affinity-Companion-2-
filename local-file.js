(function(root){
'use strict';
// Keep file I/O independent of the page so failures and overlapping edits can be tested.
function create({getData,onStatus=()=>{},delay=300}){
 let handle=null,baseline='',revision=0,saved=0,timer=null,writing=null,busy=false,error=null,lastSaved=null;
 const status=()=>({connected:!!handle,name:handle?.name||'',pending:!!handle&&revision>saved,busy,error,lastSaved});
 const notify=()=>onStatus(status());
 function clear(){if(timer!==null){root.clearTimeout(timer);timer=null;}}
 function attach(next,text){
  if(handle||busy)throw Error('请先断开当前进度文件。');
  if(!next||typeof next.getFile!=='function'||typeof next.createWritable!=='function')throw Error('无效的本地进度文件。');
  handle=next;baseline=text;revision=0;saved=0;error=null;lastSaved=null;notify();
 }
 function markDirty(){
  if(!handle)return;
  revision++;clear();notify();
  if(!error)timer=root.setTimeout(()=>{timer=null;flush().catch(()=>{});},delay);
 }
 function flush(){
  clear();
  if(writing)return writing;
  if(!handle||revision===saved)return Promise.resolve();
  busy=true;error=null;notify();
  writing=(async()=>{
   try{
    while(handle&&revision>saved){
     const target=revision,text=JSON.stringify(getData(),null,2);
     const current=await handle.getFile();
     if(await current.text()!==baseline){const changed=Error('进度文件已在其他地方修改，请重新打开文件。');changed.code='conflict';throw changed;}
     let stream;
     try{stream=await handle.createWritable();await stream.write(text);await stream.close();}
     catch(cause){try{await stream?.abort();}catch{}throw cause;}
     // close() commits the file. A later edit must not be marked saved by this write.
     baseline=text;saved=target;lastSaved=new Date().toISOString();notify();
    }
   }catch(cause){error={code:cause.code==='conflict'?'conflict':'write',message:cause.message||String(cause)};throw cause;}
   finally{busy=false;writing=null;notify();}
  })();
  return writing;
 }
 async function disconnect(){
  clear();if(writing){try{await writing;}catch{}}
  clear();handle=null;baseline='';revision=0;saved=0;error=null;lastSaved=null;notify();
 }
 return Object.freeze({attach,markDirty,flush,disconnect,status});
}
root.XB2_LOCAL_FILE=Object.freeze({create});
})(globalThis);
