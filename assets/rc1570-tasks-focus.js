/* ExportHUB360 RC1570 – task focus view: overdue and today first, rest of the week compact by area,
   a real "new task" form and a working task detail view ("Aufgabenansicht").
   Data stays in state.tasks; completing uses the app's toggleTaskCard, saving uses the RC524 editor path. */
(function(w){
'use strict';
if(!w||w.__EXPORTHUB_RC1570_TASKS__)return;
w.__EXPORTHUB_RC1570_TASKS__=true;

var VERSION='RC1570';
var SECTION_ID='rc1570Tasks';
var BODY_FLAG='data-rc1570-tasks';
var SCOPE_KEY='exporthub.rc1570.scope';
var MAX_OVERDUE=12;
var WEEKDAYS=['sonntag','montag','dienstag','mittwoch','donnerstag','freitag','samstag'];

var I18N={
 de:{noMatch:'Keine Treffer für diese Suche.',title:'Aufgaben',newTask:'+ Neue Aufgabe',planner:'Aufgaben-Planer',search:'Aufgaben durchsuchen …',scopeMine:'Meine Aufgaben',scopeAll:'Alle Aufgaben',overdue:'Überfällig',today:'Heute',week:'Rest der Woche',later:'Später',noDate:'Ohne Datum',doneToday:'Heute erledigt',showAll:'Alle {count} anzeigen',showLess:'Weniger anzeigen',empty:'Keine offenen Aufgaben – alles erledigt.',emptyToday:'Für heute ist nichts mehr offen.',done:'Erledigt',reopen:'Wieder öffnen',open:'Öffnen',edit:'Bearbeiten',due:'fällig {date}',weekly:'wöchentlich',tasks:'{count} Aufgaben',task:'1 Aufgabe',other:'Sonstiges',
  formTitle:'Neue Aufgabe',fTitle:'Was ist zu tun?',fArea:'Bereich',fOwner:'Zuständig',fWhen:'Wann',fOnce:'Einmalig am',fWeekly:'Jede Woche am',fTime:'Uhrzeit (optional)',fPriority:'Priorität',fRef:'Sendung / Referenz (optional)',fNote:'Notiz (optional)',save:'Aufgabe anlegen',cancel:'Abbrechen',required:'Bitte angeben, was zu tun ist.',noRights:'Keine Bearbeitungsrechte für Aufgaben.',saved:'Aufgabe angelegt.',pNormal:'Normal',pickTask:'Wähle eine Aufgabe, um sie in der Aufgabenansicht zu öffnen.'},
 en:{noMatch:'No tasks match this search.',title:'Tasks',newTask:'+ New task',planner:'Task planner',search:'Search tasks …',scopeMine:'My tasks',scopeAll:'All tasks',overdue:'Overdue',today:'Today',week:'Rest of the week',later:'Later',noDate:'No date',doneToday:'Done today',showAll:'Show all {count}',showLess:'Show less',empty:'No open tasks – all done.',emptyToday:'Nothing left open for today.',done:'Done',reopen:'Reopen',open:'Open',edit:'Edit',due:'due {date}',weekly:'weekly',tasks:'{count} tasks',task:'1 task',other:'Other',
  formTitle:'New task',fTitle:'What needs to be done?',fArea:'Area',fOwner:'Assigned to',fWhen:'When',fOnce:'Once on',fWeekly:'Every week on',fTime:'Time (optional)',fPriority:'Priority',fRef:'Shipment / reference (optional)',fNote:'Note (optional)',save:'Create task',cancel:'Cancel',required:'Please enter what needs to be done.',noRights:'No permission to edit tasks.',saved:'Task created.',pNormal:'Normal',pickTask:'Choose a task to open it in the task view.'},
 pl:{noMatch:'Brak wyników dla tego wyszukiwania.',title:'Zadania',newTask:'+ Nowe zadanie',planner:'Planer zadań',search:'Szukaj zadań …',scopeMine:'Moje zadania',scopeAll:'Wszystkie zadania',overdue:'Po terminie',today:'Dziś',week:'Reszta tygodnia',later:'Później',noDate:'Bez daty',doneToday:'Wykonane dziś',showAll:'Pokaż wszystkie ({count})',showLess:'Pokaż mniej',empty:'Brak otwartych zadań – wszystko wykonane.',emptyToday:'Na dziś nic nie zostało.',done:'Wykonane',reopen:'Otwórz ponownie',open:'Otwórz',edit:'Edytuj',due:'termin {date}',weekly:'co tydzień',tasks:'Zadania: {count}',task:'1 zadanie',other:'Inne',
  formTitle:'Nowe zadanie',fTitle:'Co trzeba zrobić?',fArea:'Obszar',fOwner:'Odpowiedzialny',fWhen:'Kiedy',fOnce:'Jednorazowo dnia',fWeekly:'Co tydzień w',fTime:'Godzina (opcjonalnie)',fPriority:'Priorytet',fRef:'Wysyłka / referencja (opcjonalnie)',fNote:'Notatka (opcjonalnie)',save:'Utwórz zadanie',cancel:'Anuluj',required:'Podaj, co trzeba zrobić.',noRights:'Brak uprawnień do edycji zadań.',saved:'Zadanie utworzone.',pNormal:'Normalny',pickTask:'Wybierz zadanie, aby otworzyć je w widoku zadania.'},
 es:{noMatch:'Ninguna tarea coincide con la búsqueda.',title:'Tareas',newTask:'+ Nueva tarea',planner:'Planificador de tareas',search:'Buscar tareas …',scopeMine:'Mis tareas',scopeAll:'Todas las tareas',overdue:'Vencidas',today:'Hoy',week:'Resto de la semana',later:'Más adelante',noDate:'Sin fecha',doneToday:'Hechas hoy',showAll:'Mostrar las {count}',showLess:'Mostrar menos',empty:'No hay tareas abiertas: todo hecho.',emptyToday:'No queda nada abierto para hoy.',done:'Hecho',reopen:'Reabrir',open:'Abrir',edit:'Editar',due:'vence {date}',weekly:'semanal',tasks:'{count} tareas',task:'1 tarea',other:'Otros',
  formTitle:'Nueva tarea',fTitle:'¿Qué hay que hacer?',fArea:'Área',fOwner:'Responsable',fWhen:'Cuándo',fOnce:'Una vez el',fWeekly:'Cada semana el',fTime:'Hora (opcional)',fPriority:'Prioridad',fRef:'Envío / referencia (opcional)',fNote:'Nota (opcional)',save:'Crear tarea',cancel:'Cancelar',required:'Indica qué hay que hacer.',noRights:'Sin permiso para editar tareas.',saved:'Tarea creada.',pNormal:'Normal',pickTask:'Elige una tarea para abrirla en la vista de tarea.'},
 fr:{noMatch:'Aucune tâche ne correspond à la recherche.',title:'Tâches',newTask:'+ Nouvelle tâche',planner:'Planificateur de tâches',search:'Rechercher des tâches …',scopeMine:'Mes tâches',scopeAll:'Toutes les tâches',overdue:'En retard',today:'Aujourd’hui',week:'Reste de la semaine',later:'Plus tard',noDate:'Sans date',doneToday:'Terminées aujourd’hui',showAll:'Afficher les {count}',showLess:'Afficher moins',empty:'Aucune tâche ouverte – tout est fait.',emptyToday:'Plus rien d’ouvert pour aujourd’hui.',done:'Terminé',reopen:'Rouvrir',open:'Ouvrir',edit:'Modifier',due:'échéance {date}',weekly:'hebdomadaire',tasks:'{count} tâches',task:'1 tâche',other:'Autres',
  formTitle:'Nouvelle tâche',fTitle:'Que faut-il faire ?',fArea:'Domaine',fOwner:'Responsable',fWhen:'Quand',fOnce:'Une fois le',fWeekly:'Chaque semaine le',fTime:'Heure (facultatif)',fPriority:'Priorité',fRef:'Expédition / référence (facultatif)',fNote:'Note (facultatif)',save:'Créer la tâche',cancel:'Annuler',required:'Indiquez ce qu’il faut faire.',noRights:'Pas de droit de modifier les tâches.',saved:'Tâche créée.',pNormal:'Normale',pickTask:'Choisissez une tâche pour l’ouvrir dans la vue tâche.'},
 it:{noMatch:'Nessuna attività corrisponde alla ricerca.',title:'Attività',newTask:'+ Nuova attività',planner:'Pianificatore attività',search:'Cerca attività …',scopeMine:'Le mie attività',scopeAll:'Tutte le attività',overdue:'Scadute',today:'Oggi',week:'Resto della settimana',later:'Più avanti',noDate:'Senza data',doneToday:'Completate oggi',showAll:'Mostra tutte ({count})',showLess:'Mostra meno',empty:'Nessuna attività aperta – tutto fatto.',emptyToday:'Per oggi non resta nulla.',done:'Fatto',reopen:'Riapri',open:'Apri',edit:'Modifica',due:'scade {date}',weekly:'settimanale',tasks:'{count} attività',task:'1 attività',other:'Altro',
  formTitle:'Nuova attività',fTitle:'Cosa bisogna fare?',fArea:'Area',fOwner:'Responsabile',fWhen:'Quando',fOnce:'Una volta il',fWeekly:'Ogni settimana il',fTime:'Ora (facoltativa)',fPriority:'Priorità',fRef:'Spedizione / riferimento (facoltativo)',fNote:'Nota (facoltativa)',save:'Crea attività',cancel:'Annulla',required:'Indica cosa bisogna fare.',noRights:'Nessun permesso per modificare le attività.',saved:'Attività creata.',pNormal:'Normale',pickTask:'Scegli un’attività per aprirla nella vista attività.'}
};
var DAY_NAMES={
 de:['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'],en:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
 pl:['Niedziela','Poniedziałek','Wtorek','Środa','Czwartek','Piątek','Sobota'],es:['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'],
 fr:['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'],it:['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato']
};

function q(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function low(v){return q(v).toLowerCase()}
function arr(v){return Array.isArray(v)?v:[]}
function esc(v){return q(v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function lang(){try{if(w.ExportHUBI18n&&typeof w.ExportHUBI18n.language==='function'){var l=low(w.ExportHUBI18n.language());if(I18N[l])return l}}catch(_){}return'de'}
function t(key,vars){var pack=I18N[lang()]||I18N.de,text=pack[key]||I18N.de[key]||key;if(vars)Object.keys(vars).forEach(function(k){text=text.split('{'+k+'}').join(String(vars[k]))});return text}
function state(){try{if(typeof w.__EXPORTHUB_GET_STATE__==='function'){var s=w.__EXPORTHUB_GET_STATE__();if(s&&typeof s==='object')return s}}catch(_){}return{}}
function currentUser(){
  try{if(typeof w.__EXPORTHUB_GET_CURRENT_USER__==='function'){var u=w.__EXPORTHUB_GET_CURRENT_USER__();if(u)return u}}catch(_){}
  var s=state();return s.currentUser||s.activeUser||s.user||{}
}
function view(){var d=w.document;return d&&d.body?low(d.body.getAttribute('data-exporthub-view')||d.body.getAttribute('data-current-view')):''}
function canWrite(){try{return typeof w.canWrite!=='function'||w.canWrite('tasks')!==false}catch(_){return true}}

/* dates */
function dayKey(d){return d?d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'):''}
function atNoon(d){var x=new Date(d);x.setHours(12,0,0,0);return x}
function mondayOf(d){var x=atNoon(d),n=x.getDay()||7;x.setDate(x.getDate()-n+1);return x}
function isoWeekMonday(key){
  var m=q(key).match(/^(\d{4})-W(\d{1,2})$/);if(!m)return null;
  var jan4=new Date(Number(m[1]),0,4,12);var mon=mondayOf(jan4);mon.setDate(mon.getDate()+(Number(m[2])-1)*7);return mon
}
function parseDate(v){
  var s=q(v);if(!s)return null;
  var m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(m)return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),12);
  m=s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);if(m)return new Date(Number(m[3]),Number(m[2])-1,Number(m[1]),12);
  if(/^\d{4}-\d{2}-\d{2}T/.test(s)){var d=new Date(s);if(!isNaN(d.getTime()))return atNoon(d)}
  return null
}
function taskDate(task){
  var keys=['dueAt','dueDate','plannedDate','plannedAt','date','targetDate','deadline'];
  for(var i=0;i<keys.length;i++){var d=parseDate(task&&task[keys[i]]);if(d)return d}
  // weekly plan tasks only carry a weekday; place them in the week they were created for
  var idx=WEEKDAYS.indexOf(low(task&&(task.day||task.originalDay||task.weekday)));
  if(idx<0)return null;
  var base=isoWeekMonday(task.weekKey||task.createdForWeek)||parseDate(task.sourceWeekStart);
  if(!base){
    // a weekly task without a plan week (created in this view) is due on its next weekday, never in the past
    var next=atNoon(new Date());next.setDate(next.getDate()+(idx-next.getDay()+7)%7);return next
  }
  var x=new Date(base);x.setDate(x.getDate()+((idx||7)-1));return x
}
function fmtDate(d){try{return d.toLocaleDateString(lang(),{weekday:'short',day:'2-digit',month:'2-digit'})}catch(_){return dayKey(d)}}
function dayName(d){return(DAY_NAMES[lang()]||DAY_NAMES.de)[d.getDay()]}

/* task fields */
function taskId(task){return q(task&&(task.id||task.taskId||task.uuid))}
function title(task){return q(task&&(task.title||task.name||task.subject))}
function isDone(task){return !!(task&&(task.done===true||task.completed===true))||/^(erledigt|done|abgeschlossen|completed|archiviert|storniert|cancelled|canceled)$/i.test(q(task&&task.status))}
function isTemplate(task){return !!(task&&(task.isTemplate||task.template||task.recurringTemplate||task.repeatTemplate||task.isRecurringTemplate))}
function area(task){return q(task&&(task.area||task.category||task.group))||t('other')}
function ownerName(task,users){
  var name=q(task&&task.assignedToName);if(name)return name;
  var raw=q(task&&(task.effectiveAssignee||task.owner||task.assignee||task.responsible));
  var hit=users.find(function(u){return low(u.id)===low(raw)||low(u.user||u.username||u.login)===low(raw)});
  return hit?q(hit.name||hit.displayName||hit.user):raw
}
function isMine(task){
  var u=currentUser(),ids=[u.id,u.userId].map(low).filter(Boolean),names=[u.name,u.displayName,u.user,u.login,u.username].map(low).filter(Boolean);
  var eff=low(task&&task.effectiveAssignee);
  var keys=eff?[eff]:[task&&task.owner,task&&task.assignee,task&&task.assigneeId,task&&task.assignedTo,task&&task.userId,task&&task.responsible,task&&task.assignedToName].map(low).filter(Boolean);
  if(!keys.length)return true;
  return keys.some(function(k){return k==='alle'||k==='all'||ids.indexOf(k)>=0||names.some(function(n){return k===n||(k.length>2&&n.length>2&&(n.indexOf(k)>=0||k.indexOf(n)>=0))})})
}
function priority(task){var p=q(task&&task.priority).toUpperCase();return /^P\d$/.test(p)?p:''}
function urgent(p){return /^P[0-2]$/.test(p)}
function priorityRank(task){var p=priority(task);return p?Number(p.slice(1)):5}
function isWeekly(task){return !!(task&&(task.masterTaskRC848||task.weeklySeriesId||task.seriesId||task.recurringSeriesId||/week|woch/i.test(q(task.recurrence))))}
function ref(task){return q(task&&(task.linkedShipmentRef||task.shipmentRef||task.sourceRef||task.reference))}

/* model */
var ui={search:'',scope:'',expanded:{}};
function readScope(){if(ui.scope)return ui.scope;try{ui.scope=w.localStorage&&w.localStorage.getItem(SCOPE_KEY)||''}catch(_){}return ui.scope||'mine'}
function users(){var s=state();return arr(s.users).concat(arr(s.userAccounts))}
function buildModel(now){
  now=now||new Date();
  var today=dayKey(now),weekEnd=new Date(mondayOf(now));weekEnd.setDate(weekEnd.getDate()+6);var weekEndKey=dayKey(weekEnd);
  var scope=readScope(),needle=low(ui.search),us=users();
  var all=arr(state().tasks).filter(function(x){return x&&!isTemplate(x)&&title(x)});
  var scoped=all.filter(function(x){return scope==='all'||isMine(x)});
  if(needle)scoped=scoped.filter(function(x){return low([title(x),area(x),q(x.group),ownerName(x,us),ref(x),q(x.note)].join(' ')).indexOf(needle)>=0});
  var model={overdue:[],today:[],week:{},later:[],none:[],doneToday:[],total:0,scope:scope,users:us};
  scoped.forEach(function(x){
    var d=taskDate(x),k=d?dayKey(d):'';
    var row={task:x,id:taskId(x),date:d,key:k};
    if(isDone(x)){var at=parseDate(x.completedAt||x.doneAt);if(at&&dayKey(at)===today)model.doneToday.push(row);return}
    model.total++;
    if(!k)model.none.push(row);
    else if(k<today)model.overdue.push(row);
    else if(k===today)model.today.push(row);
    else if(k<=weekEndKey)(model.week[k]=model.week[k]||[]).push(row);
    else model.later.push(row)
  });
  var byUrgency=function(a,b){if(a.key!==b.key)return a.key<b.key?-1:1;var p=priorityRank(a.task)-priorityRank(b.task);if(p)return p;return q(a.task.time).localeCompare(q(b.task.time))};
  model.overdue.sort(byUrgency);model.today.sort(byUrgency);model.later.sort(byUrgency);
  return model
}
function byArea(rows){
  var groups={},order=[];
  rows.forEach(function(r){var a=area(r.task);if(!groups[a]){groups[a]=[];order.push(a)}groups[a].push(r)});
  order.sort(function(a,b){return a.localeCompare(b)});
  return order.map(function(a){return{area:a,rows:groups[a].sort(function(x,y){return priorityRank(x.task)-priorityRank(y.task)||q(x.task.time).localeCompare(q(y.task.time))})}})
}

/* render */
function card(r,opts){
  var x=r.task,p=priority(x),done=isDone(x),owner=ownerName(x,opts.users),rf=ref(x),meta=[];
  if(opts.showDate&&r.date)meta.push(t('due',{date:fmtDate(r.date)}));
  if(q(x.time))meta.push(esc(q(x.time)));
  if(opts.showOwner&&owner)meta.push(esc(owner));
  if(opts.showArea)meta.push(esc(area(x)));
  if(isWeekly(x))meta.push('↻ '+esc(t('weekly')));
  return'<li class="rc1570-card'+(done?' is-done':'')+(opts.late?' is-late':'')+'" data-rc1570-task="'+esc(r.id)+'">'+
    '<button type="button" class="rc1570-check" data-rc1570-toggle="'+esc(r.id)+'" aria-label="'+esc(done?t('reopen'):t('done'))+'" title="'+esc(done?t('reopen'):t('done'))+'"><span aria-hidden="true">'+(done?'✓':'')+'</span></button>'+
    '<div class="rc1570-card-main"><button type="button" class="rc1570-card-title" data-rc1570-open="'+esc(r.id)+'">'+esc(title(x))+'</button>'+
    '<div class="rc1570-card-meta">'+(urgent(p)?'<span class="rc1570-prio" data-p="'+esc(p)+'">'+esc(p)+'</span>':'')+meta.map(function(m){return'<span>'+m+'</span>'}).join('')+
    (rf?'<button type="button" class="rc1570-ref" data-rc1570-ref="'+esc(rf)+'">'+esc(rf)+'</button>':'')+'</div></div>'+
    '<button type="button" class="rc1570-edit" data-rc1570-edit="'+esc(r.id)+'" aria-label="'+esc(t('edit'))+'" title="'+esc(t('edit'))+'">✎</button></li>'
}
function cards(rows,opts){return'<ul class="rc1570-cards">'+rows.map(function(r){return card(r,opts)}).join('')+'</ul>'}
function areaBlocks(rows,opts){
  return byArea(rows).map(function(g){return'<div class="rc1570-area"><h4>'+esc(g.area)+' <span>'+g.rows.length+'</span></h4>'+cards(g.rows,opts)+'</div>'}).join('')
}
function countLabel(n){return n===1?t('task'):t('tasks',{count:n})}
function section(id,label,count,body,tone,extra){
  return'<section class="rc1570-section" data-rc1570-section="'+id+'"'+(tone?' data-tone="'+tone+'"':'')+'><header><h3>'+esc(label)+'</h3><span class="rc1570-count">'+esc(countLabel(count))+'</span>'+(extra||'')+'</header>'+body+'</section>'
}
function renderHtml(model,now){
  now=now||new Date();
  var showOwner=model.scope==='all',opts={users:model.users,showOwner:showOwner};
  var html='<div class="rc1570-head"><div><h2>✅ '+esc(t('title'))+'</h2></div><div class="rc1570-actions">'+
    '<button type="button" class="btn" data-rc1570-new="1">'+esc(t('newTask'))+'</button>'+
    '<button type="button" class="ghost" data-rc1570-route="planning">'+esc(t('planner'))+'</button></div></div>'+
    '<div class="rc1570-toolbar"><input type="search" class="rc1570-search" data-rc1570-search="1" placeholder="'+esc(t('search'))+'" value="'+esc(ui.search)+'">'+
    '<div class="rc1570-scope" role="group">'+['mine','all'].map(function(s){return'<button type="button" data-rc1570-scope="'+s+'" aria-pressed="'+(model.scope===s)+'">'+esc(t(s==='mine'?'scopeMine':'scopeAll'))+'</button>'}).join('')+'</div>'+
    '<div class="rc1570-chips">'+
      '<a href="#rc1570-overdue" class="rc1570-chip" data-tone="crit">'+esc(t('overdue'))+' <b>'+model.overdue.length+'</b></a>'+
      '<a href="#rc1570-today" class="rc1570-chip">'+esc(t('today'))+' <b>'+model.today.length+'</b></a>'+
      '<a href="#rc1570-week" class="rc1570-chip">'+esc(t('week'))+' <b>'+Object.keys(model.week).reduce(function(n,k){return n+model.week[k].length},0)+'</b></a>'+
      '<span class="rc1570-chip" data-tone="ok">'+esc(t('doneToday'))+' <b>'+model.doneToday.length+'</b></span></div></div>';
  if(!model.total&&!model.doneToday.length)return html+'<p class="rc1570-empty">'+esc(ui.search?t('noMatch'):t('empty'))+'</p>';
  if(model.overdue.length){
    var expanded=!!ui.expanded.overdue,rows=expanded?model.overdue:model.overdue.slice(0,MAX_OVERDUE);
    var more=model.overdue.length>MAX_OVERDUE?'<button type="button" class="rc1570-more" data-rc1570-expand="overdue">'+esc(expanded?t('showLess'):t('showAll',{count:model.overdue.length}))+'</button>':'';
    html+='<a id="rc1570-overdue"></a>'+section('overdue',t('overdue'),model.overdue.length,cards(rows,{users:model.users,showOwner:showOwner,showDate:true,showArea:true,late:true})+more,'crit')
  }
  html+='<a id="rc1570-today"></a>'+section('today',t('today')+' · '+dayName(now)+' '+fmtDate(now).replace(/^[^,\s]+,?\s*/,''),model.today.length,
    model.today.length?areaBlocks(model.today,opts):'<p class="rc1570-empty">'+esc(t('emptyToday'))+'</p>');
  var days=Object.keys(model.week).sort();
  if(days.length){
    html+='<a id="rc1570-week"></a><section class="rc1570-section" data-rc1570-section="week"><header><h3>'+esc(t('week'))+'</h3></header>'+days.map(function(k){
      var rows=model.week[k],d=rows[0].date,open=!!ui.expanded['day:'+k];
      return'<details class="rc1570-day"'+(open?' open':'')+' data-rc1570-day="'+esc(k)+'"><summary><strong>'+esc(dayName(d))+'</strong> <span>'+esc(fmtDate(d))+'</span><span class="rc1570-count">'+esc(countLabel(rows.length))+'</span></summary>'+(open?areaBlocks(rows,opts):'')+'</details>'
    }).join('')+'</section>'
  }
  if(model.later.length)html+=section('later',t('later'),model.later.length,cards(model.later,{users:model.users,showOwner:showOwner,showDate:true,showArea:true}));
  if(model.none.length)html+=section('none',t('noDate'),model.none.length,areaBlocks(model.none,opts));
  if(model.doneToday.length)html+='<details class="rc1570-section rc1570-done"><summary><h3>'+esc(t('doneToday'))+'</h3><span class="rc1570-count">'+esc(countLabel(model.doneToday.length))+'</span></summary>'+cards(model.doneToday,{users:model.users,showOwner:showOwner})+'</details>';
  return html
}

/* actions */
function findTask(id){return arr(state().tasks).find(function(x){return taskId(x)===q(id)})||null}
function toggle(id){
  if(!canWrite()){alert(t('noRights'));return}
  try{if(typeof w.toggleTaskCard==='function')w.toggleTaskCard({preventDefault:function(){},stopPropagation:function(){}},id)}catch(err){try{console.warn('RC1570 toggle',err)}catch(_){}}
  lastHtml='';schedule()
}
function openDetail(id){
  var task=findTask(id),rt=w.ExportHUBRC1014TaskRuntime;if(!task)return;
  try{if(rt&&typeof rt.openTask==='function'){rt.openTask(task,{state:state()});return}}catch(err){try{console.warn('RC1570 open',err)}catch(_){}}
  edit(id)
}
function edit(id){try{if(typeof w.rc524OpenTaskEditor==='function')w.rc524OpenTaskEditor(id)}catch(_){}}
function openShipment(r){try{if(w.ExportHUBShipmentView&&typeof w.ExportHUBShipmentView.open==='function'){w.ExportHUBShipmentView.open(r,'tasks');return}}catch(_){}try{if(typeof w.setView==='function')w.setView('shipmentoverview')}catch(_){}}
function route(v){try{if(typeof w.setView==='function')w.setView(v)}catch(_){}}

/* new task form – saves through the RC524 editor (rights check, save, audit, render) */
function knownAreas(){var seen={};arr(state().tasks).forEach(function(x){var a=q(x&&(x.area||x.category));if(a)seen[a]=1});return Object.keys(seen).sort()}
function knownOwners(){
  var seen={},us=users();us.forEach(function(u){var n=q(u&&(u.name||u.displayName||u.user));if(n)seen[n]=1});
  arr(state().tasks).forEach(function(x){var n=ownerName(x,us);if(n&&!/^[A-Z0-9-]{6,}$/.test(n))seen[n]=1});
  var me=q(currentUser().name||currentUser().displayName||currentUser().user);if(me)seen[me]=1;
  return Object.keys(seen).sort()
}
function openForm(){
  var d=w.document;if(!d)return;
  if(!canWrite()){alert(t('noRights'));return}
  var old=d.getElementById('rc1570Form');if(old)old.remove();
  var me=q(currentUser().name||currentUser().displayName||currentUser().user),today=dayKey(new Date()),wd=new Date().getDay();
  var dlg=d.createElement('div');dlg.id='rc1570Form';dlg.className='rc1570-modal';
  dlg.innerHTML='<form class="rc1570-dialog" novalidate role="dialog" aria-modal="true" aria-labelledby="rc1570FormTitle"><h2 id="rc1570FormTitle">'+esc(t('formTitle'))+'</h2>'+
    '<label class="rc1570-field rc1570-wide"><span>'+esc(t('fTitle'))+'</span><input name="title" required maxlength="160" autocomplete="off"></label>'+
    '<label class="rc1570-field"><span>'+esc(t('fArea'))+'</span><input name="area" list="rc1570Areas" maxlength="60"><datalist id="rc1570Areas">'+knownAreas().map(function(a){return'<option value="'+esc(a)+'">'}).join('')+'</datalist></label>'+
    '<label class="rc1570-field"><span>'+esc(t('fOwner'))+'</span><input name="owner" list="rc1570Owners" maxlength="80" value="'+esc(me)+'"><datalist id="rc1570Owners">'+knownOwners().map(function(o){return'<option value="'+esc(o)+'">'}).join('')+'</datalist></label>'+
    '<fieldset class="rc1570-field rc1570-wide"><legend>'+esc(t('fWhen'))+'</legend><div class="rc1570-when">'+
      '<label><input type="radio" name="repeat" value="once" checked> '+esc(t('fOnce'))+'</label><input type="date" name="date" value="'+today+'">'+
      '<label><input type="radio" name="repeat" value="weekly"> '+esc(t('fWeekly'))+'</label><select name="weekday">'+[1,2,3,4,5,6,0].map(function(i){return'<option value="'+i+'"'+(i===wd?' selected':'')+'>'+esc((DAY_NAMES[lang()]||DAY_NAMES.de)[i])+'</option>'}).join('')+'</select></div></fieldset>'+
    '<label class="rc1570-field"><span>'+esc(t('fTime'))+'</span><input type="time" name="time"></label>'+
    '<label class="rc1570-field"><span>'+esc(t('fPriority'))+'</span><select name="priority"><option value="P1">P1</option><option value="P2">P2</option><option value="Normal" selected>'+esc(t('pNormal'))+'</option><option value="P4">P4</option></select></label>'+
    '<label class="rc1570-field rc1570-wide"><span>'+esc(t('fRef'))+'</span><input name="ref" maxlength="40" autocomplete="off"></label>'+
    '<label class="rc1570-field rc1570-wide"><span>'+esc(t('fNote'))+'</span><textarea name="note" rows="3" maxlength="1000"></textarea></label>'+
    '<p class="rc1570-error" role="alert" hidden></p>'+
    '<div class="rc1570-form-actions"><button type="submit" class="btn">'+esc(t('save'))+'</button><button type="button" class="ghost" data-rc1570-cancel="1">'+esc(t('cancel'))+'</button></div></form>';
  d.body.appendChild(dlg);
  var form=dlg.querySelector('form'),first=form.querySelector('[name="title"]');if(first)first.focus();
  var close=function(){dlg.remove()};
  dlg.addEventListener('click',function(e){if(e.target===dlg||(e.target.closest&&e.target.closest('[data-rc1570-cancel]')))close()});
  dlg.addEventListener('keydown',function(e){if(e.key==='Escape')close()});
  form.addEventListener('submit',function(e){
    e.preventDefault();
    var f=form.elements,err=form.querySelector('.rc1570-error'),name=q(f.title.value);
    if(!name){err.textContent=t('required');err.hidden=false;f.title.focus();return}
    var weekly=form.querySelector('[name="repeat"]:checked').value==='weekly';
    var day=weekly?['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'][Number(f.weekday.value)]:q(f.date.value);
    var created=saveTask({title:name,area:q(f.area.value)||'Manuell',owner:q(f.owner.value)||me,day:day,time:q(f.time.value),priority:q(f.priority.value),ref:q(f.ref.value),note:q(f.note.value)});
    if(created){close();lastHtml='';schedule()}
  })
}
function saveTask(v){
  var d=w.document;if(!d||typeof w.rc524OpenTaskEditor!=='function'||typeof w.rc524SaveTask!=='function')return false;
  var before={};arr(state().tasks).forEach(function(x){before[taskId(x)]=1});
  w.rc524OpenTaskEditor('');
  var set=function(id,val){var el=d.getElementById(id);if(el)el.value=val};
  set('rc524TaskTitle',v.title);set('rc524TaskOwner',v.owner);set('rc524TaskArea',v.area);set('rc524TaskDay',v.day);set('rc524TaskTime',v.time);set('rc524TaskPriority',v.priority);set('rc524TaskNote',v.note);
  var done=d.getElementById('rc524TaskDone');if(done)done.checked=false;
  w.rc524SaveTask();
  var modal=d.getElementById('rc524TaskModal');if(modal){modal.remove();return false}
  var created=arr(state().tasks).find(function(x){return !before[taskId(x)]});
  if(created){
    // mark as manual so roster cleanup never treats it as a shipment task; keep reference and author
    var patch={sourceType:'manual',createdAt:new Date().toISOString(),createdBy:q(currentUser().name||currentUser().user)};
    if(v.ref)patch.linkedShipmentRef=v.ref;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(v.day))patch.recurrence='weekly';else patch.dueDate=v.day;
    var rt=w.ExportHUBRC1014TaskRuntime;
    try{if(rt&&typeof rt.applyTaskPatch==='function')rt.applyTaskPatch(taskId(created),patch,{state:state()});else Object.assign(created,patch)}catch(_){Object.assign(created,patch)}
  }
  return true
}

/* mounting */
var lastHtml='';
function hostRoot(){var d=w.document;return d&&d.getElementById('content')}
function refresh(){
  var d=w.document;if(!d||!d.body)return;
  var v=view(),root=hostRoot();
  if(v==='taskdetail'&&root){
    // the menu entry and openTask() route here; the RC1152 detail renderer was never called by the router
    var rt=w.ExportHUBRC1014TaskRuntime;
    if(!d.getElementById('rc1152TaskDetail')&&rt&&typeof rt.renderTaskDetailView==='function'){
      var remembered=null;try{remembered=rt.rememberedTask&&rt.rememberedTask({state:state()})}catch(_){}
      if(remembered){try{rt.renderTaskDetailView(remembered,{state:state()})}catch(err){try{console.warn('RC1570 detail',err)}catch(_){}}}
      else route('tasks');
    }
    return
  }
  var existing=d.getElementById(SECTION_ID);
  if(v!=='tasks'||!root){if(existing)existing.remove();d.body.removeAttribute(BODY_FLAG);lastHtml='';return}
  var html=renderHtml(buildModel(new Date()),new Date());
  var section=existing;
  if(!section||section.parentNode!==root){
    if(section)section.remove();
    section=d.createElement('section');section.id=SECTION_ID;section.className='rc1570-tasks';root.insertBefore(section,root.firstChild);lastHtml='';bind(section)
  }
  if(html!==lastHtml){
    var active=d.activeElement,searching=active&&active.getAttribute&&active.getAttribute('data-rc1570-search'),pos=searching?active.selectionStart:0;
    section.innerHTML=html;lastHtml=html;
    if(searching){var s=section.querySelector('[data-rc1570-search]');if(s){s.focus();try{s.setSelectionRange(pos,pos)}catch(_){}}}
  }
  if(d.body.getAttribute(BODY_FLAG)!=='1')d.body.setAttribute(BODY_FLAG,'1')
}
function refreshNow(){try{refresh()}catch(err){try{console.warn('RC1570 tasks',err)}catch(_){}}}
var frame=0;
function schedule(){if(frame)return;var raf=w.requestAnimationFrame||function(fn){return setTimeout(fn,16)};frame=raf(function(){frame=0;refreshNow()})}
function bind(section){
  section.addEventListener('click',function(e){
    var el=e.target&&e.target.closest?e.target:null;if(!el)return;
    var b;
    if((b=el.closest('[data-rc1570-toggle]'))){e.preventDefault();toggle(b.getAttribute('data-rc1570-toggle'));return}
    if((b=el.closest('[data-rc1570-open]'))){e.preventDefault();openDetail(b.getAttribute('data-rc1570-open'));return}
    if((b=el.closest('[data-rc1570-edit]'))){e.preventDefault();edit(b.getAttribute('data-rc1570-edit'));return}
    if((b=el.closest('[data-rc1570-ref]'))){e.preventDefault();openShipment(b.getAttribute('data-rc1570-ref'));return}
    if((b=el.closest('[data-rc1570-new]'))){e.preventDefault();openForm();return}
    if((b=el.closest('[data-rc1570-route]'))){e.preventDefault();route(b.getAttribute('data-rc1570-route'));return}
    if((b=el.closest('[data-rc1570-scope]'))){e.preventDefault();ui.scope=b.getAttribute('data-rc1570-scope');try{w.localStorage.setItem(SCOPE_KEY,ui.scope)}catch(_){}refreshNow();return}
    if((b=el.closest('[data-rc1570-expand]'))){e.preventDefault();var k=b.getAttribute('data-rc1570-expand');ui.expanded[k]=!ui.expanded[k];refreshNow();return}
    if((b=el.closest('a[href^="#rc1570-"]'))){e.preventDefault();var target=w.document.getElementById(b.getAttribute('href').slice(1));if(target&&target.scrollIntoView)target.scrollIntoView({behavior:'smooth',block:'start'})}
  });
  section.addEventListener('toggle',function(e){var det=e.target;if(!det||!det.getAttribute)return;var k=det.getAttribute('data-rc1570-day');if(!k)return;ui.expanded['day:'+k]=det.open;if(det.open)refreshNow()},true);
  section.addEventListener('input',function(e){if(!e.target||!e.target.getAttribute||!e.target.getAttribute('data-rc1570-search'))return;ui.search=e.target.value;schedule()})
}
function install(){
  var d=w.document;if(!d)return;
  ['exporthub:ready','exporthub:viewchange','exporthub:rendered','exporthub:sync','exporthub:tasks-updated','exporthub:language-changed','exporthub:state-loaded'].forEach(function(n){try{w.addEventListener(n,schedule)}catch(_){}});
  var mount=function(){var v=view();if(v==='tasks'&&!d.getElementById(SECTION_ID))refreshNow();else if(v==='taskdetail'&&!d.getElementById('rc1152TaskDetail'))refreshNow();else if(v!=='tasks'&&d.body&&d.body.hasAttribute(BODY_FLAG))refreshNow()};
  var watch=function(){var c=d.getElementById('content');if(!c||c.__rc1570Observed||typeof w.MutationObserver!=='function')return;c.__rc1570Observed=true;new w.MutationObserver(mount).observe(c,{childList:true})};
  if(typeof w.MutationObserver==='function'&&d.body)new w.MutationObserver(function(){watch();mount()}).observe(d.body,{attributes:true,attributeFilter:['data-exporthub-view','data-current-view']});
  var check=function(){if(d.hidden)return;watch();mount()};
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',check);else check();
  setInterval(check,1500);
  // completed tasks from other tabs/devices: refresh the counts once a minute while the view is open
  setInterval(function(){if(!d.hidden&&view()==='tasks')schedule()},60000)
}

w.ExportHUBTasksFocus1570=Object.freeze({version:VERSION,buildModel:buildModel,renderHtml:renderHtml,taskDate:taskDate,isMine:isMine,refresh:refreshNow,openForm:openForm});
install();
})(window);
