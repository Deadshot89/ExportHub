(function(){
'use strict';
if(window.__EXPORTHUB_RELEASE_BRIDGE_V2__)return;
window.__EXPORTHUB_RELEASE_BRIDGE_V2__=true;
var API='/api/exporthub-release',KEY='exporthub_test_portal_requested',busy=false,poll=0;
function q(v){return String(v==null?'':v).trim()}
function low(v){return q(v).toLowerCase()}
function runtime(){return window.ExportHUBClean&&window.ExportHUBClean.runtime||{}}
function token(){return q(runtime().authToken)}
function user(){var r=runtime();try{return (typeof window.__EXPORTHUB_GET_CURRENT_USER__==='function'&&window.__EXPORTHUB_GET_CURRENT_USER__())||r.user||window.currentUser||{}}catch(_){return r.user||window.currentUser||{}}}
function globalAdmin(){var u=user(),role=low(u&&(u.role||u.rolle||u.level||u.type)),name=low(u&&(u.user||u.login||u.username||u.name||u.displayName)),p=Array.isArray(u&&u.permissions)?u.permissions:[];return !!u&&(u.globalAdmin===true||u.isAdmin===true||u.admin===true||name==='tobias'||/global.?admin|administrator|vollzugriff|admin/.test(role)||p.indexOf('*')>=0)}
function headers(extra){var h=Object.assign({Accept:'application/json'},extra||{}),t=token();if(t){h['X-ExportHUB-Token']=t;h['X-ExportHUB-Session']=t;h.Authorization='Bearer '+t}return h}
async function call(action,opt){opt=opt||{};var u=API+'?action='+encodeURIComponent(action)+(opt.query?'&'+opt.query:'')+'&_='+Date.now(),r=await fetch(u,{method:opt.method||'GET',credentials:'same-origin',cache:'no-store',headers:headers(opt.headers),body:opt.body});var ct=low(r.headers.get('content-type')||''),d={};if(ct.indexOf('application/json')>=0){try{d=await r.json()}catch(_){d={}}}else{d={message:await r.text()}}if(!r.ok||d&&d.ok===false){var e=new Error(d&&d.message||('Release-API HTTP '+r.status));e.status=r.status;throw e}return d||{ok:true}}
function requested(){try{return sessionStorage.getItem(KEY)==='1'}catch(_){return false}}
function setRequested(v){try{if(v)sessionStorage.setItem(KEY,'1');else sessionStorage.removeItem(KEY)}catch(_){} }
function marker(ver,channel){return '<script>window.__EXPORTHUB_RELEASE_STREAMED__=true;window.__EXPORTHUB_RELEASE_CHANNEL__='+JSON.stringify(channel)+';window.__EXPORTHUB_RELEASE_VERSION__='+JSON.stringify(ver)+';<\\/script>'}
function bridgeTag(){return '<script src="/release-bridge.js?v=2"><\\/script>'}
function sanitize(html,asShell){html=String(html||'');if(asShell){html=html.replace(/<script[^>]+id=["']rc504-static-test-channel["'][^>]*>[\s\S]*?<\/script>/i,'')}return html}
function inject(html,ver,channel,asShell){html=sanitize(html,!!asShell);if(!/<html[\s>]/i.test(html)||html.indexOf('exporthub-canonical-build-source')<0)throw new Error('Die RC-Datei ist kein gültiges ExportHUB-Dokument.');window.__EXPORTHUB_RELEASE_STREAMED__=true;window.__EXPORTHUB_RELEASE_CHANNEL__=channel;window.__EXPORTHUB_RELEASE_VERSION__=ver;html=/<head(?:\s[^>]*)?>/i.test(html)?html.replace(/<head(\s[^>]*)?>/i,function(m,a){return '<head'+(a||'')+'>'+marker(ver,channel)}):marker(ver,channel)+html;if(html.indexOf('/release-bridge.js')<0)html=/<\/body>/i.test(html)?html.replace(/<\/body>/i,bridgeTag()+'</body>'):html+bridgeTag();try{if(poll)clearInterval(poll);delete window.__EXPORTHUB_RELEASE_BRIDGE_V2__}catch(_){window.__EXPORTHUB_RELEASE_BRIDGE_V2__=false}document.open('text/html','replace');document.write(html);document.close();return true}
async function loadTest(version){if(busy)return false;if(!token())return false;if(!globalAdmin()){setRequested(false);alert('Das Testportal ist ausschließlich für Global Admin freigegeben.');return false}busy=true;try{setRequested(true);if(q(version))await call('set-test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:q(version).toUpperCase()})});var m=await call('active',{query:'channel=test'}),ver=q(m.version).toUpperCase();if(!ver)throw new Error('Es ist keine aktive Testversion ausgewählt.');var r=await fetch(API+'?action=html&channel=test&_='+Date.now(),{credentials:'same-origin',cache:'no-store',headers:headers({Accept:'text/html'})});if(!r.ok)throw new Error((await r.text())||('Testversion HTTP '+r.status));return inject(await r.text(),ver,'test',false)}catch(e){alert('Testversion konnte nicht geöffnet werden.\n\n'+q(e&&e.message));return false}finally{busy=false}}
function production(){setRequested(false);location.href='/?_='+Date.now();return false}
function decorateShell(){var b=document.getElementById('releaseTestPortalBtn');if(requested()&&b){b.classList.add('active');b.textContent='✓ Testportal ausgewählt';b.setAttribute('aria-pressed','true')}var st=document.getElementById('cleanLoginStatus');if(requested()&&st&&!token()){st.textContent='Testportal ausgewählt. Bitte als Global Admin anmelden. Danach wird die aktive Testversion geladen.';st.className='clean-login-status bad'}}
function installOverrides(){
 window.rc503SetTest=function(ver){loadTest(ver);return false};
 window.rc503OpenTestPortal=function(){loadTest();return false};
 window.ExportHUBReleaseSwitch=Object.freeze({loadTest:loadTest,backToProduction:production});
 var back=document.getElementById('rc503BackToMain');if(back)back.onclick=production;
}
function testButtonClick(e){var b=e.target&&e.target.closest&&e.target.closest('#releaseTestPortalBtn');if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();setRequested(true);decorateShell();if(token()){if(globalAdmin())loadTest();else{setRequested(false);alert('Das Testportal ist ausschließlich für Global Admin freigegeben.')}}return false}
function watch(){installOverrides();decorateShell();if(requested()&&q(window.__EXPORTHUB_RELEASE_CHANNEL__)!=='test'&&token()){if(globalAdmin())loadTest();else{setRequested(false);alert('Das Testportal ist ausschließlich für Global Admin freigegeben.')}}}
installOverrides();
window.addEventListener('click',testButtonClick,true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch,{once:true});else watch();
['exporthub:ready','exporthub:viewchange','exporthub:rendered'].forEach(function(n){window.addEventListener(n,watch)});
poll=setInterval(watch,500);
})();
