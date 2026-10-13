# SOPMaster – SOP-, Schulungs-, Tour- und Prüfungssystem

**Datum:** 12.10.2026  
**Basis:** `main` @ `f84157c1678f53264ccbf2359d6e3002b4ef977c` (RC1499)  
**Status:** Design zur fachlichen Freigabe  
**Scope:** Erweiterung des bestehenden ExportHUB-SOP-Systems, keine Neuentwicklung daneben

## 1. Ziel

Die bestehende ExportHUB-Funktion **SOP** wird zu einem vollständigen SOP-, Schulungs- und Einarbeitungssystem erweitert.

Ein neuer Mitarbeiter muss einen Prozess ohne dauerhafte Unterstützung eines erfahrenen Mitarbeiters korrekt durchführen können. Dazu darf eine SOP nicht nur das Ziel eines Arbeitsschritts beschreiben, sondern muss jeden operativen Klick, jede Prüfung, jede Eingabe, jede Entscheidung und jede Abschlusskontrolle abbilden.

Die Lösung unterstützt gleichzeitig:

1. **Kunden-SOPs** für kundenspezifische Besonderheiten,
2. **Prozess-/Funktions-SOPs** für alle ExportHUB-Arbeitsabläufe,
3. **Bildanleitungen** mit echten, sicheren Systembildern,
4. **interaktive geführte Touren**, bei denen der Mitarbeiter selbst arbeitet,
5. **Trainingsmodus** ohne produktive Nebenwirkungen,
6. **Prüfungsmodus** mit Bewertung der tatsächlich ausgeführten Schritte,
7. **Versionierung, Freigabe und Audit**, aufbauend auf dem bestehenden SOP-Modell,
8. **Abdeckungsanalyse**, um fehlende oder unvollständige SOPs sichtbar zu machen.

## 2. Bestehender Stand

ExportHUB besitzt bereits einen belastbaren SOP-Kern:

- versionierte SOP-Dokumente,
- Status `Entwurf`, `In Prüfung`, `Freigegeben`, `Archiviert`,
- Audit-Trail,
- Reconcile-Logik für gespeicherte und kanonische SOP-Fassungen,
- aktiven konsolidierten Prozesskatalog,
- historische SOP-Fassungen,
- schrittbezogene Systembilder über `stepId`,
- Browser-/Screenshot-Tests für Teile des SOP-Systems,
- responsive SOP-Darstellung und Druckansicht.

Dieser Bestand wird **erweitert, nicht ersetzt**.

### 2.1 Aktiver Prozesskatalog

Die bestehende Konsolidierung aus RC1016 bleibt die Prozessbasis. Die aktiven Prozess-SOPs werden nicht erneut dupliziert. Kundenspezifische Besonderheiten werden darübergelegt.

### 2.2 Bestandsschutz

Die SOP-Erweiterung darf keine produktiven Kernprozesse verändern, insbesondere nicht:

- Sendung speichern,
- QR aktivieren,
- Statuswechsel,
- ABD-Prozess,
- Abholung,
- POD,
- Avis,
- Mailversand,
- Druck,
- Palettenkonto,
- Archivierung.

SOP-, Tour- und Trainingslogik wird additiv über vorhandene Prozesse gelegt.

## 3. Architekturprinzip

Die zentrale Regel lautet:

> **Eine fachliche Prozessdefinition – mehrere Darstellungs- und Lernformen.**

Ein Prozessschritt wird genau einmal gepflegt und kann daraus verwendet werden als:

- SOP-Text,
- Bildanleitung,
- Tour-Schritt,
- Trainingsschritt,
- Prüfungsschritt,
- Kontrollpunkt,
- Kontext-Hilfe.

Dadurch entstehen keine getrennten, widersprüchlichen Parallel-Anleitungen.

## 4. Zielarchitektur

```text
Bestehende ExportHUB-Funktion
        │
        ├── produktive Logik bleibt unverändert
        │
        ▼
SOP Context Layer
        │
        ├── Prozess-SOP
        ├── Kunden-Overlay
        ├── Rollen-/Rechtekontext
        └── aktueller View-/Objektkontext
        │
        ▼
Unified SOP Step Model
        │
        ├── Textdarstellung
        ├── Bildanleitung
        ├── Geführte Tour
        ├── Training
        └── Prüfung
```

## 5. Datenmodell

### 5.1 SOP-Dokument

Das bestehende Modell wird erweitert, nicht ersetzt.

```js
{
  number,
  title,
  type: 'process' | 'customer' | 'function',
  area,
  version,
  status,
  validFrom,
  processOwner,
  customerId,
  baseProcessSop,
  steps: [],
  overlays: [],
  visuals: [],
  tourConfig: {},
  trainingConfig: {},
  examConfig: {},
  history: [],
  auditTrail: []
}
```

### 5.2 Unified SOP Step

Jeder relevante Arbeitsschritt bekommt ein strukturiertes Schema:

```js
{
  id: 'abd-request-07',
  order: 7,
  title: 'ABD-Funktion öffnen',
  instruction: 'Öffne in der Sendung die Funktion „ABD anfordern“.',
  page: 'shipment',
  target: {
    type: 'button',
    stableKey: 'shipment-abd-request',
    selector: '[data-tour-key="shipment-abd-request"]'
  },
  expectedAction: 'click',
  field: null,
  inputRule: null,
  checks: [],
  expectedResult: 'ABD-Dialog ist geöffnet',
  warnings: [],
  commonErrors: [],
  troubleshooting: [],
  visuals: [],
  tour: {
    enabled: true,
    highlight: true,
    blockWrongNavigation: false
  },
  training: {
    enabled: true,
    sideEffectPolicy: 'sandbox'
  },
  exam: {
    relevant: true,
    weight: 1,
    allowHint: false
  }
}
```

### 5.3 Stabile Tour-Ziele

Touren dürfen nicht von zufälligen CSS-Strukturen oder Textsuche abhängen.

Relevante UI-Elemente erhalten stabile Kennungen:

```html
<button data-tour-key="shipment-abd-request">ABD anfordern</button>
```

Fallback-Selektoren dürfen nur vorübergehend verwendet werden.

## 6. Kunden-SOPs als Overlay

Kunden-SOPs kopieren keine allgemeinen Prozesse.

Beispiel:

```text
SOP-EH-060 – ABD vom Bedarf bis zur Versandfreigabe
        +
Kunden-Overlay „Kunde XYZ“
        =
kontextbezogene Arbeitsanweisung für Kunde XYZ
```

Ein Kunden-Overlay kann:

- Schritte ergänzen,
- Schritte als nicht relevant markieren,
- zusätzliche Prüfungen einfügen,
- Warnungen hinzufügen,
- Dokumentanforderungen ändern,
- Ansprechpartner ergänzen,
- Versand-/Avis-/Portalregeln ergänzen,
- kundenspezifische Bilder verknüpfen.

Es darf den allgemeinen Kernprozess nicht still überschreiben. Abweichungen müssen sichtbar als **Kundenbesonderheit** gekennzeichnet werden.

### 6.1 Konfliktregel

Reihenfolge der Auswertung:

1. allgemeine Prozess-SOP,
2. freigegebenes Kunden-Overlay,
3. rollenbezogene Einschränkungen,
4. aktueller Objektkontext.

Widersprüchliche Overlays werden im Adminbereich als Fehler markiert und nicht automatisch freigegeben.

## 7. Kontextbezogene SOP

Jede relevante ExportHUB-Seite kann den SOP-Kontext melden:

```js
{
  view: 'shipment',
  action: 'abd-request',
  customerId: '...',
  shipmentId: '...',
  role: '...'
}
```

Darauf basierend werden angeboten:

- `? SOP anzeigen`
- `▶ Anleitung starten`
- `🖼 Bildanleitung öffnen`

Die Auswahl priorisiert die passendste freigegebene Prozess-SOP plus Kunden-Overlay.

## 8. Bildanleitung

### 8.1 Quelle

Systembilder werden aus einer sicheren Demo-/Trainingsumgebung erzeugt.

Produktivdaten dürfen nicht für automatisch erzeugte Schulungsbilder verwendet werden.

### 8.2 Zuordnung

Bilder bleiben direkt an `stepId` gebunden.

```js
{
  type: 'screenshot',
  stepId: 'abd-request-07',
  src: 'assets/sop/screenshots/...png',
  caption: 'ABD anfordern in geöffneter Sendung',
  annotations: []
}
```

### 8.3 Annotationen

Unterstützt werden:

- Fokusrahmen,
- Pfeil,
- Nummernmarker,
- kurze Bildhinweise,
- Crop/Viewport,
- erwartetes Ergebnis.

### 8.4 Qualitätsregel

Ein Screenshot gilt nur als brauchbar, wenn das relevante Element ohne Suchen erkennbar ist.

Vollbilder ohne Fokusmarkierung reichen für komplexe Schritte nicht aus.

## 9. Interaktive Tour-Engine

### 9.1 Grundregel

Die Tour führt, aber arbeitet nicht für den Benutzer.

Der Mitarbeiter muss selbst:

- klicken,
- navigieren,
- auswählen,
- eingeben,
- prüfen,
- Entscheidungen treffen.

### 9.2 Unterstützte Aktionen

Mindestens:

- `click`
- `input`
- `change`
- `select`
- `upload`
- `open-modal`
- `close-modal`
- `navigate`
- `status-change`
- `save`
- `confirm`

### 9.3 Fortschritt

Die Tour zeigt permanent:

- SOP-Titel,
- Schritt X von Y,
- Prozentfortschritt,
- aktuelle Aufgabe,
- Erklärung,
- Tipp,
- vorheriger Schritt,
- pausieren,
- beenden,
- SOP öffnen.

### 9.4 Richtige Aktion

Bei erfolgreicher Validierung:

```text
✅ Schritt abgeschlossen
```

Danach wird der nächste Schritt aktiviert.

### 9.5 Falsche Aktion

Eine falsche Aktion darf keine falsche Fortschrittsbestätigung erzeugen.

Die Tour kann abhängig vom Schritt:

- nur einen Hinweis zeigen,
- die Aktion protokollieren,
- im Trainingsmodus blockieren,
- im Prüfungsmodus als Fehler zählen.

## 10. Tour-Validierung

Jeder Tour-Schritt benötigt eine konkrete Erfolgsbedingung.

Beispiele:

```js
{ type: 'element-visible', key: 'abd-dialog' }
{ type: 'field-value', key: 'country', value: 'CH' }
{ type: 'state', path: 'shipment.status', equals: 'Bereit zur Abholung' }
{ type: 'document-present', category: 'ABD' }
```

Nur tatsächliche Zustände zählen als abgeschlossen. Ein bloßer Klick auf einen Button reicht nicht, wenn der gewünschte Folgezustand nicht erreicht wurde.

## 11. Trainingsmodus

### 11.1 Sicherheitsziel

Der Trainingsmodus darf keine produktiven Nebenwirkungen erzeugen.

### 11.2 Verbotene produktive Aktionen

Im Training werden mindestens blockiert oder umgeleitet:

- echte Mails,
- echte Avis-Sendungen,
- produktive QR-Tokens,
- produktive Statusänderungen,
- produktive Löschungen,
- produktive Buchungen,
- produktive Palettenbewegungen,
- externe Portalaktionen,
- irreversible Änderungen.

### 11.3 Trainingsdaten

Training arbeitet mit:

- Demo-Sendungen,
- Demo-Kunden,
- Demo-Dokumenten,
- simulierten externen Antworten,
- isolierter Trainingspersistenz.

### 11.4 Sichtbarkeit

Die komplette UI zeigt eindeutig:

```text
TRAININGSMODUS
Keine produktiven Daten werden verändert.
```

Die Kennzeichnung darf nicht nur in einem kleinen Badge stehen.

## 12. Geführter Modus

Der geführte Modus zeigt:

- genaue Anweisung,
- Zielhervorhebung,
- Hinweise,
- Fehlerkorrektur,
- optional erklärende Systembilder.

Er dient der Einarbeitung.

## 13. Prüfungsmodus

Im Prüfungsmodus wird dieselbe Prozessdefinition verwendet, aber ohne aktive Führung.

Ausgeblendet werden:

- Zielhervorhebung,
- Schrittanweisung,
- Tipps,
- Lösungshinweise.

Der Benutzer erhält nur die Aufgabe.

### 13.1 Bewertung

Erfasst werden:

- richtige Schritte,
- falsche Aktionen,
- Reihenfolge,
- Pflichtprüfungen,
- ausgelassene Schritte,
- verwendete Hilfen,
- Abschlusszustand.

### 13.2 Ergebnis

```text
✅ Bestanden
```

oder

```text
❌ Noch nicht bestanden
```

Zusätzlich wird eine konkrete Auswertung gespeichert.

### 13.3 Keine Zeitstrafe als Standard

Zeit kann protokolliert werden, ist aber standardmäßig kein Bestehensfaktor. Fachlich korrekte Durchführung hat Vorrang.

## 14. Mitarbeiterfortschritt

Pro Benutzer und SOP können gespeichert werden:

```js
{
  userId,
  sopNumber,
  version,
  viewedAt,
  startedAt,
  completedAt,
  tourCompletedAt,
  examAttempts,
  examPassedAt,
  helpCount,
  lastStepId
}
```

Bei einer neuen freigegebenen SOP-Version bleibt die Historie erhalten. Je nach Änderungsart kann eine erneute Bestätigung oder Prüfung notwendig sein.

## 15. SOP-Verwaltung

Der bestehende Adminbereich wird erweitert um:

- SOP erstellen,
- SOP kopieren,
- SOP bearbeiten,
- SOP archivieren,
- Schritte hinzufügen,
- Schritte verschieben,
- Schritte löschen,
- Kunden-Overlay erstellen,
- Screenshot zuordnen,
- Screenshot aktualisieren,
- Tour-Ziel auswählen,
- Erfolgsbedingung definieren,
- Trainingsregel definieren,
- Prüfungsrelevanz definieren.

## 16. Tour-Ziel-Editor

Ein Admin soll Tour-Ziele nicht als CSS-Selector von Hand schreiben müssen.

Vorgesehener Ablauf:

1. `Tour-Ziel auswählen` starten,
2. SOP-Editor wechselt in Auswahlmodus,
3. Benutzer klickt das echte UI-Element,
4. System liest `data-tour-key`,
5. Zuordnung wird gespeichert,
6. Testlauf prüft, ob das Element auffindbar ist.

Fehlt eine stabile Kennung, wird der Schritt als technisch unvollständig markiert.

## 17. Automatische SOP-Abdeckungsanalyse

### 17.1 Ziel

ExportHUB soll sichtbar machen, wo die Dokumentation nicht mit der Anwendung Schritt hält.

### 17.2 Scanner

Der Scanner erfasst definierte Hauptfunktionen und vergleicht sie mit freigegebenen SOP-Metadaten.

Er bewertet beispielsweise:

- View vorhanden, aber keine SOP,
- wichtige Aktion ohne Schritt,
- Schritt ohne Bild,
- Tour-Schritt ohne Ziel,
- Prüfungsprozess ohne Validierung,
- Kundenregel ohne Overlay.

### 17.3 Status

- 🔴 SOP fehlt
- 🟡 SOP unvollständig
- 🟢 SOP vollständig
- 🔵 Tour vorhanden
- 🟣 Bildanleitung vorhanden

Zusätzlich wird eine Abdeckungsquote angezeigt.

### 17.4 Kein blindes DOM-Crawling

Die Abdeckungsanalyse basiert auf expliziten, stabilen Funktionsmetadaten und bekannten ExportHUB-Views. Sie soll nicht beliebige Buttons automatisch zu fachlichen Prozessen erklären.

## 18. Versionierung und Änderungen

Das bestehende Freigabemodell bleibt erhalten.

Bei Änderung einer freigegebenen SOP:

- neue Entwurfsfassung erzeugen,
- Prüfung,
- Freigabe,
- alte Fassung archivieren,
- Historie erhalten,
- geänderte Schritte markieren,
- Nutzer auf relevante Änderungen hinweisen.

Beispiel:

```text
SOP aktualisiert
Version 2.4
Änderung: Neuer Ablauf für ABD-Anfragen.
```

## 19. Berechtigungen

Mindestens folgende Rollenlogik:

- **Leser:** freigegebene SOPs nutzen,
- **Trainer:** Trainingsdurchläufe begleiten und Ergebnisse sehen,
- **Editor:** Entwürfe und Overlays pflegen,
- **SOP-Admin:** Freigabe, Archivierung, Tour-Ziele und Prüfungen verwalten.

Produktive Rechte eines Benutzers werden durch den SOP-Modus nicht erweitert.

## 20. Barrierefreiheit und responsive Nutzung

Tour- und SOP-UI müssen auf Desktop, Tablet und Smartphone funktionieren.

Pflichtpunkte:

- Tastaturbedienbarkeit,
- sichtbarer Fokus,
- ARIA für Tourdialoge,
- keine Information nur über Farbe,
- ausreichender Kontrast,
- scrollsicheres Highlighting,
- keine verdeckten Pflichtbuttons,
- responsive Bilder und Zoom.

## 21. Migration

### 21.1 Bestehende SOPs

Die aktiven bestehenden Prozess-SOPs bleiben erhalten.

Neue Felder erhalten sichere Defaults:

```js
{
  type: 'process',
  overlays: [],
  tourConfig: { enabled: false },
  trainingConfig: { enabled: false },
  examConfig: { enabled: false }
}
```

### 21.2 Historie

Bestehende Versionen und Audit-Trails dürfen nicht neu geschrieben oder verworfen werden.

### 21.3 Bestehende Bilder

Vorhandene echte Systembilder bleiben gültig. Nur fehlende oder veraltete Bilder werden ergänzt bzw. ersetzt.

## 22. Technische Modulgrenzen

Vorgesehen sind getrennte Module statt eines großen Runtime-Patches:

```text
assets/sop/
  sop-model.js                 bestehendes Modell erweitern
  sop-overlay.js               Kunden-/Kontextauflösung
  sop-step-contract.js         Unified Step Schema
  sop-context.js               aktuelle View-/Objektauflösung
  sop-tour-engine.js           Toursteuerung
  sop-tour-validator.js        Erfolgsbedingungen
  sop-training.js              Sandbox-/Side-Effect-Policy
  sop-exam.js                  Prüfungslogik
  sop-progress.js              Mitarbeiterfortschritt
  sop-coverage.js              Abdeckungsanalyse
  sop-screenshot-manifest.js   Bildzuordnung
```

Die endgültigen Dateinamen werden bei der Implementierungsplanung an den aktuellen Repository-Stand angepasst.

## 23. Teststrategie

### 23.1 Unit-/Contract-Tests

Pflichtfälle:

- bestehende SOP-Versionen bleiben erhalten,
- Overlay-Merge ist deterministisch,
- Kundenabweichungen überschreiben nicht still den Kernprozess,
- Tour-Schritt wird nur bei erfüllter Erfolgsbedingung abgeschlossen,
- falsche Aktion zählt nicht als Erfolg,
- Trainingsmodus blockiert produktive Side Effects,
- Prüfungsmodus zeigt keine Lösung,
- Fortschritt ist versionsgebunden,
- Coverage erkennt bewusst fehlende Zuordnungen.

### 23.2 Browser-E2E

Mindestens:

1. SOP öffnen,
2. Bildanleitung prüfen,
3. geführte Tour vollständig durchführen,
4. falsche Aktion provozieren,
5. Tour pausieren/fortsetzen,
6. Trainingslauf ohne Produktivschreiben,
7. Prüfung bestehen,
8. Prüfung mit Fehler abschließen,
9. Kunden-Overlay verifizieren,
10. Desktop und Mobile testen.

### 23.3 Bestandsschutz-Regression

Vor Freigabe müssen bestehende Kernprozesse erneut laufen:

- Sendung speichern,
- Reload/Persistenz,
- QR aktivieren,
- Statuswechsel,
- ABD,
- Abholung,
- POD,
- Druck,
- Avis,
- Login/Navigation.

Die SOP-Erweiterung darf keinen dieser Tests verändern, um sie künstlich grün zu bekommen.

## 24. Release-Strategie

Die Umsetzung erfolgt stufenweise auf einem Feature-Branch.

Empfohlene Reihenfolge:

1. Step Contract + Migration,
2. Kunden-Overlay,
3. Kontextauflösung,
4. Bild-/Screenshot-Erweiterung,
5. Tour-Engine,
6. Training,
7. Prüfung,
8. Fortschritt,
9. Coverage Scanner,
10. E2E + Regression,
11. TESTSERVICE,
12. erst danach Production.

Keine Teilfunktion wird als fertig gemeldet, solange ihr zugehöriger Test nicht bestanden ist.

## 25. Akzeptanzkriterien

Das System gilt erst als fachlich fertig, wenn:

1. alle aktiven Prozess-SOPs weiterhin erreichbar sind,
2. historische SOP-Fassungen erhalten bleiben,
3. Kundenbesonderheiten ohne doppelte Prozesspflege hinterlegt werden können,
4. ein SOP-Schritt Text, Bild, Tour, Training und Prüfung aus derselben Definition speisen kann,
5. Touren echte Benutzeraktionen validieren,
6. falsche Aktionen keinen Fortschritt auslösen,
7. Trainingsmodus produktive Side Effects technisch verhindert,
8. Prüfungsmodus ohne aktive Führung funktioniert,
9. Ergebnisse nachvollziehbar gespeichert werden,
10. relevante Schritte echte oder bewusst markierte fehlende Systembilder besitzen,
11. die Abdeckungsanalyse fehlende SOPs und Tour-Zuordnungen sichtbar macht,
12. Desktop und Mobile funktionieren,
13. keine Regression in den geschützten ExportHUB-Kernprozessen entsteht.

## 26. Qualitätsfrage

Für jede freizugebende SOP gilt:

> Kann ein neuer Mitarbeiter, der den Prozess noch nie durchgeführt hat, allein anhand der SOP, Bilder oder Tour den Vorgang korrekt und vollständig durchführen?

Wenn die Antwort **Nein** lautet, ist die SOP nicht vollständig.

## 27. Nicht-Ziele dieser Ausbaustufe

Nicht Bestandteil dieses Designs sind:

- Ersetzen produktiver ExportHUB-Prozesslogik durch SOP-Code,
- automatische fachliche Freigabe durch KI,
- ungeprüftes Crawlen aller DOM-Elemente als vermeintliche SOP-Schritte,
- Verwendung echter Kundendaten für Trainings-Screenshots,
- automatisches Ausführen produktiver Schritte während einer Tour.

## 28. Designentscheidung

ExportHUB erhält **kein zweites SOP-System**.

Der vorhandene versionierte SOP-Kern bleibt die Dokumentenquelle. Die neue Architektur ergänzt ihn um einen strukturierten Step Contract, Kunden-Overlays, Kontextauflösung, Tour-Validierung, sichere Trainingsausführung, Prüfungslogik und Abdeckungsanalyse.

Damit bleibt die vorhandene Historie erhalten und gleichzeitig entsteht aus denselben fachlichen Schritten ein vollständiges Einarbeitungs- und Schulungssystem.
