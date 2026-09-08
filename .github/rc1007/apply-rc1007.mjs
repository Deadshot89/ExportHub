import fs from 'node:fs';

function patchFile(path,transform){
  const before=fs.readFileSync(path,'utf8');
  const after=transform(before);
  if(after===before){
    console.log(`${path}: keine Änderung erforderlich`);
    return false;
  }
  fs.writeFileSync(path,after,'utf8');
  console.log(`${path}: RC1007-Patch angewendet`);
  return true;
}

patchFile('api/shared/merge.js',(src)=>{
  if(/isoSops:\s*\['id',\s*'number',\s*'_syncId'\]/.test(src)) return src;
  const anchor="  customSops: ['id', 'name', '_syncId'],\n";
  if(!src.includes(anchor)) throw new Error('RC1007: customSops-Anker in merge.js nicht gefunden');
  return src.replace(anchor,anchor+"  isoSops: ['id', 'number', '_syncId'],\n");
});
