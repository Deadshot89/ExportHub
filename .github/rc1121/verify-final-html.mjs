import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const OUT=path.join(ROOT,'dist-rc1112');
const FILES=['index.html','TESTVERSION.html','demo.html'];
const LEAKS=[
  /RC824_SOP_DETAILS/,
  /window\.rc524OpenTaskEditor/,
  /function\s+rc824SopList\s*\(/,
  /var\s+rightsModules\s*=/,
  /window\.rc524PalletReport\s*=/
];
function outsideExecutableBlocks(source){
  return source
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,' ')
    .replace(/<!--[\s\S]*?-->/g,' ');
}
function verify(file){
  const p=path.join(OUT,file),html=fs.readFileSync(p,'utf8'),outside=outsideExecutableBlocks(html);
  for(const rx of LEAKS){if(rx.test(outside))throw new Error(file+': sichtbarer JavaScript-Code außerhalb <script>: '+rx);}
  const body=html.toLowerCase().lastIndexOf('</body>');
  if(body<0)throw new Error(file+': echtes </body> fehlt');
  for(const id of ['exporthub-rc1113-stowplan-persist','exporthub-rc1114-shipping-neutral']){
    const at=html.lastIndexOf('id="'+id+'"');
    if(at<0)throw new Error(file+': '+id+' fehlt');
    if(at>body)throw new Error(file+': '+id+' steht hinter </body>');
    if(body-at>2500)throw new Error(file+': '+id+' wurde nicht am echten Seitenende eingefügt');
  }
  const pallet=html.indexOf('Palettenreport');
  const sop=html.indexOf('RC824_SOP_DETAILS');
  if(pallet>=0&&sop>pallet){
    const middle=html.slice(pallet,sop);
    if(/exporthub-rc1113-stowplan-persist|exporthub-rc1114-shipping-neutral/.test(middle))throw new Error(file+': Runtime-Script steckt im Palettenreport-String');
  }
  console.log(file+': finaler HTML-/Script-Vertrag OK');
}
for(const file of FILES)verify(file);
