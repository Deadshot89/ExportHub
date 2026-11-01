---
name: project-map
description: Finde für eine konkrete Entwicklungsaufgabe schnell die relevanten Quelldateien, Symbole und Tests über die Projekt-MAP, ohne das gesamte Repository zu lesen.
---

# Gezielte Projekt-Navigation mit minimalem Kontextverbrauch

Benutze diesen Skill vor einer Aufgabe oder wenn du nicht weißt, wo eine Funktion implementiert ist.

1. Lies die geltenden Anweisungen aus `CLAUDE.md` / `AGENTS.md` und **nur** `docs/PROJECT_MAP.md` als Navigationshilfe. Andere Dokumente erst bei eindeutiger Relevanz.
2. Formuliere das betroffene Feature in einem Satz; wähle die zugehörige Tabellenzeile der MAP.
3. Suche **nur in den passenden Pfaden** nach Symbolen/Funktionsnamen. Große HTML-, Build- und Logdateien nicht komplett in den Modellkontext aufnehmen. Verwende kurze Suchtreffer (Dateiname und Fundstelle) und lies erst dann gezielte Funktionsausschnitte.
4. Lies höchstens fünf Dateien in der ersten Recherchephase; zusätzliche nur mit einer konkreten technischen Begründung. Keine vollständigen Repo-Scans, keine generierten `dist`-Verzeichnisse und keine doppelten Datei-Dumps.
5. Liefere einen kompakten Wegweiser: **betroffene Quelldateien und Funktionen, direkte Abhängigkeiten, passende Tests, Sicherheits-/Release-Risiken**. Unbestätigte Pfade oder Annahmen als unbestätigt kennzeichnen.
6. Wenn der Auftrag Implementierung verlangt, anschließend den kleinsten Patch erstellen, echte Tests ausführen und einen PR mit aktuellem Head-SHA übergeben. Bei reiner Analyse keinen Code verändern.
7. Die MAP nur aktualisieren, wenn sich tatsächlich Dateipfade oder Modulverantwortungen ändern; niemals die MAP als Ersatz für das Prüfen aktuellen Codes benutzen.

**Kosten-/Freigabegrenze:** Keine externen KI-APIs oder Cloudaktionen, keine automatischen Merge-/Deploy-/Review-Schleifen. Die Repository-Anweisungen haben Vorrang.
