import fs from 'node:fs';

const files=['index.html','TESTVERSION.html'];

function patchTasks(file){
  let html=fs.readFileSync(file,'utf8');
  const start=html.indexOf('function tasks(){');
  const end=html.indexOf('function taskSortRC67',start);
  if(start<0||end<=start)throw new Error(`${file}: Aufgaben-Renderblock nicht gefunden`);

  let src=html.slice(start,end);
  src=src.replace(/<button[^>]*>Alle anzeigen<\/button>/g,'');
  src=src.replace(/<button[^>]*>Gruppen [^<]*<\/button>/g,'');
  src=src.replace(/<button[^>]*>Master-Aufgaben [^<]*<\/button>/g,'');
  src=src.replace(/let days=\[[^\]]+\];/,"let days=['Heute','R\\u00fcckstand','Montag','Dienstag','Mittwoch','Donnerstag','Freitag'];");
  src=src.replace(/Mit [^<]*Alle anzeigen[^<]*eingeblendet\./g,'W\\u00e4hle oben einen anderen Tag oder \\u00e4ndere den Zust\\u00e4ndigkeitsfilter.');

  for(const label of ['Alle anzeigen','Gruppen ','Master-Aufgaben ']){
    if(new RegExp(`<button[^>]*>${label.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}[^<]*<\\/button>`).test(src)){
      throw new Error(`${file}: unerwuenschte Aufgaben-Schaltflaeche blieb erhalten: ${label}`);
    }
  }
  const daySource=(src.match(/let days=\[([^\]]+)\]/)||[])[1]||'';
  for(const label of ['Alle Tage','\\u00dcberf\\u00e4llig','Ohne Tag']){
    if(daySource.includes(label))throw new Error(`${file}: unerwuenschter Tagesfilter blieb erhalten: ${label}`);
  }
  for(const label of ['Heute','R\\u00fcckstand','Montag','Dienstag','Mittwoch','Donnerstag','Freitag']){
    if(!daySource.includes(label))throw new Error(`${file}: gewuenschter Tagesfilter fehlt: ${label}`);
  }

  html=html.slice(0,start)+src+html.slice(end);
  fs.writeFileSync(file,html,'utf8');
}

files.forEach(patchTasks);
console.log('RC1001 Aufgaben-Kacheln bereinigt');
