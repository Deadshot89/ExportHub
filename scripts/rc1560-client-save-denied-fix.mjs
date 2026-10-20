import fs from 'node:fs';
import assert from 'node:assert/strict';

function replaceOnce(source, before, after, path) {
  const count = source.split(before).length - 1;
  assert.equal(count, 1, path + ': expected one occurrence of ' + before.slice(0, 65));
  return source.replace(before, after);
}

const oldSkip = "function skipForbiddenSave(){runtime.pendingSave=false;runtime.dirty=false;if(runtime.saveTimer){native.clearTimeout(runtime.saveTimer);runtime.saveTimer=null}const info=by('saveInfo');if(info)info.textContent='Nur Leserechte · Änderung wird nicht in Azure gespeichert';return false}";
const newSkip = "function skipForbiddenSave(){runtime.pendingSave=!!(runtime.pendingSave||runtime.dirty);runtime.dirty=runtime.pendingSave;if(runtime.saveTimer){native.clearTimeout(runtime.saveTimer);runtime.saveTimer=null}if(runtime.saveRetryTimer){native.clearTimeout(runtime.saveRetryTimer);runtime.saveRetryTimer=null}const info=by('saveInfo');if(info)info.textContent=runtime.pendingSave?'Nicht in Azure gespeichert · Änderung weiterhin offen · Berechtigung prüfen':'Azure-Speicherung wegen fehlender Berechtigung gesperrt';return false}";
const oldDenied = "else if(code==='WRITE_FORBIDDEN'){";
const newDenied = "else if(code==='WRITE_FORBIDDEN'||code==='STATE_MODULE_WRITE_FORBIDDEN'){";

for (const path of ['index.html', 'TESTVERSION.html']) {
  let source = fs.readFileSync(path, 'utf8');
  if (source.includes(newSkip) && source.includes(newDenied)) continue;
  source = replaceOnce(source, oldSkip, newSkip, path);
  source = replaceOnce(source, oldDenied, newDenied, path);
  fs.writeFileSync(path, source);
  console.log(path + ': denied errors handled; unsaved changes retained');
}

const testPath = 'test/diagnose-export-fixes.test.mjs';
let tests = fs.readFileSync(testPath, 'utf8');
if (!tests.includes('STATE_MODULE_WRITE_FORBIDDEN')) {
  const lines = tests.split('\n');
  let changedDenial = 0, changedFlags = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("assert.match(save,/else if\\(code==='WRITE_FORBIDDEN'")) {
      lines[i] = "    assert.match(save,/else if\\(code==='WRITE_FORBIDDEN'\\|\\|code==='STATE_MODULE_WRITE_FORBIDDEN'\\)\\{runtime\\.saveRetryCount=0;runtime\\.writeForbiddenUser=currentUserKey\\(\\);skipForbiddenSave\\(\\);if\\(options\\.userInitiated===true\\)alert\\(/);";
      changedDenial++;
    }
    if (lines[i].includes('assert.equal(runtime.pendingSave,false);assert.equal(runtime.dirty,false);')) {
      lines[i] = lines[i].replace('assert.equal(runtime.pendingSave,false);assert.equal(runtime.dirty,false);',
        "assert.equal(runtime.pendingSave,true,'Unsaved changes stay pending');assert.equal(runtime.dirty,true,'Unsaved edits cannot be marked clean');");
      changedFlags++;
    }
  }
  assert.equal(changedDenial, 1, 'expected one denied-code assertion');
  assert.equal(changedFlags, 1, 'expected one unsaved marker assertion');
  tests = lines.join('\n');
  fs.writeFileSync(testPath, tests);
  console.log(testPath + ': test expectations updated');
}
