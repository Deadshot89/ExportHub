(function(g){
'use strict';

function demo(){const api=g.ExportHubTrainingDemoAdapter;if(!api||typeof api.execute!=='function')throw new Error('TRAINING_DEMO_ADAPTER_MISSING');return api;}
function execute(options={}){
  const mode=String(options.mode||'');
  const operation=String(options.operation||'');
  const payload=options.payload;
  // A caller must never switch to productive writes while an in-memory demo is active.
  const active=!!(g.ExportHubTrainingState&&typeof g.ExportHubTrainingState.isActive==='function'&&g.ExportHubTrainingState.isActive());
  if(active&&mode!=='training')throw new Error('TRAINING_PRODUCTIVE_WRITE_BLOCKED');
  if(mode==='training'){
    if(typeof options.productive==='function')throw new Error('TRAINING_PRODUCTIVE_WRITE_BLOCKED');
    return {mode:'training',persisted:false,result:demo().execute(operation,payload)};
  }
  if(mode==='productive'){
    if(typeof options.productive!=='function')throw new Error('PRODUCTIVE_WRITE_HANDLER_REQUIRED');
    return {mode:'productive',persisted:true,result:options.productive(payload,operation)};
  }
  throw new Error('WRITE_GUARD_MODE_INVALID');
}

g.ExportHubTrainingWriteGuard=Object.freeze({execute});
})(globalThis);
