'use strict';
(()=>{
const S=window.XB2_PLAYER,$=s=>document.querySelector(s);
const supported=window.isSecureContext&&typeof window.showOpenFilePicker==='function'&&typeof window.showSaveFilePicker==='function';
const createButton=$('#local-file-create'),openButton=$('#local-file-open'),saveButton=$('#local-file-save'),disconnectButton=$('#local-file-disconnect');
const dialog=$('#local-file-load-dialog');let choosing=false,loading=false,candidate=null,controller,linkedHandle=null,operationError='';
function render(state){
 const connected=state.connected,locked=choosing||state.busy;
 createButton.disabled=!supported||connected||locked;openButton.disabled=!supported||connected||locked;
 saveButton.disabled=!connected||locked;disconnectButton.disabled=!connected||locked;
 let text=!supported?'当前浏览器不支持直接写入本地文件，请使用 Chrome 或 Edge，或使用导出、导入进度。':!connected?'尚未关联本地文件；进度仍会缓存在当前浏览器。':state.error?.code==='conflict'?'文件已在外部修改，自动保存已停止。请断开关联后重新打开该文件。':state.error?'写入本地文件失败，进度仍在浏览器中。请点击“立即保存”重试，或导出备份。':state.busy?'正在写入本地进度文件…':state.pending?'有修改等待写入本地文件…':state.lastSaved?'本地文件已保存。':'已关联本地文件，后续修改将自动保存。';
 $('#local-file-status').textContent=operationError||text;$('#local-file-status').classList.toggle('file-error',!!state.error||!!operationError);
 $('#local-file-name').textContent=state.name;$('#local-file-time').textContent=state.lastSaved?new Date(state.lastSaved).toLocaleTimeString():'';
 $('#local-file-time-label').hidden=!state.lastSaved;
}
controller=window.XB2_LOCAL_FILE.create({getData:()=>S.exportData(),onStatus:render});
const options={types:[{description:'XB2 progress JSON',accept:{'application/json':['.json']}}],excludeAcceptAllOption:true};
function problem(cause){if(cause.name!=='AbortError')operationError='本地文件操作失败：'+cause.message;render(controller.status());}
async function writable(handle){
 if(!handle)throw Error('请先关联本地进度文件。');
 if(await handle.queryPermission({mode:'readwrite'})==='granted')return;
 if(await handle.requestPermission({mode:'readwrite'})!=='granted')throw Error('未获得文件写入权限，原进度已保留。');
}
async function create(){
 operationError='';choosing=true;render(controller.status());
 try{
  // Invoke the picker directly from the click, before any asynchronous work.
  const handle=await window.showSaveFilePicker({...options,suggestedName:'XB2-progress.json'});
  const baseline=await (await handle.getFile()).text();
  controller.attach(handle,baseline);linkedHandle=handle;controller.markDirty();await controller.flush();
 }catch(cause){problem(cause);}
 finally{choosing=false;render(controller.status());}
}
async function open(){
 operationError='';choosing=true;render(controller.status());
 try{
  const [handle]=await window.showOpenFilePicker({...options,multiple:false});
  const text=await (await handle.getFile()).text(),data=S.validateFile(JSON.parse(text));
  candidate={handle,text,data};$('#local-file-load-name').textContent=handle.name;
  $('#local-file-load-count').textContent=String(data.records.length);
  $('#local-file-current-count').textContent=String(S.snapshot().records.length);
  $('#local-file-load-error').hidden=true;dialog.showModal();
 }catch(cause){problem(cause);}
 finally{choosing=false;render(controller.status());}
}
createButton.addEventListener('click',create);openButton.addEventListener('click',open);
$('#local-file-load-cancel').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{candidate=null;});
dialog.addEventListener('cancel',event=>{if(loading)event.preventDefault();});
$('#local-file-load-confirm').addEventListener('click',async()=>{
 if(!candidate)return;
 const selected=candidate,button=$('#local-file-load-confirm');button.disabled=true;loading=true;$('#local-file-load-cancel').disabled=true;
 try{
  await writable(selected.handle);
  // Recheck after confirmation in case the disk file changed while the dialog was open.
  const text=await (await selected.handle.getFile()).text();
  if(text!==selected.text)throw Error('文件已发生变化，请取消后重新打开。');
  S.loadFile(selected.data);controller.attach(selected.handle,selected.text);linkedHandle=selected.handle;
  window.dispatchEvent(new CustomEvent('xb2-file-loaded'));
  dialog.close();
 }catch(cause){$('#local-file-load-error').textContent=cause.message;$('#local-file-load-error').hidden=false;}
 finally{button.disabled=false;loading=false;$('#local-file-load-cancel').disabled=false;render(controller.status());}
});
saveButton.addEventListener('click',async()=>{
 operationError='';try{await writable(linkedHandle);await controller.flush();}
 catch(cause){problem(cause);}
 finally{render(controller.status());}
});
// The handle stays in memory for this page session; it is never uploaded or stored in the repo.
disconnectButton.addEventListener('click',async()=>{operationError='';await controller.disconnect();linkedHandle=null;});
window.addEventListener('xb2-player-change',()=>controller.markDirty());
window.addEventListener('beforeunload',event=>{if(controller.status().pending){event.preventDefault();event.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!controller.status().error)controller.flush().catch(()=>{});});
render(controller.status());
})();
