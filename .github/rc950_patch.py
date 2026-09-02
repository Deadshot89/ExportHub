from pathlib import Path

path = Path('TESTVERSION.html')
text = path.read_text(encoding='utf-8')
original = text


def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 match, got {count}')
    text = text.replace(old, new, 1)
    print('patched:', label)


# 1) One bundled release marker.
replace_once(
    "version:'RC946',cache:'946',loginReturn:'/TESTVERSION.html?v=946'",
    "version:'RC950',cache:'950',loginReturn:'/TESTVERSION.html?v=950'",
    'RC950 build marker',
)

# 2) Reuse the existing loading/operation infrastructure. No second overlay and no extra persist.
operation_api = "window.ExportHUBOperationStatus=Object.freeze({start:operationStart,step:operationStep,done:operationDone,fail:operationFail,current:function(){return operationStatusSeq},active:function(){return !!operationStatusTimer}});"
busy_helpers = operation_api + """
var rc950BusyTokens=[];
function rc950BusyBegin(label){var token=loadingBarStart(q(label)||'ExportHUB arbeitet …',120);rc950BusyTokens.push(token);return token}
function rc950BusyEnd(){var token=rc950BusyTokens.pop();if(!token)return true;var task=loadingTask(token);if(task&&task.visible===false){if(task.showTimer)clearTimeout(task.showTimer);if(task.fallbackTimer)clearTimeout(task.fallbackTimer);delete loadingBarTasks[token];return true}return loadingBarDone(token,'Erledigt')}
function rc950WithBusy(label,fn){rc950BusyBegin(label);return Promise.resolve().then(fn).then(function(value){rc950BusyEnd();return value},function(error){var token=rc950BusyTokens.pop();if(token)loadingBarFail(token,'Vorgang nicht abgeschlossen');throw error})}
window.ExportHUBRC950Busy=Object.freeze({begin:rc950BusyBegin,end:rc950BusyEnd,withBusy:rc950WithBusy});
"""
replace_once(operation_api, busy_helpers, 'shared RC950 busy helpers')

# 3) Coalesce the active shipment patch to one paint-frame and preserve the user's active field/scroll position.
safe_patch_token = "function safePatchDuringEdit(){enforceEditingCustomerLock();var block=document.getElementById('rc363BlockShipment'),body=block&&block.querySelector('.rc363-process-body');applyRC894ShipmentFieldGrid(body);ensureRC894LieferavisButton();updateSummary();updateQr();updateConfirmationButtons();return true}"
layout_helpers = """var rc950LayoutFrame=0,rc950LayoutReason='';
function rc950PreserveActiveInput(root){var snap={scrollTop:0,scrollLeft:0,winX:Number(window.scrollX)||0,winY:Number(window.scrollY)||0};if(!root)return snap;snap.scrollTop=Number(root.scrollTop)||0;snap.scrollLeft=Number(root.scrollLeft)||0;var el=document.activeElement;if(!el||!root.contains(el)||!/^(?:INPUT|TEXTAREA|SELECT)$/.test(String(el.tagName||'').toUpperCase()))return snap;snap.id=q(el.id);snap.name=q(el.getAttribute&&el.getAttribute('name'));snap.tag=String(el.tagName||'').toLowerCase();snap.type=q(el.getAttribute&&el.getAttribute('type'));var holder=el.closest&&el.closest('[data-rc363-field]');snap.field=q(holder&&holder.getAttribute('data-rc363-field'));try{snap.value=el.value}catch(_){}try{snap.start=el.selectionStart;snap.end=el.selectionEnd}catch(_){}return snap}
function rc950RestoreActiveInput(snapshot,root){if(!snapshot||!root)return false;var el=null;if(snapshot.id){var byId=document.getElementById(snapshot.id);if(byId&&root.contains(byId))el=byId}if(!el&&snapshot.name){Array.prototype.some.call(root.querySelectorAll('[name]'),function(node){if(q(node.getAttribute('name'))===snapshot.name){el=node;return true}return false})}if(!el&&snapshot.field){Array.prototype.some.call(root.querySelectorAll('[data-rc363-field]'),function(holder){if(q(holder.getAttribute('data-rc363-field'))!==snapshot.field)return false;var candidates=holder.querySelectorAll('input,textarea,select');for(var i=0;i<candidates.length;i++){var node=candidates[i];if(!snapshot.tag||String(node.tagName||'').toLowerCase()===snapshot.tag){el=node;return true}}return false})}if(el){try{if(snapshot.value!==undefined&&'value' in el&&el.value!==snapshot.value)el.value=snapshot.value}catch(_){}try{el.focus({preventScroll:true})}catch(_){try{el.focus()}catch(__){}}try{if(snapshot.start!=null&&typeof el.setSelectionRange==='function')el.setSelectionRange(snapshot.start,snapshot.end==null?snapshot.start:snapshot.end)}catch(_){}}try{root.scrollTop=snapshot.scrollTop;root.scrollLeft=snapshot.scrollLeft}catch(_){}try{if(Math.abs((Number(window.scrollY)||0)-snapshot.winY)>1||Math.abs((Number(window.scrollX)||0)-snapshot.winX)>1)window.scrollTo(snapshot.winX,snapshot.winY)}catch(_){}return !!el}
function rc950ScheduleLayout(reason){if(!isShipmentView())return false;rc950LayoutReason=q(reason)||rc950LayoutReason||'layout';if(rc950LayoutFrame){try{(window.cancelAnimationFrame||window.clearTimeout)(rc950LayoutFrame)}catch(_){}}var raf=window.requestAnimationFrame||function(fn){return window.setTimeout(fn,16)};rc950LayoutFrame=raf(function(){rc950LayoutFrame=0;var r=root(),snapshot=rc950PreserveActiveInput(r),layout=document.getElementById('rc363FixedShipmentLayout');try{if(layout||editLockActive())safePatchDuringEdit();else patch()}finally{rc950RestoreActiveInput(snapshot,r);rc950LayoutReason=''}});return true}
""" + safe_patch_token
replace_once(safe_patch_token, layout_helpers, 'shipment frame scheduler and focus preservation')

replace_once(
    "function deferFullPatch(delay){if(!isShipmentView())return false;fullPatchPending=false;safePatchDuringEdit();return true}",
    "function deferFullPatch(delay){if(!isShipmentView())return false;fullPatchPending=false;return rc950ScheduleLayout('deferFullPatch')}",
    'deferred shipment patch batching',
)

replace_once(
    "function schedulePatch(){if(!isShipmentView())return false;var layout=document.getElementById('rc363FixedShipmentLayout');if(layout||editLockActive()){safePatchDuringEdit();return true}if(patchTimer)return true;var nt=window.ExportHUBClean&&window.ExportHUBClean.native&&window.ExportHUBClean.native.setTimeout||window.setTimeout;patchTimer=nt(function(){patchTimer=0;patch()},16);return true}",
    "function schedulePatch(){if(!isShipmentView())return false;var layout=document.getElementById('rc363FixedShipmentLayout');if(layout||editLockActive())return rc950ScheduleLayout('schedulePatch');if(patchTimer)return true;var nt=window.ExportHUBClean&&window.ExportHUBClean.native&&window.ExportHUBClean.native.setTimeout||window.setTimeout;patchTimer=nt(function(){patchTimer=0;patch()},16);return true}",
    'active shipment patch hot path',
)

# 4) Coalesce search result rendering while typing. Explicit search/Enter remain immediate.
search_token = "function renderSearch(){var root=document.getElementById('content');if(!root)return false;"
search_helper = """var rc950ShipmentSearchFrame=0,rc950ShipmentSearchValue='';
function rc950ScheduleShipmentSearch(value){rc950ShipmentSearchValue=String(value==null?'':value);if(rc950ShipmentSearchFrame){try{(window.cancelAnimationFrame||window.clearTimeout)(rc950ShipmentSearchFrame)}catch(_){}}var raf=window.requestAnimationFrame||function(fn){return window.setTimeout(fn,16)};rc950ShipmentSearchFrame=raf(function(){rc950ShipmentSearchFrame=0;renderSearchResults(rc950ShipmentSearchValue)});return false}
""" + search_token
replace_once(search_token, search_helper, 'shipment search scheduler')

replace_once(
    "document.addEventListener('input',function(e){var input=e.target;if(input&&input.id==='rc807ShipmentSearch')return renderSearchResults(input.value)},true);",
    "document.addEventListener('input',function(e){var input=e.target;if(input&&input.id==='rc807ShipmentSearch')return rc950ScheduleShipmentSearch(input.value)},true);",
    'shipment search input batching',
)

# 5) Long document downloads get the same existing top loading bar, without adding persistence.
viewer_download = "function viewerDownload(){var d=viewerCurrentDoc(),v=viewerPersist();return d?downloadDocObject(Object.assign({},d,{reference:v&&v.reference})):false}"
viewer_download_new = "function viewerDownload(){var d=viewerCurrentDoc(),v=viewerPersist();if(!d)return false;var work=function(){return downloadDocObject(Object.assign({},d,{reference:v&&v.reference}))},busy=window.ExportHUBRC950Busy;return busy&&typeof busy.withBusy==='function'?busy.withBusy('Download wird vorbereitet …',work):work()}"
replace_once(viewer_download, viewer_download_new, 'document viewer download status')

if text == original:
    raise SystemExit('RC950 patch produced no changes')
path.write_text(text, encoding='utf-8')
print('RC950 patch complete; bytes:', len(text.encode('utf-8')))
