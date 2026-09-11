import fs from 'node:fs';

const path='assets/rc1014-task-lifecycle.js';
let source=fs.readFileSync(path,'utf8');
const old=`        }else if(task.group==='Picks'){
          const pick=findPick(task,domain);
          if(pickCompleted(pick))task=markDone(task,'system:pick',ctx);
        }else if(task.group==='Offene Sendungen'){`;
const replacement=`        }else if(task.group==='Picks'){
          const pick=findPick(task,domain);
          if(pickCompleted(pick))task=markDone(task,'system:pick',ctx);
        }else if(task.group==='Kunde angemeldet'){
          const shipment=findShipment(task,domain);
          if(shipmentCancelled(shipment))task=markCancelled(task,ctx);
          else if(shipment&&fullyCollected(shipment))task=markDone(task,'system:pickup',ctx);
        }else if(task.group==='Offene Sendungen'){`;
if(!source.includes(old))throw new Error('RC1056 Zielstelle nicht gefunden');
source=source.replace(old,replacement);
fs.writeFileSync(path,source);
