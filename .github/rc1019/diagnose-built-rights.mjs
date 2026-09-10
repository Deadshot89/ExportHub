import fs from 'node:fs';
for(const file of ['dist-rc1016/index.html','dist-rc1016/TESTVERSION.html','dist-rc1016/demo.html']){
  const src=fs.readFileSync(file,'utf8');
  console.log(`\n=== ${file} ${src.length} ===`);
  for(const needle of ['renderRights','hasModuleRightsForUser','Benutzer & Rechte','Aufgaben & Reminder','Hamburger Menü – Einstellungen']){
    let at=src.indexOf(needle);
    console.log(`${needle}: ${at}`);
    if(at>=0)console.log(src.slice(Math.max(0,at-900),Math.min(src.length,at+4200)).replace(/\s+/g,' '));
  }
}
