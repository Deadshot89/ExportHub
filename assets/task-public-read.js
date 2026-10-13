(function(root){
  'use strict';
  const LANGS=new Set(['de','en','pl','es','fr','it']);
  const fallback={
    'taskPublic.pageTitle':'Task','taskPublic.loading':'Loading task…','taskPublic.invalid':'This task link is invalid or no longer active.',
    'taskPublic.unavailable':'The task cannot be loaded right now.','taskPublic.status':'Status','taskPublic.due':'Due','taskPublic.planned':'Planned',
    'taskPublic.latest':'Complete no later than','taskPublic.customer':'Customer','taskPublic.checklist':'Checklist','taskPublic.done':'Done','taskPublic.open':'Open'
  };
  let messages=fallback;
  const q=v=>String(v==null?'':v).trim();
  const byId=id=>document.getElementById(id);
  const tr=key=>q(messages&&messages[key])||fallback[key]||key;
  function language(){const raw=q((new URLSearchParams(location.search)).get('lang')||navigator.language).slice(0,2).toLowerCase();return LANGS.has(raw)?raw:'en'}
  async function loadMessages(){const lang=language();document.documentElement.lang=lang;try{const res=await fetch('/assets/i18n/'+lang+'.json',{cache:'no-store',credentials:'omit'});if(res.ok)messages=Object.assign({},fallback,await res.json())}catch(_){messages=fallback}}
  function showMessage(text,error){const el=byId('status');if(!el)return;el.textContent=text;el.dataset.kind=error?'error':'info'}
  function addMeta(label,value){if(!q(value))return;const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;row.append(dt,dd);byId('taskMeta').append(row)}
  function render(data){
    byId('taskTitle').textContent=q(data.title)||tr('taskPublic.pageTitle');
    if(q(data.description)){byId('taskDescription').textContent=data.description;byId('taskDescription').hidden=false}
    addMeta(tr('taskPublic.status'),data.status);addMeta(tr('taskPublic.planned'),data.plannedAt);addMeta(tr('taskPublic.due'),data.dueAt);addMeta(tr('taskPublic.latest'),data.latestCompletionAt);addMeta(tr('taskPublic.customer'),data.customerName);
    if(Array.isArray(data.checklist)&&data.checklist.length){const box=byId('taskChecklist'),list=byId('taskChecklistList');box.hidden=false;byId('taskChecklistTitle').textContent=tr('taskPublic.checklist');for(const item of data.checklist){const li=document.createElement('li');li.textContent=(item&&item.done===true?'✓ ':'○ ')+q(item&&item.text);list.append(li)}}
    byId('taskCard').hidden=false;showMessage('');
  }
  async function boot(){
    await loadMessages();document.title=tr('taskPublic.pageTitle');showMessage(tr('taskPublic.loading'));
    const token=q((new URLSearchParams(location.search)).get('token'));if(!/^[a-f0-9]{64}$/i.test(token)){showMessage(tr('taskPublic.invalid'),true);return}
    try{const response=await fetch('/api/task-public?token='+encodeURIComponent(token),{method:'GET',headers:{Accept:'application/json'},cache:'no-store',credentials:'omit'});if(!response.ok){showMessage(response.status===404||response.status===410?tr('taskPublic.invalid'):tr('taskPublic.unavailable'),true);return}render(await response.json())}catch(_){showMessage(tr('taskPublic.unavailable'),true)}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window);
