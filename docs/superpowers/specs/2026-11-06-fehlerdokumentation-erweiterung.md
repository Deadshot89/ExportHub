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
- KI-Tipps auf Knopfdruck pro Fall plus Muster-Auswertung über alle Fälle.
- Nachweis für Audits: Fehler und Lösungen nachvollziehbar dokumentiert.

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

### 6. KI-Tipps (generativ)
Ist: nur Regeln (`advise`).
Soll (erst nach Freigabe, siehe unten):
- `ai-case`: Auf Knopfdruck Ursachenanalyse (5-Why) und Vorschläge für Korrektur und Vorbeugung zu einem Fall.
- `ai-patterns`: Auswertung über einen Zeitraum aus verdichteten Kennzahlen (Anzahl je Kategorie, Bereich, Wiederholungen), keine Volltexte.
- Eingabe nur Falltexte ohne Anhänge. Ausgabe als „KI-Vorschlag“ gekennzeichnet, im Verlauf als Ereignis `AI_SUGGESTION` festgehalten. Der Mensch übernimmt Teile bewusst in die Felder.
- Nutzt die vorhandene Anbindung `customs-ai-provider` (dieselben Fehlerursachen `config`, `busy`, `timeout`, `server`). Ohne KI bleibt `advise` aktiv.
- Begrenzung: Rate-Limit je Benutzer, Kürzung der Eingabe, kein automatischer Aufruf, keine Wiederholschleifen.

**Freigabe nötig:** Nach AGENTS.md sind neue KI-Aufrufe ohne Freigabe von Anbieter, Budget und Umfang durch den Eigentümer nicht zulässig; vorhandene Zugangsdaten gelten nicht als Kostenfreigabe. Der Block 6 wird erst umgesetzt, wenn Anbieter, Monatsbudget und Umfang freigegeben sind. Die Blöcke 1–5 sind davon unabhängig.

## Rechte (Zielzustand)
| Aktion | Wer |
|---|---|
| melden (`report`), eigene Meldung ergänzen, Anhang zu eigener Meldung | jeder angemeldete Benutzer |
| lesen | wie bisher (`canRead`) |
| bearbeiten, Status | wie bisher (`canEdit`) |
| abschließen, wiederöffnen | wie bisher (`canClose`) |
| KI-Tipps | wer lesen darf, mit Rate-Limit |

Der Benutzername kommt immer aus der Sitzung auf dem Server.

## Fehlerbehandlung
Speicher nicht erreichbar oder Daten unvollständig: Speichern bleibt gesperrt (wie bisher). Anhang scheitert: Fall bleibt gespeichert, Anhang erneut hochladbar. KI scheitert: Hinweis nach Ursache, Regelvorschläge bleiben.

## Tests
Bestehende `test/quality-capa.test.mjs` bleibt grün. Neu: Rechte von `report`, Hash-Kette (lückenlos, Manipulation erkannt, Migration), Anhang-Grenzen und -Ablage, REF-Link, i18n-Vollständigkeit, nach Freigabe KI-Fehlergründe und Prompt ohne Anhänge. Keine Produktionsdaten in Tests.

## Umsetzung in eigenen PRs
1. Hash-Kette und `report`-Recht (API, Tests).
2. Anhänge.
3. Mehrsprachigkeit und Link aus der Sendungsansicht.
4. KI-Tipps (nur nach Freigabe).

Kein Merge und kein Deployment ohne ausdrückliche Freigabe von Deadshot89.

## Offene Punkte
- Freigabe für KI: Anbieter (vorhandener OpenAI-Zugang?), Monatsbudget, Umfang.
- Aufbewahrungsfrist laut Audit (Löschen bleibt ausgeschlossen).
- Soll „Leitung“ weiter an das SOP-Admin-Recht gebunden sein?
