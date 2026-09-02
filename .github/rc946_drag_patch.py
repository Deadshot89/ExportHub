from pathlib import Path

path = Path('TESTVERSION.html')
text = path.read_text(encoding='utf-8')

old_version = "version:'RC945',cache:'945',loginReturn:'/TESTVERSION.html?v=945'"
new_version = "version:'RC946',cache:'946',loginReturn:'/TESTVERSION.html?v=946'"
assert text.count(old_version) == 1, f'RC945 Buildmarker unerwartet: {text.count(old_version)}'
text = text.replace(old_version, new_version, 1)

task_native = ' draggable="true" data-i218-drag="'
assert text.count(task_native) == 1, f'Nativer Aufgaben-Drag unerwartet: {text.count(task_native)}'
text = text.replace(task_native, ' data-i218-drag="', 1)

task_start = "document.addEventListener('dragstart',function(e){var card=e.target&&e.target.closest&&e.target.closest('[data-i218-drag]')"
task_end = "function boot(){schedule()}"
start = text.index(task_start)
end = text.index(task_end, start)
old_task = text[start:end]
assert "document.addEventListener('drop'" in old_task
assert "moveTask(id,day.getAttribute('data-i218-drop-date'),day)" in old_task
new_task = """var rc946TaskPointer=null;
function rc946TaskPointerDayAt(e){var el=document.elementFromPoint(Number(e.clientX),Number(e.clientY));return el&&el.closest?el.closest('[data-i218-drop-date]'):null}
function rc946TaskPointerClear(){var p=rc946TaskPointer;if(p&&p.card){p.card.classList.remove('i218-dragging');p.card.style.cursor='';p.card.style.userSelect=''}document.querySelectorAll('#index218Planner .drag-over').forEach(function(x){x.classList.remove('drag-over')});rc946TaskPointer=null}
document.addEventListener('pointerdown',function(e){if(e.button!=null&&e.button!==0)return;var card=e.target&&e.target.closest&&e.target.closest('[data-i218-drag]');if(!card)return;if(e.target&&e.target.closest&&e.target.closest('button,input,select,textarea,a,label'))return;var id=card.getAttribute('data-i218-drag');if(!id)return;rc946TaskPointer={pointerId:e.pointerId,id:id,card:card,x:Number(e.clientX),y:Number(e.clientY),active:false}},true);
document.addEventListener('pointermove',function(e){var p=rc946TaskPointer;if(!p||e.pointerId!==p.pointerId)return;var dx=Number(e.clientX)-p.x,dy=Number(e.clientY)-p.y;if(!p.active){if(dx*dx+dy*dy<9)return;p.active=true;p.card.classList.add('i218-dragging');p.card.style.cursor='grabbing';p.card.style.userSelect='none';try{p.card.setPointerCapture(e.pointerId)}catch(_){}}e.preventDefault();var day=rc946TaskPointerDayAt(e);document.querySelectorAll('#index218Planner .drag-over').forEach(function(x){if(x!==day)x.classList.remove('drag-over')});if(day)day.classList.add('drag-over')},{capture:true,passive:false});
document.addEventListener('pointerup',function(e){var p=rc946TaskPointer;if(!p||e.pointerId!==p.pointerId)return;var active=p.active,id=p.id,day=active?rc946TaskPointerDayAt(e):null;if(active)e.preventDefault();rc946TaskPointerClear();if(active&&id&&day)moveTask(id,day.getAttribute('data-i218-drop-date'),day)},true);
document.addEventListener('pointercancel',function(e){var p=rc946TaskPointer;if(p&&e.pointerId===p.pointerId)rc946TaskPointerClear()},true);
"""
text = text[:start] + new_task + text[end:]

warehouse_native = ' draggable="true" data-warehouse-drag-key="'
assert text.count(warehouse_native) == 1, f'Nativer Lager-Drag unerwartet: {text.count(warehouse_native)}'
text = text.replace(warehouse_native, ' data-warehouse-drag-key="', 1)

old_decl = "pendingMove='',dragKey='',dragScrollSpeed=0,dragScrollFrame=0;"
new_decl = "pendingMove='',dragKey='',dragPointer=null,dragScrollSpeed=0,dragScrollFrame=0;"
assert text.count(old_decl) == 1, f'Lager-Dragstatus nicht eindeutig: {text.count(old_decl)}'
text = text.replace(old_decl, new_decl, 1)

wh_start = text.index('function bindWarehouseDnD(root){')
wh_end = text.index('function stopWarehouseDragScroll(){', wh_start)
old_wh = text[wh_start:wh_end]
assert "root.addEventListener('dragstart'" in old_wh
assert "moveShipmentKey(key,Number(zone.getAttribute('data-warehouse-drop-code')||0))" in old_wh
new_wh = """function rc946WarehousePointerZone(e,root){var el=document.elementFromPoint(Number(e.clientX),Number(e.clientY)),zone=el&&el.closest?el.closest('[data-warehouse-drop-code]'):null;return zone&&root.contains(zone)?zone:null}
function rc946WarehouseClearPointer(root){var p=dragPointer;if(p&&p.card){p.card.classList.remove('rc513-dragging');p.card.style.cursor='';p.card.style.userSelect=''}if(root&&root.querySelectorAll)root.querySelectorAll('.rc513-drop-target').forEach(function(x){x.classList.remove('rc513-drop-target')});dragPointer=null;dragKey='';stopWarehouseDragScroll()}
function bindWarehouseDnD(root){if(!root||root.__rc513WarehouseDnD)return;root.__rc513WarehouseDnD=true;root.addEventListener('pointerdown',function(e){if(e.button!=null&&e.button!==0)return;var card=e.target&&e.target.closest&&e.target.closest('[data-warehouse-drag-key]');if(!card||!isAdmin())return;if(e.target&&e.target.closest&&e.target.closest('button,input,select,textarea,a,label'))return;var key=q(card.getAttribute('data-warehouse-drag-key'));if(!key)return;dragPointer={pointerId:e.pointerId,key:key,card:card,x:Number(e.clientX),y:Number(e.clientY),active:false}});root.addEventListener('pointermove',function(e){var p=dragPointer;if(!p||e.pointerId!==p.pointerId)return;var dx=Number(e.clientX)-p.x,dy=Number(e.clientY)-p.y;if(!p.active){if(dx*dx+dy*dy<9)return;p.active=true;dragKey=p.key;p.card.classList.add('rc513-dragging');p.card.style.cursor='grabbing';p.card.style.userSelect='none';try{p.card.setPointerCapture(e.pointerId)}catch(_){}}e.preventDefault();updateWarehouseDragScroll(e);var zone=rc946WarehousePointerZone(e,root);root.querySelectorAll('.rc513-drop-target').forEach(function(x){if(x!==zone)x.classList.remove('rc513-drop-target')});if(zone)zone.classList.add('rc513-drop-target')},{passive:false});root.addEventListener('pointerup',function(e){var p=dragPointer;if(!p||e.pointerId!==p.pointerId)return;var active=p.active,key=p.key,zone=active?rc946WarehousePointerZone(e,root):null;if(active)e.preventDefault();rc946WarehouseClearPointer(root);if(active&&key&&zone)moveShipmentKey(key,Number(zone.getAttribute('data-warehouse-drop-code')||0))});root.addEventListener('pointercancel',function(e){var p=dragPointer;if(p&&e.pointerId===p.pointerId)rc946WarehouseClearPointer(root)})}
"""
text = text[:wh_start] + new_wh + text[wh_end:]

assert task_native not in text
assert warehouse_native not in text
assert 'function rc946TaskPointerDayAt(' in text
assert 'function rc946WarehousePointerZone(' in text
assert task_start not in text
assert "root.addEventListener('dragstart',function(e){var card=e.target&&e.target.closest&&e.target.closest('[data-warehouse-drag-key]')" not in text

path.write_text(text, encoding='utf-8')
print('RC946 patch applied cleanly')
