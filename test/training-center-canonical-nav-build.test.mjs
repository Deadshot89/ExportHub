import test from 'node:test';
import assert from 'node:assert/strict';
import {replaceLegacySopRendererInBuild} from '../.github/training-center/build-three-env.mjs';

const start='function renderSop(){var r=root();if(!r)return;try{var model=window.ExportHubIsoSopModel;if(!model)throw new Error("RC1007 SOP-Modul nicht geladen")}catch(e){console.error(e)}}';
const source='<html><script>\n'+start+'\nwindow.rc524SelectSop=function(id){renderSop()};\n</script></html>';

test('Training Center build replaces the real IIFE-local legacy navigation renderer',()=>{
  const output=replaceLegacySopRendererInBuild(source);
  assert.match(output,/function renderSop\(\)\{var r=root\(\);if\(!r\)return;var tc=window\.ExportHubTrainingCenterRuntime/);
  assert.match(output,/tc\.start\(\);return/);
  assert.doesNotMatch(output,/ExportHubIsoSopModel/);
  assert.match(output,/window\.rc524SelectSop=function/);
});

test('Training Center release refuses to patch missing, changed or duplicate renderer bodies',()=>{
  assert.throws(()=>replaceLegacySopRendererInBuild('<html></html>'),/anchor missing/);
  assert.throws(()=>replaceLegacySopRendererInBuild(source+start+'\nwindow.rc524SelectSop='),/ambiguous/);
  assert.throws(()=>replaceLegacySopRendererInBuild(source.replace('RC1007 SOP-Modul nicht geladen','changed error')),/context changed/);
});
