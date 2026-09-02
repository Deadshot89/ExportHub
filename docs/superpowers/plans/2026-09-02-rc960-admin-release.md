# RC960 Admin & Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Release Center, Rechte/Sitzungen, Prüfcenter und Deployment-Prüfungen stabilisieren, ohne bestehende Freigabe- und Datenschutzregeln zu lockern.

**Architecture:** Aktive Release-/Admin-/Exam-Pfade werden zuerst auditiert. Zähler, Scroll/Fokus und Rechte werden an ihren bestehenden Quellen korrigiert; keine zweite parallele Release-Center-Logik. TESTSERVICE-Deployment bleibt der einzige technische Live-Schritt von RC960.

**Tech Stack:** HTML/CSS/Vanilla JavaScript, Node.js 20, GitHub Actions, Azure Static Web Apps.

**Spec:** `docs/superpowers/specs/2026-09-02-rc960-large-update-design.md`

## Global Constraints
- Produktion nicht direkt ändern.
- Funktionsadmin-Regeln nicht erweitern.
- Release Center bleibt verbindlicher Produktionsweg.
- Datenschutzanzeige und Prüfungsparameter 50 Fragen / 100 Punkte erhalten.
- Audit/Backup nur prüfen und Fehlerbehandlung verbessern; keine neue Cloud-Architektur.

---

### Task 1: Admin-/Release-Pfade auditieren

**Files:**
- Extend: `.github/rc960_audit.py`
- Inspect: `TESTVERSION.html`, `api/**` und `.github/workflows/exporthub-testservice.yml` nur für tatsächlich referenzierte Pfade.

- [ ] **Step 1:** Treffer für `Release Center`, `unpublished`, `openChanges`, `confirm`, `scroll`, `session`, `admin`, `permission`, `exam`, `50`, `100`, `privacy`, `audit`, `backup` ausgeben.
- [ ] **Step 2:** Quelle des offenen Änderungszählers und des Scrollsprungs eindeutig bestimmen.
- [ ] **Step 3:** Rechteprüfungen für Prüfungsauswertung/-verwaltung und Session-Beendigung lokalisieren.

### Task 2: RED-Vertrag Admin/Release

**Files:**
- Extend: `.github/rc960_regression.py`

- [ ] **Step 1:** Assertions für server-/zustandsbasierte offene Änderungen, Scroll/Fokus-Erhalt bei Bestätigung, Funktionsadmin-Guards, 50 Fragen, 100 Punkte und Datenschutzmarker schreiben.
- [ ] **Step 2:** Assertions für TESTSERVICE-Preflight/API-Smoke/Runtime-State-Probe im finalen Deployworkflow schützen.
- [ ] **Step 3:** Vor Patch ausführen; RC960-spezifische Assertions müssen FAIL sein.

### Task 3: Release Center direkt korrigieren

**Files:**
- Modify: `TESTVERSION.html`
- Extend: `.github/rc960_patch.py`

- [ ] **Step 1:** Offenen Zähler ausschließlich aus tatsächlich unpublizierten, nicht bereits bestätigten Änderungen ableiten; bestätigte Einträge dürfen nicht als Phantom offen bleiben.
- [ ] **Step 2:** Bei Bestätigung aktuelle Scrollposition, fokussiertes Element und offenen Abschnitt erhalten; kein `scrollIntoView`/Top-Reset ohne explizite Navigation.
- [ ] **Step 3:** Freigegebene Versionen einklappbar halten und offene Änderungen getrennt rendern.

### Task 4: Rechte/Sitzungen/Prüfcenter sichern

**Files:**
- Modify: `TESTVERSION.html`

- [ ] **Step 1:** Session-Beenden nur für Global Admin bzw. vorhandene berechtigte Adminrolle zulassen; normale Nutzer dürfen keine fremden Sessions beenden.
- [ ] **Step 2:** Prüfungsauswertung/-verwaltung nur über bestehenden Funktionsadmin-Guard zugänglich machen.
- [ ] **Step 3:** Prüfungsparameter 50 Fragen und 100 Punkte sowie Nachbesprechung/Begründung/Datenschutz nicht verändern.
- [ ] **Step 4:** Fehlende/unerreichbare Audit-/Backup-Aktionen mit sichtbarem Fehler abschließen statt UI hängen zu lassen.

### Task 5: Gemeinsamer RC960-Abschluss

**Files:**
- Verify: `.github/workflows/exporthub-testservice.yml`
- Remove before merge: `.github/rc960_audit.py`, `.github/rc960_patch.py`, `.github/rc960_regression.py`, `.github/workflows/rc960-large-update-check.yml` sofern nur temporär.

- [ ] **Step 1:** Gesamte RC960-Regression → PASS.
- [ ] **Step 2:** `npm test` → PASS.
- [ ] **Step 3:** `git diff --check` → PASS.
- [ ] **Step 4:** PR gegen `main`, vollständigen Diff prüfen und temporäre Hilfsdateien entfernen.
- [ ] **Step 5:** Squash-Merge als `RC960 Großupdate – Kernbetrieb, Versand und Admin`.
- [ ] **Step 6:** TESTSERVICE-Deploy genau einmal starten/auswerten.
- [ ] **Step 7:** Logs müssen Preflight, API-Smoke, Node-20-Runtime, Auth/Storage-Probe, State-Route und HTTP-200 RC960 für `/TESTVERSION.html` und `/test` bestätigen.