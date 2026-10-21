import {test,expect} from '@playwright/test';
import {appEntry,waitReady} from '../helpers/exporthub-browser.mjs';

test('RC1607 P0: signed original from actual loadHtml fits below four DNCs without giant image or overlapping boxes',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','Real A4 POD frame runs once in Chromium');
  test.setTimeout(100_000);
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);

  const result=await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=360;
    const pen=canvas.getContext('2d');pen.fillStyle='#fff';pen.fillRect(0,0,1000,360);
    pen.strokeStyle='#111';pen.lineWidth=9;pen.beginPath();
    for(let i=0;i<100;i++){const x=28+i*9.4,y=180+112*Math.sin(i/8);if(i)pen.lineTo(x,y);else pen.moveTo(x,y)}
    pen.stroke();
    const ink=canvas.toDataURL('image/jpeg',.81);
    const sh=window.__EXPORTHUB_GET_STATE__().shipments[0];
    const pickup={complete:true,confirmedAt:'2026-10-07T13:43:00.000Z',driverName:'Oplocki',licensePlate:'MGPL803',loaderName:'Carsten Nellesen',signatureData:ink,returnedEuroPallets:0};
    Object.assign(sh,{
      status:'Abgeholt',freigabe:'Abgeholt',pickedUp:true,goodsDescription:'Plastic Parts',
      updatedAt:'2026-10-21T16:50:27.000Z',
      deliveryFiles:[{name:'DNC3019223442'},{name:'DNC3019223446'},{name:'DNC3019223491'},{name:'DNC3019223538'}],
      deliveryNotes:'DNC3019223442\nDNC3019223446\nDNC3019223491\nDNC3019223538',
      driverName:pickup.driverName,licensePlate:pickup.licensePlate,loaderName:pickup.loaderName,
      signatureData:ink,driverSignature:ink,pickupDriverSignature:ink,signatureAvailable:true,
      pickupConfirmedAt:pickup.confirmedAt,pickupHistory:[pickup]
    });
    const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,top:r.top,left:r.left,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
    let measured=null;
    const hook=frame=>{
      const w=frame&&frame.contentWindow;if(!w||w.__rc1607Hooked)return;w.__rc1607Hooked=true;
      w.html2canvas=async node=>{
        const footer=node.querySelector('.rc390-bottom'),list=node.querySelector('.rc390-table')?.nextElementSibling;
        const cards=[...node.querySelectorAll('.rc390-bottom .rc390-sign')];
        measured={
          footer:footer&&rect(footer),previous:list&&rect(list),
          qrDisplay:footer&&w.getComputedStyle(footer.querySelector('.rc390-qrslot')).display,
          columns:footer&&w.getComputedStyle(footer).gridTemplateColumns,
          cards:cards.map(card=>({
            label:(card.querySelector('.rc390-label')?.textContent||'').trim(),
            rect:rect(card),text:(card.innerText||'').trim().replace(/\s+/g,' '),
            legacyLines:[...card.querySelectorAll('.rc390-line,.rc390-hint')].filter(x=>w.getComputedStyle(x).display!=='none').length,
            images:[...card.querySelectorAll('img.index352-proof-signature,img.rc1305-signature-image')].filter(img=>img.getClientRects().length>0).map(rect)
          })),
          notes:[...node.querySelectorAll('.rc390-chip')].map(el=>el.textContent.trim()),
          debugText:(node.innerText||'').slice(-550),
          pages:[...node.ownerDocument.querySelectorAll('.rc390-load')].length
        };
        const out=node.ownerDocument.createElement('canvas');out.width=1588;out.height=2246;return out;
      };
    };
    const observer=new MutationObserver(()=>document.querySelectorAll('iframe.index352-pdf-frame').forEach(hook));
    observer.observe(document.body,{childList:true});
    document.querySelectorAll('iframe.index352-pdf-frame').forEach(hook);
    let error='';
    try{await window.ExportHUBIndex240.createPodBlob(sh)}catch(e){error=String(e&&e.message||e)}
    observer.disconnect();
    return{error,measured};
  });

  expect(result.error).toBe('');
  expect(result.measured,'Actual signed POD must reach isolated index352 PDF frame').toBeTruthy();
  const {footer,previous,cards,qrDisplay,notes}=result.measured;
  for(const dnc of ['DNC3019223442','DNC3019223446','DNC3019223491','DNC3019223538']){
    const text=result.measured.debugText;
    expect(text.split(dnc).length-1,'All 4 genuine document entries must render once in the signed A4: '+text).toBe(1);
  }
  expect(qrDisplay,'QR belongs to cover, not signed loading list').toBe('none');
  expect(cards.length,'Signature, driver, date, plate, loader and pallets expected').toBe(6);
  expect(footer.height,'Fixed two-row pickup footer must stay compact').toBeLessThan(230);
  expect(footer.top,'Signature footer must follow the delivery note cards').toBeGreaterThanOrEqual(previous.bottom-1);
  expect(cards.every(c=>c.rect.height<=105),'No pickup tile may extend down the A4 page').toBe(true);
  const signature=cards.find(c=>/unterschrift/i.test(c.label));
  expect(signature,'Driver signature box exists').toBeTruthy();
  expect(signature.images.length,'Only one visible original signature image').toBe(1);
  const image=signature.images[0];
  expect(image.height,'Original 1000x360 JPEG must fit inside 12mm').toBeLessThanOrEqual(48);
  expect(image.right).toBeLessThanOrEqual(signature.rect.right+1);
  expect(image.bottom).toBeLessThanOrEqual(signature.rect.bottom+1);
  for(let i=0;i<cards.length;i++)for(let j=i+1;j<cards.length;j++){
    const a=cards[i].rect,b=cards[j].rect;
    const x=Math.min(a.right,b.right)-Math.max(a.left,b.left);
    const y=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
    expect(x>1&&y>1,cards[i].label+' and '+cards[j].label+' must not overlap').toBe(false);
  }
  for(const label of ['Fahrername','Datum / Uhrzeit','Kennzeichen','Verlader']){
    const card=cards.find(c=>c.label.startsWith(label));
    expect(card,label+' exists').toBeTruthy();
    expect(card.legacyLines,label+' has no duplicate original/hint rows').toBeLessThanOrEqual(1);
  }
});
