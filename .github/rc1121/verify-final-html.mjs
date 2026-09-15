import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const OUT=path.join(ROOT,'dist-rc1112');
const ARGS=process.argv.slice(2);
const FILES=ARGS.length?ARGS.map(p=>path.resolve(ROOT,p)):[
  path.join(OUT,'index.html'),
  path.join(OUT,'TESTVERSION.html'),
  path.join(OUT,'demo.html')
];
const LEAKS=[
  /RC824_SOP_DETAILS/,
  /window\.rc524OpenTaskEditor/,
  /function\s+rc824SopList\s*\(/,
  /var\s+rightsModules\s*=/,
  /window\.rc524PalletReport\s*=/,
  /window\.open\(['"]about:blank['"]/,
  /function\s+normalizeActionButtons\s*\(/,
  /function\s+activateQr\s*\(/,
  /\/\*\s*exporthub-rc898-dashboard-only-compact-shipment-inline-avis\s*\*\//
];
function outsideExecutableBlocks(source){
  return source
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,' ')
    .replace(/<!--[\s\S]*?-->/g,' ');
}
function count(source,needle){
  return source.split(needle).length-1;
}
function verify(p){
  const file=path.basename(p),html=fs.readFileSync(p,'utf8'),outside=outsideExecutableBlocks(html);
  for(const rx of LEAKS){
    if(rx.test(outside))throw new Error(file+': sichtbarer JavaScript-Code außerhalb <script>: '+rx);
  }
  const headOpen=/<head\b[^>]*>/i.exec(html);
  if(!headOpen)throw new Error(file+': <head> fehlt');
  const headClose=html.toLowerCase().indexOf('</head>',headOpen.index+headOpen[0].length);
  if(headClose<0)throw new Error(file+': </head> fehlt');
  for(const id of ['exporthub-rc1113-stowplan-persist','exporthub-rc1114-shipping-neutral']){
    const needle='id="'+id+'"',n=count(html,needle);
    if(n!==1)throw new Error(file+': '+id+' muss exakt 1x vorkommen, gefunden '+n);
    const at=html.indexOf(needle);
    if(at<headOpen.index||at>headClose)throw new Error(file+': '+id+' steht nicht im echten <head>');
  }
  const stow=html.indexOf('function printStow(){');
  const stowEnd=stow>=0?html.indexOf('function normalizeActionButtons',stow):-1;
  if(stow>=0&&stowEnd>stow){
    const block=html.slice(stow,stowEnd);
    if(/exporthub-rc1113-stowplan-persist|exporthub-rc1114-shipping-neutral/.test(block)){
      throw new Error(file+': RC1113/RC1114 Runtime steckt im Stauplan-Druckstring');
    }
    const unsafe=(block.match(/<\/script\s*>/gi)||[]).length;
    if(unsafe)throw new Error(file+': Stauplan-Druckblock enthält '+unsafe+' echtes </script>');
    if(block.includes('rc1059-document-blob.js')&&!/<\\\/script>/.test(block)){
      throw new Error(file+': rc1059 Loader ist im Stauplan nicht als <\\/script> escaped');
    }
  }
  if(html.includes("function taskTitle(t){return q(t&&(t.title||t.name||t.subject||'Aufgabe'))||'Aufgabe'}"))throw new Error(file+': alter Benachrichtigungs-Fallback Aufgabe noch aktiv');
  if(!html.includes('function notificationTaskKey(t)'))throw new Error(file+': RC1123 Benachrichtigungs-Deduplizierung fehlt');
  if(!html.includes("!taskForUser(t)||!taskTitle(t)"))throw new Error(file+': RC1123 filtert inhaltslose Aufgaben nicht');
  const codeLike=outside.match(/(?:^|\n)\s*(?:function\s+[A-Za-z_$][\w$]*\s*\(|var\s+[A-Za-z_$][\w$]*\s*=|window\.[A-Za-z_$][\w$]*\s*=|\/\*\s*exporthub-)/m);
  if(codeLike)throw new Error(file+': generischer sichtbarer Code-Leak: '+codeLike[0].slice(0,160));
  console.log(file+': vollständiger finaler HTML-/Script-Vertrag OK');
}
for(const file of FILES)verify(file);
