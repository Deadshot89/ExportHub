(function(root){
  'use strict';

  const base=root.ExportHUBTaskUIV2;
  if(!base)throw new Error('TaskPlanner V2 UI fehlt');
  const q=v=>String(v==null?'':v).trim();
  const arr=v=>Array.isArray(v)?v:[];
  const low=v=>q(v).toLocaleLowerCase('de-DE');
  const esc=v=>q(v).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const DASHBOARD_VIEWS=new Set(['dashboard','home','start','startseite']);
  const CUSTOMER_VIEWS=new Set(['customers','customerfolder','customer','kunden','kundenordner']);
  const DASHBOARD_HOST_ID='taskplannerV2DashboardProjection';
  const CUSTOMER_HOST_ID='taskplannerV2CustomerProjection';
  function tr(key,vars,fallback){
    try{if(root.ExportHUBI18n&&typeof root.ExportHUBI18n.t==='function'){const value=root.ExportHUBI18n.t(key,vars);if(value&&value!==key)return value;}}catch(_){}
    let text=fallback||key;for(const [name,value] of Object.entries(vars||{}))text=String(text).replaceAll('{'+name+'}',String(value));return text;
  }
  function projections(){
    const api=root.ExportHUBTaskProjectionsV2;
    if(!api||typeof api.dashboard!=='function')throw new Error('TaskPlanner V2 Projections fehlen');
    return api;
  }
  function sharedState(){
    try{if(typeof root.__EXPORTHUB_GET_STATE__==='function')return root.__EXPORTHUB_GET_STATE__()||null;}catch(_){}
    try{if(root.ExportHUBState&&typeof root.ExportHUBState.get==='function')return root.ExportHUBState.get()||null;}catch(_){}
    return root.ExportHUBClean&&root.ExportHUBClean.state||root.appState||root.state||null;
  }
  function stateOf(ctx){const state=ctx&&ctx.state||sharedState();if(!state||typeof state!=='object')throw new Error('TaskPlanner V2 Projection UI benötigt ctx.state');return state;}
  function rowHtml(task){return `<article class="tpv2-projection-row" data-task-id="${esc(task&&task.id)}"><div><strong>${esc(task&&task.title)}</strong><span>${esc(task&&task.customerName)}</span></div><div><span>${esc(task&&task.priority)}</span><span>${esc(q(task&&task.dueAt).slice(0,16).replace('T',' · '))}</span></div></article>`;}
  function metricHtml(name,value,label){return `<article class="tpv2-kpi-card" data-metric="${esc(name)}"><span>${esc(label)}</span><strong>${Number(value)||0}</strong></article>`;}

  function renderTaskDashboard(target,ctx={}){
    if(!target)throw new Error('TaskPlanner Dashboard target missing');
    const view=projections().dashboard(stateOf(ctx),ctx),c=view.counts||{},labels={
      today:tr('taskV2.dashboard.today',null,'Today'),week:tr('taskV2.dashboard.week',null,'This week'),overdue:tr('taskV2.dashboard.overdue',null,'Overdue'),critical:tr('taskV2.dashboard.critical',null,'Critical'),done:tr('taskV2.dashboard.done',null,'Done'),waiting:tr('taskV2.dashboard.waiting',null,'Waiting')
    };
    const cards=['today','week','overdue','critical','done','waiting'].map(key=>metricHtml(key,c[key],labels[key])).join('');
    const weekly=view.weekly||{done:0,total:0,percent:0};
    target.innerHTML=`<section class="tpv2-projection tpv2-dashboard" data-taskplanner-v2-dashboard data-signature="${esc(view.signature)}"><header><h2>${esc(tr('taskV2.dashboard.title',null,'Task dashboard'))}</h2>${view.overloaded?`<span class="tpv2-projection-warning">${esc(tr('taskV2.dashboard.overloaded',null,'Week overloaded'))}</span>`:''}</header><div class="tpv2-kpi-grid">${cards}</div><div class="tpv2-progress" data-weekly-progress><div><strong>${esc(tr('taskV2.dashboard.progress',null,'Weekly progress'))}</strong><span>${weekly.done}/${weekly.total} · ${weekly.percent}%</span></div><progress max="100" value="${Number(weekly.percent)||0}">${Number(weekly.percent)||0}%</progress></div></section>`;
    return target;
  }

  function sectionHtml(title,items,emptyKey){return `<section class="tpv2-projection-list"><header><h3>${esc(title)}</h3><span>${items.length}</span></header>${items.length?items.map(rowHtml).join(''):`<p class="tpv2-projection-empty">${esc(tr(emptyKey,null,'No tasks'))}</p>`}</section>`;}
  function renderCustomerTasks(target,customerId,ctx={}){
    if(!target)throw new Error('TaskPlanner customer target missing');
    const view=projections().customer(customerId,stateOf(ctx),ctx),history=arr(view.history&&view.history.items);
    target.innerHTML=`<section class="tpv2-projection tpv2-customer-projection" data-taskplanner-v2-customer data-customer-id="${esc(view.customerId)}"><header><h2>${esc(tr('taskV2.customer.title',null,'Customer tasks'))}</h2></header><div class="tpv2-projection-columns">${sectionHtml(tr('taskV2.customer.active',null,'Active'),arr(view.active),'taskV2.customer.emptyActive')}${sectionHtml(tr('taskV2.customer.upcoming',null,'Upcoming'),arr(view.upcoming),'taskV2.customer.emptyUpcoming')}${sectionHtml(tr('taskV2.customer.history',null,'History'),history,'taskV2.customer.emptyHistory')}</div><footer>${view.history?`${view.history.page}/${view.history.pages} · ${view.history.total}`:''}</footer></section>`;
    return target;
  }

  function renderTaskArchive(target,query={},ctx={}){
    if(!target)throw new Error('TaskPlanner archive target missing');
    const view=projections().archive(query,stateOf(ctx),ctx);
    target.innerHTML=`<section class="tpv2-projection tpv2-archive" data-taskplanner-v2-archive><header><h2>${esc(tr('taskV2.archive.title',null,'Task archive'))}</h2><span>${view.total}</span></header><div class="tpv2-projection-list">${arr(view.items).map(rowHtml).join('')||`<p class="tpv2-projection-empty">${esc(tr('taskV2.archive.empty',null,'No archived tasks'))}</p>`}</div><footer>${view.page}/${view.pages}</footer></section>`;
    return target;
  }

  function statCard(name,value,label){return `<article class="tpv2-stat-card" data-stat="${esc(name)}"><span>${esc(label)}</span><strong>${Number(value)||0}</strong></article>`;}
  function renderTaskStats(target,query={},ctx={}){
    if(!target)throw new Error('TaskPlanner stats target missing');
    const view=projections().stats(query,stateOf(ctx),ctx),mode=view.completionMode||{};
    const cards=[
      statCard('open',view.open,tr('taskV2.stats.open',null,'Open')),
      statCard('overdue',view.overdue,tr('taskV2.stats.overdue',null,'Overdue')),
      statCard('completed',view.completed,tr('taskV2.stats.completed',null,'Completed')),
      statCard('onTime',view.onTime,tr('taskV2.stats.onTime',null,'On time')),
      statCard('late',view.late,tr('taskV2.stats.late',null,'Late')),
      statCard('automatic',mode.automatic,tr('taskV2.stats.automatic',null,'Automatic')),
      statCard('manual',mode.manual,tr('taskV2.stats.manual',null,'Manual')),
      statCard('duration',view.averageDurationMinutes,tr('taskV2.stats.averageMinutes',null,'Avg. minutes'))
    ].join('');
    target.innerHTML=`<section class="tpv2-projection tpv2-stats" data-taskplanner-v2-stats><header><h2>${esc(tr('taskV2.stats.title',null,'Task statistics'))}</h2></header><div class="tpv2-stat-grid">${cards}</div></section>`;
    return target;
  }

  function documentOf(ctx){return ctx&&ctx.document||root.document||null;}
  function viewOf(state){return low(state&&(state.view||state.currentView||state.activeView||state.page));}
  function stableCustomerId(state){
    const direct=q(state&&(state.currentCustomerId||state.selectedCustomerId||state.customerFolderId||state.customerFolderOpenId));
    if(direct)return direct;
    const customer=state&&(state.currentCustomer||state.selectedCustomer);
    return q(customer&&(customer.customerId||customer.id||customer.account||customer.customerNumber||customer.kundennummer));
  }
  function mountContainer(doc){return doc&&(doc.getElementById&&doc.getElementById('content')||doc.querySelector&&doc.querySelector('main')||doc.body)||null;}
  function removeHost(doc,id){const node=doc&&doc.getElementById&&doc.getElementById(id);if(node&&typeof node.remove==='function')node.remove();else if(node&&node.parentNode&&typeof node.parentNode.removeChild==='function')node.parentNode.removeChild(node);}
  function ensureHost(doc,container,id,className){
    let host=doc&&doc.getElementById&&doc.getElementById(id);if(host)return host;
    if(!doc||typeof doc.createElement!=='function'||!container||typeof container.appendChild!=='function')return null;
    host=doc.createElement('section');host.id=id;host.className=className;host.setAttribute&&host.setAttribute('data-taskplanner-v2-mounted','1');container.appendChild(host);return host;
  }
  function mountCurrentView(ctx={}){
    const state=stateOf(ctx),doc=documentOf(ctx);if(!doc)return{mounted:'',view:viewOf(state),customerId:''};
    const view=viewOf(state),container=mountContainer(doc);if(!container)return{mounted:'',view,customerId:''};
    if(DASHBOARD_VIEWS.has(view)){
      removeHost(doc,CUSTOMER_HOST_ID);
      const host=ensureHost(doc,container,DASHBOARD_HOST_ID,'card tpv2-dashboard-mount');if(!host)return{mounted:'',view,customerId:''};
      renderTaskDashboard(host,{...ctx,state});return{mounted:'dashboard',view,customerId:''};
    }
    if(CUSTOMER_VIEWS.has(view)){
      removeHost(doc,DASHBOARD_HOST_ID);const customerId=stableCustomerId(state);
      if(!customerId){removeHost(doc,CUSTOMER_HOST_ID);return{mounted:'',view,customerId:''};}
      const host=ensureHost(doc,container,CUSTOMER_HOST_ID,'card tpv2-customer-mount');if(!host)return{mounted:'',view,customerId};
      renderCustomerTasks(host,customerId,{...ctx,state});return{mounted:'customer',view,customerId};
    }
    removeHost(doc,DASHBOARD_HOST_ID);removeHost(doc,CUSTOMER_HOST_ID);return{mounted:'',view,customerId:''};
  }
  function bindProjectionMounts(ctx={}){
    if(root.__EXPORTHUB_TASKPLANNER_V2_PROJECTION_MOUNTS__)return root.__EXPORTHUB_TASKPLANNER_V2_PROJECTION_MOUNTS__;
    let timer=0;
    const schedule=()=>{try{if(timer&&typeof root.clearTimeout==='function')root.clearTimeout(timer);}catch(_){}timer=(root.setTimeout||setTimeout)(()=>{try{mountCurrentView(ctx);}catch(_){}},0);};
    const events=['exporthub:ready','exporthub:rendered','exporthub:viewchange','exporthub:state-loaded','exporthub:language-changed','exporthub:tasks-updated','exporthub:user-profile-updated'];
    if(typeof root.addEventListener==='function')for(const name of events)root.addEventListener(name,schedule);
    const doc=documentOf(ctx);if(doc&&doc.readyState==='loading'&&typeof doc.addEventListener==='function')doc.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
    const binding=Object.freeze({schedule,events:events.slice()});root.__EXPORTHUB_TASKPLANNER_V2_PROJECTION_MOUNTS__=binding;return binding;
  }

  root.ExportHUBTaskUIV2=Object.freeze({...base,renderTaskDashboard,renderCustomerTasks,renderTaskArchive,renderTaskStats,mountCurrentView,bindProjectionMounts});
  if(root.document&&root.window===root)bindProjectionMounts();
})(globalThis);
