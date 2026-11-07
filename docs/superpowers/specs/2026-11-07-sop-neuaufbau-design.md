# SOP-Neuaufbau – Design

Stand: 2026-11-07. Status: Entwurf zur Prüfung, noch kein Code.

## Ziel
Die SOP-Funktion wird **neu und aufgeräumt** aufgebaut: ein System statt mehrerer überlappender Generationen. Sie dient **zuerst als Audit-Nachweis** (gelenkte SOPs mit Version, Prüfung, Freigabe, Schulungsnachweis) und **danach zur Anleitung** von Mitarbeitern durch Touren in der echten App. Das Design des SOPMaster-Coverage-Dashboards bleibt unverändert.

## Entscheidungen (Gespräch 2026-11-07)
- Zweck: beides, erst Nachweis, dann Touren.
- Bisherige Inhalte: die 24 Handbuch-SOPs werden **als Entwürfe übernommen**, ohne den alten Freigabestempel; jede SOP wird neu geprüft und freigegeben.
- Ansatz B: neues Modul **neben** dem alten bauen, danach umschalten und den alten Code samt Tests entfernen (nur mit ausdrücklicher Freigabe).
- **Vier-Augen-Prinzip:** Freigeber ist nicht der Autor. Die Freigabe muss **nicht** durch einen Administrator erfolgen; jede **weitere Person** mit SOP-Bearbeitungsrecht darf eine SOP freigeben, die sie nicht selbst zuletzt bearbeitet hat. Ein Ausnahmeweg ist nicht vorgesehen.
- **Zweisprachig:** Jede SOP wird in **Deutsch und Englisch** dargestellt. Beide Sprachen sind Pflicht für die Freigabe.
- **Menüname:** bleibt „SOP“.
- **Training-Center-Katalog:** wird nicht als eigener Bestand importiert. Seine englischen Texte dienen höchstens als Übersetzungsvorlage; die Entfernung des Katalogs wird in Phase 4 entschieden (nur mit Freigabe).
- Das SOP-Handbuch als eigene Listenansicht entfällt. „SOP öffnen“ im Dashboard öffnet das Dokument im neuen Editor und Leser.

## Ausgangslage (Befund auf `main`)
Mehrere Generationen laufen nebeneinander:
1. SOP-Handbuch `rc1007` bis `rc1018`: 75 Einzel-SOPs, zu 24 zusammengefasst. `rc1010` und `rc1016` **stempeln jedes Dokument fest als „Freigegeben“** (Freigeber „ExportHUB Freigabe RC1010/RC1016“, Datum 2026-09).
2. SOPMaster `rc1500` bis `rc1506`: Editor, Speicherung, Touren (`rc1501`), Prüfung, Fortschritt, Coverage-Dashboard.
3. Geführter Arbeitsbereich `rc1544`.
4. Training-Center `assets/training-center`: zweiter Katalog mit 30 SOPs in sechs Sprachen, als Entwurf markiert (UI-Ziele und Screenshots unverifiziert).
5. Hilfe-Popup in der Sendungsansicht `rc1660`, Kontexthilfe `rc1705`.
6. Academy-Prüfungen `rc1835`.

Weitere Fakten:
- 30 JavaScript-Dateien in `assets/sop`, 63 Tests, 13 Workflows; kein SOP-Backend.
- SOPs werden heute im **gemeinsamen Team-State** gespeichert (`ExportHUBClean.flushSave`). Dort kann ein Dokument ohne Spur überschrieben werden.
- Das Coverage-Dashboard (`rc1506`) wird **in die Handbuch-Ansicht eingefügt**; „SOP öffnen“ klickt auf Elemente des Handbuchs.
- Die SOP-Tests enthalten absichtliche Freigabe-Sperren (Version 2.0 mit Pflichtstruktur, echtes Systembild, nur freigegebener Bestand, feste Zahlen 75 und 24). Der alte Bestand lässt sich deshalb nicht ohne Abschwächen dieser Tests um Entwürfe erweitern. Das ist ein Grund für Ansatz B.
- Das Register `rc1505` enthält 25 Prozessbereiche und verlangt je Bereich Bild, Tour und Prüfung. Das Dashboard zeigt aktuell 0 % Abdeckung und 0 Touren.

## Nicht-Ziele
Keine Änderung an Geschäftsregeln, an der Academy-Fachlogik oder an Kennzahlen-Zielwerten. Academy und Hilfe-Popups laufen bis Phase 3 unverändert auf dem alten System weiter. Keine Kundendaten in SOPs oder Screenshots.

## Architektur
Neues Modul `sop2` nach dem Muster von `quality-capa`:
- **API** `api/sop-documents` (eine Azure-Function, Aktionen per POST), Sitzungsprüfung und Rechte wie bei `quality-capa` (`auth.validateSession`, `rights.sop`).
- **Speicher:** privater Blob je Umgebung (Produktion und TESTSERVICE getrennt), **nicht** im Team-State. Je SOP eine Ereignisfolge, jedes Ereignis mit `seq`, `prevHash`, `hash` (SHA-256), Benutzer und Zeit aus der Sitzung. Ereignisse werden nie überschrieben oder gelöscht.
- **Oberfläche:** neue Seite im SOP-Menü mit dem unveränderten Coverage-Dashboard, Editor und Leser. Shared Code aus `rc1506` (Darstellung) wird weiterverwendet, die Datenquelle wird die neue API.

## Datenmodell
SOP `SOP-EH-<nnn>`:
- Kopf: Nummer, Titel, Bereich, `functionId` (Verweis auf das Register), Verantwortlicher (Rolle).
- Versionen `1.0, 1.1, 2.0 …`, je Version: Status **Entwurf → In Prüfung → Freigegeben → Archiviert**, Autor, Prüfer, Freigeber, Zeitpunkte, Änderungsgrund.
- Inhalt je Version **in Deutsch und Englisch** (`content.de`, `content.en`): Zweck, Geltungsbereich, Verantwortlichkeiten, Voraussetzungen, Schritte (je Schritt Text, optionaler Screenshot, optionales Tour-Ziel), Prüfpunkte, Abweichungen, Aufzeichnungen, Verweise. Screenshot und Tour-Ziel sind sprachunabhängig je Schritt.
- **Zweisprachigkeit:** Eine Version kann nur eingereicht und freigegeben werden, wenn alle Pflichtteile in beiden Sprachen befüllt sind und beide Fassungen **gleich viele Schritte** haben. Weitere Sprachen (pl, es, fr, it) sind optional; fehlt eine, zeigt der Leser Englisch.
- Der Leser bietet einen Umschalter Deutsch/Englisch (Voreinstellung: Oberflächensprache, bei pl/es/fr/it Englisch). Ändert sich eine Sprachfassung, gilt das als neue Version beider Sprachen (eine Freigabe gilt für beide).
- Pro SOP genau eine **gültige** Version (die letzte Freigegebene); frühere werden archiviert und bleiben lesbar.

## Rechte und Ablauf
| Aktion | Wer |
|---|---|
| Lesen freigegebener SOPs | alle angemeldeten Benutzer |
| Entwurf anlegen und bearbeiten | `rights.sop` mit Bearbeitungsrecht |
| Zur Prüfung einreichen | Autor |
| Freigeben oder zurückweisen | jede **weitere Person** mit `rights.sop`-Bearbeitungsrecht, **nicht der Autor der Version** (Vier-Augen) |
| Archivieren, neue Version anlegen | Bearbeiter; Archivieren der gültigen Version braucht eine zweite Person wie die Freigabe |

Der Server setzt Freigeber, Datum und Version aus der Sitzung. Es gibt **keine festen Freigabestempel im Code**. Das Vier-Augen-Prinzip wird serverseitig geprüft: Freigeber und Autor der Version dürfen nicht dieselbe Person sein. Pflegt nur eine Person SOPs, kann sie nicht allein freigeben; das ist gewollt und wird im Hinweistext erklärt. Eine eigene Freigaberolle ist nicht nötig, sie kann später ergänzt werden, falls nicht jeder Bearbeiter freigeben dürfen soll.

## Coverage
Die 25 Bereiche aus dem Register `rc1505` bleiben. Die Kennzahlen werden aus echten Daten berechnet:
- **SOP vollständig:** gültige freigegebene Version vorhanden **und** Tour vorhanden **und** Prüfungsbezug vorhanden (Bild folgt den Schritten).
- **SOP unvollständig:** gültige Version vorhanden, es fehlt Tour oder Prüfungsbezug oder Bild.
- **SOP fehlt:** keine freigegebene Version.
„SOP öffnen“ und „Schritt öffnen“ öffnen die Version im neuen Editor und Leser am betreffenden Schritt.

## Import der Altinhalte (einmalig)
Eine Admin-Aktion `import-legacy` liest die 24 bisherigen SOPs aus dem Katalog und legt je SOP eine **Entwurfsversion 0.1** an. Die bisherigen Texte sind nur deutsch. Die **englischen Fassungen** werden als Entwurf vorbereitet (Übersetzungsvorschlag in einer Datei im Repository, in den Import eingelesen) und müssen vor der Freigabe fachlich geprüft werden. Der alte Freigabestempel wird nicht übernommen, im Verlauf steht „importiert aus Handbuch RC1016, nicht freigegeben“. Der Import ist wiederholbar (bereits importierte SOPs werden übersprungen) und löscht nichts.

## Phasen (je ein eigener PR, kein Merge ohne Freigabe)
1. **Daten und Nachweis:** API, Speicher mit Hash-Kette, Rechte, Vier-Augen, Import, Editor und Leser, Coverage aus echten Daten, sechs Sprachen.
2. **Touren:** vorhandene Tour-Engine `rc1501` an freigegebene Versionen anbinden. „Installieren“ heißt: Tour wird gegen die echten UI-Ziele geprüft (`rc1501-sop-tour-validator`) und veröffentlicht.
3. **Schulungsnachweis und Umstellung:** Prüfungsbezug und Lesebestätigung je Version nachweisen; Academy und Hilfe-Popups auf die neuen SOPs umstellen.
4. **Rückbau:** alten Handbuch-Code (`rc1007`, `rc1010`, `rc1013`, `rc1016`, `rc1018`, `rc1544`) und, falls entschieden, den Training-Center-Katalog samt zugehöriger Tests entfernen. Nur mit ausdrücklicher Freigabe, nachdem Phase 3 auf dem TESTSERVICE geprüft wurde.

## Tests
- Hash-Kette: lückenlos, Manipulation erkannt, Reihenfolge, Konflikte (409).
- Vier-Augen: Autor kann nicht freigeben, zweite Person kann.
- Rechte: Leser, Bearbeiter, Admin; Sitzungsprüfung; Umgebungstrennung.
- Import: wiederholbar, ohne Freigabestempel, ohne Löschen.
- Coverage: Berechnung der drei Status aus Testdaten; Dashboard-Darstellung unverändert (Snapshot der Struktur).
- i18n-Audit (streng) für alle neuen Texte in sechs Sprachen.
- Alte Tests bleiben bis Phase 4 unverändert und grün.

## Risiken
- **Umfang:** Phase 1 ist groß. Sie wird in kleinere PRs geschnitten (Speicher und API, Editor, Coverage, Import).
- **Doppelter Zustand bis Phase 4:** Zwei Systeme existieren parallel. Die Oberfläche zeigt bis zur Umschaltung genau ein System (Feature-Schalter je Umgebung).
- **Vier-Augen bei einer einzigen Pflegeperson:** Ohne zweite Person mit SOP-Recht kann nichts freigegeben werden. Es gibt bewusst keinen Ausnahmeweg.
- **Zweisprachigkeit:** Aufwand für die englischen Fassungen der 24 Altinhalte und jeder neuen SOP; eine Übersetzung ersetzt keine fachliche Prüfung.
- **Screenshots:** Bilder für Schritte brauchen echte Aufnahmen am TESTSERVICE; ich kann sie ohne Anmeldung dort nicht erzeugen.

## Offene Punkte für die Prüfung
- Reicht das SOP-Bearbeitungsrecht für die Freigabe, oder soll es ein eigenes Freigaberecht geben?
- Training-Center-Katalog: Ist die Annahme richtig, dass er nicht importiert, sondern nur als Übersetzungsvorlage genutzt und später entfernt wird?
