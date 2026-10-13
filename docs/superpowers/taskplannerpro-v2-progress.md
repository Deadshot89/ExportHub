# TaskPlannerPro V2 – Integrations- und Freigabestatus

**Stand:** 13.10.2026  
**Branch:** `taskplannerpro/v2-task10`  
**Produktionsfreigabe:** **NICHT erfolgt** – separater expliziter Release-Schritt

## Gesamtstatus

| Paket | Status | Nachweis |
|---|---|---|
| 1–9 | ✅ | Implementierung, Migration, Recurrence, Planner, UI, Workflow, Public Links, Projektionen, Performance und Release-Härtung vorhanden und automatisiert getestet |
| 10 – TESTSERVICE-Abnahme | ✅ | Rehearsal `38433811927 = SUCCESS`; Branch Verification `38433811936 = SUCCESS` |
| 11 – Integration Review / Production-Readiness Handoff | 🟡 | Architektur- und Spec-Audit abgeschlossen; RC1519 in Branch integriert; finale Branch-Verifikation und Integrations-PR sind der letzte Handoff-Schritt |

## TESTSERVICE-Nachweis – Paket 10

Der vollständige TESTSERVICE-Rehearsal wurde erfolgreich durchgeführt.

- Run: `38433811927 = SUCCESS`
- getesteter TaskPlanner-Kandidat: `0516ef18167e204ed8219ab70a40fe0d4f23a551`
- Branch-Verifikation dazu: `38433811936 = SUCCESS`
- Migration: `safe:true`
- Tasks vorher/nachher: `8 / 8`
- State-Hash vorher/nachher: identisch
- Identity-Kollisionen: `0`
- ungelöste Beziehungen/Dependencies: `0`
- Backup-Readback: verifiziert
- temporärer Rehearsal-Endpunkt nach Cleanup: entfernt / 404
- Produktion berührt: `false`

Nach dem Live-Rehearsal wurde ausschließlich RC1519 aus `main` integriert. RC1519 ändert den Main-Buildvertrag und dessen Regressionstest; der TaskPlanner-Runtime-/State-Code des live geprüften Kandidaten wird dadurch nicht verändert. Der aktuelle Branch wird deshalb nach dem Sync erneut vollständig automatisiert verifiziert.

## Architekturreview – Paket 11 / Schritt 1

### Eine kanonische Task-Datenbasis

- aktive Aufgaben bleiben in `state.tasks`
- Serien, Templates, Kalender, Settings und Archiv sind ergänzende Task-Modul-Collections
- alle neuen persistierten Task-Keys bleiben dem serverseitigen Recht `tasks` zugeordnet
- parallele State-Merges erhalten unabhängige Serien, Templates, Archiv-, Settings- und Kalenderänderungen und vermeiden ID-Dubletten

### Ein Recurrence-Owner

- V2-Serien werden von der V2-Recurrence-Engine materialisiert
- strukturierte V2-Workflow-Aufgaben werden nicht zusätzlich von der Legacy-Snapshot-Automatik erledigt
- bestehende Legacy-Aufgaben ohne V2-Workflow-Bindung behalten die Legacy-Kompatibilität

### Ein sichtbarer Planner-/DnD-Owner

- `ExportHUBTaskUIV2.renderPlannerPage` ist der V2-Planner-Renderer
- View-Event-Binding wird pro Host nur einmal gesetzt
- bestehender DnD-Handler wird vor Re-Render bereinigt
- Drag & Drop nutzt bevorzugt `ExportHUBRC1014TaskRuntime.moveTaskOccurrence`
- Runtime-Bridge erweitert den bestehenden RC1014-Owner, statt einen parallelen Runtime-Owner anzulegen

### Kein render-getriggerter Save

- Render-/Projektionspfade sind read-only
- Persistenz wird nur von fachlichen Mutationen aufgerufen
- `applyTaskPatch` persistiert eine Änderung exakt einmal
- `applyWeekPlan` kann mehrere Planner-Patches mit genau einem Persist-Aufruf übernehmen
- reine UI-Filter invalidieren den stabilen Projektionscache nicht und persistieren nicht

### Produktionsmarker unverändert

- TaskPlanner-Pretests dürfen Produktionsmarker/Release-Version nicht verändern
- TESTSERVICE-Rehearsal meldet `productionTouched:false`
- Paket 11 führt keinen Production-Deploy aus

### Public-Link-Sicherheit

- Public Endpoint ist absichtlich read-only/anonym
- Zugriff nur über kryptografisch zufälliges Token; serverseitig wird nur dessen SHA-256-Hash verglichen
- Environment-Isolation und Widerruf werden geprüft
- Response verwendet eine explizite Feld-Whitelist
- interne IDs, Kommentare, Historie und nicht freigegebene interne Daten werden nicht öffentlich ausgegeben

## Spec-Coverage – Paket 11 / Schritt 2

| Spec | Implementierungs-/Testnachweis |
|---|---|
| 1 Ziel | Paket 1–10 + TESTSERVICE-Rehearsal |
| 2 Grundsätze | Migration/Release-, State-Rights-, Performance- und Security-Gates |
| 3 Migrationsrisiko | Compat-, Migration-, State-Merge- und Legacy-Regressionstests |
| 4 Architektur | Core, Recurrence, Planner, Workflow, Reminder, Projections, Runtime-Bridge |
| 5 Persistenzmodell | State-Rights + State-Merge + Migration |
| 6 Zeitmodell | Core-/Calendar-Verträge inkl. 16:15 und Europe/Berlin |
| 7 Wiederholungsmodell | Recurrence-Verträge inkl. Wochentage, X-Wochen, Monat/Jahr und Workday-Regeln |
| 8 Arbeitstage/Feiertage | Calendar- und Recurrence-Tests inkl. NRW-/Firmenkalender und Policies |
| 9 Drag & Drop | Planner + DnD-Runtime-Owner + Performance-Hotpath |
| 10 Überfällig | Core/Planner/UI-Verträge |
| 11 Erledigen/Checkliste/Archiv | Task-UI, Core, Runtime-Bridge, Projections |
| 12 Abhängigkeiten | Planner-Verträge inkl. Blockierung/Zyklusprüfung |
| 13 Kunden/Bereiche/Prozesse | Projections + Workflow Matching |
| 14 Vorlagen | Task-UI/Core-Verträge für Templates |
| 15 Erinnerungen | `taskplanner-v2-reminders.test.mjs` |
| 16 Planner/Wochenplan | Planner + Planner-UI + Runtime-Bridge |
| 17 Aufgabenansicht/UI | Task-UI + Planner-UI + Accessibility |
| 18 Dashboard | Projection-Integration + Performance |
| 19 Workflow Events | Workflow + Workflow-Bindings + Lifecycle-Workflow-Owner |
| 20 Sofortige Synchronisierung | Runtime-Bridge Event-/Persist-Verträge + Projection Cache |
| 21 Historie | Core/Workflow/Runtime + Archiv-Projektionen |
| 22 Öffentliche Links | Public-Link API/UI + Release-Hardening/Security |
| 23 Statistik | Projections + Performance/Pagination |
| 24 Performance | `taskplanner-v2-performance.test.mjs` + DnD-Hotpath-Regressions |
| 25 Migration | Migration-Audit + Rehearsal-State + TESTSERVICE-Rehearsal |
| 26 Fehlerbehandlung | fail-closed Migration, Workflow-Ambiguität, Rechte/State-Merge, Calendar Policies |
| 27 Teststrategie | RED-GREEN Contracts + Full Repository Regression + Security/Accessibility/i18n |
| 28 Implementierungszerlegung | Pakete 1–10 umgesetzt und einzeln verifiziert |
| 29 Abnahmekriterien | TESTSERVICE live grün; Integritätsnachweis grün; finale Branch-Verifikation vor PR |
| 30 Nicht-Ziele | keine D365-Abhängigkeit; keine fachfremde QR/POD/Avis-/Dokument-Neugestaltung |

## RC1519-Synchronisierung

`main` lief nach dem TESTSERVICE-Rehearsal auf RC1519 weiter. Der Branch wurde deshalb vor dem Handoff mit `main` synchronisiert.

- vorher: Branch `1` Commit hinter `main`
- integrierter Main-Commit: `de2715b212026ef5d570a3d88eed2f3cc099abbd`
- Sync-Merge auf TaskPlanner-Branch: `cc5a061ea2a8fd543cbc4bd1ae2338245a3cb312`
- danach: Branch `0` Commits hinter `main`
- Inhalt RC1519: Bereinigung einer falschen Public-Language-Assertion im Main-Buildvertrag + zugehöriger Regressionstest

## Vorher / Nachher

**Vorher:** mehrere historische Task-/Planner-Verantwortungen, uneinheitliche Zeit-/Serienfelder, fehlende belastbare V2-Migrations- und Release-Nachweise.  
**Nachher:** kanonisches V2-Modell mit klar getrennten Engines, zentraler Runtime-/Persist-Verantwortung, deterministischen Serien, Workday-Kalender, Planner/Monat, Workflow-Automatik, Public Read-only Links, gemeinsamen Projektionen, Archiv/Statistik und abgesichertem TESTSERVICE-Rehearsal.

## Verbleibender Handoff

1. aktuelle Branch-Verifikation nach RC1519-Sync vollständig grün abschließen
2. Integrations-PR `taskplannerpro/v2-task10` → `main` öffnen
3. PR **nicht** automatisch mergen
4. Produktionsfreigabe/Release-Center bleibt eine separate explizite Entscheidung

`release-version.json`, Produktionsmarker und Production-Deployment werden in Paket 11 nicht vorzeitig geändert.
