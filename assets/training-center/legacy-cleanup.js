(function(g){
'use strict';

const LEGACY_SOP_KEYS=Object.freeze([
  'customSops',
  'isoSops',
  'sopLearningProgress',
  'sopFavorites',
  'sopRecents',
  'sopVersions',
  'sopAudit',
  'sopTraining',
  'sopTours',
  'sopScreenshots',
  'sopCatalog'
]);

function clone(value){
  if(value===undefined)return undefined;
  return JSON.parse(JSON.stringify(value));
}

function cleanup(state){
  if(!state||typeof state!=='object'||Array.isArray(state))return state;
  const next=clone(state);
  for(const key of LEGACY_SOP_KEYS)delete next[key];
  return next;
}

g.ExportHubTrainingLegacyCleanup=Object.freeze({LEGACY_SOP_KEYS,cleanup});
})(globalThis);
