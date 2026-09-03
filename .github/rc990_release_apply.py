from pathlib import Path
import re

p=Path('TESTVERSION.html')
s=p.read_text(encoding='utf-8')

old_build="var BUILD=Object.freeze({version:'RC980',cache:'980',loginReturn:'/TESTVERSION.html?v=980'});"
new_build="var BUILD=Object.freeze({version:'RC990',cache:'990',loginReturn:'/TESTVERSION.html?v=990'});"
assert s.count(old_build)==1, f'expected one RC980 BUILD, got {s.count(old_build)}'
s=s.replace(old_build,new_build,1)

def span(name, text=None):
    text=s if text is None else text
    m=re.search(r'function\s+'+re.escape(name)+r'\s*\([^)]*\)\s*\{',text)
    assert m, f'function {name} not found'
    i=m.end()-1; depth=0; quote=''; esc=False
    while i<len(text):
        ch=text[i]
        if quote:
            if esc: esc=False
            elif ch=='\\': esc=True
            elif ch==quote: quote=''
        else:
            if ch in "'\"`": quote=ch
            elif ch=='{': depth+=1
            elif ch=='}':
                depth-=1
                if depth==0:return m.start(),i+1
        i+=1
    raise AssertionError(f'unclosed function {name}')

def replace_func(name, new_src):
    global s
    a,b=span(name)
    s=s[:a]+new_src+s[b:]

# One canonical unpublished-change source for list, counter, lookup and recovery.
a,b=span('unreleasedChanges')
insert="\nfunction rc990OpenChangeItems(){return unreleasedChanges().slice()}"
s=s[:b]+insert+s[b:]

replace_func('changeItemByKey',"function changeItemByKey(key){key=q(key);return rc990OpenChangeItems().find(function(item){return changeKey(item)===key})||null}")
replace_func('changeChecklistProgress',"function changeChecklistProgress(){var list=rc990OpenChangeItems(),done=0,failed=0;list.forEach(function(item){if(changeConfirmed(item))done++;else if(changeFailed(item))failed++});return{total:list.length,done:done,failed:failed,remaining:Math.max(0,list.length-done)}}")
replace_func('unreleasedGroups',"function unreleasedGroups(){var list=rc990OpenChangeItems(),map={},order=[];list.forEach(function(item){var n=releaseItemVersion(item),key='RC'+n;if(!map[key]){map[key]=[];order.push(key)}map[key].push(item)});order.sort(function(a,b){return rcNumber(b)-rcNumber(a)});return order.map(function(version){return{version:version,items:map[version]}})}")

# A stale explicit 'open' result must not override a newer checked/pending confirmation.
replace_func('changeResult',"function changeResult(item){var key=changeKey(item),result=changeResultState(false)[key],status=q(result&&result.status),confirmed=releaseChecklistPending[key]===true||changeChecklistState(false)[key]===true;if(status==='failed')return result;if(status==='passed')return result;if(confirmed)return{status:'passed',legacy:true};if(status==='open')return result;return{status:'open'}}")

# Keep the old simple scroll helper for legacy callers, but add stable keyed RC990 restoration
# that survives a later full application render caused by queued persistence.
_,preserve_end=span('preserveReleaseScroll')
helpers=r'''
var rc990PendingReleasePosition=null,rc990ReleaseRestoreTimer=0,rc990ReleaseSuppressScrollUntil=0;
function rc990ReleaseAnchor(key){key=q(key);if(!key)return null;var root=document.getElementById('rc747UnreleasedChanges')||document.getElementById('content');if(!root)return null;var nodes=root.querySelectorAll('[data-rc990-change-key]');for(var i=0;i<nodes.length;i++)if(q(nodes[i].getAttribute('data-rc990-change-key'))===key)return nodes[i];return null}
function rc990CaptureReleasePosition(key){var pos=captureReleaseScroll(),anchor=rc990ReleaseAnchor(key);pos.key=q(key);pos.anchorTop=anchor&&anchor.getBoundingClientRect?anchor.getBoundingClientRect().top:null;pos.capturedAt=Date.now();rc990PendingReleasePosition=pos;return pos}
function rc990RestoreReleasePosition(pos,keepPending){pos=pos||rc990PendingReleasePosition;if(!pos)return false;rc990ReleaseSuppressScrollUntil=Date.now()+140;restoreReleaseScroll(pos);var anchor=rc990ReleaseAnchor(pos.key);if(anchor&&Number.isFinite(Number(pos.anchorTop))&&anchor.getBoundingClientRect){var delta=anchor.getBoundingClientRect().top-Number(pos.anchorTop);if(Math.abs(delta)>1){rc990ReleaseSuppressScrollUntil=Date.now()+140;try{window.scrollBy(0,delta)}catch(_){}}}if(keepPending!==true&&rc990PendingReleasePosition===pos)rc990PendingReleasePosition=null;return true}
function rc990ArmReleasePosition(pos){pos=pos||rc990PendingReleasePosition;if(!pos)return false;rc990PendingReleasePosition=pos;rc990RestoreReleasePosition(pos,true);var raf=window.requestAnimationFrame||function(cb){return setTimeout(cb,16)};raf(function(){raf(function(){if(rc990PendingReleasePosition===pos)rc990RestoreReleasePosition(pos,true)})});if(rc990ReleaseRestoreTimer)clearTimeout(rc990ReleaseRestoreTimer);rc990ReleaseRestoreTimer=setTimeout(function(){if(rc990PendingReleasePosition===pos)rc990RestoreReleasePosition(pos,false)},1700);return true}
window.addEventListener('exporthub:rendered',function(){var pos=rc990PendingReleasePosition;if(!pos||Date.now()-Number(pos.capturedAt||0)>2600)return;var raf=window.requestAnimationFrame||function(cb){return setTimeout(cb,16)};raf(function(){raf(function(){if(rc990PendingReleasePosition===pos&&document.getElementById('rc562ReleaseStatus'))rc990RestoreReleasePosition(pos,false)})})});
window.addEventListener('scroll',function(){if(!rc990PendingReleasePosition||Date.now()<=rc990ReleaseSuppressScrollUntil)return;rc990PendingReleasePosition=null;if(rc990ReleaseRestoreTimer){clearTimeout(rc990ReleaseRestoreTimer);rc990ReleaseRestoreTimer=0}},{passive:true});
'''
s=s[:preserve_end]+helpers+s[preserve_end:]

replace_func('scheduleConfirmationSave',"function scheduleConfirmationSave(reason){if(releaseChecklistSaveTimer)clearTimeout(releaseChecklistSaveTimer);releaseChecklistSaveTimer=setTimeout(function(){releaseChecklistSaveTimer=0;var pos=rc990PendingReleasePosition;applyPendingConfirmations();save(reason||'Release-Center: Bestätigungen gespeichert');if(pos)rc990ArmReleasePosition(pos)},900);return true}")

replace_func('toggleReleaseChange',"function toggleReleaseChange(key,checked){key=q(key);var pos=rc990CaptureReleasePosition(key);releaseChecklistPending[key]=!!checked;changeChecklistState(true)[key]=!!checked;scheduleConfirmationSave('Release-Center: offene Änderungen aktualisiert');preserveReleaseScroll(function(){refreshUnreleasedChangesCard();updateReleaseGateUi()});rc990ArmReleasePosition(pos);return false}")
replace_func('setReleaseChangeStatus',"function setReleaseChangeStatus(key,next){key=q(key);next=q(next);var item=changeItemByKey(key);if(!item)return false;var pos=rc990CaptureReleasePosition(key);if(next==='failed'){var existing=failureFor(item),reason=prompt('Warum ist diese Änderung nicht bestanden?\\n\\nBitte den Fehler so beschreiben, dass er später gezielt repariert werden kann.',existing&&existing.reason||'');if(reason===null){rc990PendingReleasePosition=null;return false}reason=q(reason);if(!reason){alert('Für „Nicht bestanden“ ist eine Fehlerbeschreibung erforderlich.');rc990PendingReleasePosition=null;return false}recordFailure(item,reason)}else if(next==='passed'){recordPassed(item)}else{recordOpen(item)}scheduleConfirmationSave('Release-Center: Prüfstatus der Änderung aktualisiert');preserveReleaseScroll(function(){refreshUnreleasedChangesCard();refreshFailureReportCard();updateReleaseGateUi()});rc990ArmReleasePosition(pos);return false}")

# Test checklist actions get the same positional protection even though they have no change key.
replace_func('toggleChecklist',"function toggleChecklist(index,checked){var pos=rc990CaptureReleasePosition(''),key=String(index);testChecklistPending[key]=!!checked;checklistState(true)[index]=!!checked;scheduleConfirmationSave('Release-Center: Testcheckliste aktualisiert');preserveReleaseScroll(function(){refreshChecklistCard();updateReleaseGateUi()});rc990ArmReleasePosition(pos);return false}")
replace_func('checkAllTests',"function checkAllTests(){var pos=rc990CaptureReleasePosition(''),tests=releaseTests(),state=checklistState(true);for(var i=0;i<tests.length;i++){state[i]=true;testChecklistPending[String(i)]=true}scheduleConfirmationSave('Release-Center: alle Testpunkte bestätigt');preserveReleaseScroll(function(){refreshChecklistCard();updateReleaseGateUi()});rc990ArmReleasePosition(pos);return false}")
replace_func('resetChecklist',"function resetChecklist(){if(!confirm('Checkliste für '+VERSION+' wirklich zurücksetzen?'))return false;var pos=rc990CaptureReleasePosition(''),m=meta(true);m.testChecklist=m.testChecklist&&typeof m.testChecklist==='object'?m.testChecklist:{};m.testChecklist[VERSION]={};testChecklistPending=Object.create(null);save('Release-Center: Checkliste zurückgesetzt');preserveReleaseScroll(function(){refreshChecklistCard();updateReleaseGateUi()});rc990ArmReleasePosition(pos);return false}")

# Full Release-Center rebuild accepts/captures a position and restores it after async refresh.
replace_func('rerender',"function rerender(pos){var root=document.getElementById('content');if(!root)return;pos=pos||rc990PendingReleasePosition||rc990CaptureReleasePosition('');root.innerHTML=renderHtml();rc990ArmReleasePosition(pos);var raf=window.requestAnimationFrame||function(fn){return setTimeout(fn,16)};raf(function(){Promise.resolve(refresh()).catch(function(error){console.error('Release-Center aktualisieren',error)}).finally(function(){rc990ArmReleasePosition(pos)})});return true}")

# Preserve position for the explicit full-render actions too.
old_mark_a,old_mark_b=span('markTested'); old_mark=s[old_mark_a:old_mark_b]
needle="save('Release-Center: '+VERSION+' Test bestanden');rerender();return false"
assert needle in old_mark, 'markTested tail changed'
old_mark=old_mark.replace(needle,"var pos=rc990CaptureReleasePosition('');save('Release-Center: '+VERSION+' Test bestanden');rerender(pos);return false",1)
s=s[:old_mark_a]+old_mark+s[old_mark_b:]

old_reset_a,old_reset_b=span('resetTest'); old_reset=s[old_reset_a:old_reset_b]
needle="save('Release-Center: Teststatus zurückgesetzt');rerender();return false"
assert needle in old_reset, 'resetTest tail changed'
old_reset=old_reset.replace(needle,"var pos=rc990CaptureReleasePosition('');save('Release-Center: Teststatus zurückgesetzt');rerender(pos);return false",1)
s=s[:old_reset_a]+old_reset+s[old_reset_b:]

# Old RC761 recovery must use the same item source as the visible list/counter.
a,b=span('recoverRc761Confirmations'); src=s[a:b]
src2=src.replace('unreleasedChanges().filter(', 'rc990OpenChangeItems().filter(', 1)
assert src2!=src, 'recoverRc761Confirmations source not replaced'
s=s[:a]+src2+s[b:]

# Add a stable key to every visible unpublished-change row.
a,b=span('renderUnreleasedChangesInner'); src=s[a:b]
old="return '<div style=\"padding:10px 12px;border:1px solid '+border"
new="return '<div data-rc990-change-key=\"'+esc(key)+'\" style=\"padding:10px 12px;border:1px solid '+border"
assert old in src, 'unreleased row markup changed'
src=src.replace(old,new,1)
s=s[:a]+src+s[b:]

# Sanity: the old active consumers must no longer read unreleasedChanges directly.
for name in ['changeItemByKey','changeChecklistProgress','unreleasedGroups']:
    a,b=span(name); assert 'rc990OpenChangeItems(' in s[a:b], name

p.write_text(s,encoding='utf-8')
print('RC990 Release Center patch applied')
