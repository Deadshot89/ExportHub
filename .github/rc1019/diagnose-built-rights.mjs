import fs from 'node:fs';
for(const file of ['dist-rc1016/index.html','dist-rc1016/TESTVERSION.html','dist-rc1016/demo.html']){
  const src=fs.readFileSync(file,'utf8');
  console.log(`\n=== ${file} ${src.length} ===`);
  for(const needle of ['window.ExportHUBRC544Auth','ExportHUBRC544Auth=','rightsModules=','rightsLabels=','function renderRights()','Benutzerverwaltung wird geladen','Benutzer & Rechte']){
    let at=src.indexOf(needle);
    console.log(`${needle}: ${at}`);
    if(at>=0)console.log(src.slice(Math.max(0,at-1800),Math.min(src.length,at+9000)).replace(/\s+/g,' '));
  }
}