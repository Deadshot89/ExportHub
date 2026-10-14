# SOPMaster Implementation Roadmap

**Status:** Fachliches Design freigegeben, Implementierungspläne bereit  
**Design:** `docs/superpowers/specs/2026-10-12-sopmaster-training-tour-system-design.md`  
**Design-Basis:** `main` @ `f84157c1678f53264ccbf2359d6e3002b4ef977c` (RC1499)

## Ziel

SOPMaster erweitert das bestehende ExportHUB-SOP-System zu einem vollständigen SOP-, Bild-, Tour-, Trainings- und Prüfungssystem. Der vorhandene versionierte SOP-Kern, die 24 aktiven Prozess-SOPs, die historischen 75 Dokumente und die realen Systembilder bleiben erhalten.

## Umsetzungspakete

1. **Core & Customer Overlays**  
   `2026-10-12-sopmaster-core-overlays.md`  
   Unified Step Contract, sichere Model-Migration, Kunden-Overlays, Kontextauflösung.

2. **Interactive Tour Engine**  
   `2026-10-12-sopmaster-tour-engine.md`  
   Erfolgsvalidierung, Tour-Session, stabile `data-tour-key`-Ziele, zugängliche Tour-UI, Browser-E2E.

3. **Visual Guide & Editor**  
   `2026-10-12-sopmaster-visual-editor.md`  
   Schrittbilder, Annotationen, Zoom, sichere Demo-Screenshot-Pipeline, SOP-/Overlay-Editor, Tour-Ziel-Picker.

4. **Training, Exam & Progress**  
   `2026-10-12-sopmaster-training-exam-progress.md`  
   Demo-only Trainings-Sandbox, geführtes Training, lösungsfreier Prüfungsmodus, versionsgebundener Mitarbeiterfortschritt.

5. **Coverage, Integration & Release**  
   `2026-10-12-sopmaster-coverage-integration-release.md`  
   Explizites Funktionsregister, Abdeckungsanalyse, Admin-Dashboard, Gesamt-E2E, Drei-Umgebungen-Build, TESTSERVICE- und Production-Gates.

## Verbindliche Reihenfolge

```text
Core / Overlays
      ↓
Tour Engine
      ↓
Visual Guide / Editor
      ↓
Training / Exam / Progress
      ↓
Coverage / Integration / Release
```

Die Reihenfolge ist absichtlich seriell, obwohl einzelne Dateien theoretisch parallel bearbeitet werden könnten. Tour, Editor, Training und Coverage teilen zentrale SOP-Interfaces und würden bei paralleler Umsetzung unnötige Merge- und Vertragskonflikte erzeugen.

## Versionsregel

Die in den Plänen verwendeten RC1500–RC1504-Dateinamen sind **provisorische Reservierungen für die Implementierungsphase**.

Vor dem ersten Produktcode-Commit muss:

1. der Implementierungsbranch auf den neuesten `main`-Stand gebracht werden,
2. geprüft werden, welche RC inzwischen aktuell ist,
3. der nächste freie zusammenhängende RC-Bereich reserviert werden,
4. nur die RC-spezifischen Dateinamen/Marker angepasst werden.

Die öffentlichen Modulverträge und die fachliche Architektur bleiben davon unberührt.

## Paket-Gates

Jedes Paket muss vor Start des nächsten Pakets mindestens bestehen:

- seine neuen RED→GREEN Unit-/Contract-Tests,
- die betroffenen bestehenden SOP-Regressionstests,
- `npm test`,
- bei UI-Änderungen `npm run test:accessibility`,
- bei Browser-Funktionen die vorgesehenen Playwright-Tests.

Ein Paket wird nicht als fertig gemeldet, wenn sein Testvertrag noch rot oder nicht ausgeführt ist.

## Bestandsschutz

Während aller Pakete bleiben besonders geschützt:

- Sendung anlegen/speichern,
- Reload/Persistenz,
- QR aktivieren,
- Statuswechsel,
- ABD,
- Abholung,
- POD,
- Gesamtdruck/Dokumente,
- Avis,
- Mail,
- Palettenkonto,
- Login/Navigation,
- Archiv/Audit.

SOPMaster darf diese Prozesse beobachten, beschreiben oder in Demo simulieren, aber produktive Handler nicht ersetzen.

## Abdeckung der freigegebenen Spezifikation

| Designanforderung | Umsetzungspaket |
| --- | --- |
| Prozess-/Funktions-SOPs erhalten und strukturieren | Core & Overlays |
| Kunden-SOP ohne doppelte Prozesspflege | Core & Overlays |
| Kontextbezogene SOP | Core & Overlays |
| Detaillierte Unified Steps | Core & Overlays |
| Interaktive Tour mit echter Benutzeraktion | Tour Engine |
| Richtige/falsche Aktion validieren | Tour Engine |
| Pause/Fortsetzen/Fortschritt | Tour Engine |
| Echte Screenshots pro Schritt | Visual Guide & Editor |
| Markierungen/Zoom/mehrere Bilder | Visual Guide & Editor |
| SOP-/Schritt-/Overlay-Administration | Visual Guide & Editor |
| Tour-Ziel per UI auswählen | Visual Guide & Editor |
| Sicherer Trainingsmodus | Training, Exam & Progress |
| Geführter Modus | Tour + Training |
| Prüfungsmodus | Training, Exam & Progress |
| Mitarbeiterfortschritt je SOP-Version | Training, Exam & Progress |
| Automatische SOP-Abdeckungsanalyse | Coverage & Release |
| 🔴/🟡/🟢/🔵/🟣 Status und Quote | Coverage & Release |
| Desktop/Tablet/Mobile/A11y | alle UI-Pakete + Release |
| TESTSERVICE vor Produktion | Coverage & Release |
| Vollständige Kernprozess-Regression | Coverage & Release |
| Abschlussbericht mit Vorher/Nachher und % | Coverage & Release |

## Definition of Done Gesamtprojekt

SOPMaster ist erst vollständig, wenn:

- alle fünf Umsetzungspakete grün sind,
- historische SOP-Versionen/Audits unverändert nachweisbar bleiben,
- Kunden-Overlays ohne doppelte Prozesskopie funktionieren,
- Touren den Benutzer selbst arbeiten lassen und echte Zustände validieren,
- Training produktive Side Effects technisch verhindert,
- Prüfungen ohne Lösungshinweise laufen,
- Fortschritt je Nutzer/SOP/Version erhalten bleibt,
- Bild- und Tourlücken im Coverage-Dashboard sichtbar werden,
- Desktop, Tablet und Mobile funktionieren,
- das komplette bestehende Release-/Kernprozess-Gate grün bleibt,
- TESTSERVICE auf demselben Release-SHA erfolgreich geprüft wurde,
- die freigegebene Production-Version anschließend erfolgreich gesmoked wurde.

Erst dann darf der Gesamtfortschritt mit **100 %** ausgewiesen werden.
