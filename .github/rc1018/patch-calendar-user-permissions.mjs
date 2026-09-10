function replaceExactlyOnce(source,search,replacement,label){
  const count=source.split(search).length-1;
  if(count!==1)throw new Error(`${label}: erwartet 1 Treffer, gefunden ${count}`);
  return source.replace(search,replacement);
}

export function patchCalendarUserPermissions(html){
  let out=String(html||'');

  const renderAt=out.indexOf('function renderRights(c){');
  if(renderAt<0)throw new Error('RC1019 Kalenderrechte: renderRights fehlt.');
  const modsAt=out.indexOf('const mods=[',renderAt);
  const modsEnd=modsAt>=0?out.indexOf('];',modsAt):-1;
  if(modsAt<0||modsEnd<0)throw new Error('RC1019 Kalenderrechte: Modulliste im Rechteeditor fehlt.');
  const mods=out.slice(modsAt,modsEnd+2);
  if(!mods.includes("id:'pickupcalendar'")){
    const settings="{id:'settings',l:'Hamburger Menü – Einstellungen'}";
    if(!mods.includes(settings))throw new Error('RC1019 Kalenderrechte: Einstellungen-Anker im Rechteeditor fehlt.');
    const patchedMods=mods.replace(settings,"{id:'pickupcalendar',l:'Abholkalender'},"+settings);
    out=out.slice(0,modsAt)+patchedMods+out.slice(modsEnd+2);
  }

  const moduleStart=out.indexOf('function hasModuleRightsForUser(u)');
  if(moduleStart<0)throw new Error('RC1019 Kalenderrechte: hasModuleRightsForUser fehlt.');
  const moduleEnd=out.indexOf('}',moduleStart);
  if(moduleEnd<0)throw new Error('RC1019 Kalenderrechte: hasModuleRightsForUser unvollständig.');
  const block=out.slice(moduleStart,moduleEnd+1);
  if(!block.includes("'pickupcalendar'")){
    const oldList="['shipment','customer','user','cmr','pallet','abd','documents','archive','tasks','settings']";
    const newList="['shipment','customer','user','cmr','pallet','abd','documents','archive','tasks','pickupcalendar','settings']";
    const patchedBlock=replaceExactlyOnce(block,oldList,newList,'RC1019 Kalenderrechte Modulerkennung');
    out=out.slice(0,moduleStart)+patchedBlock+out.slice(moduleEnd+1);
  }

  return out;
}
