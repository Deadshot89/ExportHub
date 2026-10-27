(function(w){
'use strict';
// Existing printed pickup QRs use /?pickup=<token>; never boot the authenticated SPA for those links.
try{
 var current=new URL(w.location.href),params=current.searchParams;
 var legacy=String(params.get('ehcmd')||'').toLowerCase()==='pickup';
 if(!params.has('pickup')&&!legacy)return;
 var target=new URL('/pickup.html',current.origin);
 var raw=params.has('pickup')?params.get('pickup'):(params.get('token')||params.get('qr')||params.get('ref'));
 var token=String(raw||'').trim();
 // Invalid tokens must land on the public error page, not on the internal login website.
 if(!/^[A-Za-z0-9_-]{6,160}$/.test(token))token='invalid';
 target.searchParams.set('token',token);
 var env=String(params.get('environment')||'').toLowerCase();
 if(env==='production'||env==='testservice')target.searchParams.set('environment',env);
 w.location.replace(target.href);
}catch(_){/* An unavailable URL API must not trigger a privileged session or a write. */}
})(window);
