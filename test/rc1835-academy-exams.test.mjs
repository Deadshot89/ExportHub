import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const build=fs.readFileSync('.github/rc1112/build-three-env.mjs','utf8');
const source=fs.readFileSync('assets/rc1835-academy-exams.js','utf8');
const styles=fs.readFileSync('assets/rc1835-academy-exams.css','utf8');

test('RC1835 assets are wired to all generated app entrypoints',()=>{
  assert.match(build,/patchRc1835LearningUi\(html,file\)/);
  assert.match(build,/html=patchRc1835LearningUi\(html,file\)/);
  assert.match(build,/rc1835-academy-exams\.css\?v=1835/);
  assert.match(build,/rc1835-academy-exams\.js\?v=1835/);
  assert.match(build,/data-rc1835-catalog-body/);
  assert.match(build,/view==='academy'/);
  assert.match(build,/view==='inspections'/);
  assert.match(build,/!u.activeAttempt/);
  assert.match(build,/fastViewMax=4/);
  assert.match(build,/!fastCacheable\(view\)/);
  assert.match(build,/region\.innerHTML!==body/);
  assert.match(styles,/#rc626Inspections \.ihk-cards/);
  assert.match(styles,/#content \.rc299-layout/);
  assert.match(styles,/@media\(max-width:600px\)/);
  assert.match(styles, /:focus-visible/);
});
test('RC1835 Academy area switches without rendering whole ExportHUB view',()=>{
  const state={view:'academy',rc299Area:'area-a'};
  let clickHandler=null,academyCalls=0,globalRenders=0;
  const oldList={scrollTop:95,innerHTML:'before',querySelector(selector){return selector==='button.active'?{setAttribute(key,value){this[key]=value;}}:null;}};
  const currentCards=[{innerHTML:'static header'},{innerHTML:'old question'}];
  const layout={querySelector(selector){return selector==='.rc299-area-list'?oldList:null;},
    querySelectorAll(selector){return selector===':scope > .card'?currentCards:[];}};
  const incomingList={innerHTML:'new area list'};
  const incomingCards=[{innerHTML:'other static header'},{innerHTML:'new question'}];
  const incomingLayout={querySelector(selector){return selector==='.rc299-area-list'?incomingList:null;},
    querySelectorAll(selector){return selector===':scope > .card'?incomingCards:[];}};
  const content={querySelector(selector){return selector==='.rc299-layout'?layout:null;}};
  const doc={getElementById(id){return id==='content'?content:null;},
    createElement(){return{set innerHTML(html){this._html=html;},querySelector(selector){return selector==='.rc299-layout'?incomingLayout:null;}};},
    addEventListener(name,handler,capture){if(name==='click'&&capture)clickHandler=handler;}};
  const root={document:doc,__EXPORTHUB_GET_STATE__:()=>state,
    academy(){academyCalls++;return'<div class="rc299-layout"></div>';},
    render(){globalRenders++;}};
  vm.runInNewContext(source,{window:root,globalThis:root});
  assert.equal(typeof clickHandler,'function');
  let prevented=0,stopped=0;
  const button={getAttribute(name){return name==='onclick'?"return rc299SelectArea('area-b')":'';}};
  const event={target:{closest(){return button;}},preventDefault(){prevented++;},
    stopImmediatePropagation(){stopped++;},stopPropagation(){}};
  clickHandler(event);
  assert.equal(state.rc299Area,'area-b');
  assert.equal(academyCalls,1);
  assert.equal(globalRenders,0);
  assert.equal(oldList.innerHTML,'new area list');
  assert.equal(oldList.scrollTop,95);
  assert.equal(currentCards[0].innerHTML,'static header');
  assert.equal(currentCards[1].innerHTML,'new question');
  assert.equal(prevented,1);
  assert.equal(stopped,1);
  clickHandler(event); // Same area is a no-op, not another rerender.
  assert.equal(academyCalls,1);
  state.view='inspections';
  clickHandler(event);
  assert.equal(academyCalls,1,'other pages must stay untouched');
});
test('RC1835 respects reduced-motion and light/dark contrast',()=>{
  assert.match(styles,/prefers-reduced-motion/);
  assert.match(styles,/data-eh-theme="dark"/);
});
