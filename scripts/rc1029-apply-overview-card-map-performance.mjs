import fs from 'node:fs';

const path='TESTVERSION.html';
let source=fs.readFileSync(path,'utf8');

function replaceOnce(before,after,label){
  const first=source.indexOf(before);
  if(first<0)throw new Error(`RC1029 Patchanker fehlt: ${label}`);
  if(source.indexOf(before,first+before.length)>=0)throw new Error(`RC1029 Patchanker nicht eindeutig: ${label}`);
  source=source.slice(0,first)+after+source.slice(first+before.length);
}

replaceOnce(
"window.rc485PatchOverviewCards=function(desired){var r=root();if(!r||currentView()!=='shipmentoverview')return false;var changed=0;A(S().shipments).forEach(function(sh){var selector=overviewCardSelector(shipmentId(sh)),card=selector&&r.querySelector(selector);if(!card)return;var before=Q(card.getAttribute('data-status-key')),after=overviewStatusKey(sh),beforePickup=Q(card.getAttribute('data-pickup-complete')),afterPickup=overviewPickupCompleted(sh)?'1':'0',parentGroup=card.closest&&card.closest('.rc543-overview-group'),parentKey=parentGroup?Q(parentGroup.getAttribute('data-overview-group')):'';if(before===after&&beforePickup===afterPickup&&(overviewGroupBy()!=='status'||parentKey===after))return;patchOverviewCardDom(sh);if(overviewGroupBy()==='status'&&(before!==after||parentKey!==after)){if(!Array.isArray(desired))desired=overviewDesiredSnapshot(desired);overviewPlaceChangedCard(card,sh,desired)}changed++});if(changed&&overviewGroupBy()==='status'){overviewRemoveEmptyGroups();patchOverviewGroupHeaders()}return true};",
"window.rc485PatchOverviewCards=function(desired,cardMap){var r=root();if(!r||currentView()!=='shipmentoverview')return false;var changed=0;A(S().shipments).forEach(function(sh){var selector=overviewCardSelector(shipmentId(sh)),card=cardMap instanceof Map?cardMap.get(shipmentId(sh)):selector&&r.querySelector(selector);if(!card)return;var before=Q(card.getAttribute('data-status-key')),after=overviewStatusKey(sh),beforePickup=Q(card.getAttribute('data-pickup-complete')),afterPickup=overviewPickupCompleted(sh)?'1':'0',parentGroup=card.closest&&card.closest('.rc543-overview-group'),parentKey=parentGroup?Q(parentGroup.getAttribute('data-overview-group')):'';if(before===after&&beforePickup===afterPickup&&(overviewGroupBy()!=='status'||parentKey===after))return;patchOverviewCardDom(sh);if(overviewGroupBy()==='status'&&(before!==after||parentKey!==after)){if(!Array.isArray(desired))desired=overviewDesiredSnapshot(desired);overviewPlaceChangedCard(card,sh,desired)}changed++});if(changed&&overviewGroupBy()==='status'){overviewRemoveEmptyGroups();patchOverviewGroupHeaders()}return true};",
'rc485PatchOverviewCards');

replaceOnce(
"function rc640PatchOverviewQuietly(){if(currentView()!=='shipmentoverview'||!viewDomMatches('shipmentoverview'))return false;try{var r=root(),desired=overviewFiltered(),expected=desired.map(function(sh){return shipmentId(sh)}).filter(Boolean),actual=Array.from(r.querySelectorAll('.rc524-shipment-card[data-shipment]')).map(function(card){return Q(card.getAttribute('data-shipment'))}).filter(Boolean),same=expected.length===actual.length&&expected.every(function(id){return actual.indexOf(id)>=0});if(!same){if(overviewInputActive())return false;return renderOverview(true)}window.rc485PatchOverviewCards(desired);overviewReorderExistingCards(desired);patchOverviewGroupHeaders();return true}catch(e){console.error('RC645 Sendungsübersicht aktualisieren',e);return false}}",
"function rc640PatchOverviewQuietly(){if(currentView()!=='shipmentoverview'||!viewDomMatches('shipmentoverview'))return false;try{var r=root(),desired=overviewFiltered(),expected=desired.map(function(sh){return shipmentId(sh)}).filter(Boolean),cards=Array.from(r.querySelectorAll('.rc524-shipment-card[data-shipment]')),cardMap=new Map(),actual=[];cards.forEach(function(card){var id=Q(card.getAttribute('data-shipment'));if(id){actual.push(id);cardMap.set(id,card)}});var same=expected.length===actual.length&&expected.every(function(id){return cardMap.has(id)});if(!same){if(overviewInputActive())return false;return renderOverview(true)}window.rc485PatchOverviewCards(desired,cardMap);overviewReorderExistingCards(desired);patchOverviewGroupHeaders();return true}catch(e){console.error('RC645 Sendungsübersicht aktualisieren',e);return false}}",
'rc640PatchOverviewQuietly');

fs.writeFileSync(path,source);
console.log('RC1029 Overview-Kartenmap-Patch angewendet.');
