from pathlib import Path

PATH = Path('TESTVERSION.html')
html = PATH.read_text(encoding='utf-8')


def function_span(signature: str):
    start = html.find(signature)
    if start < 0:
        raise SystemExit(f'function not found: {signature}')
    brace = html.find('{', start)
    if brace < 0:
        raise SystemExit(f'brace not found: {signature}')
    depth = 0
    quote = None
    escaped = False
    i = brace
    while i < len(html):
        ch = html[i]
        if quote:
            if escaped:
                escaped = False
            elif ch == '\\':
                escaped = True
            elif ch == quote:
                quote = None
            i += 1
            continue
        if ch in ('"', "'", '`'):
            quote = ch
        elif ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return start, i + 1
        i += 1
    raise SystemExit(f'unclosed function: {signature}')


def replace_function(signature: str, source: str):
    global html
    start, end = function_span(signature)
    html = html[:start] + source + html[end:]


if 'function rc990FailOperation(' not in html:
    anchor = 'function rc990ScheduleRender('
    pos = html.find(anchor)
    if pos < 0:
        raise SystemExit('RC990 render scheduler anchor missing')
    helper = r'''function rc990FailOperation(token,message,snapshot,root){
 var text=String(message||'Vorgang nicht abgeschlossen');
 try{
  if(typeof operationFail==='function')operationFail(token,text);
  else if(window.ExportHUBOperationStatus&&typeof window.ExportHUBOperationStatus.fail==='function')window.ExportHUBOperationStatus.fail(token,text);
  else if(typeof loadingBarFail==='function')loadingBarFail(token,text);
 }catch(reportError){try{console.error('RC990 Fehlerstatus',reportError)}catch(_){}}
 if(snapshot){
  var defer=window.requestAnimationFrame||function(cb){return window.setTimeout(cb,0)};
  defer(function(){try{rc990RestoreUiState(snapshot,root)}catch(restoreError){try{console.error('RC990 UI-State Restore',restoreError)}catch(_){}}});
 }
 return false
}
'''
    html = html[:pos] + helper + html[pos:]

replace_function('function rc990ScheduleRender(', r'''function rc990ScheduleRender(reason,fn){
 rc990RenderReason=q(reason)||rc990RenderReason||'render';
 if(typeof fn==='function')rc990RenderTask=fn;
 if(rc990RenderFrame)return true;
 var root=document.getElementById('content'),snapshot=rc990CaptureUiState(root);
 var run=function(){
  rc990RenderFrame=0;
  var task=rc990RenderTask;rc990RenderTask=null;
  try{
   if(typeof task==='function')task()
  }catch(error){
   rc990FailOperation(0,(error&&error.message)||'Ansicht konnte nicht aktualisiert werden',snapshot,root)
  }finally{
   rc990RenderReason=''
  }
 };
 if(typeof window.requestAnimationFrame==='function')rc990RenderFrame=window.requestAnimationFrame(run);
 else rc990RenderFrame=window.setTimeout(run,16);
 return true
}''')

replace_function('function toggleReleaseChange(', r'''function toggleReleaseChange(key,checked){
 key=q(key);var pos=rc990CaptureReleasePosition(key);
 try{
  releaseChecklistPending[key]=!!checked;
  changeChecklistState(true)[key]=!!checked;
  scheduleConfirmationSave('Release-Center: offene Änderungen aktualisiert');
  preserveReleaseScroll(function(){refreshUnreleasedChangesCard();updateReleaseGateUi()});
  rc990ArmReleasePosition(pos);
 }catch(error){
  rc990RestoreReleasePosition(pos,true);
  rc990ArmReleasePosition(pos);
  return rc990FailOperation(0,(error&&error.message)||'Änderung konnte nicht aktualisiert werden',null,null)
 }
 return false
}''')

replace_function('function setReleaseChangeStatus(', r'''function setReleaseChangeStatus(key,next){
 key=q(key);next=q(next);var item=changeItemByKey(key);if(!item)return false;var pos=rc990CaptureReleasePosition(key);
 try{
  if(next==='failed'){
   var existing=failureFor(item),reason=prompt('Warum ist diese Änderung nicht bestanden?\n\nBitte den Fehler so beschreiben, dass er später gezielt repariert werden kann.',existing&&existing.reason||'');
   if(reason===null){rc990PendingReleasePosition=null;return false}
   reason=q(reason);
   if(!reason){alert('Für „Nicht bestanden“ ist eine Fehlerbeschreibung erforderlich.');rc990PendingReleasePosition=null;return false}
   recordFailure(item,reason)
  }else if(next==='passed')recordPassed(item);else recordOpen(item);
  scheduleConfirmationSave('Release-Center: Prüfstatus der Änderung aktualisiert');
  preserveReleaseScroll(function(){refreshUnreleasedChangesCard();refreshFailureReportCard();updateReleaseGateUi()});
  rc990ArmReleasePosition(pos)
 }catch(error){
  rc990RestoreReleasePosition(pos,true);
  rc990ArmReleasePosition(pos);
  return rc990FailOperation(0,(error&&error.message)||'Prüfstatus konnte nicht aktualisiert werden',null,null)
 }
 return false
}''')

for token, expected in [
    ('function rc990FailOperation(', 1),
    ('function rc990ScheduleRender(', 1),
    ('function toggleReleaseChange(', 1),
    ('function setReleaseChangeStatus(', 1),
]:
    count = html.count(token)
    if count != expected:
        raise SystemExit(f'{token}: expected {expected}, got {count}')

PATH.write_text(html, encoding='utf-8')
print('RC990 error handling applied.')
