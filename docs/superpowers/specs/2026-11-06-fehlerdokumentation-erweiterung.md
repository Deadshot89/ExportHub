# Fehlerdokumentation – Erweiterung von „Fehler & Verbesserungen“

Stand: 2026-11-06. Status: Entwurf zur Prüfung, noch kein Code.

## Ausgangslage (bereits auf `main`)
Die Funktion existiert seit #1212 als Seite `qualitaet.html` mit API `api/quality-capa` (Menü „Fehler & Verbesserungen“, #1246 öffnet sie innerhalb der Website):
- Fälle `QM-<Datum>-<ID>` mit Kategorie, Schweregrad, Beschreibung, Folgen, Sofortmaßnahme, Ursache, Abstellmaßnahme, Vorbeugung, Verantwortlich, Frist, Nachweis, Wirksamkeitsprüfung.
- Status: offen → Ursachenanalyse → Maßnahme → Wirksamkeitsprüfung → abgeschlossen. Abschluss nur mit Ursache, Maßnahme und dokumentiert wirksamer Prüfung.
- Wiederöffnen nur mit Begründung. Revisionszähler gegen gleichzeitige Änderungen. Verlauf je Fall (`history`).
- Regelbasierte Vorschläge und ähnliche frühere Fälle (`advise`), ausdrücklich ohne generative KI.
- Filter, Druck/Export. Ablage getrennt vom Team-State, je Umgebung getrennt.

Ein Neubau ist deshalb nicht nötig. Dieser Entwurf schließt nur die Lücken gegenüber den Anforderungen.

## Festgelegte Anforderungen (Gespräch vom 2026-11-05)
- Alle Mitarbeiter erfassen, die Leitung schließt ab.
- Alle Fehlerarten, Sendungs-REF optional, Anhänge möglich.
- Tipps pro Fall plus Muster-Auswertung über alle Fälle, kostenlos (Budget 0 Euro, daher regelbasiert statt externer KI).
- Nachweis für Audits: Fehler und Lösungen nachvollziehbar dokumentiert.
- Aufbewahrung: mindestens 2 Jahre (Entscheidung 2026-11-06). Fälle werden in dieser Zeit weder gelöscht noch gekürzt; eine Archivierung nach Ablauf ist eine eigene, freizugebende Entscheidung.

## Lücken und Maßnahmen

### 1. Erfassen für alle Mitarbeiter
Ist: Lesen und Bearbeiten hängen am SOP-Recht (`rights.sop`); wer nur Mitarbeiter ist, kann ggf. nicht melden.
Soll: Neue Aktion `report` (nur anlegen und eigene offene Meldung ergänzen) für jeden angemeldeten Benutzer. Bearbeiten fremder Fälle, Status und Abschluss bleiben an den bisherigen Rechten (`canEdit`, `canClose`).

### 2. Manipulationssicherer Verlauf
Ist: Verlauf liegt im selben Datensatz in einer JSON-Datei, ist auf eine feste Länge gekürzt und kann nicht auf Manipulation geprüft werden. Alle Fälle (max. 2.000) liegen in einer Datei.
Soll: Jeder Verlaufseintrag erhält `seq`, `prevHash` und `hash` (SHA-256 über Inhalt und Vorgänger). Der Verlauf wird nicht mehr gekürzt. Beim Lesen prüft die API die Kette und markiert einen Fall mit gebrochener Kette sichtbar („Verlauf nicht integer“). Bestehende Fälle bekommen beim ersten Schreiben eine Anfangs-Kette mit Vermerk „Migration“. Die Revisionsprüfung bleibt.

### 3. Anhänge
Soll: Fotos und Dokumente (PDF, JPG, PNG, max. 15 MB, max. 10 je Fall) als Nachweis. Ablage im vorhandenen Dokument-Blob-Speicher je Umgebung, im Fall nur Verweis, Name, Größe und SHA-256, Ereignis `ATTACHED` im Verlauf. Zugriff nur mit Sitzung und Leserecht.

### 4. Fehler aus der Sendung melden
Soll: In der Sendungsansicht ein Link „Fehler melden“, der `qualitaet.html` mit vorbelegter REF öffnet. Das Feld `reference` ist schon vorhanden und wird auf das REF-Format geprüft, wenn es wie eine REF aussieht.

### 5. Mehrsprachigkeit
Ist: `qualitaet.html` und die API-Meldungen sind nur deutsch.
Soll: Texte in de, en, pl, es, fr, it über die vorhandene i18n-Struktur (`npm run verify:i18n`). Gespeicherte Falltexte bleiben unübersetzt.

### 6. Tipps ohne Kosten (Entscheidung 2026-11-06: Budget 0 Euro)
Ein externer KI-Anbieter wird **nicht** eingebunden, weil jeder Aufruf Geld kostet. Stattdessen wird der vorhandene Regel-Assistent (`advise`) ausgebaut. Er läuft komplett in der eigenen API, ohne Netzwerkaufruf.
- **Tipps pro Fall:** konkrete 5-Warum-Leitfragen je Kategorie (Verladung, Dokumente, Zoll, POD, Beschädigung, Termin/Abholung, System), Hinweise zu Sofortmaßnahme, Korrektur und Vorbeugung, Schweregrad-abhängige Eskalation.
- **Muster-Auswertung** (neue Aktion `patterns`, reine Berechnung über die Fälle eines Zeitraums): Häufungen nach Kategorie, Bereich und Wochentag, Wiederholungsfälle derselben Referenz oder Ursache, Maßnahmen mit Ergebnis „unwirksam“, überfällige Fristen.
- **Kennzeichnung:** Ausgaben heißen „Regelvorschlag“, nicht „KI“. Sie ändern nie selbst einen Fall; der Mensch übernimmt Teile bewusst.
- Keine Ausgaben an Dritte, keine Zugangsdaten, keine laufenden Kosten. Eine spätere KI-Anbindung bräuchte eine neue Freigabe von Anbieter, Budget und Umfang durch den Eigentümer (AGENTS.md).

## Rechte (Zielzustand)
| Aktion | Wer |
|---|---|
| melden (`report`), eigene Meldung ergänzen, Anhang zu eigener Meldung | jeder angemeldete Benutzer |
| lesen | wie bisher (`canRead`) |
| bearbeiten, Status | wie bisher (`canEdit`) |
| abschließen, wiederöffnen | wie bisher (`canClose`) |
| Tipps und Muster-Auswertung | wer lesen darf |

Der Benutzername kommt immer aus der Sitzung auf dem Server.

## Fehlerbehandlung
Speicher nicht erreichbar oder Daten unvollständig: Speichern bleibt gesperrt (wie bisher). Anhang scheitert: Fall bleibt gespeichert, Anhang erneut hochladbar.

## Tests
Bestehende `test/quality-capa.test.mjs` bleibt grün. Neu: Rechte von `report`, Hash-Kette (lückenlos, Manipulation erkannt, Migration), Anhang-Grenzen und -Ablage, REF-Link, i18n-Vollständigkeit, Muster-Auswertung (Häufung, Wiederholung, unwirksame Maßnahmen, Zeitraum). Keine Produktionsdaten in Tests.

## Umsetzung in eigenen PRs
1. Hash-Kette und `report`-Recht (API, Tests).
2. Anhänge.
3. Mehrsprachigkeit und Link aus der Sendungsansicht.
4. Ausgebauter Regel-Assistent und Muster-Auswertung (kostenlos).

Kein Merge und kein Deployment ohne ausdrückliche Freigabe von Deadshot89.

## Offene Punkte
- „Leitung“ bleibt vorerst an das SOP-Admin-Recht gebunden (Empfehlung A); ein eigenes Recht „Fehler abschließen“ wäre Variante B.

## Nachtrag 2026-11-07: KI-Tipps mit Google Gemini (Entscheidung des Eigentümers)
Der Eigentümer hat Gemini als Anbieter bei **Budget 0 €** freigegeben. Das ersetzt den Abschnitt „6. Tipps ohne Kosten“ für die Einzelfall-Tipps; der Regel-Assistent bleibt als Rückfall und für die Muster-Auswertung.

- **Schlüssel:** Das Gemini-Abo für die App (Google AI Pro) enthält keinen API-Zugang. Verwendet wird ein Schlüssel aus Google AI Studio **ohne hinterlegte Zahlungsdaten** (kostenloser Tarif). Dort darf Google Eingaben zur Produktverbesserung nutzen; deshalb werden Eingaben immer anonymisiert, unabhängig vom Tarif.
- **App-Einstellungen** (nie im Repository): `EXPORTHUB_QM_AI_API_KEY` (ohne Schlüssel ist die KI aus), optional `EXPORTHUB_QM_AI_MODEL` (Standard `gemini-3.5-flash-lite`, Modell-ID vor Inbetriebnahme prüfen), `EXPORTHUB_QM_AI_DAILY_LIMIT` (20), `EXPORTHUB_QM_AI_USER_LIMIT` (5), `EXPORTHUB_QM_AI_ENABLED=0` als Notschalter.
- **Aktion `ai-case`:** lesend, ändert keinen Fall und speichert keinen KI-Text. Gesendet werden nur Kategorie, Schweregrad, Beschreibung, Folgen, Sofortmaßnahme, Ursache, Korrektur und Vorbeugung, ohne Titel, Referenz, Verantwortliche, Ersteller, E-Mails, Links, Telefon- und längere Zahlen. Freitext kann Namen enthalten; die Oberfläche weist darauf hin.
- **Kostenschutz:** Tageslimit gesamt und je Benutzer, Ausgabe standardmäßig auf 2600 Token begrenzt (über `EXPORTHUB_QM_AI_MAX_OUTPUT_TOKENS` maximal 4096; Denk-Tokens zählen mit), Nutzungsprotokoll `quality/ai-usage.json` (Zeit, Benutzer, Fall, Modell).
- **Rückfall:** Kein Schlüssel, Limit erreicht, 429, Zeitüberschreitung oder Fehler → automatisch Regelvorschläge mit Hinweis. Ein Umschalten nach einer Kündigung ist nicht nötig.
