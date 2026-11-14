import fs from 'node:fs';
import path from 'node:path';

// SOP2 Phase 1 assets are present in all bundles, but the runtime switch
// remains OFF unless TESTSERVICE/demo is explicitly opted in. No API enablement.
export const SOP2_ASSETS=Object.freeze([
 'assets/i18n/sop2.js',
 'assets/sop2/sop2-client.js',
 'assets/sop2/sop2-reader.js',
 'assets/sop2/sop2-reader.css',
 'assets/sop2/sop2-editor.js',
 'assets/sop2/sop2-editor.css',
 'assets/sop2/sop2-coverage.js',
 'assets/sop2/sop2-mount.js',
 'assets/sop2/sop2-mount.css'
]);
const STYLE=[
 ['exporthub-sop2-reader-css','/assets/sop2/sop2-reader.css'],
 ['exporthub-sop2-editor-css','/assets/sop2/sop2-editor.css'],
 ['exporthub-sop2-mount-css','/assets/sop2/sop2-mount.css']
];
const SCRIPT=[
 ['exporthub-sop2-i18n','/assets/i18n/sop2.js'],
 ['exporthub-sop2-client','/assets/sop2/sop2-client.js'],
 ['exporthub-sop2-reader','/assets/sop2/sop2-reader.js'],
 ['exporthub-sop2-editor','/assets/sop2/sop2-editor.js'],
 ['exporthub-sop2-coverage','/assets/sop2/sop2-coverage.js'],
 ['exporthub-sop2-mount','/assets/sop2/sop2-mount.js']
];
const ANCHOR_ID='exporthub-rc1506-sop-coverage-runtime';
function count(html,id){return html.split('id="'+id+'"').length-1;}
function tagId(id,path,kind){return kind==='css'?
 '<link id="'+id+'" rel="stylesheet" href="'+path+'?v=sop2phase1">':
 '<script id="'+id+'" defer src="'+path+'?v=sop2phase1"></script>';}
export function injectSop2(html,file='build.html'){
 let out=String(html||'');
 if(!/<\/head>/i.test(out))throw new Error(file+': SOP2 HEAD_MISSING');
 const ids=[...STYLE,...SCRIPT].map(x=>x[0]);
 if(ids.some(id=>count(out,id)>1))throw new Error(file+': SOP2 DUPLICATE_ASSET');
 // Both established SOP wrappers must exist. RC1502 persistence is injected
 // before the RC1506 coverage runtime by the existing build chain. SOP2 loads
 // only after BOTH wrappers, so it cannot be overwritten by the old mount hooks.
 if(count(out,'exporthub-rc1502-sop-persistence')!==1)
   throw new Error(file+': SOP2 PERSISTENCE_ANCHOR_MISSING');
 const anchorRx=/<script\s+id=["']exporthub-rc1506-sop-coverage-runtime["'][^>]*><\/script>/i;
 if(!anchorRx.test(out))throw new Error(file+': SOP2 COVERAGE_RUNTIME_REQUIRED');
 const styles=STYLE.filter(([id])=>!count(out,id)).map(([id,p])=>tagId(id,p,'css'));
 if(styles.length)out=out.replace(/<\/head>/i,styles.join('\n')+'\n</head>');
 const scripts=SCRIPT.filter(([id])=>!count(out,id)).map(([id,p])=>tagId(id,p,'js'));
 if(scripts.length)out=out.replace(anchorRx,x=>x+'\n'+scripts.join('\n'));
 for(const id of ids)if(count(out,id)!==1)throw new Error(file+': SOP2 ASSET_COUNT '+id);
 const indices=SCRIPT.map(([id])=>out.indexOf('id="'+id+'"'));
 const persistence=out.indexOf('id="exporthub-rc1502-sop-persistence"');
 const lastLegacy=out.indexOf('id="'+ANCHOR_ID+'"');
 if(persistence>=lastLegacy||indices.some((i,n)=>i<lastLegacy||(n>0&&i<=indices[n-1])))
   throw new Error(file+': SOP2 SCRIPT_ORDER');
 // Release builder must not ship an activation flag; that requires later consent.
 if(/__EXPORTHUB_SOP2_PHASE1__\s*=\s*true/.test(out))
   throw new Error(file+': SOP2 FEATURE_FLAG_UNAUTHORIZED');
 return out;
}
export function integrateSop2(root,out){
 for(const relative of SOP2_ASSETS){
   const source=path.join(root,relative),target=path.join(out,relative);
   if(!fs.existsSync(source))throw new Error('SOP2 MISSING_ASSET '+relative);
   fs.mkdirSync(path.dirname(target),{recursive:true});
   fs.copyFileSync(source,target);
 }
 const pages=['index.html','TESTVERSION.html','demo.html'];
 for(const page of pages){
   const target=path.join(out,page);
   if(!fs.existsSync(target))throw new Error('SOP2 MISSING_PAGE '+page);
   fs.writeFileSync(target,injectSop2(fs.readFileSync(target,'utf8'),page));
 }
 return Object.freeze({
   assets:SOP2_ASSETS.slice(),pages,
   activation:'explicit-nonproduction-only',
   apiEnabled:false,
   productionActivation:false
 });
}
