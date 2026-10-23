(function(root){
'use strict';
if(root.__EXPORTHUB_RC1016_DEMO_TASK_SEED__)return;
root.__EXPORTHUB_RC1016_DEMO_TASK_SEED__=true;
if(root.__EXPORTHUB_DEMO_MODE__!==true)return;
const team=root.__EXPORTHUB_DEMO_STATE__;
const state=team&&team.state;
if(!state||!Array.isArray(state.tasks))return;
const user=root.__EXPORTHUB_DEMO_USER__||state.currentUser||{};
const userId=String(user.id||user.userId||user.username||'DEMO-USER-1').trim();
function q(v){return String(v==null?'':v).trim();}
function contract(task,index){
  const title=q(task&&task.title||task&&task.name);
  const ref=q(task&&task.sourceRef||task&&task.linkedShipmentRef||task&&task.shipmentRef);
  let group='Offene Sendungen',priority='P3',sourceType='shipment';
  if(/abd/i.test(title)){group='Offene ABDs';priority='P0';sourceType='abd';}
  else if(/abhol|pickup/i.test(title)){group='Kunde angemeldet';priority='P1';sourceType='pickup';}
  else if(/pick/i.test(title)){group='Picks';priority='P2';sourceType='pick';}
  else if(/pod/i.test(title)){group='Fehlende POD';priority='P1';sourceType='pod';}
  return Object.assign({},task||{}, {
    id:q(task&&task.id)||`DEMO-TASK-${index+1}`,
    title:title||`Demo-Aufgabe ${index+1}`,
    group,
    status:'open',
    priority,
    sourceType,
    sourceId:q(task&&task.sourceId)||ref||q(task&&task.id),
    sourceRef:ref,
    originalAssignee:userId,
    effectiveAssignee:userId,
    owner:userId,
    assignee:userId,
    userId,
    assignedTo:userId,
    assignedToName:q(user.name)||'Demo Administrator',
    environment:'demo'
  });
}
const tasks=state.tasks.map(contract);
state.tasks=tasks;
if(team.state)team.state.tasks=tasks;
root.__EXPORTHUB_DEMO_TASKS__=tasks;
})(typeof globalThis!=='undefined'?globalThis:this);
