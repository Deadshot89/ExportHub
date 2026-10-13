import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../assets/rc1371-dashboard-personalization.js',import.meta.url),'utf8');

function load(extra={}){
  const localStorage={getItem:()=>null,setItem(){},removeItem(){}};
  const window={localStorage,...extra};
  window.window=window;
  const context={window,localStorage,console,JSON,String,Array,Object,Map,Set,Date,Math,Number,Boolean,RegExp,encodeURIComponent,decodeURIComponent};
  vm.runInNewContext(source,context,{filename:'rc1371-dashboard-personalization.js'});
  return window.ExportHUBDashboard1371;
}

test('RC1371 waehlt den Dashboard-Inhaltsbereich statt des Navigationsbuttons',()=>{
  const navButton={id:'nav-dashboard'};
  const content={id:'content'};
  const body={getAttribute(name){return name==='data-exporthub-view'?'dashboard':null}};
  const document={
    body,
    readyState:'loading',
    addEventListener(){},
    querySelector(selector){
      if(selector==='[data-view="dashboard"]')return navButton;
      if(selector==='#content')return content;
      return null;
    }
  };
  const api=load({document,__EXPORTHUB_GET_STATE__:()=>({view:'dashboard'})});
  assert.equal(api.discoverDashboardRoot(),content);
});
