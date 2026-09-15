# ExportHUB Browser-E2E- und Release-Gate-Design

Datum: 2026-09-15  
Status: zur Freigabe  
Zielrelease: nächster konsolidierter Release nach RC1123

## 1. Ziel

ExportHUB soll vor jedem produktiven Release nicht nur durch statische Node-/Regex-Verträge, sondern durch reale Browser-Tests gegen eine tatsächlich gestartete bzw. bereitgestellte Anwendung geprüft werden.

Der neue QA-Pfad muss insbesondere Fehlerklassen erkennen, die bisher trotz grüner CI bis in den Browser gelangt sind:

- falsche Navigation bzw. falsche View-Zuordnung,
- sichtbarer JavaScript-/CSS-Code im DOM,
- nicht öffnende Reiter oder Buttons,
- kaputte Formulare oder Modale,
- horizontales Überlaufen und abgeschnittene Inhalte,
- fehlerhafte Browser-Zurück-/F5-Navigation,
- Unterschiede zwischen Desktop, Tablet und Smartphone,
- kritische Regressionen in Sendung, Aufgaben, Benachrichtigungen, Kunden, Dokumenten, QR und Lieferavis.

## 2. Grundsatz

Bestehende 228 Node-/Vertragstests bleiben erhalten. Playwright wird als zusätzliche reale Browser-Ebene eingeführt.

Die QA-Pyramide lautet danach:

1. Node-/Unit-/Contract-Tests für Fachlogik und APIs.
2. Build-/HTML-Integritätsprüfungen für erzeugte Artefakte.
3. Playwright-Browser-Smokes gegen den gebauten TESTSERVICE-Kandidaten.
4. Azure-Deploy nach TESTSERVICE.
5. Playwright-Live-Smokes gegen TESTSERVICE.
6. Produktions-Deploy nur, wenn alle P0-Smokes grün sind.
7. Live-Smoke gegen Produktion nach Deploy.

Ein grüner Node-Test allein ist künftig keine ausreichende Freigabe für Produktion.

## 3. Scope des ersten E2E-Releases

### 3.1 P0 – Navigation und Browser-Grundfunktion

Automatisch zu prüfen:

- Loginseite lädt ohne sichtbaren Quellcode oder kaputtes Layout.
- Login führt in den geschützten Arbeitsbereich.
- Dashboard öffnet korrekt.
- Jeder Hauptmenüpunkt öffnet die erwartete View und nur diese View.
- "Sendung erstellen" öffnet die Erfassungsmaske, nicht Historie oder eine andere Ansicht.
- Aufgaben, Aufgaben Planner, Benachrichtigungen, Abholkalender, Sendungsübersicht, Sendungsansicht, Ladeliste & CMR, Lager, Kundenordner, Palettenkonto, Versandkosten, Zollwissen, SOP & Portale, Academy und Prüfungen öffnen jeweils ihren eigenen Bereich.
- Browser-Zurück und Browser-Vor funktionieren ohne Logout oder View-Verwechslung.
- F5 auf einer geöffneten Hauptansicht führt nicht zu einem falschen Modul.
- Kein JavaScript-/CSS-Quelltext wird als normaler Seiteninhalt gerendert.
- Keine unerwartete horizontale Seitenscrollbar auf den definierten Viewports.

### 3.2 P0 – Sendung erstellen

Automatisch zu prüfen:

- Formular wird sichtbar.
- Kunde kann gewählt werden.
- Standortauswahl reagiert auf den gewählten Kunden.
- Referenz akzeptiert genau sechs alphanumerische Zeichen.
- Colli-Zeile kann hinzugefügt werden.
- Anzahl, Gewicht, LDM und Maße sind editierbar.
- Dokumentbereich ist sichtbar.
- Mailbereich ist sichtbar.
- Speichern reagiert und zeigt eindeutiges Benutzerfeedback.
- Nach Speichern ist die Sendung in der Übersicht auffindbar.
- Öffnen der gespeicherten Sendung zeigt dieselbe Referenz.
- Kritische Pflichtfelder verhindern ungültiges Speichern.

Der Test verwendet ausschließlich dedizierte E2E-Testdaten in TESTSERVICE.

### 3.3 P0 – Aufgaben und Benachrichtigungen

Automatisch zu prüfen:

- Aufgabenliste lädt.
- Benachrichtigungen laden.
- Karten mit ausschließlich dem Titel "Aufgabe" oder "Task" sind nicht zulässig.
- Zähler entspricht der tatsächlich gerenderten fachlichen Aufgabenmenge.
- Eine Aufgabe lässt sich öffnen.
- Erledigen verändert den Status.
- Erledigte Aufgabe wird nicht weiter als offen angezeigt.
- Doppelte fachlich identische Aufgaben werden in Benachrichtigungen nicht doppelt dargestellt.
- Aufgaben ohne fachlichen Inhalt werden nicht angezeigt.

### 3.4 P0 – öffentliche QR-/Avis-Pfade

Automatisch zu prüfen:

- bestehender Test-QR-Link öffnet die Pickup-Seite,
- neuer Test-QR-Link öffnet die Pickup-Seite,
- ungültiger Token wird kontrolliert abgelehnt,
- Referenzprüfung funktioniert,
- Lieferavis öffnet mit gültigem Testtoken,
- Dokumentliste wird angezeigt, wenn Dokumente vorhanden sind,
- abgelaufene oder deaktivierte Zugriffe liefern einen kontrollierten Fehlerzustand,
- öffentliche Seiten enthalten keinen geschützten internen Navigationsbereich.

Produktive QR-Tokens oder produktive Kundendaten werden von E2E-Tests niemals verändert.

### 3.5 P1 – Dokumente und Druck

Im zweiten Testblock:

- Deckblatt-Ansicht erzeugbar,
- L1/L2/CMR vorhanden, wenn fachlich erforderlich,
- Gesamtdruck öffnet einen druckbaren Dokumentkontext,
- Dokumente werden nicht leer ausgegeben,
- Warenbeschreibung bleibt vorhanden,
- Palettenkonto erscheint dort, wo vorgesehen,
- Druckaktionen zerstören nicht den Haupt-DOM.

Für Browser-Automation wird nicht der physische Drucker geprüft, sondern der erzeugte Druck-DOM bzw. das Druckfenster.

## 4. Viewport-Matrix

Verbindliche erste Matrix:

| Profil | Viewport | Zweck |
| --- | --- | --- |
| Mobile Small | 360 x 800 | kleines Android-Gerät |
| Mobile Standard | 390 x 844 | modernes Smartphone |
| Tablet | 768 x 1024 | Tablet Hochformat |
| Laptop | 1366 x 768 | typischer Arbeitsplatz |
| Desktop | 1920 x 1080 | Full-HD Arbeitsplatz |

Die vollständigen P0-Workflows laufen mindestens auf Laptop. Navigation, Quellcode-Leak, Overflow und Kernansichten laufen auf allen fünf Viewports.

## 5. Testarchitektur

### 5.1 Verzeichnisstruktur

Vorgesehen:

- `playwright.config.mjs`
- `e2e/fixtures/`
- `e2e/helpers/`
- `e2e/specs/navigation.spec.mjs`
- `e2e/specs/shipment-create.spec.mjs`
- `e2e/specs/tasks-notifications.spec.mjs`
- `e2e/specs/public-links.spec.mjs`
- `e2e/specs/responsive.spec.mjs`

### 5.2 Selektoren

Neue Tests dürfen nicht primär auf zufälligen CSS-Klassen oder sichtbaren Layoutdetails beruhen.

Priorität der Selektoren:

1. vorhandene semantische Rollen und Labels,
2. stabile IDs,
3. gezielt ergänzte `data-testid`-Attribute,
4. sichtbarer Text nur dort, wo Text selbst Vertragsbestandteil ist.

Neue `data-testid`-Attribute verändern keine Fachlogik und sind im Produktionsmarkup zulässig.

### 5.3 Testdaten

TESTSERVICE erhält dedizierte E2E-Testdatensätze mit eindeutigem Präfix:

- Kundenname: `E2E TEST ...`
- Referenzen: deterministisch sechs Zeichen
- Aufgaben: `E2E ...`
- Dokumente: kleine synthetische Testdateien

Die Tests dürfen keine produktiven Kunden, Sendungen, QR-Codes oder Dokumente löschen oder überschreiben.

Aufräumen erfolgt nur für Datensätze, die eindeutig durch den aktuellen E2E-Lauf erzeugt wurden.

### 5.4 Authentifizierung

Für TESTSERVICE wird ein eigener E2E-Benutzer verwendet.

Anforderungen:

- keine Verwendung persönlicher Zugangsdaten,
- Secret ausschließlich in GitHub Actions Secrets,
- minimale benötigte Rechte für normale P0-Tests,
- separater Admin-E2E-Benutzer nur für Admin-spezifische Tests,
- Sessions dürfen nicht in Artefakten oder Logs ausgegeben werden.

## 6. Browser-Sicherheitsprüfungen

Jeder Browserlauf enthält zusätzlich:

- keine unbehandelten `pageerror`-Ereignisse,
- keine unerwarteten Console-`error`-Meldungen,
- keine fehlgeschlagenen Kern-Requests,
- keine sichtbaren Quellcode-Muster im `body.innerText`,
- keine HTML-Parser-Leaks wie `window.open('about:blank'`, `function normalizeActionButtons`, `RC824_SOP_DETAILS` oder rohe CSS-Regeln,
- keine Navigation auf eine falsche ExportHUB-View nach einem Menü-Klick.

Bekannte und bewusst tolerierte Warnungen werden in einer kleinen Allowlist dokumentiert. Die Allowlist darf keine generischen JavaScript-Fehler enthalten.

## 7. Responsive-Prüfung

Für jede Kernansicht wird geprüft:

- `document.documentElement.scrollWidth <= viewportWidth + Toleranz`,
- Hauptnavigation bleibt erreichbar,
- kein wichtiger Button liegt vollständig außerhalb des Viewports,
- keine überlappenden Hauptkarten,
- Dialoge bleiben innerhalb des Viewports,
- Hauptüberschriften sind sichtbar,
- Formularfelder bleiben bedienbar.

Pixelperfekte Screenshot-Golden-Tests werden im ersten Schritt bewusst nicht als hartes Release-Gate verwendet. Screenshots werden bei Fehlern als Artefakt gespeichert.

## 8. Release-Gate

### 8.1 Vor TESTSERVICE-Deploy

Pflicht:

- `npm test`
- Security-Gate
- Accessibility-/Responsive-Vertrag
- Build-HTML-Integrität
- Playwright gegen lokal/CI bereitgestellten Kandidaten

### 8.2 Nach TESTSERVICE-Deploy

Pflicht:

- TESTSERVICE erreichbar,
- Login-Smoke,
- Navigation-Smoke,
- Sendung-erstellen-Smoke,
- Aufgaben-/Benachrichtigungs-Smoke,
- öffentliche Links-Smoke,
- Responsive-Smoke,
- keine Browser-/Console-/Page-Errors.

### 8.3 Vor Produktion

Produktion wird nur deployed, wenn alle P0-Checks auf TESTSERVICE erfolgreich sind.

Ein fehlgeschlagener P0-Test führt zu `exit 1` und blockiert Produktion vollständig.

### 8.4 Nach Produktion

Es laufen ausschließlich nicht-destruktive Live-Smokes:

- Seite erreichbar,
- Loginseite korrekt,
- Hauptbundle/HTML ohne Quellcode-Leak,
- öffentliche Seiten erreichbar,
- Produktionsmarker korrekt,
- keine sichtbare Fehlermeldung beim Start.

Produktive Sendungen werden im Post-Deploy-Smoke nicht erstellt oder verändert.

## 9. Fehlerartefakte

Bei einem Playwright-Fehler werden gespeichert:

- Screenshot,
- Trace,
- Browser-Konsole,
- relevante Netzwerkfehler,
- URL und Viewport,
- Testname und Commit-SHA.

Retention in GitHub Actions: 14 Tage für E2E-Fehlerartefakte.

Secrets, Sessiontokens, QR-Tokens und Dokumentinhalte werden vor Artefaktablage redigiert oder nicht aufgezeichnet.

## 10. Performance-Baseline

Der erste E2E-Schritt blockiert noch nicht anhand strenger Web-Vitals, erfasst aber:

- HTML-Größe,
- DOM-Elementanzahl,
- Zeit bis Arbeitsbereich sichtbar,
- Zeit für Navigation zwischen Hauptviews,
- Anzahl JavaScript-Fehler,
- Anzahl fehlgeschlagener Kern-Requests.

Nach zwei stabilen Releases werden daraus feste Budgets abgeleitet.

Das aktuell ca. 5,47 MB große `index.html` wird als technische Schuld erfasst und darf im ersten Schritt nicht weiter wachsen. Eine harte Obergrenze wird nach der Baseline gesetzt.

## 11. Nicht-Ziele dieses ersten Arbeitspakets

Nicht Bestandteil der ersten E2E-Einführung:

- vollständige Zerlegung des 5,47-MB-Monolithen,
- Redesign des ExportHUB,
- neue Fachfunktionen,
- produktives Android-Signing,
- Pixel-Golden-Tests für jede einzelne Seite,
- Lasttest mit vielen parallelen Benutzern.

Diese Punkte folgen nach Stabilisierung der Browser-QA.

## 12. Rollout-Reihenfolge

1. Playwright und Basiskonfiguration integrieren.
2. Testserver/Kandidatenstart in CI bereitstellen.
3. Navigation + Quellcode-Leak + Browserfehler testen.
4. Sendung erstellen als P0-E2E.
5. Aufgaben/Benachrichtigungen als P0-E2E.
6. öffentliche QR-/Avis-Smokes.
7. fünf Viewports für Navigation/Responsive-Smoke.
8. TESTSERVICE-Gate in Workflow integrieren.
9. Produktion hinter das TESTSERVICE-E2E-Gate verschieben.
10. Post-Deploy-Produktion-Smoke ergänzen.
11. Erst danach Architektur-/Performance-Refactoring beginnen.

## 13. Akzeptanzkriterien

Das Arbeitspaket gilt als fertig, wenn:

- Playwright reproduzierbar lokal und in GitHub Actions läuft,
- fünf Viewports konfiguriert sind,
- alle definierten P0-Smokes grün sind,
- falsche View-Zuordnung automatisch erkannt wird,
- sichtbarer JavaScript-/CSS-Code automatisch erkannt wird,
- Browser-`pageerror` und nicht erlaubte Console-`error` den Test scheitern lassen,
- TESTSERVICE vor Produktion vollständig geprüft wird,
- Produktion bei einem fehlgeschlagenen P0-Test nicht deployed wird,
- Fehlerartefakte automatisch bereitstehen,
- bestehende Node-/Contract-Tests weiterhin grün bleiben,
- die aktuelle fachliche Funktionalität durch die QA-Einführung nicht verändert wird.

## 14. Abnahme

Nach erfolgreicher technischer Umsetzung erfolgt ein manueller Abschlusslauf mit denselben P0-Prozessen auf:

- Desktop,
- mindestens einem realen Android-Smartphone,
- TESTSERVICE,
- anschließend nicht-destruktiver Produktionsprüfung.

Erst nach diesem Abschlusslauf wird der QA-Milestone als release-ready markiert.
