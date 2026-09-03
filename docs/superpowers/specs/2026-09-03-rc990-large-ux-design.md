# RC990 Großupdate – UX, Release Center und Stabilität

## Ziel
RC990 ist ein gebündeltes TESTSERVICE-Großupdate auf Basis von RC980. Es soll die Bedienung spürbar ruhiger, konsistenter und moderner machen, ohne die fachliche Exportlogik neu zu bauen. Der bereits freigegebene Release-Center-Fix aus RC981 wird vollständig in RC990 aufgenommen.

## Ausgangspunkt und Leitplanken
- Ausgangspunkt ist der geprüfte RC980-Stand auf `main`.
- Entwicklung und Veröffentlichung erfolgen ausschließlich im TESTSERVICE.
- Produktionsdateien werden nicht direkt durch ChatGPT verändert; Produktion bleibt an das Release Center gebunden.
- Keine D365-Integration oder direkte D365-Verknüpfung.
- Keine neuen Reparaturblöcke über bereits vorhandenen Altblöcken. Wo alte aktive Regeln RC990 widersprechen, werden sie gezielt ersetzt oder entfernt.
- RC977-Colli-Typografie bleibt bestehen: 12 px in den Colli-Feldern, 42 px Feldhöhe.
- RC978–RC980 bleiben funktionale Basis für das responsive Sendungsraster, kompakte Innenhöhen und positionsstabile Colli-Zeilen.
- Fachregeln für ABD, Statuskette, CMR/PDF, Palettenkonto, Kunden/Standorte, Mailpflichten, POD, QR/PIN und Versandkosten werden nicht neu entworfen.

## Block A – Release Center
1. Einzelbestätigungen und Freigaben dürfen den Nutzer nicht mehr an den Seitenanfang setzen.
2. Vor einer Aktion wird die relevante Position gespeichert: Fenster-Scrollposition, Release-Center-Scrollposition und – wenn vorhanden – die ID oder der stabile Schlüssel der bearbeiteten Änderung.
3. Nach einem unvermeidbaren Render wird zuerst die betroffene Änderung wiedergefunden; falls sie nicht mehr existiert, wird die vorherige Scrollposition wiederhergestellt.
4. Mehrere Bestätigungen hintereinander müssen ohne sichtbaren Sprung nach oben funktionieren.
5. Offene, bestätigte und veröffentlichte Änderungen werden visuell klar getrennt.
6. Freigegebene/veröffentlichte Versionen dürfen kompakt eingeklappt werden, während aktuelle offene Änderungen sichtbar bleiben.
7. Der Zähler für nicht veröffentlichte Änderungen muss aus demselben aktiven Datenbestand berechnet werden wie die sichtbare Liste. Phantomzähler durch veraltete oder doppelte Quellen sind nicht zulässig.
8. Release- und Speicherlogik selbst bleibt fachlich unverändert; RC990 ändert Darstellung, Positionserhalt und Konsistenz der Anzeige.

## Block B – Einheitliches Designsystem
1. Karten, Überschriften, Statuschips, Buttons, Eingabefelder und Innenabstände erhalten eine gemeinsame visuelle Sprache.
2. Leerräume werden reduziert, ohne Inhalte zu quetschen. Karten dürfen sich an ihrer tatsächlichen Inhaltshöhe orientieren und sollen nicht künstlich gestreckt werden.
3. Die bestehenden Formulargrundregeln aus RC971 bleiben die Baseline. Spezialisierte Bereiche dürfen klar dokumentierte Ausnahmen besitzen, etwa Colli.
4. Desktop nutzt die verfügbare Inhaltsbreite neben dem Menü aus. Tablet und Smartphone brechen kontrolliert um und dürfen keine abgeschnittenen Hauptaktionen erzeugen.
5. Hauptaktionen erhalten eine klare Hierarchie: primäre Aktion sichtbar, sekundäre Aktionen ruhiger, destruktive Aktionen eindeutig unterscheidbar.
6. Statusdarstellungen müssen semantisch konsistent sein; dieselbe Bedeutung darf nicht in verschiedenen Bereichen widersprüchlich aussehen.
7. Warncenter und Benachrichtigungscenter bleiben getrennte Systeme und werden optisch stärker differenziert: Warncenter für Handlungsbedarf/Fehler, Benachrichtigungscenter für Informationen/Ereignisse.
8. Bestehende TESTSERVICE-Kennzeichnung bleibt eindeutig von Produktion unterscheidbar.

## Block C – Rendering, Fokus und Bediengeschwindigkeit
1. Teiländerungen sollen keinen unnötigen Vollrender auslösen, wenn der bestehende DOM-Bereich gezielt aktualisiert werden kann.
2. Bereits vorhandenes Frame-Batching aus RC950 bleibt Grundlage und wird dort erweitert, wo mehrere synchrone Renderaufrufe noch unnötig aufeinander folgen.
3. Fokus, Cursorposition, Eingabewert und Scrollposition müssen bei UI-Aktualisierungen erhalten bleiben, sofern das betroffene Element weiterhin existiert.
4. Sichtbare Benutzereingaben dürfen nicht durch einen älteren Teamstand oder ein spätes Render überschrieben werden.
5. Längere Aktionen nutzen das bestehende Arbeitsstatus-/Loading-System. Es wird kein zweites paralleles Statussystem eingeführt.
6. Reine UI-Aktualisierungen dürfen keine zusätzlichen Azure-Schreibvorgänge auslösen.
7. Drag-&-Drop in Lager und Aufgabenplaner behält die schnelle Pointer-Logik aus RC946; RC990 prüft nur unnötige Render- und Speicherkaskaden um diese Interaktionen herum.

## Block D – Navigation und Seitenzustand
1. Die aktive Hauptfunktion bleibt visuell eindeutig markiert.
2. Zurück-Navigation führt zum tatsächlichen vorherigen Bereich, nicht pauschal zur Sendungsansicht oder Startansicht.
3. Schnelle Wechsel zwischen Hauptfunktionen dürfen keine doppelten oder übereinanderliegenden Layouts erzeugen.
4. Ein Neu-Render derselben Ansicht darf den Benutzer nicht ohne Grund an den Anfang der Seite setzen.
5. Navigation darf keine bestehende Anmeldung beenden; F5 bleibt ein Reload und kein Logout.
6. Mobile Navigation muss mit denselben Zielansichten arbeiten wie Desktop und darf keine gesonderten veralteten Renderpfade verwenden.

## Block E – Sendung erstellen
1. RC977–RC980 bleiben verbindliche Grundlage.
2. Kunde, Sendungsdaten, Colli und Dokumente/ABD behalten ihre neue kompakte Geometrie.
3. Colli-Zeilen behalten beim Hinzufügen und Entfernen ihre horizontalen Positionen; der Bereich wächst primär nach unten.
4. Widersprüchliche ältere CSS-Regeln, die diese Geometrie wieder überschreiben, werden gezielt entfernt oder neutralisiert statt durch weitere globale `!important`-Schichten überdeckt zu werden.
5. Mailbereich und ABD-Bereich bleiben getrennte Prozessbereiche.
6. Stauplan, Druck/PDF, CMR, Versandkosten und gespeicherte Sendungsdaten werden in RC990 nicht fachlich umgebaut.

## Block F – Dashboard, Lager und Aufgaben
1. Dashboard-, Lager- und Aufgabenkarten erhalten dieselben grundlegenden Abstands-, Typografie- und Kartenregeln wie der Rest der Anwendung.
2. Karten sollen ihren Inhalt kompakt darstellen und keine unnötigen Mindesthöhen erzeugen.
3. Arbeitsfokus, Warncenter und Benachrichtigungscenter werden in der Hierarchie klar voneinander getrennt.
4. Drag-&-Drop darf weder durch Designänderungen noch durch neue Animationen verlangsamt werden.
5. Wiederholte Aufgaben, Prioritäten und Fachlogik des Aufgabenplaners bleiben unverändert.

## Fehlerbehandlung
- Jede Benutzereingabe bleibt lokal erhalten, wenn ein Render- oder Netzfehler auftritt.
- Ein fehlgeschlagener Release-Center- oder Speicherabgleich darf die Oberfläche nicht auf einen unbestimmten Anfangszustand zurücksetzen.
- Aktionen müssen entweder erfolgreich abschließen oder eine sichtbare konkrete Fehlermeldung liefern.
- UI-Optimierungen dürfen keine Fehler verschlucken, die bisher korrekt angezeigt wurden.

## Technische Umsetzung
- RC990 soll als gebündelter, nachvollziehbarer Änderungenblock umgesetzt werden, nicht als Serie unverbundener Reparatur-Patches.
- Neue Hilfsfunktionen werden nur eingeführt, wenn sie mehrere Stellen konsistent lösen; ansonsten wird bestehende Logik erweitert.
- Versionsspezifische Test-Hooks sind erlaubt, produktive Altlogik soll aber nicht unnötig vervielfacht werden.
- Wo CSS konsolidiert werden kann, wird die aktive Regelquelle bevorzugt angepasst. Ein neuer globaler Override-Layer ist nur zulässig, wenn er bewusst als neues kanonisches Design-Layer dient und ältere widersprüchliche Regeln gleichzeitig entfernt oder außer Kraft gesetzt werden.

## Teststrategie
1. Bestehende RC971–RC980-Regressionen bleiben verpflichtend.
2. Neue RC990-Regressionen prüfen mindestens:
   - Release-Center-Scroll- und Fokus-Erhalt bei Einzel- und Mehrfachbestätigung,
   - korrekten Zähler offener nicht veröffentlichter Änderungen,
   - Renderintegrität ohne doppelte Hauptlayouts,
   - Erhalt von Fokus/Scroll/Eingaben bei Teilupdates,
   - responsive Hauptlayouts Desktop/Tablet/Smartphone,
   - Design-Grenzen für Karten, Hauptaktionen und spezialisierte Colli-Ausnahmen,
   - getrennte Darstellung von Warncenter und Benachrichtigungscenter,
   - unveränderte Colli-Geometrie und Fachlogik,
   - unveränderte Drag-Reaktionslogik.
3. Kritische bestehende Flows werden zusätzlich gegen Regression geprüft: Sendung öffnen/wechseln, Colli-Zeile hinzufügen, Speichern, Dokument öffnen, Navigation, Release-Center-Bestätigung und Kachelbewegung.
4. Vor TESTSERVICE-Deploy müssen Regression, Renderintegrität, API-Smoke und Live-Versionstest grün sein.
5. Nach Deploy werden `/test` und direkte `TESTVERSION.html` auf RC990 sowie Auth/API-Erreichbarkeit geprüft.

## Nicht Bestandteil von RC990
- Neue QR-Token-/PIN-Sicherheitsarchitektur.
- Änderung der Kunden-Avis-Einmalöffnungslogik.
- Fachlicher Umbau von CMR/PDF/Ladeliste.
- Neue Versandkostenformeln oder Gate41-/UPS-Fachlogik.
- Neue ABD-Regeln oder Statuskette.
- Neue Cloud-/Backup-Architektur.
- Produktionsrelease außerhalb des bestehenden Release Centers.
- D365-Integration.

## Erfolgskriterien
RC990 gilt erst als fertig, wenn:
- Release-Center-Bestätigungen die Position zuverlässig erhalten,
- das Design über die Hauptbereiche sichtbar konsistenter und kompakter ist,
- keine neuen Hohlräume oder übergroßen Karten entstehen,
- Navigation und Teilrender keinen unbegründeten Sprung oder Fokusverlust verursachen,
- RC977–RC980 unverändert weiterbestehen,
- alle verpflichtenden Regressionen grün sind,
- TESTSERVICE RC990 live und verifiziert ist,
- Produktion unangetastet bleibt.