/*
 * ExportHUB360 Login Experience. Presentation-only enhancement:
 * never moves/removes the login form and never intercepts auth or environment events.
 */
(function(window,document){
  'use strict';
  if(window.__EXPORTHUB_RC1630_LOGIN_EXPERIENCE__)return;
  window.__EXPORTHUB_RC1630_LOGIN_EXPERIENCE__=true;
  var copy={
    de:{tag:'LOGISTIK. VERNETZT.',title:'Deine Versandzentrale. Alles im Blick.',description:'Sendungen, Dokumente und Abholungen an einem Ort. Starte mit einem klaren Überblick in deinen Arbeitstag.',features:['Sendungen','Zolldokumente','Abholungen'],subtitle:'Melde dich an, um deine Arbeit fortzusetzen.'},
    en:{tag:'LOGISTICS. CONNECTED.',title:'Your shipping hub. Everything in view.',description:'Shipments, documents and pickups in one place. Start your day with a clear overview.',features:['Shipments','Customs documents','Pickups'],subtitle:'Sign in to continue your work.'},
    pl:{tag:'LOGISTYKA. POŁĄCZONA.',title:'Twoje centrum wysyłek. Wszystko pod kontrolą.',description:'Przesyłki, dokumenty i odbiory w jednym miejscu. Rozpocznij dzień z pełnym przeglądem.',features:['Wysyłki','Dokumenty celne','Odbiory'],subtitle:'Zaloguj się, aby kontynuować pracę.'},
    es:{tag:'LOGÍSTICA. CONECTADA.',title:'Tu centro de envíos. Todo bajo control.',description:'Envíos, documentos y recogidas en un solo lugar. Empieza el día con una visión clara.',features:['Envíos','Documentos aduaneros','Recogidas'],subtitle:'Inicia sesión para continuar tu trabajo.'},
    fr:{tag:'LOGISTIQUE. CONNECTÉE.',title:'Votre centre d’expédition. Tout en vue.',description:'Expéditions, documents et enlèvements au même endroit. Commencez la journée avec une vue claire.',features:['Expéditions','Documents douaniers','Enlèvements'],subtitle:'Connectez-vous pour continuer votre travail.'},
    it:{tag:'LOGISTICA. CONNESSA.',title:'Il tuo centro spedizioni. Tutto sotto controllo.',description:'Spedizioni, documenti e ritiri in un unico posto. Inizia la giornata con una panoramica chiara.',features:['Spedizioni','Documenti doganali','Ritiri'],subtitle:'Accedi per continuare il lavoro.'}
  };
  function node(tag,className,text){
    var n=document.createElement(tag);
    if(className)n.className=className;
    if(typeof text==='string')n.textContent=text;
    return n;
  }
  function language(){
    var select=document.getElementById('loginLanguageSelect');
    var raw=select&&select.value||document.documentElement.lang||'de';
    var val=String(raw).toLowerCase().slice(0,2);
    return Object.prototype.hasOwnProperty.call(copy,val)?val:'de';
  }
  function translate(){
    var login=document.getElementById('login');
    if(!login||login.getAttribute('data-eh360-ui')!=='v2')return;
    var tr=copy[language()];
    var lookup={
      '.eh360-login-kicker':tr.tag,
      '.eh360-login-hero h2':tr.title,
      '.eh360-login-hero p':tr.description,
      '.eh360-login-subline':tr.subtitle
    };
    Object.keys(lookup).forEach(function(key){
      var el=login.querySelector(key);
      if(el&&el.textContent!==lookup[key])el.textContent=lookup[key];
    });
    var features=login.querySelectorAll('.eh360-login-features span');
    for(var i=0;i<features.length&&i<tr.features.length;i++){
      if(features[i].textContent!==tr.features[i])features[i].textContent=tr.features[i];
    }
  }
  function setup(){
    var login=document.getElementById('login');
    if(!login||login.getAttribute('data-eh360-ui')==='v2')return;
    var card=login.querySelector('.login-card');
    // Layout enhancement only when the known root structure is present.
    if(!card||card.parentNode!==login)return;
    var hero=node('section','eh360-login-hero');
    hero.setAttribute('aria-label','ExportHUB360');
    var kicker=node('div','eh360-login-kicker');
    var headline=node('h2');
    var desc=node('p');
    var art=node('img','eh360-login-art');
    art.src='/assets/rc1630-login-route.svg?v=1630';
    art.alt='';
    art.setAttribute('aria-hidden','true');
    art.setAttribute('loading','lazy');
    art.width=760;art.height=360;
    var features=node('div','eh360-login-features');
    for(var i=0;i<3;i++)features.appendChild(node('span'));
    hero.appendChild(kicker);
    hero.appendChild(headline);
    hero.appendChild(desc);
    hero.appendChild(art);
    hero.appendChild(features);
    login.insertBefore(hero,card);
    var h1=card.querySelector('h1');
    if(h1){
      // Brand only. All authentication, environment and status text stays owned by existing code.
      h1.textContent='ExportHUB360';
      var subline=node('p','eh360-login-subline');
      h1.insertAdjacentElement('afterend',subline);
    }
    login.setAttribute('data-eh360-ui','v2');
    translate();
    var lang=document.getElementById('loginLanguageSelect');
    if(lang)lang.addEventListener('change',translate);
    document.addEventListener('exporthub:language-changed',translate);
    window.addEventListener('languagechange',translate);
    // Existing i18n may set lang during startup, without changing the select via user input.
    if(window.MutationObserver){
      var obs=new MutationObserver(translate);
      obs.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});
  else setup();
})(window,document);
