import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// HSTS keeps browsers on HTTPS after the first visit. No includeSubDomains/preload, so other
// subdomains of the domain are not affected.
for(const file of ['staticwebapp.config.json','staticwebapp.testservice.config.json']){
  test(`RC1558 ${file}: Strict-Transport-Security ist gesetzt, ohne Subdomains zu erzwingen`,()=>{
    const headers=JSON.parse(fs.readFileSync(file,'utf8')).globalHeaders||{};
    assert.equal(headers['Strict-Transport-Security'],'max-age=31536000');
    assert.equal(headers['X-Frame-Options'],'DENY');
    assert.equal(headers['Content-Security-Policy'],"frame-ancestors 'none'");
  });
}
