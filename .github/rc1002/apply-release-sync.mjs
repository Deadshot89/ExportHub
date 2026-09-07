import fs from 'node:fs';

for(const file of ['index.html','TESTVERSION.html']){
  let src=fs.readFileSync(file,'utf8');
  const before=src;
  src=src.replace(/var BUILD=Object\.freeze\(\{version:'RC\d+',cache:'\d+',loginReturn:'([^']*)'\}\);/,(_m,ret)=>{
    const next=String(ret||'').replace(/v=\d+/,'v=1002');
    return `var BUILD=Object.freeze({version:'RC1002',cache:'1002',loginReturn:'${next}'});`;
  });
  src=src.replace(/(var RELEASE=Object\.freeze\(\{\s*version:)'RC\d+'/m,"$1'RC1002'");
  src=src.replace(/(var RELEASE=Object\.freeze\(\{[\s\S]{0,120}?date:)'[^']*'/m,"$1'07.09.2026'");
  src=src.replace(/(var RELEASE=Object\.freeze\(\{[\s\S]{0,220}?title:)'[^']*'/m,"$1'Aufgaben-Gruppen und gemeinsamer RC1002-Stand'");
  if(!src.includes("version:'RC1002',cache:'1002'"))throw new Error(`${file}: BUILD konnte nicht auf RC1002 gesetzt werden`);
  if(src===before)throw new Error(`${file}: keine Versionsänderung angewendet`);
  fs.writeFileSync(file,src,'utf8');
}
console.log('index.html und TESTVERSION.html auf RC1002 synchronisiert');
