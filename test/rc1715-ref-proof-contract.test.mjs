import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('REF upload must validate file identity, name and byte count before success',()=>{
 const source=readFileSync(new URL('../api/shared/reference-folder-upload.js',import.meta.url),'utf8');
 assert.match(source,/GRAPH_REFERENCE_FILE_UNVERIFIED/);
 assert.match(source,/itemName!==file/);
 assert.match(source,/itemSize!==buffer.length/);
 assert.match(source,/!itemId/);
});
