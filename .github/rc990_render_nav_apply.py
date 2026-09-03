from pathlib import Path

PATH = Path('TESTVERSION.html')
html = PATH.read_text(encoding='utf-8')


def require_once(text: str, label: str) -> int:
    count = html.count(text)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 occurrence, got {count}')
    return html.index(text)


def replace_once(old: str, new: str, label: str) -> None:
    global html
    count = html.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 occurrence, got {count}')
    html = html.replace(old, new, 1)


def function_span(signature: str):
    start = html.find(signature)
    if start < 0:
        raise SystemExit(f'function not found: {signature}')
    brace = html.find('{', start)
    if brace < 0:
        raise SystemExit(f'function brace not found: {signature}')
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
        if ch in ('\"', "'", '`'):
            quote = ch
        elif ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return start, i + 1
        i += 1
    raise SystemExit(f'unclosed function: {signature}')


def replace_function(signature: str, new_source: str) -> None:
    global html
    start, end = function_span(signature)
    html = html[:start] + new_source + html[end:]


# ---------------------------------------------------------------------------
# RC990 UI snapshot + deduplicated render queue.
# This extends the existing RC950 focus protection and becomes its scheduler.
# ---------------------------------------------------------------------------
render_anchor = "var rc950LayoutFrame=0,rc950LayoutReason='';"
require_once(render_anchor, 'RC950 render anchor')

if 'function rc990CaptureUiState(' not in html:
    rc990_render_core = r'''/* RC990 RENDER FOCUS NAVIGATION CORE START */
var rc990RenderFrame=0,rc990RenderReason='',rc990RenderTask=null;
function rc990CaptureUiState(root){
 var el=document.activeElement,snapshot={winX:Number(window.scrollX)||0,winY:Number(window.scrollY)||0,rootTop:root?Number(root.scrollTop)||0:0,rootLeft:root?Number(root.scrollLeft)||0:0,id:'',name:'',field:'',value:undefined,start:null,end:null,node:null};
 if(!root||!el||!root.contains(el)||!/^(?:INPUT|TEXTAREA|SELECT)$/.test(String(el.tagName||'').toUpperCase()))return snapshot;
 snapshot.node=el;
 snapshot.id=q(el.id);
 snapshot.name=q(el.getAttribute&&el.getAttribute('name'));
 var holder=el.closest&&el.closest('[data-rc363-field]');
 snapshot.field=q(holder&&holder.getAttribute('data-rc363-field'));
 try{snapshot.value=el.value}catch(_){}
 try{snapshot.start=el.selectionStart;snapshot.end=el.selectionEnd}catch(_){}
 return snapshot
}
function rc990ResolveUiField(snapshot,root){
 if(!snapshot||!root)return null;
 var el=null;
 if(snapshot.id){try{el=document.getElementById(snapshot.id)}catch(_){}}
 if(el&&!root.contains(el))el=null;
 if(!el&&snapshot.name){try{el=root.querySelector('[name="'+String(snapshot.name).replace(/"/g,'\\"')+'"]')}catch(_){}}
 if(!el&&snapshot.field){try{var holder=root.querySelector('[data-rc363-field="'+String(snapshot.field).replace(/"/g,'\\"')+'"]');if(holder)el=holder.querySelector('input,textarea,select')}catch(_){}}
 return el
}
function rc990RestoreUiState(snapshot,root){
 if(!snapshot||!root)return false;
 var defer=window.requestAnimationFrame||function(fn){return window.setTimeout(fn,0)};
 defer(function(){
  var el=rc990ResolveUiField(snapshot,root);
  if(el){
   var sameNode=!!(snapshot.node&&snapshot.node===el),activeNow=document.activeElement===el;
   try{if(snapshot.value!==undefined&&'value' in el&&!sameNode&&!(activeNow&&el.value!==snapshot.value))el.value=snapshot.value}catch(_){}
   try{el.focus({preventScroll:true})}catch(_){try{el.focus()}catch(__){}}
   try{if(snapshot.start!=null&&typeof el.setSelectionRange==='function')el.setSelectionRange(snapshot.start,snapshot.end==null?snapshot.start:snapshot.end)}catch(_){}
  }
  try{root.scrollTop=Number(snapshot.rootTop)||0;root.scrollLeft=Number(snapshot.rootLeft)||0}catch(_){}
  try{var x=Number(snapshot.winX)||0,y=Number(snapshot.winY)||0;if(Math.abs((Number(window.scrollX)||0)-x)>1||Math.abs((Number(window.scrollY)||0)-y)>1)window.scrollTo(x,y)}catch(_){}
 });
 return true
}
function rc990ScheduleRender(reason,fn){
 rc990RenderReason=q(reason)||rc990RenderReason||'render';
 if(typeof fn==='function')rc990RenderTask=fn;
 if(rc990RenderFrame)return true;
 var run=function(){rc990RenderFrame=0;var task=rc990RenderTask;rc990RenderTask=null;try{if(typeof task==='function')task()}finally{rc990RenderReason=''}};
 if(typeof window.requestAnimationFrame==='function')rc990RenderFrame=window.requestAnimationFrame(run);
 else rc990RenderFrame=window.setTimeout(run,16);
 return true
}
/* RC990 RENDER FOCUS NAVIGATION CORE END */
'''
    html = html.replace(render_anchor, rc990_render_core + render_anchor, 1)

replace_function('function rc950ScheduleLayout(reason)', r'''function rc950ScheduleLayout(reason){
 if(!isShipmentView())return false;
 rc950LayoutReason=q(reason)||rc950LayoutReason||'layout';
 return rc990ScheduleRender(rc950LayoutReason,function(){
  var r=root(),snapshot=rc990CaptureUiState(r),layout=document.getElementById('rc363FixedShipmentLayout');
  try{if(layout||editLockActive())safePatchDuringEdit();else patch()}
  finally{rc990RestoreUiState(snapshot,r);rc950LayoutReason=''}
 })
}''')

# ---------------------------------------------------------------------------
# RC990 application view history inside the one canonical navigation controller.
# ---------------------------------------------------------------------------
nav_marker = '<script id="index321-single-navigation-controller">'
require_once(nav_marker, 'canonical navigation controller')

history_anchor = 'function historyEnabled()'
require_once(history_anchor, 'historyEnabled anchor')

if 'var rc990ViewHistory=' not in html:
    rc990_history = r'''var rc990ViewHistory=[],rc990HistoryApplying=false,rc990ViewHistoryLimit=24;
function rc990RememberView(view,source){
 if(rc990HistoryApplying)return false;
 view=canonical(view);
 if(!view)return false;
 if(source==='history'||source==='popstate'){
  var existing=rc990ViewHistory.lastIndexOf(view);
  if(existing>=0){rc990ViewHistory.splice(existing+1);return true}
 }
 var last=rc990ViewHistory[rc990ViewHistory.length-1];
 if(last===view)return false;
 rc990ViewHistory.push(view);
 if(rc990ViewHistory.length>rc990ViewHistoryLimit)rc990ViewHistory.splice(0,rc990ViewHistory.length-rc990ViewHistoryLimit);
 return true
}
function rc990BackView(fallbackView){
 var now=current(),snapshot=rc990ViewHistory.slice();
 if(rc990ViewHistory[rc990ViewHistory.length-1]===now)rc990ViewHistory.pop();
 var target=rc990ViewHistory[rc990ViewHistory.length-1]||'';
 if(target&&target!==now&&canRoute(target)){
  rc990HistoryApplying=true;historyApplying=true;
  try{route(target,'rc990-back')}finally{historyApplying=false;rc990HistoryApplying=false}
  if(current()===target)return true;
  rc990ViewHistory=snapshot.slice()
 }
 if(fallbackView){
  var fallback=canonical(fallbackView);
  if(fallback&&fallback!==now&&canRoute(fallback)){
   rc990HistoryApplying=true;historyApplying=true;
   try{route(fallback,'rc990-back')}finally{historyApplying=false;rc990HistoryApplying=false}
   if(current()===fallback){rc990RememberView(fallback,'fallback');return true}
  }
 }
 try{if(window.history&&typeof window.history.back==='function'){window.history.back();return true}}catch(_){}
 return false
}
window.rc990BackView=rc990BackView;
'''
    html = html.replace(history_anchor, rc990_history + history_anchor, 1)

replace_function('function recordHistory(view,source)', r'''function recordHistory(view,source){view=canonical(view);rememberView(view);rc990RememberView(view,source);if(!historyEnabled()||historyApplying||source==='history'||source==='popstate'||source==='boot'||source==='ready'||source==='rc990-back')return false;initHistory();var hs=window.history&&window.history.state;if(hs&&hs.exporthub===true&&canonical(hs.view)===view)return false;try{var now=Date.now(),rapid=lastHistoryWriteAt&&now-lastHistoryWriteAt<260;lastHistoryWriteAt=now;if(rapid)window.history.replaceState(historyPayload(view,false),'',window.location.href);else window.history.pushState(historyPayload(view,false),'',window.location.href);return true}catch(_){return false}}''')

route_seed = 'var previous=current();'
require_once(route_seed, 'route previous-view anchor')
replace_once(route_seed, "var previous=current();if(previous!==view)rc990RememberView(previous,source==='history'||source==='popstate'?'history':'seed');", 'route history seed')

# Existing explicit Back buttons keep their local cleanup/return targets, but delegate
# the actual navigation to the same RC990 application history.
replace_function('function back()', r'''function back(){var s=state(),target=low(s.shipmentViewReturnView)||'shipmentoverview';rc843ReleaseViewGuard('back');if(target==='shipmentview'||target==='documentviewer')target='shipmentsearch';if(typeof window.rc990BackView==='function'){window.rc990BackView(target);return false}if(window.ExportHUBRC325&&typeof window.ExportHUBRC325.route==='function')return window.ExportHUBRC325.route(target,'shipment-view-back');return false}''')

replace_function('function viewerBack()', r'''function viewerBack(){var v=viewerPersist(),s=state();viewerClearUrl();if(v){s.shipmentViewId=q(v.shipmentId||v.reference);try{sessionStorage.removeItem('exporthub_document_viewer_v1')}catch(_){}viewerMemory=null}if(typeof window.rc990BackView==='function'){window.rc990BackView('shipmentview');return false}if(window.ExportHUBRC325&&typeof window.ExportHUBRC325.route==='function')return window.ExportHUBRC325.route('shipmentview','document-viewer-back');s.view='shipmentview';return render()}''')

# Sanity: exactly one canonical RC990 core and no accidental mobile/desktop split.
for token, expected in [
    ('function rc990CaptureUiState(', 1),
    ('function rc990RestoreUiState(', 1),
    ('function rc990ScheduleRender(', 1),
    ('var rc990ViewHistory=', 1),
    ('function rc990RememberView(', 1),
    ('function rc990BackView(', 1),
]:
    count = html.count(token)
    if count != expected:
        raise SystemExit(f'{token}: expected {expected}, got {count}')
if 'rc990MobileViewHistory' in html or 'rc990DesktopViewHistory' in html:
    raise SystemExit('RC990 view history must be shared across responsive layouts')

PATH.write_text(html, encoding='utf-8')
print('RC990 render/focus/navigation core applied to TESTVERSION.html')
