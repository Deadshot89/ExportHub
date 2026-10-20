import {test,expect} from '@playwright/test';
import {appEntry,waitReady,attachRuntimeGuards,assertRuntimeClean} from '../helpers/exporthub-browser.mjs';

test('RC1547: viele Positionen und Anhänge bleiben vollständig auf genau einer A4-Ladeliste',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','Der A4-Druckfit wird einmal im echten Chromium geprüft.');
  test.setTimeout(45_000);
  const guard=attachRuntimeGuards(page,testInfo);

  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);
  await page.emulateMedia({media:'print'});

  const result=await page.evaluate(()=>{
    const api=window.ExportHUBRC1305LoadingListPrint;
    if(!api||typeof api.enhance!=='function')throw new Error('RC1547 Ladelisten-Runtime fehlt');

    const positions=Array.from({length:18},(_,i)=>
      '<tr data-position-row="1"><td>'+(i+1)+'</td><td>Gestapelte Euro Palette '+(i+1)+'</td><td>2</td><td>120 × 80 × 220</td><td>180,0</td><td>0,20</td><td>0,40</td></tr>'
    ).join('');
    const deliveryFiles=Array.from({length:28},(_,i)=>({name:'DNC_'+String(i+1).padStart(2,'0')+'_Kundenauftrag_'+(47110000+i)+'.pdf'}));
    const raw='<section class="rc390-page rc390-load" style="box-sizing:border-box;width:194mm;height:281mm;max-height:281mm;min-height:281mm;margin:0;padding:8mm;overflow:visible">'+
      '<div data-rc1547-header style="height:78mm">Kopfbereich Ladeliste</div>'+
      '<table style="width:100%;border-collapse:collapse"><thead><tr><th>Pos.</th><th>Verpackung</th><th>Anzahl</th><th>Maße</th><th>Gewicht</th><th>LDM</th><th>LDM gesamt</th></tr></thead><tbody>'+positions+'</tbody></table>'+
      '<div class="rc390-card"><div class="rc390-label">Lieferscheine / DNCs</div><div class="rc390-txt"></div></div>'+
      '<div data-rc1547-footer style="height:48mm">Unterschrift Fahrer · Fahrername · Datum / Uhrzeit · Kennzeichen · Verlader · Palettenkonto</div>'+
      '</section>';

    document.body.innerHTML=api.enhance(raw,{reference:'FIT001',deliveryFiles});
    const root=document.querySelector('.rc390-load');
    if(!root)throw new Error('RC1547 Ladeliste wurde nicht gerendert');
    const rows=Array.from(root.querySelectorAll('tbody tr'));
    const docs=Array.from(root.querySelectorAll('[data-rc1293-packing-slip]'));
    const all=rows.concat(docs);
    const rects=all.map(node=>node.getBoundingClientRect());
    let overlap=false;
    for(let i=0;i<docs.length;i++)for(let j=i+1;j<docs.length;j++){
      const a=docs[i].getBoundingClientRect(),b=docs[j].getBoundingClientRect();
      const x=Math.min(a.right,b.right)-Math.max(a.left,b.left),y=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
      if(x>1&&y>1)overlap=true;
    }
    const rootRect=root.getBoundingClientRect();
    const descendants=Array.from(root.querySelectorAll('*')).filter(node=>getComputedStyle(node).display!=='none');
    const visualBottom=Math.max(rootRect.top,...descendants.map(node=>node.getBoundingClientRect().bottom));
    const mm=d=>{const probe=document.createElement('div');probe.style.cssText='position:absolute;visibility:hidden;height:'+d+'mm';document.body.appendChild(probe);const px=probe.getBoundingClientRect().height;probe.remove();return px};
    const pageHeight=mm(281);
    return{
      singlePage:root.getAttribute('data-rc1547-single-page'),
      positionCount:root.getAttribute('data-rc1547-position-count'),
      documentCount:root.getAttribute('data-rc1547-document-count'),
      fitScale:Number(root.getAttribute('data-rc1547-fit-scale')||1),
      zoom:Number.parseFloat(getComputedStyle(root).zoom||root.style.zoom||'1'),
      rows:rows.length,
      docs:docs.length,
      overlap,
      allVisible:rects.every(r=>r.width>0&&r.height>0),
      visualHeight:visualBottom-rootRect.top,
      pageHeight
    };
  });

  expect(result.singlePage).toBe('1');
  expect(result.positionCount).toBe('18');
  expect(result.documentCount).toBe('28');
  expect(result.rows,'Keine Verpackungsposition darf verschwinden').toBe(18);
  expect(result.docs,'Kein Lieferschein/DNC darf verschwinden').toBe(28);
  expect(result.fitScale,'Bei dieser Datenmenge muss die Ladeliste verdichtet werden').toBeLessThan(1);
  expect(result.zoom).toBeLessThan(1);
  expect(result.overlap,'Anhänge dürfen sich nicht überlappen').toBe(false);
  expect(result.allVisible,'Positionen und Anhänge müssen messbar sichtbar bleiben').toBe(true);
  expect(result.visualHeight,'Die sichtbare Ladeliste darf die A4-Nutzfläche nicht überschreiten').toBeLessThanOrEqual(result.pageHeight+3);

  await assertRuntimeClean(guard,testInfo);
});
