from pathlib import Path
import re
import shutil
import textwrap

ROOT=Path(__file__).resolve().parents[2]

def promote_api():
    stage=ROOT/'.github/rc995/stage/api'
    target=ROOT/'api'
    if not stage.is_dir():
        raise SystemExit('RC995 Stage-Verzeichnis fehlt')
    files=[p for p in stage.rglob('*') if p.is_file()]
    if not files:
        raise SystemExit('RC995 Stage enthält keine Dateien')
    for src in files:
        rel=src.relative_to(stage)
        dst=target/rel
        dst.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(src,dst)
        print('promote',rel)


def patch_public_access():
    p=ROOT/'api/shared/public-access-store.js'
    s=p.read_text(encoding='utf-8')
    old="crypto.randomBytes(32).toString('base64url')"
    if s.count(old)!=1:
        raise SystemExit(f'Public-Access Tokenanker nicht eindeutig: {s.count(old)}')
    s=s.replace(old,"crypto.randomBytes(24).toString('hex')",1)
    p.write_text(s,encoding='utf-8')


def patch_merge():
    p=ROOT/'api/shared/merge.js'
    s=p.read_text(encoding='utf-8')
    anchor="function isObject(value) {\n  return value && typeof value === 'object' && !Array.isArray(value);\n}\n"
    if 'function stripPublicAccessSecrets(' not in s:
        if s.count(anchor)!=1:
            raise SystemExit('merge.js isObject-Anker fehlt oder ist nicht eindeutig')
        block=textwrap.dedent("""
        const PUBLIC_ACCESS_SECRET_KEYS = ['customerAvisToken','avisToken','pickupToken','pickupQrToken','qrToken'];
        function stripPublicAccessSecrets(state) {
          if (!isObject(state)) return state;
          const out = clone(state) || {};
          const strip = (shipment) => {
            if (!isObject(shipment)) return shipment;
            const next = clone(shipment) || {};
            for (const key of PUBLIC_ACCESS_SECRET_KEYS) delete next[key];
            return next;
          };
          ['shipments','savedShipments','shipmentArchive','archivedShipments'].forEach((key) => {
            if (Array.isArray(out[key])) out[key] = out[key].map(strip);
          });
          ['shipment','currentShipment','selectedShipment'].forEach((key) => {
            if (isObject(out[key])) out[key] = strip(out[key]);
          });
          return out;
        }
        """)
        s=s.replace(anchor,anchor+'\n'+block,1)
    old="  out._teamSyncMeta = mergedMeta;\n  return out;\n}\n\nfunction mergeUsers"
    if old in s:
        s=s.replace(old,"  out._teamSyncMeta = mergedMeta;\n  return stripPublicAccessSecrets(out);\n}\n\nfunction mergeUsers",1)
    elif 'return stripPublicAccessSecrets(out);' not in s:
        raise SystemExit('mergeState Rückgabeanker fehlt')
    old="  out._teamSyncMeta.tombstones = normalizeTombstones(out._teamSyncMeta);\n  return out;\n}\n\nfunction pruneTombstones"
    if old in s:
        s=s.replace(old,"  out._teamSyncMeta.tombstones = normalizeTombstones(out._teamSyncMeta);\n  return stripPublicAccessSecrets(out);\n}\n\nfunction pruneTombstones",1)
    p.write_text(s,encoding='utf-8')


def patch_client():
    p=ROOT/'TESTVERSION.html'
    s=p.read_text(encoding='utf-8')
    build_old="var BUILD=Object.freeze({version:'RC994',cache:'994',loginReturn:'/TESTVERSION.html?v=994'});"
    build_new="var BUILD=Object.freeze({version:'RC995',cache:'995',loginReturn:'/TESTVERSION.html?v=995'});"
    if s.count(build_old)!=1:
        raise SystemExit(f'RC994 BUILD-Anker nicht eindeutig: {s.count(build_old)}')
    s=s.replace(build_old,build_new,1)

    done="function done(data,compat){var beforeDone=syncSnapshot(sh)"
    done995="function done(data,compat){var serverToken=q(data&&data.token);if(!/^[a-f0-9]{48}$/i.test(serverToken))throw new Error('RC995: Der Server hat keinen gültigen sicheren Pickup-Token geliefert.');token=serverToken;patchCopies(sh,{pickupToken:serverToken,pickupQrToken:serverToken});var beforeDone=syncSnapshot(sh)"
    if s.count(done)!=1:
        raise SystemExit(f'Pickup done-Anker nicht eindeutig: {s.count(done)}')
    s=s.replace(done,done995,1)

    qr="return'<div class=\"index351-qr-box\" data-qr-token=\"'+token+'\">'+svg+'<span>QR-Abholung</span></div>'"
    qr995="return'<div class=\"index351-qr-box\" data-rc995-print-qr=\"pickup\">'+svg+'<span>QR-Abholung</span></div>'"
    if s.count(qr)!=1:
        raise SystemExit(f'Pickup QR-Markup-Anker nicht eindeutig: {s.count(qr)}')
    s=s.replace(qr,qr995,1)

    if s.count('SECURITY_VERSION=2')<1:
        raise SystemExit('Avis SECURITY_VERSION-Anker fehlt')
    s=s.replace('SECURITY_VERSION=2','SECURITY_VERSION=995',1)
    enabled="function enabled(sh){var a=avisSnapshot(sh);return !!(a.active&&a.token&&a.securityVersion>=SECURITY_VERSION&&a.enabledAt&&!pickupStamp(a.source||sh)&&!expired(a.source||sh))}"
    enabled995="function enabled(sh){var a=avisSnapshot(sh);return !!(a.active&&a.securityVersion>=SECURITY_VERSION&&a.enabledAt&&!pickupStamp(a.source||sh)&&!expired(a.source||sh))}"
    if s.count(enabled)!=1:
        raise SystemExit(f'Avis enabled-Anker nicht eindeutig: {s.count(enabled)}')
    s=s.replace(enabled,enabled995,1)

    render_toggle="function render(){return false}\nasync function toggle(on)"
    helper=textwrap.dedent("""function render(){return false}
    function rc995AvisHeaders(){var rt=window.ExportHUBClean&&window.ExportHUBClean.runtime||{},t=q(rt.authToken||'');if(!t)throw new Error('ExportHUB-Sitzung ist nicht mehr gültig.');return{'Content-Type':'application/json','Accept':'application/json','Cache-Control':'no-cache','X-ExportHUB-Token':t,'X-ExportHUB-Session':t,'Authorization':'Bearer '+t,'X-ExportHUB-Environment':/-testservice\\./i.test(String(location.hostname||''))?'testservice':'production'}}
    async function rc995AvisAction(action,sh){var payload={action:action,shipmentId:id(sh),reference:ref(sh),environment:/-testservice\\./i.test(String(location.hostname||''))?'testservice':'production'},r=await fetch('/api/customer-avis',{method:'POST',credentials:'same-origin',cache:'no-store',headers:rc995AvisHeaders(),body:JSON.stringify(payload)}),data=await r.json().catch(function(){return{}});if(!r.ok)throw new Error(q(data.message)||('HTTP '+r.status));return data}
    async function toggle(on)""")
    if s.count(render_toggle)!=1:
        raise SystemExit(f'Avis toggle-Anker nicht eindeutig: {s.count(render_toggle)}')
    s=s.replace(render_toggle,helper,1)
    pattern=r"async function toggle\(on\)\{.*?\}\nasync function autoDisableIfDue\(\)"
    matches=list(re.finditer(pattern,s,re.S))
    if len(matches)!=1:
        raise SystemExit(f'Avis toggle-Funktion nicht eindeutig: {len(matches)}')
    replacement=textwrap.dedent("""async function toggle(on){var sh=current();if(!sh)return false;if(on&&pickupStamp(sh)){alert('Der Lieferavis ist nach der Abholung geschlossen und kann nicht erneut aktiviert werden.');return false}if(on&&!ref(sh)){alert('Die Sendung benötigt zuerst eine Referenznummer.');return false}try{var data=await rc995AvisAction(on?'issue':'disable',sh),stamp=new Date().toISOString(),values=on?{customerAvisEnabled:true,avisEnabled:true,customerAvisToken:q(data.token),avisToken:q(data.token),customerAvisSecurityVersion:995,avisSecurityVersion:995,customerAvisEnabledAt:stamp,avisEnabledAt:stamp,customerAvisExpiresAt:q(data.expiresAt),avisExpiresAt:q(data.expiresAt),customerAvisDisabledAt:'',avisDisabledAt:'',customerAvisResponseStatus:'offen',avisResponseStatus:'offen'}:{customerAvisEnabled:false,avisEnabled:false,customerAvisToken:'',avisToken:'',customerAvisSecurityVersion:0,avisSecurityVersion:0,customerAvisDisabledAt:stamp,avisDisabledAt:stamp};patchCopies(sh,values);lastSig='';render();window.dispatchEvent(new CustomEvent('exporthub:customer-avis-updated',{detail:{reference:ref(sh),enabled:on,version:'RC995'}}));try{if(window.ExportHUBMailStatus373&&typeof window.ExportHUBMailStatus373.patch==='function')window.ExportHUBMailStatus373.patch('Kunden-Avis RC995 geändert')}catch(_){}schedule();return false}catch(e){alert('Kunden-Avis konnte nicht geändert werden.\\n\\n'+q(e&&e.message||e));return false}}
    async function autoDisableIfDue()""")
    m=matches[0]
    s=s[:m.start()]+replacement+s[m.end():]

    if '<!-- exporthub-rc995-public-access -->' in s:
        raise SystemExit('RC995 Clientblock ist bereits vorhanden')
    block=textwrap.dedent("""
    <!-- exporthub-rc995-public-access -->
    <style id="exporthub-rc995-print-qr">
    .index351-qr-box[data-rc995-print-qr="pickup"]{display:none!important}
    @media print{
      .index351-qr-box[data-rc995-print-qr="pickup"]{display:none!important}
      html:not([data-rc995-pdf="1"]) .index351-qr-box[data-rc995-print-qr="pickup"][data-rc995-print-first="1"]{display:flex!important;width:28mm!important;max-width:28mm!important;min-width:28mm!important;height:auto!important;flex-direction:column!important;gap:1.2mm!important;align-items:center!important;break-inside:avoid!important}
      html:not([data-rc995-pdf="1"]) .index351-qr-box[data-rc995-print-qr="pickup"][data-rc995-print-first="1"] .rc569-qr-svg{width:26mm!important;height:26mm!important;max-width:26mm!important;max-height:26mm!important}
      html:not([data-rc995-pdf="1"]) .index351-qr-box[data-rc995-print-qr="pickup"][data-rc995-print-first="1"] span{font-size:8pt!important;line-height:1.1!important}
    }
    </style>
    <script id="exporthub-rc995-public-access">
    (function(){
    'use strict';
    if(window.__EXPORTHUB_RC995_PUBLIC_ACCESS__)return;window.__EXPORTHUB_RC995_PUBLIC_ACCESS__=true;
    window.RC995_PDF_NO_QR=true;
    window.rc995PdfMode=false;
    window.RC995_CUSTOMER_CONFIRMATION_AVIS_ONLY=true;
    function pickupQrs(){return Array.prototype.slice.call(document.querySelectorAll('.index351-qr-box[data-rc995-print-qr="pickup"]'))}
    function clear(){pickupQrs().forEach(function(n){n.removeAttribute('data-rc995-print-first')})}
    function beforePrint(){clear();document.documentElement.removeAttribute('data-rc995-pdf');var list=pickupQrs();if(list.length)list[0].setAttribute('data-rc995-print-first','1')}
    function afterPrint(){clear()}
    window.addEventListener('beforeprint',beforePrint);
    window.addEventListener('afterprint',afterPrint);
    window.ExportHUBRC995=Object.freeze({version:'RC995',printOnlyPickupQr:true,pdfQr:false,customerConfirmation:'customer-avis-only',beforePrint:beforePrint,afterPrint:afterPrint});
    })();
    </script>
    <!-- /exporthub-rc995-public-access -->
    """)
    anchor='<script id="exporthub-rc352-qr-pod-controller">'
    if s.count(anchor)!=1:
        raise SystemExit(f'RC995 sicherer Pickup-Controller-Anker nicht eindeutig: {s.count(anchor)}')
    s=s.replace(anchor,block+'\n'+anchor,1)
    p.write_text(s,encoding='utf-8')


def main():
    production=(ROOT/'production-version.js').read_text(encoding='utf-8')
    if 'RC990' not in production or 'RC995' in production:
        raise SystemExit('Produktionsmarker ist nicht sauber auf RC990 fixiert')
    promote_api()
    patch_public_access()
    patch_merge()
    patch_client()
    print('RC995 apply complete')

if __name__=='__main__':
    main()
