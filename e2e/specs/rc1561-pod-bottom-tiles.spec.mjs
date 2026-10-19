import {test,expect} from '@playwright/test';
import {appEntry,waitReady} from '../helpers/exporthub-browser.mjs';

// RC1561: .rc390-bottom (Unterschrift, Fahrer, Datum, Kennzeichen, Verlader, Palettenkonto) was absolutely
// pinned to the page bottom. With many positions and delivery notes (e.g. POD Y8Z6DM) the content above grew
// into it and the tiles overlapped the table, delivery notes and remark. Checked inside the real POD PDF frame.
for(const rowsCount of [1,12]){
  test(`RC1561: untere POD-Kacheln überlappen nichts (${rowsCount} Positionen)`,async({page},testInfo)=>{
    test.skip(testInfo.project.name!=='laptop','POD-PDF wird einmal im echten Chromium geprüft.');
    test.setTimeout(90_000);
    await page.goto(appEntry(),{waitUntil:'domcontentloaded'});
    await waitReady(page);

    const result=await page.evaluate(async n=>{
      const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=360;
      const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,1000,360);ctx.strokeStyle='#000';ctx.lineWidth=7;
      ctx.beginPath();for(let i=0;i<110;i++){const x=60+i*8,y=180+110*Math.sin(i/5);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y)}ctx.stroke();
      const sig=canvas.toDataURL('image/jpeg',.78);

      const sh=window.__EXPORTHUB_GET_STATE__().shipments[0];
      const rows=Array.from({length:n},(_,i)=>({type:i%2?'Karton':'Europalette',count:i+1,weight:100+i,length:120,width:80,height:100}));
      const pickup={complete:true,driverName:'Balletanu Constantin',licensePlate:'KÜN R 764 / TR 22',loaderName:'Daniel Ollmann',confirmedAt:'2026-10-17T08:41:00.000Z',signatureData:sig,returnedEuroPallets:0};
      Object.assign(sh,{rows,packages:rows,comments:'Bitte vorsichtig behandeln, Ware ist zerbrechlich. '.repeat(n>6?4:1),
        status:'Abgeholt',freigabe:'Abgeholt',pickedUp:true,driverName:pickup.driverName,licensePlate:pickup.licensePlate,loaderName:pickup.loaderName,
        signatureData:sig,driverSignature:sig,pickupDriverSignature:sig,signatureAvailable:true,palletOut:2,pickupConfirmedAt:pickup.confirmedAt,pickupHistory:[pickup],
        deliveryNotes:Array.from({length:n*2},(_,i)=>'Lieferschein_'+(80000000+i)+'.pdf')});

      let measured=null;
      const hook=frame=>{
        const w=frame&&frame.contentWindow;if(!w||w.__rc1561Hooked)return;w.__rc1561Hooked=true;
        w.html2canvas=async node=>{
          const box=el=>{const r=el.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
          const label=el=>String((el.querySelector('.rc390-label,th')||el).textContent||'').replace(/\s+/g,' ').trim().slice(0,40);
          const page=node.matches('.rc390-load')?node:node.querySelector('.rc390-load');
          const out=node.ownerDocument.createElement('canvas');out.width=1588;out.height=2246;
          if(!page)return out;
          const tiles=[...node.querySelectorAll('.rc390-bottom .rc390-sign')].map(el=>({label:label(el),box:box(el)}));
          const content=[...page.querySelectorAll('.rc390-card,.rc390-box,table,[data-rc1305-documents],[data-rc1305-remark]')]
            .filter(el=>!el.closest('.rc390-bottom')).map(el=>({label:label(el),box:box(el)})).filter(x=>x.box.width>2&&x.box.height>2);
          const grid=page.querySelector('[data-rc1504-document-columns]');
          measured={page:box(page),tiles,content,gridColumns:grid?getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length:0,
            gridDisplay:grid?getComputedStyle(grid).display:''};
          return out;
        };
      };
      const observer=new MutationObserver(()=>document.querySelectorAll('iframe.index352-pdf-frame').forEach(hook));
      observer.observe(document.body,{childList:true,subtree:true});
      document.querySelectorAll('iframe.index352-pdf-frame').forEach(hook);
      let error='';
      try{await window.ExportHUBIndex240.createPodBlob(sh)}catch(e){error=String(e&&e.message||e)}
      observer.disconnect();
      return{error,measured};
    },rowsCount);

    expect(result.error).toBe('');
    expect(result.measured,'POD-PDF-Rahmen wurde nicht gerendert').toBeTruthy();
    const {page:pageBox,tiles,content}=result.measured;
    expect(tiles.length,'Untere Kacheln fehlen').toBeGreaterThanOrEqual(6);
    expect(content.length,'Inhaltsblöcke fehlen').toBeGreaterThanOrEqual(4);
    const lowestContent=Math.max(...content.map(c=>c.box.bottom));
    for(const tile of tiles){
      expect(tile.box.top,`Kachel "${tile.label}" muss unter dem Inhalt beginnen`).toBeGreaterThanOrEqual(lowestContent-1);
      expect(tile.box.bottom,`Kachel "${tile.label}" muss innerhalb der Seite bleiben`).toBeLessThanOrEqual(pageBox.bottom+1);
      for(const other of content){
        const x=Math.min(tile.box.right,other.box.right)-Math.max(tile.box.left,other.box.left);
        const y=Math.min(tile.box.bottom,other.box.bottom)-Math.max(tile.box.top,other.box.top);
        expect(x>1&&y>1,`Kachel "${tile.label}" überlappt "${other.label}"`).toBe(false);
      }
    }
    if(rowsCount>=6){
      expect(result.measured.gridDisplay).toBe('grid');
      expect(result.measured.gridColumns,'Viele Lieferscheine stehen im PDF zweispaltig').toBe(2);
    }
  });
}
