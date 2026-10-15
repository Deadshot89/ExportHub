import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {integrateGuidedWorkspace,GUIDED_MARKERS} from '../.github/rc1544/integrate-guided-workspace.mjs';

const ROOT=process.cwd();

function count(value,needle){return String(value).split(needle).length-1;}

test('RC1544: Injection benutzt reale letzte HTML-Endtags und zerstört keine Inline-JavaScript-Strings',()=>{
  const out=fs.mkdtempSync(path.join(os.tmpdir(),'rc1544-injection-'));
  try{
    const inline=`<script>const bodyToken='</body>';const headToken='</head>';window.__RC1544_INLINE_OK__=bodyToken+headToken;</script>`;
    const html=`<!doctype html><html><head><meta charset="utf-8">${inline}</head><body><main>ExportHUB</main></body></html>`;
    for(const file of ['index.html','TESTVERSION.html','demo.html'])fs.writeFileSync(path.join(out,file),html);

    integrateGuidedWorkspace(ROOT,out);

    for(const file of ['index.html','TESTVERSION.html','demo.html']){
      const built=fs.readFileSync(path.join(out,file),'utf8');
      assert.ok(built.includes(`const bodyToken='</body>';const headToken='</head>';`),`${file}: Inline-JavaScript wurde durch Injection beschädigt`);
      assert.equal(count(built,'</body>'),2,`${file}: ursprünglicher String plus echter body-Endtag müssen erhalten bleiben`);
      assert.equal(count(built,'</head>'),2,`${file}: ursprünglicher String plus echter head-Endtag müssen erhalten bleiben`);
      for(const marker of GUIDED_MARKERS)assert.equal(count(built,`id="${marker}"`),1,`${file}: ${marker} muss genau einmal vorkommen`);
      const realBodyClose=built.toLowerCase().lastIndexOf('</body>');
      const guidedScript=built.indexOf('id="exporthub-rc1544-sop-guided-workspace"');
      assert.ok(guidedScript>built.indexOf('</script>')&&guidedScript<realBodyClose,`${file}: Guided-Script muss vor dem echten letzten body-Endtag stehen`);
    }
  }finally{
    fs.rmSync(out,{recursive:true,force:true});
  }
});
