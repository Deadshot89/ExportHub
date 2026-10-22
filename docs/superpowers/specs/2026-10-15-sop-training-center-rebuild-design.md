# SOP & Training Center – Clean Rebuild Design

**Datum:** 15.10.2026  
**Status:** Technische Spezifikation zur Umsetzung  
**Scope:** Vollständiger Neuaufbau der bestehenden ExportHUB360-Funktion „SOP“  
**Grundsatz:** Kein altes SOP-Design, keine alten SOP-Datenmodelle, keine alten SOP-Inhalte und keine alten Tour-/Training-Daten werden übernommen.

## 1. Ziel

Die bisherige Funktion „SOP“ wird vollständig durch ein neues **SOP & Training Center** ersetzt.

Das neue System muss:

1. Standardprozesse dokumentieren,
2. kundenspezifische Abweichungen separat verwalten,
3. echte interaktive Trainings auf der realen ExportHUB360-Oberfläche ermöglichen,
4. Demo-Geschäftsdaten vollständig von produktiven Geschäftsdaten isolieren,
5. responsive, barrierearm, tastaturbedienbar und theme-kompatibel sein,
6. später beliebig viele weitere SOPs und Trainings auf derselben Engine ermöglichen.

Das System wird neu entworfen. Historische SOPMaster-Strukturen dienen nicht als Daten- oder UI-Basis.

## 2. Harte Abgrenzung zum alten SOP-System

Nicht übernehmen:

- bisherige SOP-Seitenstruktur,
- bisherige SOP-Karten,
- bisherige SOP-Texte,
- bisherige SOP-Nummerierung und Kataloglogik,
- bisherige Kunden-Overlays,
- bisherige Tourdefinitionen,
- bisherige Trainings- und Prüfungsdefinitionen,
- bisherige SOP-Screenshots,
- bisherige SOP-Favoriten,
- bisherige Zuletzt-verwendet-Listen,
- bisherige SOP-Lernfortschritte,
- bisherige SOP-Versionen und SOP-Auditdaten,
- alte SOP-spezifische UI-Komponenten und CSS-Strukturen.

Die produktiven ExportHUB360-Geschäftsfunktionen bleiben unverändert:

- Sendungen,
- Kunden,
- Aufgaben,
- ABD,
- Zoll,
- Dokumente,
- QR,
- Abholungen,
- Ladelisten,
- POD,
- Palettenkonto,
- Geschäftshistorie.

Die Entfernung alter SOP-Daten darf niemals diese Geschäftsdaten berühren.

## 3. Hauptnavigation

Das neue „SOP & Training Center“ besitzt drei Hauptbereiche:

1. **Standardprozesse**
2. **Kundenspezifische SOPs**
3. **Interaktive Touren / Trainings**

Zusätzliche globale Funktionen:

- SOP-Suche,
- Kategorien,
- Favoriten,
- zuletzt verwendete SOPs,
- Änderungsdatum,
- Version,
- Verantwortlicher,
- Verknüpfung Standard-SOP ↔ Kunden-SOP,
- Lernfortschritt.

## 4. Oberflächenarchitektur

### Desktop

- linke Navigation: Bereiche, Kategorien, Kapitel,
- mittlerer Hauptbereich: SOP- oder Trainingsinhalt,
- optionale rechte Leiste: Kontext, Fortschritt, Metadaten,
- globale Suche oberhalb des Inhalts,
- keine Überlagerung zentraler Formularfelder durch Tour-Panels.

### Tablet / Mobil

- linke Navigation einklappbar,
- Kontextleiste als Drawer/Bottom-Sheet,
- große Touch-Ziele,
- Fokusrahmen und Tour-Panel dynamisch positioniert,
- keine festen Bildschirmkoordinaten.

Die Darstellung verwendet das bestehende ExportHUB360-Designsystem und muss mit allen vorhandenen Themes funktionieren, ohne das Layout anderer Funktionen zu verändern.

## 5. Neues Datenmodell

Das neue System erhält eigene Datenbereiche. Alte `isoSops`- und alte SOPMaster-Katalogstrukturen werden nicht als Quelle des neuen Systems verwendet.

### 5.1 Standardprozess

```js
{
  id,
  slug,
  title,
  categoryId,
  summary,
  version,
  status,
  ownerUserId,
  changedAt,
  steps: [],
  relatedCustomerSopIds: [],
  screenshotIds: [],
  trainingScenarioIds: []
}
```

### 5.2 SOP-Schritt

```js
{
  stepId,
  order,
  route,
  title,
  shortInstruction,
  explanation,
  purpose,
  checkpoints: [],
  commonErrors: [],
  warnings: [],
  screenshotId,
  targetElement,
  expectedAction,
  validation: [],
  helpText,
  successText,
  nextStep,
  demoData
}
```

### 5.3 Kunden-SOP

```js
{
  id,
  customerId,
  title,
  baseProcessId,
  version,
  ownerUserId,
  changedAt,
  sections: {
    shipping: [],
    packaging: [],
    notification: [],
    avisLink: [],
    contacts: [],
    email: [],
    documents: [],
    deliveryNotes: [],
    cmr: [],
    abd: [],
    customs: [],
    labeling: [],
    deadlines: [],
    pickup: [],
    portals: [],
    attachments: [],
    specialChecks: [],
    knownErrors: [],
    notes: []
  }
}
```

Kunden-SOPs enthalten ausschließlich zusätzliche oder abweichende Anforderungen. In der UI wird immer sichtbar angezeigt:

> Es gilt zusätzlich der Standardprozess „…“.

### 5.4 Training

```js
{
  id,
  title,
  processId,
  version,
  description,
  steps: [],
  demoSeed,
  completionPolicy
}
```

### 5.5 Lernfortschritt

Nur diese Metadaten dürfen dauerhaft gespeichert werden:

```js
{
  userId,
  trainingId,
  version,
  completed,
  progressPercent,
  completedAt,
  updatedAt
}
```

Keine Demo-Geschäftsdaten dürfen in Lernfortschritt gespeichert werden.

## 6. Erste Standard-SOP

Titel:

**Sendung in ExportHUB360 anmelden**

Die SOP muss ausschließlich reale, zum Implementierungszeitpunkt vorhandene UI-Komponenten und Feldbezeichnungen verwenden.

Mindestens folgende Kapitel:

1. Sendungsfunktion öffnen
2. Neue Sendung beginnen
3. Kunde auswählen
4. Empfänger / Standort prüfen
5. Referenz prüfen bzw. nach realer aktueller Logik behandeln
6. Sendungsdaten erfassen
7. Colli erfassen
8. Gewicht erfassen
9. Dokumente prüfen
10. Lieferscheine prüfen
11. Gesamtprüfung
12. ABD-Pflicht prüfen
13. Zollprozess bei Bedarf
14. Sendung speichern
15. Status kontrollieren
16. QR-/Abholprozess
17. Abschlusskontrolle

Jeder Schritt zeigt strukturiert:

- Titel,
- kurze Arbeitsanweisung,
- ausführliche Erklärung,
- Zweck,
- Kontrollpunkte,
- mögliche Fehler,
- Hinweise/Warnungen,
- Screenshot/Beispielgrafik,
- passende Website-Stelle,
- Button **Auf Website zeigen**,
- Button **Tour ab hier starten**.

Keine langen unstrukturierten Textblöcke.

## 7. Interaktive Tour-Engine

Die neue Tour-Engine arbeitet auf echten ExportHUB360-Komponenten.

### 7.1 Tour-Schrittvertrag

Jeder Schritt enthält mindestens:

- `stepId`
- `route`
- `targetElement`
- `title`
- `instruction`
- `expectedAction`
- `validation`
- `helpText`
- `successText`
- `nextStep`
- optional `demoData`

### 7.2 Zielauflösung

Keine festen Bildschirmkoordinaten.

Relevante Komponenten erhalten stabile DOM-/Komponenten-Identifier, z. B.:

```html
<button data-training-target="shipment-new">Neue Sendung</button>
```

Die Engine löst Ziele ausschließlich über stabile Identifier bzw. zentral registrierte Component-Keys auf.

### 7.3 Aktionsvalidierung

Der Benutzer muss selbst handeln.

Unterstützte Aktionen mindestens:

- click,
- input,
- change,
- select,
- upload-demo,
- open-modal,
- close-modal,
- navigate,
- decision,
- save-demo,
- confirm.

Fortschritt erfolgt erst, wenn sowohl Aktion als auch erwarteter Zustand korrekt sind.

Falsche Aktion:

- kein Fortschritt,
- verständliche Hilfestellung,
- kein produktiver Nebeneffekt.

## 8. Trainingsszenario „Meine erste Sendung“

Das erste vollständige Training umfasst:

1. neue Sendung öffnen
2. Demo-Kunden auswählen
3. Empfänger prüfen
4. Sendungsdaten erfassen
5. Colli erfassen
6. Gewicht erfassen
7. Dokumente kontrollieren
8. fehlendes Dokument erkennen
9. Sendungsprüfung durchführen
10. Zoll-/ABD-Pflicht beurteilen
11. Beispiel-Zollinformationen prüfen
12. Sendung fertigstellen
13. Ergebnis kontrollieren

Spätere Trainings verwenden dieselbe Engine:

- Kunde anlegen/verwalten
- Sendung prüfen
- ABD erstellen
- Zollprüfung
- Abholung
- QR-Prozess
- Dokumentenprüfung
- Ladeliste
- POD
- kundenspezifische Prozesse.

## 9. Strikter Demo-Modus

### 9.1 In-Memory Training State

Alle Demo-Geschäftsdaten leben ausschließlich in einem temporären In-Memory-State.

Beispiele:

- Demo-Kunde,
- Demo-Empfänger,
- Demo-Sendung,
- Demo-Colli,
- Demo-Dokumente,
- Demo-ABD,
- Demo-Zollinformationen.

Beim Beenden oder Reload werden sie verworfen.

### 9.2 Verbotene Speicherziele

Demo-Geschäftsdaten dürfen niemals gespeichert werden in:

- produktiver Datenbank,
- Sendungen,
- Kunden,
- Aufgaben,
- ABD,
- Dokumenten,
- Ladelisten,
- Abholungen,
- Palettenkonto,
- Geschäftshistorie,
- LocalStorage,
- SessionStorage.

### 9.3 Write Guard

Alle schreibenden produktiven Wege müssen während des Trainings durch eine zentrale Sicherheitsschicht laufen:

```text
Training UI
   ↓
Training Controller
   ↓
Training Write Guard
   ├── Demo Adapter → In-Memory State
   └── Productive API → BLOCKED
```

Die Sicherheit darf nicht nur auf UI-Ebene beruhen.

Ein produktiver Schreibaufruf im Training ist ein Testfehler und muss hart blockiert werden.

## 10. Sichtbarer Trainingsmodus

Während der gesamten Tour permanent:

**TRAININGSMODUS – KEINE PRODUKTIVDATEN**

Darunter:

**Alle Kunden, Sendungen, Dokumente und Zollinformationen dieser Tour sind Beispieldaten und werden nicht produktiv gespeichert.**

Die Kennzeichnung:

- bleibt beim Navigieren sichtbar,
- funktioniert in allen Themes,
- verändert nicht das normale Produktivlayout,
- ist per Screenreader erkennbar.

## 11. Fortschritt und Bedienung

Tour zeigt:

- Schritt X von Y,
- Prozentfortschritt,
- erledigte Schritte,
- aktuelle Aufgabe,
- kommende Schritte.

Bedienung:

- Pause,
- Fortsetzen,
- Neu starten,
- Tour beenden,
- Escape beendet nach Bestätigung,
- Fokusführung in Overlays,
- Fokus kehrt sinnvoll zur Anwendung zurück.

## 12. Screenshots

Screenshots werden separat von Text und Schritten verwaltet.

```js
{
  id,
  processId,
  stepId,
  src,
  alt,
  caption,
  updatedAt
}
```

Ein Screenshot kann ersetzt werden, ohne den SOP-Schritt neu anzulegen.

Screenshots müssen aus sicherer Demo-/Testumgebung stammen und dürfen keine echten Kundendaten zeigen.

## 13. Migration / Cutover

Es gibt **keine fachliche Datenmigration** aus dem alten SOP-System.

Der Cutover erfolgt kontrolliert:

1. neues System auf isoliertem Entwicklungsbranch bauen,
2. neue Datenstrukturen initial leer bereitstellen,
3. neue Standard-SOP und Training erstellen,
4. alle neuen Tests auf TESTSERVICE ausführen,
5. prüfen, dass alte SOP-Daten nicht als Fallback gelesen werden,
6. alten SOP-Einstieg deaktivieren,
7. alte SOP-spezifische Daten gezielt entfernen,
8. produktive Geschäftsbestände vorher/nachher vergleichen,
9. neues SOP & Training Center aktivieren,
10. Produktion-Smoketest durchführen.

Alte SOP-Daten dürfen erst entfernt werden, wenn bewiesen ist, dass der Löschpfad ausschließlich SOP-spezifische Schlüssel/Bestände betrifft.

## 14. Tests

Pflichttests vor Fertigstellung:

### Training

1. Tour starten
2. Demo-Kunde erscheint
3. Demo-Sendung vollständig bearbeiten
4. richtige Aktionen werden erkannt
5. falsche Aktionen werden abgefangen
6. Zoll-/ABD-Demo funktioniert
7. Tour beenden
8. Browser aktualisieren
9. erneut anmelden
10. produktiven Datenbestand prüfen

Erwartung nach 7–10:

- keine Demo-Kunden,
- keine Demo-Sendungen,
- keine Demo-Dokumente,
- keine Demo-ABDs,
- keine Demo-Aufgaben,
- keine Demo-Ladelisten,
- keine Demo-Abholungen,
- keine Demo-Palettenbewegungen,
- keine Demo-Historieneinträge.

### Regression

Mindestens unverändert testen:

- normale produktive Sendungserstellung,
- Sendung speichern,
- QR aktivieren,
- Statuswechsel,
- ABD,
- Zoll,
- Dokumente,
- Abholung,
- Ladeliste,
- POD.

### UI

- Desktop,
- Tablet,
- Smartphone,
- alle vorhandenen Themes,
- Tastaturbedienung,
- Fokusführung,
- kein Horizontal-Overflow,
- kein Overlay über notwendigen Bedienelementen.

## 15. Definition of Done

Die Funktion gilt erst als **100 % fertig**, wenn:

1. das neue SOP & Training Center auf Produktion aktiv ist,
2. der alte SOP-Bereich nicht mehr erreichbar ist,
3. alte SOP-spezifische Daten entfernt oder technisch vollständig stillgelegt sind,
4. keine alten SOP-Daten als Fallback gelesen werden,
5. „Sendung in ExportHUB360 anmelden“ vollständig funktioniert,
6. „Meine erste Sendung“ vollständig funktioniert,
7. kein Demo-Geschäftsobjekt Produktivpersistenz erreicht,
8. Reload und erneute Anmeldung keine Demo-Daten wiederherstellen,
9. produktive Sendungserstellung weiterhin fehlerfrei funktioniert,
10. Produktions-Smoketest erfolgreich ist.

Vor erfolgreichem Produktionsnachweis darf der Fortschritt nicht mit 100 % ausgewiesen werden.

## 16. Sicherheitsregel für Rückfragen

Fehlende zwingende Informationen oder Entscheidungen werden gegenüber dem Auftraggeber deutlich mit `🔴 BENÖTIGT:` markiert. Solange eine solche Information nicht tatsächlich zwingend für eine sichere Entscheidung erforderlich ist, wird ohne unnötige Rückfrage weitergearbeitet.
