import {test,expect} from '@playwright/test';
import fs from 'node:fs';

test('RC1604: 15 Abholungen passen im A4-Druck ohne horizontalen Beschnitt',async({page},testInfo)=>{
  test.skip(testInfo.project.name!=='desktop','Druckgeometrie wird einmal mit Chromium Desktop geprüft');

  await page.setViewportSize({width:794,height:1123});
  await page.setContent('<!doctype html><html lang="de"><head><meta charset="utf-8"></head><body data-exporthub-view="shipmentoverview"></body></html>');
  await page.evaluate(()=>{
    window.__EXPORTHUB_GET_STATE__=()=>({
      shipments:Array.from({length:15},(_,i)=>({
        reference:'AB'+String(i+1).padStart(4,'0'),
        customerName:i===0?'Extra langer Kunde mit mehreren Worten & sehr langem Firmennamen':('Beispielkunde '+i),
        status:'Bereit zur Abholung',
        warehousePrepared:i!==1,
        warehouseLocationCode:i===0?3:7,
        plannedPickupDate:'2026-10-20'
      }))
    });
  });
  const src=fs.readFileSync('assets/rc1546-pickup-control.js','utf8');
  await page.addScriptTag({content:src});
  await page.evaluate(()=>window.ExportHUBRC1546PickupControl.openControl());
  await page.emulateMedia({media:'print'});

  const model=await page.evaluate(()=>{
    const panel=document.querySelector('.rc1546-dialog');
    const print=document.querySelector('.rc1546-print-only');
    const screen=document.querySelector('.rc1546-screen-only');
    const table=document.querySelector('.rc1546-print-table');
    const cells=[...table.querySelectorAll('th,td')];
    const b=table.getBoundingClientRect(),container=panel.getBoundingClientRect();
    return{
      printDisplay:getComputedStyle(print).display,
      screenDisplay:getComputedStyle(screen).display,
      headers:[...table.querySelectorAll('th')].map(x=>x.textContent.trim()),
      rowCount:table.tBodies[0].rows.length,
      tableLayout:getComputedStyle(table).tableLayout,
      fitsContainer:b.left>=container.left-1&&b.right<=container.right+1,
      tableOverflows:table.scrollWidth>table.clientWidth+1,
      clippingCells:cells.filter(c=>c.scrollWidth>c.clientWidth+2).length,
      handwrittenSlots:table.querySelectorAll('.rc1546-print-location-line').length,
      yesCount:table.querySelectorAll('.rc1546-print-pickup-box').length
    };
  });
  expect(model.printDisplay).not.toBe('none');
  expect(model.screenDisplay).toBe('none');
  expect(model.headers).toEqual(['REF','Kunde','Wo befindet sich die Ware?','Abgeholt?']);
  expect(model.rowCount).toBe(15);
  expect(model.tableLayout).toBe('fixed');
  expect(model.fitsContainer).toBe(true);
  expect(model.tableOverflows).toBe(false);
  expect(model.clippingCells).toBe(0);
  expect(model.handwrittenSlots).toBeGreaterThan(0);
  expect(model.yesCount).toBe(30);

  const pdf=await page.pdf({format:'A4',preferCSSPageSize:true,printBackground:true});
  expect(pdf.length).toBeGreaterThan(2000);
});
