# RC1007 ISO-SOP-Handbuch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den bestehenden SOP-Bereich in ExportHUB durch ein neues, auditierbares System mit genau 36 gelenkten ISO-SOPs, Versionierung, Freigabelogik, Bildern/Prozessgrafiken, Suche, Filterung, Druckansicht und nachvollziehbarer Historie ersetzen.

**Architecture:** Die neuen SOPs werden in einer eigenen, vom Altbestand getrennten Sammlung `isoSops` geführt. Ein neues, modular eingebundenes SOP-Frontend rendert Übersicht, Einzelansicht, Versionen, Prozessgrafiken und Bildhinweise; `index.html` und `TESTVERSION.html` erhalten nur die Integration. Bestehende `customSops` werden nicht gelöscht, aber im neuen aktiven SOP-Bereich nicht mehr angezeigt.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, Node.js 20, bestehender ExportHUB-State/Cloud-Merge, Node-Test-Runner.

**Spec:** `docs/superpowers/specs/2026-09-08-iso-sop-handbook-design.md`

## Global Constraints

- Aktiver Entwicklungszweig: `rc1007-iso-sop-handbook`.
- `main` und Produktion werden während der Umsetzung nicht direkt verändert.
- Aktive SOP-Übersicht enthält ausschließlich die 36 neuen SOPs.
- Bestehende `customSops` bleiben als Altbestand erhalten, werden aber nicht in die neue aktive Liste gemischt.
- Jede SOP hat eine eindeutige Nummer, Version, Status, Verantwortlichkeiten, Pflichtabschnitte und Historie.
- Freigegebene Versionen werden nicht direkt überschrieben; Änderungen erzeugen eine neue Entwurfsfassung.
- Jede SOP enthält mindestens eine visuelle Prozessdarstellung; bei fehlenden echten ExportHUB-Screenshots wird ein klar gekennzeichneter Bildplatzhalter am passenden Schritt angezeigt.
- Externe oder noch nicht nummerierte Arbeitsanweisungen werden exakt als `SOP XXXX` gekennzeichnet.
- Das bestehende Rechteobjekt `rights.sop` bleibt die Basis: `read` = lesen, `edit` = Entwurf bearbeiten, `admin/functionAdmin` = prüfen/freigeben/Historie verwalten.
- Node.js bleibt mindestens Version 20; keine neue Laufzeitabhängigkeit hinzufügen.

---

### Task 1: RC1007-Vertrag als RED-Test festlegen

**Files:**
- Create: `test/rc1007-iso-sop-contract.test.mjs`

**Interfaces:**
- Consumes: vorhandene Dateien `api/shared/merge.js`, `index.html`, `TESTVERSION.html`.
- Produces: verbindliche Assertions für 36 SOPs, neue Assets, getrennte Persistenz und Altbestandsausschluss.

- [ ] **Step 1: Failing contract test schreiben**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=p=>fs.readFileSync(p,'utf8');

test('RC1007 besitzt genau 36 neue ISO-SOPs',()=>{
  const src=read('assets/sop/rc1007-sop-catalog.js');
  const numbers=[...src.matchAll(/number:\s*['"](SOP-(?:QM|SYS|LOG|WH|ORG)-\d{3})['"]/g)].map(m=>m[1]);
  assert.equal(numbers.length,36);
  assert.equal(new Set(numbers).size,36);
});

test('RC1007 trennt neue ISO-SOPs vom alten customSops-Bestand',()=>{
  const merge=read('api/shared/merge.js');
  assert.match(merge,/isoSops:\s*\['id',\s*'number'/);
  const ui=read('assets/sop/rc1007-sop-ui.js');
  assert.doesNotMatch(ui,/customSops\b/);
});

test('RC1007 ist in Produktion und TESTVERSION eingebunden',()=>{
  for(const file of ['index.html','TESTVERSION.html']){
    const src=read(file);
    assert.match(src,/assets\/sop\/rc1007-sop-catalog\.js/);
    assert.match(src,/assets\/sop\/rc1007-sop-ui\.js/);
    assert.match(src,/assets\/sop\/rc1007-sop\.css/);
  }
});
```

- [ ] **Step 2: Test ausführen und RED bestätigen**

Run: `node --test test/rc1007-iso-sop-contract.test.mjs`

Expected: FAIL, weil die RC1007-SOP-Assets und `isoSops` noch fehlen.

- [ ] **Step 3: RED-Test committen**

```bash
git add test/rc1007-iso-sop-contract.test.mjs
git commit -m "RC1007: ISO-SOP-Vertrag als RED-Test anlegen"
```

---

### Task 2: Eigenständiges SOP-Datenmodell und Cloud-Merge einführen

**Files:**
- Modify: `api/shared/merge.js`
- Create: `assets/sop/rc1007-sop-model.js`
- Test: `test/rc1007-sop-model.test.mjs`

**Interfaces:**
- Produces: `globalThis.ExportHubIsoSopModel` mit `seedState`, `createDraftVersion`, `submitForReview`, `approveVersion`, `archiveVersion`, `validateRelease`, `filterDocuments`.
- Persisted collection: `isoSops`, Identität über `id` und `number`.

- [ ] **Step 1: Model-Tests schreiben**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
await import('../assets/sop/rc1007-sop-model.js');
const model=globalThis.ExportHubIsoSopModel;

test('freigegebene Version wird beim Bearbeiten nicht überschrieben',()=>{
  const source={id:'SOP-LOG-011',number:'SOP-LOG-011',currentVersion:'1.0',versions:[{version:'1.0',status:'Freigegeben',title:'QR-Abholung',content:{steps:['Alt']}}]};
  const next=model.createDraftVersion(source,{version:'1.1',actor:'Admin',reason:'Ablauf geändert'});
  assert.equal(source.versions[0].content.steps[0],'Alt');
  assert.equal(next.versions.length,2);
  assert.equal(next.versions[1].status,'Entwurf');
});

test('Freigabe scheitert bei fehlender Pflichtangabe',()=>{
  const result=model.validateRelease({number:'',title:'Test',version:'1.0',approvedBy:'Admin'});
  assert.equal(result.ok,false);
  assert.ok(result.errors.includes('SOP-Nummer fehlt'));
});
```

- [ ] **Step 2: Tests RED ausführen**

Run: `node --test test/rc1007-sop-model.test.mjs`

Expected: FAIL, weil `ExportHubIsoSopModel` noch fehlt.

- [ ] **Step 3: `isoSops` in Merge-Vertrag aufnehmen**

In `COLLECTION_KEYS` ergänzen:

```js
isoSops: ['id', 'number', '_syncId'],
```

`customSops` bleibt unverändert bestehen, damit Altbestand nicht verloren geht.

- [ ] **Step 4: Modell implementieren**

Das Modell muss folgende Statusübergänge erzwingen:

```text
Entwurf -> In Prüfung -> Freigegeben -> Archiviert
```

Direkter Übergang `Entwurf -> Freigegeben` wird abgelehnt. Eine freigegebene Version wird ausschließlich durch `createDraftVersion` fortgeschrieben.

- [ ] **Step 5: Model-Tests GREEN ausführen**

Run: `node --test test/rc1007-sop-model.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/shared/merge.js assets/sop/rc1007-sop-model.js test/rc1007-sop-model.test.mjs
git commit -m "RC1007: gelenktes ISO-SOP-Datenmodell ergänzen"
```

---

### Task 3: 36 SOPs als neuen Katalog mit vollständiger Pflichtstruktur anlegen

**Files:**
- Create: `assets/sop/rc1007-sop-catalog.js`
- Test: `test/rc1007-sop-catalog.test.mjs`

**Interfaces:**
- Produces: `globalThis.ExportHubIsoSopCatalog` mit genau 36 Dokumentdefinitionen.
- Jede Definition enthält `id`, `number`, `title`, `area`, `keywords`, `processFlow`, `version`, `status`, `validFrom`, `createdBy`, `reviewedBy`, `approvedBy`, `processOwner`, `affectedAreas`, `nextReview`, `changeReason`, `sections`, `visuals`, `references`, `history`.

- [ ] **Step 1: Katalogtest schreiben**

Der Test prüft exakt diese Bereichszahlen:

```js
assert.deepEqual(countByArea,{
  Qualitätsmanagement:5,
  'System / ExportHUB':4,
  'Versand und Export':17,
  Lager:7,
  Organisation:3
});
```

Zusätzlich muss jede SOP die 14 Pflichtabschnitte besitzen:

```js
const required=['purpose','scope','definitions','responsibilities','prerequisites','resources','steps','checks','deviations','records','metrics','relatedDocuments','references','changeHistory'];
for(const doc of catalog.documents){
  for(const key of required) assert.ok(Object.hasOwn(doc.sections,key),`${doc.number}: ${key}`);
}
```

- [ ] **Step 2: Test RED ausführen**

Run: `node --test test/rc1007-sop-catalog.test.mjs`

Expected: FAIL, weil der Katalog noch fehlt.

- [ ] **Step 3: Katalog mit genau diesen 36 Nummern anlegen**

```text
SOP-QM-001 bis SOP-QM-005
SOP-SYS-001 bis SOP-SYS-004
SOP-LOG-001 bis SOP-LOG-017
SOP-WH-001 bis SOP-WH-007
SOP-ORG-001 bis SOP-ORG-003
```

Die Titel entsprechen exakt der freigegebenen Designspezifikation.

- [ ] **Step 4: Inhalt jeder SOP vollständig ausformulieren**

Die Inhalte werden einfach, sachlich und detailliert geschrieben. Jeder operative Schritt enthält eine konkrete Handlung und, wo fachlich erforderlich, einen Stop-/Prüfpunkt. Interne Folgeprozesse verwenden konkrete SOP-Nummern; externe nicht im ExportHUB beschriebene Tätigkeiten verwenden exakt `Die weitere Durchführung erfolgt gemäß SOP XXXX.`.

- [ ] **Step 5: Ausgangsstatus setzen**

Alle 36 Dokumente starten als Version `1.0` mit Status `Entwurf`, solange keine formelle fachliche Einzel-Freigabe vorliegt. Dadurch werden sie im Admin-SOP-Bereich sichtbar, aber nicht fälschlich als bereits freigegebene ISO-Dokumente ausgegeben.

- [ ] **Step 6: Katalogtests GREEN ausführen**

Run: `node --test test/rc1007-sop-catalog.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add assets/sop/rc1007-sop-catalog.js test/rc1007-sop-catalog.test.mjs
git commit -m "RC1007: 36 neue ISO-SOP-Dokumente anlegen"
```

---

### Task 4: Prozessgrafiken und Bildmodell in jede SOP integrieren

**Files:**
- Modify: `assets/sop/rc1007-sop-catalog.js`
- Modify: `assets/sop/rc1007-sop-model.js`
- Test: `test/rc1007-sop-visuals.test.mjs`

**Interfaces:**
- Jede SOP liefert `processFlow` mit mindestens drei benannten Stationen.
- `visuals` verwendet `type: 'process'`, `type: 'screenshot'` oder `type: 'placeholder'` und bindet sich an eine konkrete `stepId`.

- [ ] **Step 1: Visual-Vertrag testen**

```js
for(const doc of catalog.documents){
  assert.ok(Array.isArray(doc.processFlow) && doc.processFlow.length>=3,`${doc.number}: Prozessgrafik fehlt`);
  assert.ok(Array.isArray(doc.visuals) && doc.visuals.length>=1,`${doc.number}: Visual fehlt`);
}
```

Für SOP-LOG-011 wird zusätzlich geprüft, dass Visuals für QR, Abholseite, PIN, Colli und Abschluss vorhanden sind.

- [ ] **Step 2: Prozessgrafikdaten ergänzen**

Beispiel SOP-LOG-011:

```js
processFlow:['QR-Code öffnen','Sendung prüfen','Verlade-PIN prüfen','Colli bestätigen','Abholung abschließen']
```

- [ ] **Step 3: Screenshotstellen definieren**

Für ExportHUB-Bedienschritte ohne vorhandenes Originalbild wird kein Stockbild genutzt. Das Visual erhält stattdessen:

```js
{type:'placeholder',stepId:'pin',caption:'Bild noch zu erstellen: ExportHUB > Sendung > Abholung > Verlade-PIN.'}
```

- [ ] **Step 4: Visual-Tests GREEN ausführen**

Run: `node --test test/rc1007-sop-visuals.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add assets/sop/rc1007-sop-catalog.js assets/sop/rc1007-sop-model.js test/rc1007-sop-visuals.test.mjs
git commit -m "RC1007: Prozessgrafiken und SOP-Bildstellen ergänzen"
```

---

### Task 5: Neue SOP-Übersicht und Einzelansicht bauen

**Files:**
- Create: `assets/sop/rc1007-sop-ui.js`
- Create: `assets/sop/rc1007-sop.css`
- Test: `test/rc1007-sop-ui.test.mjs`

**Interfaces:**
- Produces: `globalThis.ExportHubIsoSopUi` mit `mount`, `renderOverview`, `renderDocument`, `renderProcessGraphic`, `printDocument`.
- Consumes: `ExportHubIsoSopCatalog`, `ExportHubIsoSopModel`, aktueller ExportHUB-State und `rights.sop`.

- [ ] **Step 1: UI-Vertrag RED schreiben**

Der Test verlangt folgende feste Beschriftungen und Funktionen:

```text
SOP-Handbuch
SOP suchen
Bereich
Status
Version
Gültig ab
Nächste Prüfung
Öffnen
Versionshistorie
Drucken
```

Zusätzlich wird geprüft, dass `renderProcessGraphic` SVG-Markup erzeugt und Bildplatzhalter mit der Kennzeichnung `Bild noch zu erstellen` rendert.

- [ ] **Step 2: UI implementieren**

Die Übersicht gruppiert nach fünf Bereichen und bietet Suche nach Nummer, Titel und Stichwort sowie Bereichs- und Statusfilter.

Die Einzelansicht zeigt oben den gelenkten Dokumentenkopf und anschließend alle Pflichtabschnitte. Prozessgrafiken erscheinen vor dem detaillierten Ablauf; Schrittbilder erscheinen direkt beim zugehörigen Schritt.

- [ ] **Step 3: Rechte anwenden**

```text
rights.sop.read = Übersicht und freigegebene Dokumente lesen
rights.sop.edit = Entwürfe erstellen/bearbeiten
rights.sop.admin oder functionAdmin = In Prüfung setzen, freigeben, archivieren und Historie verwalten
```

Entwürfe sind für Benutzer ohne Edit-/Admin-Recht nicht als gültige Arbeitsanweisung auszugeben.

- [ ] **Step 4: UI-Test GREEN ausführen**

Run: `node --test test/rc1007-sop-ui.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add assets/sop/rc1007-sop-ui.js assets/sop/rc1007-sop.css test/rc1007-sop-ui.test.mjs
git commit -m "RC1007: neue SOP-Übersicht und Einzelansicht bauen"
```

---

### Task 6: Versions-, Prüf- und Freigabeworkflow anbinden

**Files:**
- Modify: `assets/sop/rc1007-sop-ui.js`
- Modify: `assets/sop/rc1007-sop-model.js`
- Test: `test/rc1007-sop-workflow.test.mjs`

**Interfaces:**
- Entwurf speichert `createdBy`, `createdAt`, `changeReason`.
- Prüfung speichert `reviewedBy`, `reviewedAt`.
- Freigabe speichert `approvedBy`, `approvedAt`, `validFrom` und setzt `currentVersion`.

- [ ] **Step 1: Workflow-Tests schreiben**

Prüfen:

```text
Entwurf kann bearbeitet werden.
Freigegebene Version kann nicht direkt bearbeitet werden.
Neue Änderung an freigegebener Version erzeugt zweite Version.
Freigabe ohne Nummer/Titel/Version/Freigabeverantwortlichen wird abgelehnt.
Offene Pflicht-Bildplatzhalter markieren Dokument als unvollständig.
Historische Version bleibt nach neuer Freigabe erhalten.
```

- [ ] **Step 2: Audit-Historie implementieren**

Jede Workflow-Aktion ergänzt einen Eintrag:

```js
{action:'Freigegeben',version:'1.0',actor:'...',at:'ISO-Zeitstempel',reason:'...'}
```

- [ ] **Step 3: Workflow-Test GREEN ausführen**

Run: `node --test test/rc1007-sop-workflow.test.mjs`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add assets/sop/rc1007-sop-ui.js assets/sop/rc1007-sop-model.js test/rc1007-sop-workflow.test.mjs
git commit -m "RC1007: SOP-Pruef- und Freigabeworkflow absichern"
```

---

### Task 7: SOP-Modul in Produktion und TESTVERSION integrieren, Altansicht ersetzen

**Files:**
- Modify: `index.html`
- Modify: `TESTVERSION.html`
- Test: `test/rc1007-iso-sop-contract.test.mjs`

**Interfaces:**
- SOP-Navigation bleibt unter Modul-ID `sop` erreichbar.
- Neue Assets werden in beiden Umgebungsdateien geladen.
- Beim Aufruf der SOP-Seite übernimmt RC1007 die aktive Darstellung.

- [ ] **Step 1: Asset-Integration hinzufügen**

In beiden HTML-Dateien werden eingebunden:

```html
<link rel="stylesheet" href="assets/sop/rc1007-sop.css">
<script src="assets/sop/rc1007-sop-model.js"></script>
<script src="assets/sop/rc1007-sop-catalog.js"></script>
<script src="assets/sop/rc1007-sop-ui.js"></script>
```

- [ ] **Step 2: Bestehenden SOP-Renderpfad ersetzen**

Beim Modul `sop` wird ausschließlich `ExportHubIsoSopUi.mount(...)` verwendet. Alte `customSops`-Karten oder alte fest verdrahtete SOPs werden nicht mehr in der aktiven Ansicht gerendert.

- [ ] **Step 3: Seed-Persistenz anbinden**

Wenn `state.isoSops` leer ist, erzeugt `seedState` die 36 neuen Dokumente. Bestehende `isoSops` werden nicht bei jedem Start überschrieben.

- [ ] **Step 4: Contract-Test GREEN ausführen**

Run: `node --test test/rc1007-iso-sop-contract.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html TESTVERSION.html test/rc1007-iso-sop-contract.test.mjs
git commit -m "RC1007: neues ISO-SOP-Modul in ExportHUB integrieren"
```

---

### Task 8: Druckansicht, mobile Lesbarkeit und Bildfehler absichern

**Files:**
- Modify: `assets/sop/rc1007-sop.css`
- Modify: `assets/sop/rc1007-sop-ui.js`
- Test: `test/rc1007-sop-print-mobile.test.mjs`

**Interfaces:**
- Print CSS über `@media print`.
- Mobile Layout ab schmalen Viewports einspaltig.
- Bildfehler erzeugen einen sichtbaren Hinweis, entfernen aber keinen Textinhalt.

- [ ] **Step 1: Druck-/Mobile-Vertrag schreiben**

Prüfen, dass CSS mindestens enthält:

```css
@media print
@media (max-width: 760px)
break-inside: avoid
```

und die Druckansicht Nummer, Titel, Version, Status, Gültig-ab-Datum, Freigabedaten, Bildunterschriften und Änderungshinweis rendert.

- [ ] **Step 2: Druckansicht implementieren**

Navigation, Suchfelder und Bearbeitungsschaltflächen werden im Druck ausgeblendet; Dokumentenkopf, SOP-Inhalt, Prozessgrafiken und Bildunterschriften bleiben sichtbar.

- [ ] **Step 3: Bildfehler robust machen**

Ein `error`-Handler ersetzt ein fehlendes Bild durch eine Hinweisbox mit Bildnummer und Caption. Der übrige SOP-Inhalt bleibt vollständig sichtbar.

- [ ] **Step 4: Test GREEN ausführen**

Run: `node --test test/rc1007-sop-print-mobile.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add assets/sop/rc1007-sop.css assets/sop/rc1007-sop-ui.js test/rc1007-sop-print-mobile.test.mjs
git commit -m "RC1007: SOP-Druck und mobile Darstellung absichern"
```

---

### Task 9: Vollständige Regression und RC1007-Abnahme

**Files:**
- No production write.
- Review all RC1007 changed files.

- [ ] **Step 1: RC1007-Einzeltests ausführen**

```bash
node --test test/rc1007-*.test.mjs
```

Expected: alle RC1007-Tests PASS.

- [ ] **Step 2: Gesamte Node-Regression ausführen**

```bash
npm test
```

Expected: alle vorhandenen Tests PASS.

- [ ] **Step 3: Syntaxprüfung ausführen**

```bash
node --check assets/sop/rc1007-sop-model.js
node --check assets/sop/rc1007-sop-catalog.js
node --check assets/sop/rc1007-sop-ui.js
node --check api/shared/merge.js
```

Expected: keine Syntaxfehler.

- [ ] **Step 4: Fachlichen RC1007-Vertrag prüfen**

Manuell/reproduzierbar bestätigen:

```text
Genau 36 neue SOPs sichtbar.
Alte SOPs nicht mehr in aktiver Übersicht.
Alle fünf Kategorien vorhanden.
Jede SOP öffnet separat.
Jede SOP zeigt gelenkten Dokumentenkopf.
Jede SOP enthält Prozessgrafik oder Schrittbild.
SOP XXXX bleibt bei externen Arbeitsanweisungen sichtbar.
Suche und Filter funktionieren.
Entwurf, In Prüfung, Freigabe und Historie funktionieren.
Druck zeigt eindeutige Versionsdaten.
Mobile Darstellung ist lesbar.
Andere ExportHUB-Module bleiben navigierbar.
```

- [ ] **Step 5: Branch gegen `main` vergleichen**

Der Diff darf nur RC1007-SOP-bezogene Änderungen und die bereits freigegebene Designspezifikation/Planung enthalten. Produktion bleibt bis zur ausdrücklichen Releasefreigabe unverändert.

- [ ] **Step 6: Abschlusscommit nur bei vollständigem GREEN**

```bash
git add .
git commit -m "RC1007 GREEN: ISO-SOP-Handbuch vollständig verifizieren"
```

## Self-Review

- Spec coverage: alle 15 Testanforderungen der Designspezifikation sind Tasks 1 bis 9 zugeordnet.
- Altbestand: `customSops` wird nicht gelöscht und nicht in `isoSops` migriert; die aktive UI nutzt ausschließlich `isoSops`.
- Versionierung: freigegebene Version bleibt unveränderlich; neue Bearbeitung erzeugt neue Entwurfsfassung.
- Bilder: jede SOP erhält eine Prozessgrafik; echte ExportHUB-Screenshots werden schrittbezogen eingebunden, fehlende Originale werden ausdrücklich als offene Bildaufnahme gekennzeichnet.
- Rechte: bestehende SOP-Modulrechte werden genutzt, ohne ein zweites widersprüchliches Rollenmodell einzuführen.
- Keine Produktionsänderung ist Bestandteil des Implementierungsplans.
