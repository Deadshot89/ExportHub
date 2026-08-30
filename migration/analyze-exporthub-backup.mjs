#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {buildMigrationPackage,summarizePackage} from '../shared/migration-core.js';

const input=process.argv[2];
if(!input){
  console.error('Verwendung: npm run analyze -- /pfad/ExportHUB_Backup.json [ausgabe.json]');
  process.exit(2);
}
const output=process.argv[3] || path.join(path.dirname(input),'ExportHUB_Professional_Migration_Package.json');
const text=await fs.readFile(input,'utf8');
let payload;
try{payload=JSON.parse(text)}catch(e){console.error('Backup ist kein gültiges JSON.');process.exit(3)}
const pkg=await buildMigrationPackage(payload,text);
await fs.writeFile(output,JSON.stringify(pkg,null,2),'utf8');
const s=summarizePackage(pkg);
console.log(JSON.stringify({output,...s,gates:pkg.manifest.gates},null,2));
if(!pkg.manifest.gates.readOnlyReady) process.exitCode=4;
