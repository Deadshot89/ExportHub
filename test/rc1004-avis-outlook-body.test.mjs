import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const file of ['index.html','TESTVERSION.html']) {
  test(`${file}: Outlook-Avis übergibt auch lange Mailtexte vollständig`, () => {
    const html = fs.readFileSync(file,'utf8');
    const start = html.indexOf('function launchMail(data)');
    const end = html.indexOf('function persist(reason)', start);
    assert.ok(start > 0 && end > start, `${file}: launchMail konnte nicht gefunden werden`);
    const fn = html.slice(start,end);

    assert.doesNotMatch(fn,/full\.length\s*<=\s*1800/,'keine künstliche 1800-Zeichen-Grenze');
    assert.doesNotMatch(fn,/mailtoUrl\(data,false\)/,'Mailtext darf bei langen AVIS-Mails nicht entfernt werden');
    assert.doesNotMatch(fn,/copyMailBody\(/,'kein Zwischenablage-Fallback statt Outlook-Mailtext');
    assert.match(fn,/mailtoUrl\(data,true\)/,'Outlook muss immer den vollständigen Mailtext erhalten');
  });
}
