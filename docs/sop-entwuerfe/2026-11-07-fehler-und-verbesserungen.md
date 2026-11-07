# SOP-Entwürfe: Fehler & Verbesserungen

**Status: ENTWURF – nicht geprüft, nicht freigegeben.**
Diese Texte sind kein gelenktes Dokument. Sie werden im SOP-Editor von ExportHUB360 angelegt, mit Screenshots versehen und dort durch die zuständigen Personen geprüft und freigegeben. Erst die Freigabe im Editor macht sie zu gelenkten SOPs (Freigeber, Datum und Version werden dort festgehalten).

Stand: 2026-11-07. Bezug: Funktion „Fehler & Verbesserungen“ (`qualitaet.html`, `api/quality-capa`).

## Hinweise zur Übernahme in den SOP-Editor
- **Bereich:** Archiv, Diagnose, Release und App (oder ein eigener Bereich „Qualität“, falls gewünscht).
- **Verknüpfte SOPs:** SOP-EH-110/111 (Archiv und Audit-Nachweise), SOP-EH-112 (Fehlerdiagnose).
- **Screenshots:** je Schritt eine Ansicht der Seite „Fehler & Verbesserungen“ (Liste, Formular, Anhänge, Muster-Auswertung), aufgenommen am TESTSERVICE oder in der Demo ohne echte Kundendaten.
- **Tour und Prüfung:** Die SOP-Abdeckung verlangt für registrierte Funktionen Bild, Tour und Prüfungsfragen. Diese sind noch zu erstellen.
- **Rollen:** „Leitung“ ist technisch das SOP-Admin-Recht (`rights.sop` mit Stufe admin oder `functionAdmin`). Melden darf jeder angemeldete Benutzer.
- **Aufbewahrung:** Fälle werden mindestens zwei Jahre aufbewahrt und nicht gelöscht.

---

## SOP-Entwurf A – Fehler dokumentieren, Ursache beheben und Wirksamkeit nachweisen

**Zweck:** Jeder Fehler im Tagesgeschäft (zum Beispiel eine falsch verladene Sendung) wird nachvollziehbar dokumentiert, die Ursache wird behoben und die Wirksamkeit der Maßnahme wird nachgewiesen, damit der Vorgang für Audits belegbar ist.

**Geltungsbereich:** Alle Mitarbeiter, die einen Fehler melden oder bearbeiten, sowie die Leitung, die Fälle abschließt. Gilt für Produktion und TESTSERVICE getrennt.

**Verantwortlichkeiten**
- Mitarbeiter: Fehler melden, eigene Meldung ergänzen, Nachweise anhängen.
- Bearbeiter (Bearbeitungsrecht): Ursache, Maßnahmen, Frist und Wirksamkeitsprüfung pflegen.
- Leitung (Abschlussfreigabe): Fall abschließen oder mit Begründung wieder öffnen.

**Voraussetzungen:** Anmeldung im ExportHUB360. Zum Lesen des Fehlerprotokolls ist ein Leserecht nötig; ohne Leserecht steht das Meldeformular zur Verfügung.

**Schritte**
1. Bereich „Fehler & Verbesserungen“ öffnen. Bei einem Fehler an einer Sendung stattdessen in der Sendungsansicht „Fehler melden“ wählen, damit die Referenz vorbelegt wird.
2. Mitarbeiter ohne Leserecht nutzen das Meldeformular: Titel, Beschreibung und Referenz eintragen, senden und die Fallnummer notieren.
3. Neuen Fehler anlegen: Titel, Kategorie, Schweregrad, Fehlerdatum, Arbeitsbereich und Referenz eintragen sowie beschreiben, was passiert ist und welche Folgen der Fehler hatte. Keine Namen von Personen in Freitexte eintragen.
4. Sofortmaßnahme eintragen: was unternommen wurde, um den Schaden zu begrenzen (betroffene Ware, Dokumente, Kunde, Spedition).
5. Fall speichern. Danach Fotos und Dokumente (PDF, JPG, PNG, bis 15 MB, höchstens zehn je Fall) als Nachweis anhängen; Anhänge sind nur bei gespeichertem Fall möglich.
6. Die Ursache mit der 5-Warum-Methode bestimmen und die tatsächliche Ursache eintragen; nicht bei „Mitarbeiterfehler“ stehen bleiben.
7. Abstellmaßnahme, vorbeugende Verbesserung beziehungsweise SOP-Anpassung, Verantwortlichen und Frist festlegen und den Bearbeitungsstand setzen.
8. Nach der Umsetzung die Wirksamkeit anhand realer Vorgänge prüfen und Bewertung, Prüfdatum und Nachweis eintragen. Wird Ursache oder Maßnahme später geändert, ist die bisherige Prüfung ungültig und muss wiederholt werden.
9. Die Leitung schließt den Fall mit „Wirksamkeit bestätigen & schließen“. Der Abschluss ist nur mit Ursache, Maßnahme und wirksamer Prüfung möglich; ein abgeschlossener Fall wird nur mit Begründung wieder geöffnet.
10. Den Änderungsverlauf prüfen: Er muss als „lückenlos verkettet“ angezeigt werden. Meldet die Seite „Verlauf nicht integer“, den Fall nicht ändern und die Leitung informieren.

**Prüfpunkte**
- Jeder Fall hat eine Fallnummer, Beschreibung, Ursache, Abstellmaßnahme und einen Wirksamkeitsnachweis, bevor er abgeschlossen wird.
- Anhänge sind geöffnet und lesbar; beim Herunterladen stimmt der Prüfwert (sonst meldet das System einen Integritätsfehler).
- Der Verlauf zeigt jede Änderung mit Name und Zeit und ist als „lückenlos verkettet“ markiert.

**Abweichungen**
- „Verlauf nicht integer“: Fall ist für Änderungen gesperrt; Leitung informieren, Fall prüfen lassen.
- Speicher nicht erreichbar: Speichern bleibt gesperrt, es geht nichts verloren; später erneut versuchen und bei Dauerstörung die Fehlerdiagnose (SOP-EH-112) nutzen.
- Anhang schlägt fehl: Fall bleibt gespeichert; Anhang erneut hochladen.

**Aufzeichnungen:** Fall mit Verlauf, Anhängen und Wirksamkeitsnachweis. Aufbewahrung mindestens zwei Jahre; Fälle werden nicht gelöscht.

---

## SOP-Entwurf B – Muster-Auswertung und KI-Vorschlag für Fehlerfälle nutzen

**Zweck:** Wiederkehrende Fehler und unwirksame Maßnahmen werden früh erkannt, damit Ursachen an der Wurzel behoben werden.

**Geltungsbereich:** Alle Benutzer mit Leserecht auf „Fehler & Verbesserungen“.

**Verantwortlichkeiten:** Bearbeiter und Leitung werten regelmäßig aus und entscheiden, welche Vorschläge als Maßnahme übernommen werden. Die Auswertung und die Vorschläge ersetzen keine fachliche Prüfung.

**Schritte**
1. Bereich „Fehler & Verbesserungen“ öffnen.
2. „Muster-Auswertung“ wählen und den Zeitraum festlegen (30 Tage, 90 Tage, ein Jahr oder alle Fälle).
3. Auffälligkeiten prüfen: Häufungen nach Kategorie, Bereich und Wochentag, Wiederholungen, Maßnahmen ohne Wirkung sowie überfällige und länger als 30 Tage offene Fälle. Treffer über den Link im zugehörigen Fall öffnen.
4. Bei Wiederholungen die Ursachen der früheren Fälle prüfen; eine Maßnahme, die nicht gewirkt hat, nicht unverändert erneut beschließen.
5. Für einen gespeicherten Fall „Verbesserungsvorschläge“ (regelbasiert) oder „KI-Vorschlag“ öffnen.
6. Den KI-Vorschlag nur als Anregung verwenden: Er ist fachlich zu prüfen und wird nicht automatisch gespeichert. Gesendet werden nur anonymisierte Fachfelder; keine Namen in Freitexte eintragen.
7. Erscheint statt des KI-Vorschlags die Regelanzeige mit Hinweis, den genannten Grund beachten (Tageslimit, Schlüssel oder Modell abgelehnt, Kontingent erschöpft) und bei Bedarf den Administrator informieren.
8. Übernommene Vorschläge als Maßnahme eintragen, mit Verantwortlichem und Frist versehen und den Fall speichern.

**Prüfpunkte**
- Ein Treffer der Muster-Auswertung ist ein Hinweis, kein Beweis; kleine Fallzahlen werden nicht als Häufung gewertet (ab fünf Fällen und mindestens 40 %).
- Übernommene KI-Vorschläge sind fachlich geprüft und mit Verantwortlichem und Frist versehen.

**Abweichungen:** KI nicht verfügbar oder Tageslimit erreicht: Die Regelvorschläge bleiben nutzbar; der genannte Grund steht über den Vorschlägen.

**Aufzeichnungen:** Übernommene Maßnahmen stehen im Fall mit Verlauf. Die KI-Aufrufe werden mit Zeit, Benutzer, Fall und Modell protokolliert, der KI-Text selbst wird nicht gespeichert.
