(function(w,d){
'use strict';
if(!w||!d||w.__EXPORTHUB_RC1454_AVIS_DOWNLOAD_ALL_UI__)return;
w.__EXPORTHUB_RC1454_AVIS_DOWNLOAD_ALL_UI__=true;
var STYLE_ID='exporthub-rc1454-avis-download-all-ui-style';
var LINK_SELECTOR='a.doc[href*="action=download-all"]';
var observer=null,queued=false;
function q(v){return String(v==null?'':v).trim()}
function installStyle(){
 if(d.getElementById(STYLE_ID))return;
 var style=d.createElement('style');style.id=STYLE_ID;
 style.textContent='.section-head .rc1454-bulk-download{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:40px;flex:0 0 auto;border:1px solid #0b5fa7;border-radius:10px;background:linear-gradient(180deg,var(--primary2,#2385cf),var(--primary,#0f6cbd));color:#fff;padding:8px 13px;text-decoration:none;font-size:12px;font-weight:800;line-height:1.2;box-shadow:0 4px 10px rgba(15,108,189,.16);transition:transform .13s ease,box-shadow .13s ease,filter .13s ease}.section-head .rc1454-bulk-download:before{content:"⇩";font-size:16px;line-height:1}.section-head .rc1454-bulk-download:hover{color:#fff;filter:brightness(1.04);transform:translateY(-1px);box-shadow:0 7px 16px rgba(15,108,189,.2)}@media(max-width:760px){.section-head .rc1454-bulk-download{width:100%;justify-self:stretch;margin-top:2px}}';
 (d.head||d.documentElement).appendChild(style);
}
function enhanceLink(link){
 if(!link||link.getAttribute('data-rc1454-bulk-download')==='1')return;
 var card=link.closest&&link.closest('.card'),head=card&&card.querySelector('.section-head');if(!head)return;
 var labelNode=link.querySelector('b'),label=q(labelNode&&labelNode.textContent)||q(link.textContent)||'Download ZIP';
 link.classList.remove('doc');link.classList.add('rc1454-bulk-download');
 link.setAttribute('data-rc1454-bulk-download','1');
 link.removeAttribute('target');link.setAttribute('download','');link.setAttribute('aria-label',label);link.textContent=label;
 head.appendChild(link);
}
function enhance(){installStyle();Array.from(d.querySelectorAll(LINK_SELECTOR)).forEach(enhanceLink)}
function schedule(){if(queued)return;queued=true;(w.requestAnimationFrame||w.setTimeout)(function(){queued=false;enhance()},0)}
function boot(){enhance();var root=d.getElementById('content')||d.body;if(!root||typeof MutationObserver!=='function')return;observer=new MutationObserver(schedule);observer.observe(root,{childList:true,subtree:true})}
if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window,document);
