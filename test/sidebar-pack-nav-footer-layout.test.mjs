import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const nav=fs.readFileSync('assets/pack-notification-nav.js','utf8');
const theme=fs.readFileSync('assets/rc1304-theme-switcher.css','utf8');

function fakeElement(tag){
  const el={tagName:tag.toUpperCase(),children:[],attributes:{},style:{props:{},setProperty(k,v){this.props[k]=v;}},className:'',textContent:'',innerHTML:'',
    setAttribute(k,v){this.attributes[k]=String(v);},getAttribute(k){return this.attributes[k]??null;},removeAttribute(k){delete this.attributes[k];},
    appendChild(child){this.children.push(child);return child;},insertBefore(child,ref){const i=this.children.indexOf(ref);if(i<0)this.children.push(child);else this.children.splice(i,0,child);return child;},
    get firstChild(){return this.children[0]||null;},
    querySelector(sel){
      const match=node=>{
        if(sel==='svg')return /<svg/.test(node.innerHTML)?node:null;
        if(sel.startsWith('.'))return String(node.className).split(/\s+/).includes(sel.slice(1))?node:null;
        const attr=sel.match(/^\[([^\]=]+)\]$/);return attr&&attr[1] in node.attributes?node:null;
      };
      for(const child of this.children){const hit=match(child)||child.querySelector(sel);if(hit)return hit;}
      return null;
    }};
  return el;
}

function loadNavApi(){
  const head=fakeElement('head');
  const document={head,documentElement:head,body:fakeElement('body'),readyState:'complete',getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],createElement:fakeElement,addEventListener(){}};
  const root={document,setTimeout:()=>0,clearTimeout(){},addEventListener(){},ExportHUBPackStationAdmin:{},ExportHUBPackagingAdmin:{}};
  root.window=root;
  vm.runInNewContext(nav,{window:root,globalThis:root,Promise,Object,Array,String,Boolean});
  return {api:root.ExportHUBPackNotificationNav,head};
}

test('Packmeldungen uses the same icon tile and label classes as the other sidebar entries',()=>{
  const {api}=loadNavApi();
  const button=fakeElement('button');
  api.setPackNavIcon(button);api.setPackNavLabel(button);
  const [icon,label]=button.children;
  assert.ok(String(icon.className).split(/\s+/).includes('index308-nav-icon'),'icon must be an index308 tile like Aufgaben');
  assert.match(icon.innerHTML,/^<svg /,'icon must be a line SVG, not the bare ▣ glyph');
  assert.ok(!/▣/.test(icon.innerHTML+icon.textContent));
  assert.ok(icon.getAttribute('data-menu-accent'),'icon needs a menu accent for the tile colour');
  assert.ok(String(label.className).split(/\s+/).includes('index308-nav-label'));
  assert.equal(label.textContent,'Packmeldungen');
});

test('An entry rendered by an older runtime (bare ▣ glyph) is upgraded to the icon tile',()=>{
  const {api}=loadNavApi();
  const button=fakeElement('button');
  const old=fakeElement('span');old.className='pack-notification-nav-icon';old.setAttribute('data-pack-notifications-icon','');old.textContent='▣';
  button.appendChild(old);
  api.setPackNavIcon(button);
  assert.equal(button.children.length,1,'the existing icon is reused, not duplicated');
  assert.ok(String(old.className).split(/\s+/).includes('index308-nav-icon'));
  assert.match(old.innerHTML,/<svg /);
});

test('Packmeldungen gets the same flex row layout as entries owned by the index305 menu',()=>{
  assert.match(nav,/#nav\.nav\[data-index305-authoritative=\\?"1\\?"\]>button\[data-pack-notifications-nav\]:not\(\[hidden\]\)\{display:flex!important/);
  assert.match(nav,/button\[data-pack-notifications-nav\]>span:first-child\{width:20px;text-align:center;flex:0 0 20px\}/);
  assert.match(nav,/\.pack-notification-nav-fallback \.pack-notification-nav-icon\{display:inline-flex/,'the standalone icon style must only apply to the fallback button outside the menu');
});

test('Sidebar footer: user card and Stammdaten link are never squeezed by the flex column',()=>{
  const block=theme.match(/\.sidebar>\.brand,\s*\.sidebar>\.profile,\s*\.sidebar>\.rc1555-packaging-nav-wrap\{([^}]*)\}/);
  assert.ok(block,'footer flex rule missing in rc1304-theme-switcher.css');
  assert.match(block[1],/flex-shrink:0!important/);
  assert.match(theme,/\.sidebar>\.profile\{\s*min-height:max-content!important;?\s*\}/);
});
