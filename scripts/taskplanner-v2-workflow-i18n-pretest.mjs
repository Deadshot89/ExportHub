import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const LOCALES=Object.freeze(['de','en','pl','es','fr','it']);
export const TRANSLATIONS=Object.freeze({
  de:Object.freeze({'taskV2.workflow.reviewMapping':'Zuordnung prüfen'}),
  en:Object.freeze({'taskV2.workflow.reviewMapping':'Review mapping'}),
  pl:Object.freeze({'taskV2.workflow.reviewMapping':'Sprawdź przypisanie'}),
  es:Object.freeze({'taskV2.workflow.reviewMapping':'Revisar asignación'}),
  fr:Object.freeze({'taskV2.workflow.reviewMapping':'Vérifier l’affectation'}),
  it:Object.freeze({'taskV2.workflow.reviewMapping':'Verifica associazione'})
});

export function patchRepository(root=process.cwd()){
  const changed=[];
  for(const locale of LOCALES){
    const file=path.join(root,'assets/i18n',locale+'.json');
    if(!fs.existsSync(file))throw new Error('TaskPlanner V2 workflow i18n file missing '+locale);
    const before=fs.readFileSync(file,'utf8'),parsed=JSON.parse(before),next=Object.assign({},parsed,TRANSLATIONS[locale]),after=JSON.stringify(next,null,2)+'\n';
    if(after!==before){fs.writeFileSync(file,after);changed.push(locale);}
  }
  return{changed,locales:LOCALES.slice(),keyCount:Object.keys(TRANSLATIONS.de).length};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const result=patchRepository();
  console.log(`TaskPlanner V2 workflow i18n prepared for ${result.locales.join(', ')} (${result.keyCount} keys)`);
}
