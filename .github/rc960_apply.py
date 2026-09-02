from pathlib import Path


def replace_once(path, old, new):
    text = Path(path).read_text()
    if new in text:
        return False
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one active match, found {count}")
    Path(path).write_text(text.replace(old, new, 1))
    return True


# Build marker
replace_once(
    'TESTVERSION.html',
    "version:'RC950',cache:'950',loginReturn:'/TESTVERSION.html?v=950'",
    "version:'RC960',cache:'960',loginReturn:'/TESTVERSION.html?v=960'"
)

# Add reusable loading state to viewer printing.
replace_once(
    'TESTVERSION.html',
    "function viewerPrint(){var frame=document.getElementById('rc786DocumentFrame');if(frame){try{frame.contentWindow.focus();frame.contentWindow.print();return false}catch(_){}}var v=viewerPersist();if(v){v.autoPrint=true;try{sessionStorage.setItem(RC786_DOCUMENT_VIEWER_KEY,JSON.stringify(v))}catch(_){}}viewerLoad();return false}",
    "function viewerPrint(){var frame=document.getElementById('rc786DocumentFrame'),busy=window.ExportHUBRC950Busy;if(frame){try{(busy&&busy.withBusy?busy.withBusy('Druck wird vorbereitet …',function(){frame.contentWindow.focus();frame.contentWindow.print();return true}):(function(){frame.contentWindow.focus();frame.contentWindow.print();return true})());return false}catch(_){}}var v=viewerPersist();if(v){v.autoPrint=true;try{sessionStorage.setItem(RC786_DOCUMENT_VIEWER_KEY,JSON.stringify(v))}catch(_){}}return busy&&busy.withBusy?(busy.withBusy('Druckansicht wird geladen …',function(){return viewerLoad()}),false):(viewerLoad(),false)}"
)

# Keep scheduled warehouse views responsive while a task is actively dragged.
replace_once(
    'TESTVERSION.html',
    "var source=rc946TaskPointer.from||taskAssignment(id),overlay=rc946StableOverlay(source),msg=null,res=assignmentAllowed(source,teamId,day);",
    "var source=rc946TaskPointer.from||taskAssignment(id),overlay=rc946StableOverlay(source),msg=null;rc946FocusTask(id);var res=assignmentAllowed(source,teamId,day);"
)
replace_once(
    'TESTVERSION.html',
    "if(msg) {notify(msg,'info'); schedulePersist()} rc946TaskPointer=null; rc946ResetDragPreview(); try{rc946WarehousePointerZone&&rc946WarehousePointerZone.classList.remove('rc946-pointer-drop-target')}catch(_){} rc946WarehousePointerZone=null; rc946TaskPointerDay=''; return;",
    "if(msg) {notify(msg,'info'); schedulePersist()} rc946TaskPointer=null; rc946ResetDragPreview(); try{rc946WarehousePointerZone&&rc946WarehousePointerZone.classList.remove('rc946-pointer-drop-target')}catch(_){} rc946WarehousePointerZone=null; rc946TaskPointerDay=''; rc946FocusTask(''); rc946SetRenderScope('full'); return;"
)
replace_once(
    'TESTVERSION.html',
    "if(msg) notify(msg,'success'); schedulePersist(); rc946TaskPointer=null; rc946ResetDragPreview(); try{rc946WarehousePointerZone&&rc946WarehousePointerZone.classList.remove('rc946-pointer-drop-target')}catch(_){} rc946WarehousePointerZone=null; rc946TaskPointerDay='';",
    "if(msg) notify(msg,'success'); schedulePersist(); rc946TaskPointer=null; rc946ResetDragPreview(); try{rc946WarehousePointerZone&&rc946WarehousePointerZone.classList.remove('rc946-pointer-drop-target')}catch(_){} rc946WarehousePointerZone=null; rc946TaskPointerDay=''; rc946FocusTask(''); rc946SetRenderScope('full');"
)
replace_once(
    'TESTVERSION.html',
    "try{rc946WarehousePointerZone&&rc946WarehousePointerZone.classList.remove('rc946-pointer-drop-target')}catch(_){}rc946WarehousePointerZone=null;rc946TaskPointer=null;rc946TaskPointerDay='';try{window.__rc946_pointer_up_ts=Date.now()}catch(_){}rc946ClearPointerTimer();rc946ResetDragPreview();rc946RefreshTaskCard(taskId);",
    "try{rc946WarehousePointerZone&&rc946WarehousePointerZone.classList.remove('rc946-pointer-drop-target')}catch(_){}rc946WarehousePointerZone=null;rc946TaskPointer=null;rc946TaskPointerDay='';rc946FocusTask('');rc946SetRenderScope('full');try{window.__rc946_pointer_up_ts=Date.now()}catch(_){}rc946ClearPointerTimer();rc946ResetDragPreview();rc946RefreshTaskCard(taskId);"
)

# QR audit metadata: label the functional addressee source honestly and do not invent a technical subject.
replace_once(
    'TESTVERSION.html',
    "if(d.recipientEmail||d.recipientName)lines.push('<b>Empfänger:</b> '+escapeHtml(d.recipientName||d.recipientEmail));",
    "if(d.recipientEmail||d.recipientName)lines.push('<b>Adressat:</b> '+escapeHtml(d.recipientName||d.recipientEmail)+' <span class=\"muted\">(aus Auftrag/Standort)</span>');"
)
replace_once(
    'TESTVERSION.html',
    "lines.push('<b>Betreff:</b> '+escapeHtml(d.reference||('QR Audit – '+(qrTypeLabel(t)||'QR Zugriff'))));",
    "lines.push('<b>Betreff:</b> '+escapeHtml(d.reference||'Nicht verfügbar'));"
)

# Pickup client: trusted aggregate totals first, row-array sum second, ambiguous legacy fields last.
replace_once(
    'pickup.html',
    "var explicitNames=['expectedColliCount','totalCollis','totalColli','totalPackages','packagesCount','packageCount','colliCount'];",
    "var explicitNames=['expectedColliCount','totalCollis','totalColli','totalPackages','packagesCount','packageCount'];"
)
replace_once(
    'pickup.html',
    "return pickupColliNumber(valueDeep(data,['pickupColliCount','enteredColliCount']))",
    "return pickupColliNumber(valueDeep(data,['pickupColliCount','enteredColliCount','colliCount']))"
)

# Pickup server: one authoritative expected-Colli rule shared by init, confirmation, public view and team confirmation.
# Precedence is deliberate: explicit aggregate > summed physical rows > ambiguous legacy fallback.
store_helper = r"""function positiveColliCount(value){
  var n=Number(value);
  if(!isFinite(n)||n<=0)return 0;
  return Math.max(0,Math.round(n));
}
function physicalColliCount(value){
  var n=Number(value);
  if(!isFinite(n)||n<=0)return 0;
  return Math.max(0,Math.ceil(n));
}
function expectedCollis(source){
  var src=source&&typeof source==='object'?source:{},trusted=['expectedColliCount','totalCollis','totalColli','totalPackages','packagesCount','packageCount'],lists=['rows','colli','collis','packages','packageRows','items'],rowFields=['count','qty','quantity','anzahl','menge','colliCount'],i,j;
  for(i=0;i<trusted.length;i+=1){
    var total=positiveColliCount(src[trusted[i]]);
    if(total>0)return total;
  }
  var best=0,seen=[],stack=[src];
  while(stack.length){
    var node=stack.pop();
    if(!node||typeof node!=='object'||seen.indexOf(node)>=0)continue;
    seen.push(node);
    for(i=0;i<lists.length;i+=1){
      if(!Array.isArray(node[lists[i]]))continue;
      var sum=0;
      for(j=0;j<node[lists[i]].length;j+=1){
        var row=node[lists[i]][j]||{},k,rowCount=0;
        for(k=0;k<rowFields.length;k+=1){
          rowCount=physicalColliCount(row[rowFields[k]]);
          if(rowCount>0)break;
        }
        sum+=rowCount;
      }
      if(sum>best)best=sum;
    }
    Object.keys(node).forEach(function(key){
      var child=node[key];
      if(child&&typeof child==='object'&&!Array.isArray(child))stack.push(child);
    });
  }
  if(best>0)return best;
  var legacy=['pickupColliCount','enteredColliCount','colliCount'];
  for(i=0;i<legacy.length;i+=1){
    var fallback=positiveColliCount(src[legacy[i]]);
    if(fallback>0)return fallback;
  }
  return 0;
}"""

store_path = 'api/shared/pickup-store.js'
store = Path(store_path).read_text()
if 'function expectedCollis(source)' not in store:
    anchor = "function sanitizeText(v,max=180){return String(v==null?'':v).replace(/[\\u0000-\\u001f\\u007f]/g,' ').replace(/\\s+/g,' ').trim().slice(0,max)}"
    if store.count(anchor) != 1:
        raise SystemExit('pickup-store: helper anchor mismatch')
    store = store.replace(anchor, anchor + '\n' + store_helper, 1)

old_public = "Math.max(0,Math.round(Number(first(r,['expectedColliCount','totalColli','colliCount','packageCount']))||0))"
if old_public in store:
    store = store.replace(old_public, 'expectedCollis(r)', 1)
elif 'expected=expectedCollis(r)' not in store:
    raise SystemExit('pickup-store: public expected-Colli anchor mismatch')

old_team = "Math.max(0,Math.round(Number(first(record,['expectedColliCount','totalColli','colliCount','packageCount']))||0))"
if old_team in store:
    store = store.replace(old_team, 'expectedCollis(record)', 1)
elif 'expected=expectedCollis(record)' not in store:
    raise SystemExit('pickup-store: team expected-Colli anchor mismatch')

if 'realPodFiles,first,sanitizeText,expectedCollis};' not in store:
    old_export = 'realPodFiles,first,sanitizeText};'
    if old_export not in store:
        raise SystemExit('pickup-store: export anchor mismatch')
    store = store.replace(old_export, 'realPodFiles,first,sanitizeText,expectedCollis};', 1)

# Assert the precedence in the actual product source before writing it.
helper_start = store.find('function expectedCollis(source)')
helper_end = store.find('\n}', helper_start)
helper = store[helper_start:helper_end + 2]
trusted_loop = helper.find('for(i=0;i<trusted.length;i+=1)')
row_loop = helper.find('while(stack.length)')
legacy_loop = helper.find("var legacy=['pickupColliCount','enteredColliCount','colliCount']")
if not (0 <= trusted_loop < row_loop < legacy_loop):
    raise SystemExit('pickup-store: expected-Colli precedence is not explicit > rows > legacy')
Path(store_path).write_text(store)

replace_once(
    'api/pickup-init/index.js',
    "const expected=count(b.expectedColliCount||b.totalColli||b.colliCount||b.packageCount);",
    "const expected=store.expectedCollis(b);"
)
replace_once(
    'api/pickup-confirm-v2/index.js',
    "const expected=count(store.first(r,['expectedColliCount','totalColli','colliCount','packageCount']));",
    "const expected=store.expectedCollis(r);"
)
