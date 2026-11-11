// RC1982 P0: The browser delta writer currently sends the whole _teamSyncMeta
// object for every single shipment-history write, even when it is unchanged.
// The server already retains persisted metadata (field clocks and tombstones)
// when the incoming delta omits _teamSyncMeta. Never omit changed metadata.
const BEFORE="if(key==='_teamSyncMeta'){out[key]=compactInlineBinaryAliases(clone(current[key]));return}";
const AFTER="if(key==='_teamSyncMeta'){if(!sameValue(base[key],current[key]))out[key]=compactInlineBinaryAliases(clone(current[key]));return}";
const FALLBACK_BEFORE="if(!out._teamSyncMeta&&isObject(current._teamSyncMeta))out._teamSyncMeta=compactInlineBinaryAliases(clone(current._teamSyncMeta));return out";
const FALLBACK_AFTER="if(!out._teamSyncMeta&&isObject(current._teamSyncMeta)&&!sameValue(base._teamSyncMeta,current._teamSyncMeta))out._teamSyncMeta=compactInlineBinaryAliases(clone(current._teamSyncMeta));return out";
export function patchRc1982MetaDeltaHtml(source,file='index.html'){
  const html=String(source);
  const done=html.includes(AFTER)&&html.includes(FALLBACK_AFTER);
  if(done)return html;
  if(html.includes(AFTER)!==html.includes(FALLBACK_AFTER))throw new Error(file+': RC1982 partially applied');
  for(const [needle,label] of [[BEFORE,'metadata branch'],[FALLBACK_BEFORE,'metadata fallback']]){
    if(html.split(needle).length-1!==1){
      if(file==='demo.html'&&!html.includes('function buildAzureStateDelta('))return html;
      throw new Error(file+': RC1982 '+label+' anchor missing or ambiguous');
    }
  }
  return html.replace(BEFORE,AFTER).replace(FALLBACK_BEFORE,FALLBACK_AFTER);
}
