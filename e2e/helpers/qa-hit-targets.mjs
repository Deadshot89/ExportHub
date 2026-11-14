// QA F03 (13.11.2026): Prüft, ob sichtbare Klickziele an ihrem Mittelpunkt wirklich
// selbst getroffen werden (elementFromPoint) und nicht von festen Leisten, Toasts
// oder schwebenden Schaltflächen überdeckt sind. Ein Treffer gilt erst als Fehler,
// wenn das Ziel nach dem Zentrieren im Viewport weiterhin verdeckt ist. Normales
// Unterscrollen einer Sticky-Leiste ist also kein Befund.
export function installHitProbe(){
  const SELECTOR='button,a[href],[role="button"],[role="tab"],[role="menuitem"],input:not([type=hidden]),select,textarea,[data-view],summary';
  const describe=el=>{
    if(!el)return 'null';
    let s=el.tagName.toLowerCase();
    if(el.id)s+='#'+el.id;
    const c=typeof el.className==='string'?el.className.trim().split(/\s+/).filter(Boolean).slice(0,2).join('.'):'';
    if(c)s+='.'+c;
    const label=String(el.getAttribute('aria-label')||el.textContent||'').trim().replace(/\s+/g,' ').slice(0,40);
    return label?s+' "'+label+'"':s;
  };
  const insideClosedDetails=el=>{
    for(let d=el.parentElement&&el.parentElement.closest('details');d;d=d.parentElement&&d.parentElement.closest('details')){
      const summary=el.closest('summary');
      if(!d.open&&!(summary&&summary.parentElement===d))return true;
    }
    return false;
  };
  const visibleCenter=el=>{
    const cs=getComputedStyle(el);
    if(cs.visibility!=='visible'||cs.pointerEvents==='none'||cs.display==='none'||Number(cs.opacity)===0)return null;
    const r=el.getBoundingClientRect();
    if(r.width<4||r.height<4)return null;
    let L=Math.max(r.left,0),T=Math.max(r.top,0),R=Math.min(r.right,innerWidth),B=Math.min(r.bottom,innerHeight);
    for(let a=el.parentElement;a&&a!==document.documentElement;a=a.parentElement){
      const s=getComputedStyle(a);
      if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)return null;
      if(s.overflowX!=='visible'||s.overflowY!=='visible'){
        const q=a.getBoundingClientRect();
        L=Math.max(L,q.left);T=Math.max(T,q.top);R=Math.min(R,q.right);B=Math.min(B,q.bottom);
      }
    }
    if(R-L<4||B-T<4)return null;
    return {x:(L+R)/2,y:(T+B)/2};
  };
  const coveredBy=el=>{
    const point=visibleCenter(el);
    if(!point)return null;
    const hit=document.elementFromPoint(point.x,point.y);
    if(!hit||hit===el||el.contains(hit))return null;
    if(hit.tagName==='LABEL'&&(hit.contains(el)||hit.control===el))return null;
    if(el.id&&hit.closest(`label[for="${CSS.escape(el.id)}"]`))return null;
    return hit;
  };
  const candidates=()=>[...document.querySelectorAll(SELECTOR)].filter(el=>
    !el.disabled&&!el.closest('[inert],[aria-hidden="true"]')&&!insideClosedDetails(el)&&coveredBy(el));
  window.__qaHitTargets=async function(){
    const findings=[];
    const startY=scrollY;
    for(const el of candidates()){
      el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
      await new Promise(resolve=>setTimeout(resolve,40));
      if(!el.isConnected)continue;
      const hit=coveredBy(el);
      if(hit)findings.push({target:describe(el),coveredBy:describe(hit)});
    }
    window.scrollTo({top:startY,behavior:'instant'});
    return findings;
  };
}
