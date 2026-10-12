import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const workflowDir=path.join(process.cwd(),'.github','workflows');

function workflowFiles(){
  return fs.readdirSync(workflowDir)
    .filter(name=>/\.ya?ml$/i.test(name))
    .sort();
}

function directMainPushes(){
  const offenders=[];
  for(const name of workflowFiles()){
    const source=fs.readFileSync(path.join(workflowDir,name),'utf8');
    const lines=source.split(/\r?\n/);
    lines.forEach((line,index)=>{
      const normalized=line.trim();
      if(/\bgit\s+push\b[^\n]*\b(?:HEAD:)?main\b/i.test(normalized)){
        offenders.push(`${name}:${index+1}: ${normalized}`);
      }
    });
  }
  return offenders;
}

test('GitHub Actions dürfen main nicht direkt per git push verändern',()=>{
  assert.deepEqual(
    directMainPushes(),
    [],
    'Direkte main-Pushes umgehen PR-Herkunft, Review-/CI-Gates und RC1473.'
  );
});

test('Diagnose-Autofix bereitet Änderungen über einen Pull Request vor',()=>{
  const source=fs.readFileSync(path.join(workflowDir,'diagnostic-autofix.yml'),'utf8');
  assert.match(source,/pull-requests:\s*write/,'Autofix braucht PR-Schreibrecht statt direktem main-Push.');
  assert.match(source,/gh\s+pr\s+create\b/,'Autofix muss für Codeänderungen einen Pull Request erstellen.');
  assert.match(source,/echo "diagnostic_id=\$diagnostic_id" >> "\$GITHUB_OUTPUT"/,'Die Diagnose-ID muss vor dem Löschen des temporären Arbeitsverzeichnisses als Step-Output gesichert werden.');
  assert.match(source,/diagnostic_id="\$\{\{ steps\.commit\.outputs\.diagnostic_id \}\}"/,'Der PR muss die gesicherte Diagnose-ID verwenden.');
  assert.doesNotMatch(source,/\bgit\s+push\b[^\n]*\b(?:HEAD:)?main\b/i,'Autofix darf main nicht direkt beschreiben.');
});
