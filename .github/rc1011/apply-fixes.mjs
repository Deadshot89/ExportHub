import fs from 'node:fs';

function countOf(source,needle){return source.split(needle).length-1}
function replaceExact(file,from,to){
  let src=fs.readFileSync(file,'utf8');
  if(src.includes(to)){console.log(file+': bereits angewendet');return false}
  const count=countOf(src,from);
  if(count!==1)throw new Error(`${file}: erwartete genau 1 Fundstelle, gefunden ${count}: ${from.slice(0,120)}`);
  src=src.replace(from,to);
  fs.writeFileSync(file,src);
  console.log(file+': 1 Änderung angewendet');
  return true;
}
function replaceEvery(file,from,to,expected){
  let src=fs.readFileSync(file,'utf8');
  if(src.includes(to)&&countOf(src,from)===0){console.log(file+': bereits angewendet');return false}
  const count=countOf(src,from);
  if(count!==expected)throw new Error(`${file}: erwartete ${expected} Fundstellen, gefunden ${count}: ${from.slice(0,120)}`);
  src=src.split(from).join(to);
  fs.writeFileSync(file,src);
  console.log(`${file}: ${count} Änderungen angewendet`);
  return true;
}

for(const file of ['index.html','TESTVERSION.html']){
  replaceExact(file,
    '<label class="field">Sendungsreferenz<input id="rc542PalRef" placeholder="bei Ausgang Pflicht"></label>',
    '<label class="field">Sendungsreferenz optional<input id="rc542PalRef" placeholder="optional"></label>');
  replaceExact(file,
    "if(dir==='Ausgang'&&!ref)return alert('Für einen Ausgang ist die Sendungsreferenz Pflicht.');",
    '');
}

const policy='api/shared/user-policy.js';
replaceExact(policy,
  '\nfunction defaultRights(admin) {',
  `\nfunction isCompanyAdmin(user) {\n  const role = lower(user && (user.role || user.rolle));\n  return Boolean(user && (\n    user.companyAdmin === true ||\n    /company[\\s/_-]*(?:admin|administrator)/.test(role) ||\n    /firmen[\\s/_-]*(?:admin|administrator)/.test(role) ||\n    /(?:^|[\\s/_-])hse(?:$|[\\s/_-])/.test(role) ||\n    /sicherheits[\\s/_-]*verantwortlich/.test(role)\n  ));\n}\n\nfunction defaultRights(admin, companyAdmin = false) {`);
replaceExact(policy,
`    const allow = admin || id === 'start' || id === 'dashboard' || id === 'pickupcalendar';\n    result[id] = {\n      level: admin ? 'admin' : (allow ? 'view' : 'none'),\n      visible: allow,\n      read: allow,\n      edit: admin,\n      admin: admin,\n      functionAdmin: admin\n    };`,
`    const baseAllow = id === 'start' || id === 'dashboard' || id === 'pickupcalendar';\n    const level = admin ? 'admin' : (companyAdmin ? (id === 'update' ? 'none' : 'admin') : (baseAllow ? 'view' : 'none'));\n    const allow = level !== 'none';\n    result[id] = {\n      level,\n      visible: allow,\n      read: allow,
      edit: level === 'edit' || level === 'admin',\n      admin: level === 'admin',\n      functionAdmin: level === 'admin'\n    };`);
replaceExact(policy,
`  result.rights = {\n    level: admin ? 'admin' : 'none', visible: !!admin, read: !!admin,\n    edit: !!admin, admin: !!admin, functionAdmin: !!admin\n  };`,
`  const companyManager = admin || companyAdmin;\n  result.rights = {\n    level: companyManager ? 'admin' : 'none', visible: companyManager, read: companyManager,\n    edit: companyManager, admin: companyManager, functionAdmin: companyManager\n  };`);
replaceExact(policy,'function normalizeRights(value, admin) {','function normalizeRights(value, admin, companyAdmin = false) {');
replaceExact(policy,
`    const fallback = admin ? 'admin' : ((id === 'start' || id === 'dashboard' || id === 'pickupcalendar') ? 'view' : 'none');\n    const level = admin ? 'admin' : normalizeLevel(old, fallback);`,
`    const fallback = admin ? 'admin' : (companyAdmin ? (id === 'update' ? 'none' : 'admin') : ((id === 'start' || id === 'dashboard' || id === 'pickupcalendar') ? 'view' : 'none'));\n    const level = admin ? 'admin' : (companyAdmin ? fallback : normalizeLevel(old, fallback));`);
replaceExact(policy,'  const admin = isAdmin(source);','  const admin = isAdmin(source);\n  const companyAdmin = !admin && isCompanyAdmin(source);');
replaceExact(policy,'  source.globalAdmin = admin;','  source.globalAdmin = admin;\n  source.companyAdmin = companyAdmin;');
replaceExact(policy,"  source.role = admin ? 'Globaler Administrator' : (text(source.role) || 'Benutzer');","  source.role = admin ? 'Globaler Administrator' : (text(source.role) || (companyAdmin ? 'Firmen-Admin' : 'Benutzer'));" );
replaceExact(policy,'  source.rights = normalizeRights(source.rights, admin);','  source.rights = normalizeRights(source.rights, admin, companyAdmin);');
replaceExact(policy,'    globalAdmin: u.globalAdmin === true,','    globalAdmin: u.globalAdmin === true,\n    companyAdmin: u.companyAdmin === true,');
replaceExact(policy,'  isAdmin,\n  countAdmins,','  isAdmin,\n  isCompanyAdmin,\n  countAdmins,');

const access='api/shared/public-access-store.js';
replaceExact(access,
  "  const createdAt=now(),ttl=Math.max(60*1000,Number(ttlMs)|| (kind==='pickup'?DEFAULT_PICKUP_TTL_MS:DEFAULT_AVIS_TTL_MS)),expiresAt=new Date(Date.now()+ttl).toISOString();",
  "  const createdAt=now(),indefinite=ttlMs===null,ttl=indefinite?null:Math.max(60*1000,Number(ttlMs)|| (kind==='pickup'?DEFAULT_PICKUP_TTL_MS:DEFAULT_AVIS_TTL_MS)),expiresAt=indefinite?null:new Date(Date.now()+ttl).toISOString();");
replaceExact(access,
  "  if(record.expiresAt&&Date.now()>=Date.parse(record.expiresAt))throw error('ACCESS_EXPIRED','Dieser öffentliche Link ist abgelaufen.',410);",
  "  if(record.kind!=='avis'&&record.expiresAt&&Date.now()>=Date.parse(record.expiresAt))throw error('ACCESS_EXPIRED','Dieser öffentliche Link ist abgelaufen.',410);");

const avis='api/customer-avis/index.js';
replaceEvery(avis,'singleUse:true','singleUse:false',2);
replaceExact(avis,'},7*86400000,payload);','},null,payload);');
replaceExact(avis,'oneTime:true','oneTime:false');
replaceExact(avis,"access.resolve(req,'avis',raw,{allowUsed:false},payload)","access.resolve(req,'avis',raw,{allowUsed:true},payload)");
replaceExact(avis,
  "await access.clearFailures(resolved.environment,'avis',resolved.tokenHash);const consumed=await access.consume(resolved.environment,'avis',resolved.tokenHash,{reason:'authorized'}),sessionInfo=access.issueSession(consumed),response=publicShipment(sh,sessionInfo.session);",
  "const cleared=await access.clearFailures(resolved.environment,'avis',resolved.tokenHash),sessionInfo=access.issueSession(cleared),response=publicShipment(sh,sessionInfo.session);");
replaceExact(avis,'response.rawLinkConsumed=true','response.rawLinkConsumed=false');

const testFile='test/rc1011-core-open-issues.test.mjs';
replaceExact(testFile,
  "assert.match(source,/level===['\"]none['\"]\\)return\\{visible:false,read:false,edit:false,admin:false\\}/,`${file}: none muss unsichtbar sein`);",
  "assert.match(source,/level===['\"]none['\"]\\)return\\s*\\{visible:false,read:false,edit:false,admin:false\\}/,`${file}: none muss unsichtbar sein`);");
replaceExact(testFile,
  "  assert.match(accessStore,/ttlMs===null[^;]*expiresAt=null/s,'Public-Access-Store muss ausdrücklich unbefristete Avis-Links unterstützen');",
  "  assert.match(accessStore,/indefinite=ttlMs===null/,'Public-Access-Store muss ausdrücklich unbefristete Avis-Links unterstützen');\n  assert.match(accessStore,/expiresAt=indefinite\\?null:/,'Unbefristete Avis-Links dürfen kein Ablaufdatum erhalten');");

console.log('RC1011-Korrekturen vollständig angewendet.');
