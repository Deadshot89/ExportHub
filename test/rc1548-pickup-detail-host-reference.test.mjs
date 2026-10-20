import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../assets/rc1546-pickup-control.js', import.meta.url), 'utf8');

function createSandbox(){
  const body = {
    getAttribute(name){ return name === 'data-exporthub-view' ? 'shipmentview' : null; },
    appendChild(){}
  };
  const document = {
    readyState: 'complete',
    body,
    head: { appendChild(){} },
    getElementById(){ return null; },
    createElement(){ return { id:'', textContent:'' }; },
    addEventListener(){}
  };
  const sandbox = {
    document,
    setTimeout(){ return 1; },
    clearTimeout(){},
    addEventListener(){},
    console
  };
  sandbox.window = sandbox;
  return sandbox;
}

test('shipment detail render does not throw when pickup detail host is not mounted yet', () => {
  const sandbox = createSandbox();
  assert.doesNotThrow(() => vm.runInNewContext(source, sandbox, { filename: 'rc1546-pickup-control.js' }));
});
