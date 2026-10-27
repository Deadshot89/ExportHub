# RC1684 Versandkosten-Regressionsfix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax.

**Goal:** Zielregion und Verpackungen bleiben in Versandkosten korrekt und stabil, auch wenn gespeicherte Sendungsfelder veraltet sind.

**Architecture:** Ein einziges Prioritätsschema für eingebetteten/ausgewählten Lieferstandort in beiden bestehenden Versandkosten-Runtimes; kanonische Paketliste nur bei inhaltlichen Änderungen aktualisieren.

**Tech Stack:** Browser-JavaScript, Node.js `node:test`, Azure Static Web Apps.

**Spec:** Nutzerfehlerbericht vom 27.10.2026 (Zielland fehlt, Verpackung rendert wiederholt neu).

## Global Constraints

- UPS nur Kartons; Paletten nur Gate41; bestehende Preise nicht verändern.
- Keine Änderung an Sendungsdaten, POD, AVIS oder QR-Links.
- Produktion nur bei erfolgreichen Regressionen und Deployment-Kontrollen.

## Review Focus

- Eingebetteter Standort ohne Standort-ID → Standortland/-PLZ.
- Standort-ID mit stale Sendungsland → Standortland.
- Manuell gesetztes Zielland darf nicht ungefragt überschrieben werden.
- Mehrere Kartons mit gleichen Dimensionen → stabile kanonische Paketliste.
- Versandkosten außerhalb aktiver Sendung → keine erfundene Destination.

---

### Task 1: Konsistente Destination

**Files:** `assets/rc1206-shipping-rules.js`, `index.html`, `test/rc1684-shipping-country-packaging-regression.test.mjs`

**Interfaces:** `shipmentDestination()`, `activeShipmentRoute()`; bestehende Rückgaben unverändert.

- [ ] Fehlerfälle als Tests definieren und Rotlauf nachweisen.
- [ ] In beiden Implementierungen ausgewählten Lieferstandort priorisieren.
- [ ] Tests erneut ausführen und Land/PLZ auf gleicher Quelle prüfen.
- [ ] Fix auf Branch committen.

### Task 2: Verpackungssynchronisierung stabilisieren

**Files:** `assets/rc1206-shipping-rules.js`, `test/rc1684-shipping-country-packaging-regression.test.mjs`

**Interfaces:** `syncCanonicalShippingState()` und `shippingCosts.ups.packageItems`.

- [ ] Regression für unveränderte wiederholte Synchronisierung im Rotlauf nachweisen.
- [ ] Paketliste nur bei echtem Inhaltsunterschied ersetzen.
- [ ] Test und ganze Node-Regression ausführen; Quellen und drei Umgebungsdateien prüfen.
- [ ] Fix committen, PR mit CI prüfen und freigeben, wenn Checks grün.
