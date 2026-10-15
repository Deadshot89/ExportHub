(function(g){
'use strict';

function ui(){const api=g.ExportHubTrainingCenterUi;if(!api||typeof api.render!=='function')throw new Error('TRAINING_CENTER_UI_MISSING');return api;}
function store(){const api=g.ExportHubTrainingCenterStore;if(!api||typeof api.read!=='function')throw new Error('TRAINING_CENTER_STORE_MISSING');return api;}
function copy(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value));}

function mount(root,context={}){
  if(!root||typeof root!=='object')throw new Error('TRAINING_CENTER_ROOT_MISSING');
  let center=context.center?copy(context.center):store().read(context.state||{});
  let view={section:'standard',query:'',categoryId:''};
  let destroyed=false;
  const t=typeof context.t==='function'?context.t:undefined;

  function paint(focusHint){
    if(destroyed)return;
    root.innerHTML=ui().render(center,{...view,t});
    bind();
    if(focusHint==='search'){
      const input=root.querySelector('[data-training-center-search]');
      if(input){input.focus();try{const end=input.value.length;input.setSelectionRange(end,end);}catch(_){}}
    }
  }
  function chooseSection(section,focus=false){
    if(!['standard','customer','training'].includes(section))return;
    view.section=section;
    paint();
    if(focus){const target=root.querySelector(`[data-training-center-section="${section}"]`);if(target)target.focus();}
  }
  function handleTabKey(event){
    const tabs=[...root.querySelectorAll('[data-training-center-section]')];
    const current=tabs.indexOf(event.currentTarget);
    if(current<0||!tabs.length)return;
    let next=current;
    if(event.key==='ArrowRight')next=(current+1)%tabs.length;
    else if(event.key==='ArrowLeft')next=(current-1+tabs.length)%tabs.length;
    else if(event.key==='Home')next=0;
    else if(event.key==='End')next=tabs.length-1;
    else return;
    event.preventDefault();
    tabs[next].focus();
  }
  function bind(){
    for(const tab of root.querySelectorAll('[data-training-center-section]')){
      tab.addEventListener('click',()=>chooseSection(tab.getAttribute('data-training-center-section')));
      tab.addEventListener('keydown',handleTabKey);
    }
    const search=root.querySelector('[data-training-center-search]');
    if(search)search.addEventListener('input',(event)=>{view.query=event.target.value||'';paint('search');});
    for(const category of root.querySelectorAll('[data-training-center-category]'))category.addEventListener('click',()=>{view.categoryId=category.getAttribute('data-training-center-category')||'';paint();});
  }
  function update(next={}){
    if(next.center)center=copy(next.center);
    if(next.state)center=store().read(next.state);
    if(next.section)view.section=next.section;
    if(Object.prototype.hasOwnProperty.call(next,'query'))view.query=String(next.query||'');
    if(Object.prototype.hasOwnProperty.call(next,'categoryId'))view.categoryId=String(next.categoryId||'');
    paint();
  }
  function destroy(){destroyed=true;root.replaceChildren();}
  function state(){return Object.freeze({...view});}

  paint();
  return Object.freeze({update,destroy,state});
}

g.ExportHubTrainingCenterRuntime=Object.freeze({mount});
})(globalThis);
