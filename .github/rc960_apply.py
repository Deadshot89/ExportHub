from pathlib import Path


def replace_once(path, old, new, label):
    text = Path(path).read_text()
    if new in text:
        return False
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: {path}: expected exactly one active match, found {count}")
    Path(path).write_text(text.replace(old, new, 1))
    return True


# RC960 canonical TESTSERVICE build marker.
replace_once(
    'TESTVERSION.html',
    "version:'RC950',cache:'950',loginReturn:'/TESTVERSION.html?v=950'",
    "version:'RC960',cache:'960',loginReturn:'/TESTVERSION.html?v=960'",
    'build marker'
)

# Active document viewer print path: reuse the RC950 busy system instead of creating another overlay.
replace_once(
    'TESTVERSION.html',
    "function viewerPrint(){var frame=document.getElementById('rc786DocumentFrame');if(frame){try{frame.contentWindow.focus();frame.contentWindow.print();return false}catch(_){}}var v=viewerPersist();if(v){v.autoPrint=true;try{sessionStorage.setItem('exporthub_document_viewer_v1',JSON.stringify(v))}catch(_){} }viewerLoad();return false}",
    "function viewerPrint(){var frame=document.getElementById('rc786DocumentFrame'),busy=window.ExportHUBRC950Busy;if(frame){try{(busy&&busy.withBusy?busy.withBusy('Druck wird vorbereitet …',function(){frame.contentWindow.focus();frame.contentWindow.print();return true}):(function(){frame.contentWindow.focus();frame.contentWindow.print();return true})());return false}catch(_){}}var v=viewerPersist();if(v){v.autoPrint=true;try{sessionStorage.setItem('exporthub_document_viewer_v1',JSON.stringify(v))}catch(_){} }return busy&&busy.withBusy?(busy.withBusy('Druckansicht wird geladen …',function(){return viewerLoad()}),false):(viewerLoad(),false)}",
    'document viewer print'
)

# Harden shipment save against a pickup/POD that is confirmed while the form is being prepared.
replace_once(
    'TESTVERSION.html',
    "if(!persistenceSave)persistenceSave=window.ExportHUBRC565&&window.ExportHUBRC565.persistShipment;if(typeof persistenceSave!=='function'){operationFail(opToken,'Speicherfunktion ist nicht verfügbar');alert('Die Speicherfunktion ist nicht verfügbar.');return false}operationStep(opToken,'Sendung wird dauerhaft in Azure gespeichert …');",
    "if(!persistenceSave)persistenceSave=window.ExportHUBRC565&&window.ExportHUBRC565.persistShipment;if(typeof persistenceSave!=='function'){operationFail(opToken,'Speicherfunktion ist nicht verfügbar');alert('Die Speicherfunktion ist nicht verfügbar.');return false}operationStep(opToken,'Sendungssperre wird vor dem Speichern erneut geprüft …');if(button)button.textContent='Sendungssperre wird erneut geprüft …';locked=await refreshShipmentLock(true);if(locked){lockShipmentForm(locked,true);operationFail(opToken,'Sendung wurde vor dem Speichern gesperrt');return false}operationStep(opToken,'Sendung wird dauerhaft in Azure gespeichert …');",
    'authoritative shipment lock before persist'
)

# Pickup client: trusted aggregate totals first, row-array sum second, ambiguous legacy fields last.
replace_once(
    'pickup.html',
    "var explicitNames=['expectedColliCount','totalCollis','totalColli','totalPackages','packagesCount','packageCount','colliCount'];",
    "var explicitNames=['expectedColliCount','totalCollis','totalColli','totalPackages','packagesCount','packageCount'];",
    'pickup client trusted totals'
)
replace_once(
    'pickup.html',
    "return pickupColliNumber(valueDeep(data,['pickupColliCount','enteredColliCount']))",
    "return pickupColliNumber(valueDeep(data,['pickupColliCount','enteredColliCount','colliCount']))",
    'pickup client legacy fallback'
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
        raise SystemExit(f'pickup-store helper anchor: expected 1 active match, found {store.count(anchor)}')
    store = store.replace(anchor, anchor + '\n' + store_helper, 1)

old_public = "Math.max(0,Math.round(Number(first(r,['expectedColliCount','totalColli','colliCount','packageCount']))||0))"
if old_public in store:
    store = store.replace(old_public, 'expectedCollis(r)', 1)
elif 'expected=expectedCollis(r)' not in store:
    raise SystemExit('pickup-store public expected-Colli anchor mismatch')

old_team = "Math.max(0,Math.round(Number(first(record,['expectedColliCount','totalColli','colliCount','packageCount']))||0))"
if old_team in store:
    store = store.replace(old_team, 'expectedCollis(record)', 1)
elif 'expected=expectedCollis(record)' not in store:
    raise SystemExit('pickup-store team expected-Colli anchor mismatch')

if 'realPodFiles,first,sanitizeText,expectedCollis};' not in store:
    old_export = 'realPodFiles,first,sanitizeText};'
    if old_export not in store:
        raise SystemExit('pickup-store export anchor mismatch')
    store = store.replace(old_export, 'realPodFiles,first,sanitizeText,expectedCollis};', 1)

helper_start = store.find('function expectedCollis(source)')
helper_end = store.find('function signatureUrl', helper_start)
helper = store[helper_start:helper_end]
trusted_loop = helper.find('for(i=0;i<trusted.length;i+=1)')
row_loop = helper.find('while(stack.length)')
legacy_loop = helper.find("var legacy=['pickupColliCount','enteredColliCount','colliCount']")
if not (0 <= trusted_loop < row_loop < legacy_loop):
    raise SystemExit('pickup-store expected-Colli precedence is not explicit > rows > legacy')
Path(store_path).write_text(store)

replace_once(
    'api/pickup-init/index.js',
    "const expected=count(b.expectedColliCount||b.totalColli||b.colliCount||b.packageCount);",
    "const expected=store.expectedCollis(b);",
    'pickup init expected Colli'
)
replace_once(
    'api/pickup-confirm-v2/index.js',
    "const expected=count(store.first(r,['expectedColliCount','totalColli','colliCount','packageCount']));",
    "const expected=store.expectedCollis(r);",
    'pickup confirm expected Colli'
)
