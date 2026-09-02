from pathlib import Path


def read(path):
    return Path(path).read_text()


def write(path, text):
    Path(path).write_text(text)


def require(path, marker, label):
    text = read(path)
    if marker not in text:
        raise SystemExit(f'{label}: required marker missing in {path}')
    return text


def replace_once(path, old, new, label):
    text = read(path)
    if new in text:
        return False
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: {path}: expected exactly one match, found {count}')
    write(path, text.replace(old, new, 1))
    return True


def replace_block(path, start_token, end_token, new_block, label):
    text = read(path)
    start = text.find(start_token)
    if start < 0:
        raise SystemExit(f'{label}: start token missing in {path}')
    end = text.find(end_token, start + len(start_token))
    if end < 0:
        raise SystemExit(f'{label}: end token missing in {path}')
    old = text[start:end]
    if old == new_block:
        return False
    write(path, text[:start] + new_block + text[end:])
    return True


# RC960 core changes must already be present before the final pickup normalization.
html = require('TESTVERSION.html', "version:'RC960',cache:'960',loginReturn:'/TESTVERSION.html?v=960'", 'RC960 build marker')
for marker, label in [
    ('Sendungssperre wird vor dem Speichern erneut geprüft', 'authoritative save lock'),
    ('Druck wird vorbereitet', 'document print busy feedback'),
    ('rc950ScheduleLayout', 'RC950 layout scheduler'),
    ('rc950ScheduleShipmentSearch', 'RC950 search scheduler'),
]:
    if marker not in html:
        raise SystemExit(f'{label}: marker missing in TESTVERSION.html')

# Visible physical Colli rows are authoritative. Trusted aggregate totals are fallback only.
pickup_block = """function pickupExpectedCollis(data){
 var explicitNames=['expectedColliCount','totalCollis','totalColli','totalPackages','packagesCount','packageCount'];
 var lists=[];function walk(x,d){if(!x||typeof x!=='object'||d>6)return;['rows','colli','collis','packages','packageRows','items'].forEach(function(k){if(Array.isArray(x[k]))lists.push(x[k])});Object.keys(x).forEach(function(k){var v=x[k];if(v&&typeof v==='object'&&!Array.isArray(v))walk(v,d+1)})}walk(data,0);
 var best=0;for(var i=0;i<lists.length;i++){var total=lists[i].reduce(function(sum,row){if(!row||typeof row!=='object')return sum;var count=pickupColliNumber(row.count||row.qty||row.quantity||row.anzahl||row.menge||row.colliCount);return sum+count},0);if(total>best)best=total}
 if(best>0)return best;
 for(var e=0;e<explicitNames.length;e++){var explicit=pickupColliNumber(valueDeep(data,[explicitNames[e]]));if(explicit>0)return explicit}
 return pickupColliNumber(valueDeep(data,['pickupColliCount','enteredColliCount','colliCount']))
}
"""
replace_block('pickup.html', 'function pickupExpectedCollis(data){', 'function resetColliCheck', pickup_block, 'pickup client physical Colli precedence')

store_block = """function expectedCollis(source){
  var src=source&&typeof source==='object'?source:{},trusted=['expectedColliCount','totalCollis','totalColli','totalPackages','packagesCount','packageCount'],lists=['rows','colli','collis','packages','packageRows','items'],rowFields=['count','qty','quantity','anzahl','menge','colliCount'],i,j;
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
  for(i=0;i<trusted.length;i+=1){
    var total=positiveColliCount(src[trusted[i]]);
    if(total>0)return total;
  }
  var legacy=['pickupColliCount','enteredColliCount','colliCount'];
  for(i=0;i<legacy.length;i+=1){
    var fallback=positiveColliCount(src[legacy[i]]);
    if(fallback>0)return fallback;
  }
  return 0;
}
"""
replace_block('api/shared/pickup-store.js', 'function expectedCollis(source){', 'function signatureUrl', store_block, 'pickup server physical Colli precedence')

# Preserve the physical rows in the QR pickup record so later checks retain the authoritative source.
init_path = 'api/pickup-init/index.js'
init = require(init_path, 'const expected=store.expectedCollis(b);', 'pickup init shared expectedCollis')
if 'const physicalRows=' not in init:
    init = init.replace(
        "const expected=store.expectedCollis(b);if(!expected)throw store.err('COLLI_REQUIRED','Die Soll-Colli-Anzahl fehlt. Bitte die Sendung mit vollständigen Colli-Daten speichern.',400);",
        "const expected=store.expectedCollis(b);if(!expected)throw store.err('COLLI_REQUIRED','Die Soll-Colli-Anzahl fehlt. Bitte die Sendung mit vollständigen Colli-Daten speichern.',400);const physicalRows=Array.isArray(b.rows)?b.rows:Array.isArray(b.colli)?b.colli:Array.isArray(b.collis)?b.collis:Array.isArray(b.packages)?b.packages:[];",
        1,
    )
if 'if(physicalRows.length)record.rows=physicalRows.map' not in init:
    init = init.replace(
        'record.expectedColliCount=expected;record.colliCount=expected;record.totalColli=expected;record.packageCount=expected;',
        'if(physicalRows.length)record.rows=physicalRows.map(row=>store.clone(row));record.expectedColliCount=expected;record.colliCount=expected;record.totalColli=expected;record.packageCount=expected;',
        1,
    )
init = init.replace("record.registrationVersion='RC644';record.metadataVersion=14;", "record.registrationVersion='RC960';record.metadataVersion=15;")
init = init.replace("'pickup-init RC644'", "'pickup-init RC960'")
write(init_path, init)

# Version the confirmation path with the release that owns the corrected Colli contract.
confirm_path = 'api/pickup-confirm-v2/index.js'
confirm = require(confirm_path, 'const expected=store.expectedCollis(r);', 'pickup confirmation shared expectedCollis')
confirm = confirm.replace("r.confirmationVersion='RC873'", "r.confirmationVersion='RC960'")
confirm = confirm.replace("version:'RC873'", "version:'RC960'")
confirm = confirm.replace("'pickup-confirm-v2 RC873'", "'pickup-confirm-v2 RC960'")
write(confirm_path, confirm)

# Final invariants.
pickup = read('pickup.html')
store = read('api/shared/pickup-store.js')
init = read(init_path)
confirm = read(confirm_path)
client = pickup[pickup.find('function pickupExpectedCollis(data){'):pickup.find('function resetColliCheck')]
server = store[store.find('function expectedCollis(source){'):store.find('function signatureUrl')]
if not (0 <= client.find('var lists=[]') < client.find('if(best>0)return best') < client.find('for(var e=0;e<explicitNames.length;e++)')):
    raise SystemExit('pickup client precedence is not physical rows > aggregate > legacy')
if not (0 <= server.find('while(stack.length)') < server.find('if(best>0)return best') < server.find('for(i=0;i<trusted.length;i+=1)') < server.find("var legacy=['pickupColliCount','enteredColliCount','colliCount']")):
    raise SystemExit('pickup server precedence is not physical rows > aggregate > legacy')
if not all(x in init for x in ['const physicalRows=', 'record.rows=physicalRows.map', "registrationVersion='RC960'", 'metadataVersion=15']):
    raise SystemExit('pickup init does not preserve RC960 physical Colli metadata')
if not all(x in confirm for x in ["confirmationVersion='RC960'", "version:'RC960'", "pickup-confirm-v2 RC960"]):
    raise SystemExit('pickup confirmation is not versioned RC960')
