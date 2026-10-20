(function(root){
  'use strict';
  if(!root||root.ExportHUBPackagingAdmin)return;
  const doc=root.document;if(!doc)return;
  // Packaging is maintained in one place only: Administration › Stammdaten › Verpackungen (rc1555-packaging-management.js).
  // The "Verpackungen" tab in the Packmeldungen inbox opens that central master data view instead of its own editor.
  const CENTRAL_SRC='/assets/rc1555-packaging-management.js?v=1555';
  const q=v=>String(v==null?'':v).trim();
  const TEXT={
    de:{tab:'Verpackungen',adminOnly:'Nur Administratoren dürfen Verpackungen verwalten.',unavailable:'Die Verpackungs-Stammdaten konnten nicht geöffnet werden.'},
    en:{tab:'Packaging',adminOnly:'Only administrators may manage packaging.',unavailable:'The packaging master data could not be opened.'},
    pl:{tab:'Opakowania',adminOnly:'Tylko administratorzy mogą zarządzać opakowaniami.',unavailable:'Nie udało się otworzyć danych podstawowych opakowań.'},
    es:{tab:'Embalajes',adminOnly:'Solo los administradores pueden gestionar embalajes.',unavailable:'No se pudieron abrir los datos maestros de embalajes.'},
    fr:{tab:'Emballages',adminOnly:'Seuls les administrateurs peuvent gérer les emballages.',unavailable:'Impossible d’ouvrir les données de base des emballages.'},
    it:{tab:'Imballaggi',adminOnly:'Solo gli amministratori possono gestire gli imballaggi.',unavailable:'Impossibile aprire i dati anagrafici degli imballaggi.'}
  };
  function lang(){try{const v=root.ExportHUBPackI18n&&root.ExportHUBPackI18n.language&&root.ExportHUBPackI18n.language();if(TEXT[v])return v;}catch(_){}const v=q(doc.documentElement&&doc.documentElement.lang).slice(0,2).toLowerCase();return TEXT[v]?v:'de';}
  function t(k){return TEXT[lang()][k]||TEXT.de[k]||k;}
  function currentUser(){try{if(typeof root.__EXPORTHUB_GET_CURRENT_USER__==='function')return root.__EXPORTHUB_GET_CURRENT_USER__()||{};}catch(_){}try{if(root.ExportHUBClean&&root.ExportHUBClean.runtime&&root.ExportHUBClean.runtime.user)return root.ExportHUBClean.runtime.user;}catch(_){}try{const s=typeof root.__EXPORTHUB_GET_STATE__==='function'?root.__EXPORTHUB_GET_STATE__()||{}:{};return s.currentUser||s.user||{};}catch(_){return{};}}
  function norm(v){return q(v).toLocaleLowerCase('de-DE').normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
  function globalAdmin(){const u=currentUser()||{},role=norm(u.role||u.rolle||u.level||u.type),perms=Array.isArray(u.permissions)?u.permissions:[];return u.globalAdmin===true||u.isGlobalAdmin===true||u.admin===true||perms.includes('*')||['global admin','globaler administrator','globaler admin','administrator','admin','vollzugriff'].includes(role);}
  function section(){return doc.getElementById('packNotificationInbox');}
  function notify(message){const s=section(),node=s&&s.querySelector('[data-packaging-message]');if(node){node.textContent=message;node.setAttribute('data-kind','error');return;}try{root.alert&&root.alert(message);}catch(_){}}
  function central(){const api=root.ExportHUBPackagingManagement1555;return api&&typeof api.open==='function'?Promise.resolve(api):loadCentral();}
  function loadCentral(){return new Promise(resolve=>{const done=()=>resolve(root.ExportHUBPackagingManagement1555||null);let script=doc.getElementById('exporthub-rc1555-packaging-management-lazy');if(!script){script=doc.createElement('script');script.id='exporthub-rc1555-packaging-management-lazy';script.src=CENTRAL_SRC;script.defer=true;(doc.head||doc.documentElement).appendChild(script);}script.addEventListener('load',done,{once:true});script.addEventListener('error',done,{once:true});root.setTimeout&&root.setTimeout(done,2500);});}
  function show(){if(!globalAdmin()){notify(t('adminOnly'));return Promise.resolve(false);}return central().then(api=>{if(!api){notify(t('unavailable'));return false;}api.open();return true;});}
  function hide(){const api=root.ExportHUBPackagingManagement1555;if(api&&typeof api.close==='function')api.close();}
  function load(){const api=root.ExportHUBPackagingManagement1555;return api&&typeof api.load==='function'?api.load():Promise.resolve();}
  function decorate(){const s=section();if(!s||!globalAdmin())return false;const tabs=s.querySelector('.pack-admin-tabs');if(!tabs)return false;let btn=tabs.querySelector('[data-packaging-admin-open]');if(!btn){btn=doc.createElement('button');btn.type='button';btn.setAttribute('data-packaging-admin-open','');tabs.appendChild(btn);}btn.textContent=t('tab');btn.title='Management → Stammdaten → '+t('tab');return true;}
  function click(event){const open=event.target&&event.target.closest&&event.target.closest('#packNotificationInbox [data-packaging-admin-open]');if(!open)return;event.preventDefault();show();}
  function schedule(){root.setTimeout&&root.setTimeout(decorate,0);}
  doc.addEventListener('click',click,true);
  if(typeof root.addEventListener==='function')for(const name of ['exporthub:pack-inbox-opened','exporthub:state-updated','exporthub:pack-language-changed'])root.addEventListener(name,schedule);
  root.ExportHUBPackagingAdmin=Object.freeze({decorate,show,hide,load});
  schedule();
})(typeof window!=='undefined'?window:globalThis);
