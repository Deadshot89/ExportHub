import {test,expect} from '@playwright/test';
import {appEntry,waitReady} from '../helpers/exporthub-browser.mjs';

// RC1560: the POD PDF is rendered by html2canvas inside an isolated iframe that only receives the RC352
// document style. A real driver signature (1000×360 JPEG from pickup.html) then appeared in full size and
// covered the loading list (e.g. Ladeliste e6apce). This spec checks the geometry inside that PDF frame.
test('RC1560: Fahrerunterschrift bleibt im POD-PDF-Rahmen kompakt, Palettenkonto steht unten rechts',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='laptop','POD-PDF wird einmal im echten Chromium geprüft.');
  test.setTimeout(90_000);
  await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
  await waitReady(page);

  const result=await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=360;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1000,360);ctx.strokeStyle='#000';ctx.lineWidth=7;
    ctx.beginPath();for(let i=0;i<110;i++){const x=60+i*8,y=180+110*Math.sin(i/5);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y)}ctx.stroke();
    const sig=canvas.toDataURL('image/jpeg',.78);

    const sh=window.__EXPORTHUB_GET_STATE__().shipments[0];
    const pickup={complete:true,driverName:'Balletanu',licensePlate:'KÜN R 764',loaderName:'Daniel Ollmann',confirmedAt:'2026-10-17T08:41:00.000Z',signatureData:sig,returnedEuroPallets:0};
    Object.assign(sh,{status:'Abgeholt',freigabe:'Abgeholt',pickedUp:true,driverName:pickup.driverName,licensePlate:pickup.licensePlate,loaderName:pickup.loaderName,
      signatureData:sig,driverSignature:sig,pickupDriverSignature:sig,signatureAvailable:true,palletOut:2,pickupConfirmedAt:pickup.confirmedAt,pickupHistory:[pickup]});

    let measured=null;
    const hook=frame=>{
      const w=frame&&frame.contentWindow;if(!w||w.__rc1560Hooked)return;w.__rc1560Hooked=true;
      w.html2canvas=async node=>{
        const box=el=>{const r=el.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
        const cards=[...node.querySelectorAll('.rc390-sign')].map(card=>({label:String((card.querySelector('.rc390-label')||{}).textContent||'').trim(),box:box(card)}));
        const img=node.querySelector('.rc1503-signature-value .rc1305-signature-image');
        const sigCard=img&&img.closest('.rc390-sign');
        const pallet=node.querySelector('[data-rc1560-pallet-card]');
        measured={cards,image:img&&box(img),natural:img&&{w:img.naturalWidth,h:img.naturalHeight},signatureCard:sigCard&&box(sigCard),
          palletHint:!!node.querySelector('.rc1095-pallet-account'),palletText:pallet?String(pallet.innerText||'').replace(/\s+/g,' ').trim():'',palletIsBottomCard:!!(pallet&&pallet.matches('.rc929-proof-pallet'))};
        const out=node.ownerDocument.createElement('canvas');out.width=1588;out.height=2246;return out;
      };
    };
    const observer=new MutationObserver(()=>document.querySelectorAll('iframe.index352-pdf-frame').forEach(hook));
    observer.observe(document.body,{childList:true,subtree:true});
    document.querySelectorAll('iframe.index352-pdf-frame').forEach(hook);
    let error='';
    try{await window.ExportHUBIndex240.createPodBlob(sh)}catch(e){error=String(e&&e.message||e)}
    observer.disconnect();
    return{error,measured};
  });

  expect(result.error).toBe('');
  expect(result.measured,'POD-PDF-Rahmen wurde nicht gerendert').toBeTruthy();
  const {cards,image,natural,signatureCard}=result.measured;
  expect(image,'Signaturbild fehlt im POD').toBeTruthy();
  expect(natural.w,'Testsignatur muss die reale Canvas-Größe haben').toBe(1000);
  expect(image.height,'Signaturbild darf maximal 15mm hoch sein').toBeLessThanOrEqual(58);
  expect(image.height,'Signaturbild muss sichtbar bleiben').toBeGreaterThan(20);
  expect(image.right,'Signaturbild darf nicht aus dem Feld ragen').toBeLessThanOrEqual(signatureCard.right+1);
  expect(image.bottom,'Signaturbild darf nicht aus dem Feld ragen').toBeLessThanOrEqual(signatureCard.bottom+1);
  expect(signatureCard.height,'Unterschriftsfeld muss kompakt bleiben').toBeLessThanOrEqual(110);
  const others=cards.filter(c=>!/unterschrift/i.test(c.label));
  expect(others.length).toBeGreaterThanOrEqual(5);
  for(const other of others){
    const x=Math.min(signatureCard.right,other.box.right)-Math.max(signatureCard.left,other.box.left);
    const y=Math.min(signatureCard.bottom,other.box.bottom)-Math.max(signatureCard.top,other.box.top);
    expect(x>1&&y>1,'Unterschriftsfeld überlappt '+other.label).toBe(false);
  }
  expect(result.measured.palletHint,'Palettenkonto darf nicht mehr über dem Ladelisten-Kopf stehen').toBe(false);
  expect(result.measured.palletIsBottomCard,'Palettenkonto gehört in das Europaletten-Feld unten rechts').toBe(true);
  expect(result.measured.palletText).toMatch(/Palettenkonto \/ EUR pallet balance/i);
  expect(result.measured.palletText).toMatch(/Europaletten \/ (?:Balanced|In favour of)/i);
  expect(result.measured.palletText).toMatch(/Ausgang: 2 · Eingang\/Rückgabe: 0/);
});
