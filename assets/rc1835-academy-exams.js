/* RC1835 – Academy area navigation updates only the learning panels. */
(function(root){
  'use strict';
  if(!root||!root.document||root.__EXPORTHUB_RC1835_ACADEMY__)return;
  root.__EXPORTHUB_RC1835_ACADEMY__=true;
  var doc=root.document;
  function state(){try{if(typeof root.__EXPORTHUB_GET_STATE__==='function')return root.__EXPORTHUB_GET_STATE__()||{};}catch(_){}
    return root.state||(root.ExportHUBClean&&root.ExportHUBClean.state)||{};}
  function academyLayout(){var content=doc.getElementById&&doc.getElementById('content');return content&&content.querySelector&&content.querySelector('.rc299-layout');}
  function areaId(button){var action=button&&button.getAttribute&&button.getAttribute('onclick')||'';var match=action.match(/\brc299SelectArea\(['"]([^'"]+)['"]\)/);return match?match[1]:'';}
  function areaChange(event){
    var target=event&&event.target,button=target&&target.closest&&target.closest('#content .rc299-area-list button');
    if(!button||typeof root.academy!=='function')return;
    var layout=academyLayout(),s=state(),id=areaId(button);
    if(!layout||!id)return;
    var currentView=String(s.view||s.currentView||s.activeView||'').toLowerCase();
    if(currentView&&currentView!=='academy')return;
    var prior=String(s.rc299Area||'');
    if(prior===id){event.preventDefault();event.stopImmediatePropagation();return false;}
    var oldList=layout.querySelector('.rc299-area-list'),cards=layout.querySelectorAll(':scope > .card');
    if(!oldList||cards.length!==2)return;
    // Render HTML detached from the live DOM. Never trigger the global render()
    // and never reset the Academy header, selected profession, year or scroll.
    var candidate,holder=doc.createElement('div');
    s.rc299Area=id;
    try{
      holder.innerHTML=root.academy();
      candidate=holder.querySelector('.rc299-layout');
      var incoming=candidate&&candidate.querySelectorAll(':scope > .card');
      var nextList=candidate&&candidate.querySelector('.rc299-area-list');
      if(!nextList||!incoming||incoming.length!==2)throw new Error('Academy-Bereich nicht verfügbar');
      var scrollTop=oldList.scrollTop;
      oldList.innerHTML=nextList.innerHTML;
      oldList.scrollTop=scrollTop;
      cards[1].innerHTML=incoming[1].innerHTML;
      var active=oldList.querySelector('button.active');
      if(active&&active.setAttribute)active.setAttribute('aria-current','true');
    }catch(_){
      s.rc299Area=prior;
      // Native navigation remains the fallback if a future Academy version
      // changes its DOM contract.
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    if(event.stopPropagation)event.stopPropagation();
    return false;
  }
  doc.addEventListener('click',areaChange,true);
  root.ExportHUBAcademyUX1835=Object.freeze({areaChange:areaChange});
})(typeof window!=='undefined'?window:globalThis);
