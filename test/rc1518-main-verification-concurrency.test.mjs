import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflowPath = '.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml';

function readWorkflow() {
  return readFileSync(workflowPath, 'utf8');
}

test('RC1518: Main Verification concurrency isolates different commit SHAs', () => {
  const workflow = readWorkflow();

  assert.match(
    workflow,
    /group:\s*exporthub-rc1112-three-env-\$\{\{\s*github\.ref\s*\}\}-\$\{\{\s*github\.sha\s*\}\}/,
    'Concurrency-Gruppe muss den Commit-SHA enthalten, damit ein spaeter neu gestarteter Alt-Run den aktuellen main-Run nicht abbrechen kann.'
  );

  assert.match(
    workflow,
    /cancel-in-progress:\s*true/,
    'Wiederholte Runs desselben Commits duerfen weiterhin ihren eigenen Vorgänger abbrechen.'
  );
});
