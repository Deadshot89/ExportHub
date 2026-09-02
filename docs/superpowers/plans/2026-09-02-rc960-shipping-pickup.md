# RC960 Versand & Abholung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Versandkosten-, Abhol-, Status- und POD-Flows fachlich konsistent und gegen Fehlbedienung abgesichert machen.

**Architecture:** Bestehende Versandkosten-, Pickup- und Shipment-Statusfunktionen werden über Audit identifiziert und direkt korrigiert. Status-/Sperrlogik bleibt zentral; UI-Handler dürfen sie nicht umgehen. QR/PIN bleibt unverändert und wird nur gegen Regression geschützt.

**Tech Stack:** HTML/CSS/Vanilla JavaScript, Node.js 20, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-02-rc960-large-update-design.md`

## Global Constraints
- Keine D365-Integration.
- Gate41 ohne Servicezuschlag.
- POD erst nach Abholung.
- Ab `Abgeholt` oder POD: kein Bearbeiten/Speichern.
- Geplantes und tatsächliches Abholdatum bleiben getrennt.
- QR/PIN-Sicherheit nicht umbauen.

---

### Task 1: Versand-/Pickup-Pfade auditieren

**Files:**
- Extend: `.github/rc960_audit.py`
- Inspect: `TESTVERSION.html`, vorhandene Pickup/API-Dateien nur soweit vom Flow referenziert.

- [ ] **Step 1:** Treffer für `Gate41`, `UPS`, `country`, `land`, `shipping`, `pickup`, `Abgeholt`, `POD`, `actualPickup`, `plannedPickup`, `Abholtag`, `colli`, `total` ausgeben.
- [ ] **Step 2:** Tatsächliche aktive Berechnung/Validierung identifizieren; doppelte Altgenerationen markieren.

### Task 2: RED-Vertrag Versand/Abholung

**Files:**
- Extend: `.github/rc960_regression.py`

- [ ] **Step 1:** Assertions schreiben: Gate41-Service darf nicht in Summenpfad eingehen; Zielland-Fallback existiert; Pickup-Soll basiert auf Summe physischer Colli; POD-Guard verlangt Abholung; Schreibsperre wird vor Persistenz geprüft; tatsächliches Abholdatum erledigt `Abholtag`.
- [ ] **Step 2:** Regression vor Patch ausführen; mindestens RC960-spezifische Assertions müssen FAIL liefern.

### Task 3: Versandkosten korrigieren

**Files:**
- Modify: `TESTVERSION.html`
- Extend: `.github/rc960_patch.py`

- [ ] **Step 1:** Zielland deterministisch aus ausgewähltem Empfänger/Standort, dann Sendungsadresse ableiten; keine Textfeld-Ratespiele wenn strukturierte Daten vorhanden sind.
- [ ] **Step 2:** Gate41-Summe ohne Servicekomponente berechnen; vorhandene Grund-/Maut-/zulässige Zuschlagslogik erhalten.
- [ ] **Step 3:** Berechnungsfehler sichtbar melden und vorhandene Werte nicht still auf 0 überschreiben.

### Task 4: Abholung/POD/Status korrigieren

**Files:**
- Modify: `TESTVERSION.html`

- [ ] **Step 1:** Physische Colli-Gesamtzahl über alle sichtbaren/gespeicherten Colli-Zeilen summieren und auf Abholseite als ein Soll anzeigen.
- [ ] **Step 2:** Bestätigung exakt gegen diese Gesamtsumme validieren.
- [ ] **Step 3:** Abholung speichert tatsächliches Datum/Uhrzeit separat und erledigt zugehörige `Abholtag`-Aufgabe.
- [ ] **Step 4:** POD-Upload ohne Abholung blockieren; mit POD Status `POD vorhanden` und Schreibsperre setzen.
- [ ] **Step 5:** Vor jedem Save Schreibsperre erneut aus aktuellem Shipment-State prüfen, damit stale offene Formulare nicht speichern.

### Task 5: GREEN und Regression

- [ ] **Step 1:** `python .github/rc960_regression.py` → PASS.
- [ ] **Step 2:** `npm test` → PASS.
- [ ] **Step 3:** Audit bestätigt QR/PIN-Tokens unverändert und Status-/Sperrpfade eindeutig aktiv.