# ExportHUB360 i18n Browser + Production Proof Design

## Goal
Close the remaining proof gaps after RC1510: verify real six-language rendering in a browser on responsive viewports, make locale-sensitive formatting use the central i18n runtime, and expose safe translator configuration status to administrators.

## Constraints
- Supported languages stay exactly `de`, `en`, `pl`, `es`, `fr`, `it`.
- No shipment, document, status, permission, calculation or customer-policy behavior changes.
- No translation credentials, keys, tokens or secret values may ever be returned to the browser.
- Existing RC1267 remains the only central i18n runtime.
- Existing `_localizedText` data model remains unchanged.

## RC1511 Browser/Responsive proof
A Playwright spec must render the actual `customer-avis.html` page for all six languages using the existing `?lang=` contract. It must run in both `mobile-standard` (390x844) and `laptop` (1366x768), assert the page runtime selected the requested language, assert the visible AVIS title equals `ExportHUBI18n.t('avis.title')`, assert the document `<html lang>` matches, and assert no horizontal page overflow or runtime errors.

A dedicated PR workflow must build the current three-environment package and execute this spec on both target projects whenever central i18n assets, customer AVIS, the spec, its contract test, the build script or Playwright configuration changes.

## Locale-sensitive formatting
`customer-avis.html` must not hard-code `de-DE` for visible dates or numbers. Its `fmtDate` and `fmtNum` helpers must delegate to `ExportHUBI18n.formatDate` and `ExportHUBI18n.formatNumber` when available, preserving a safe browser fallback only when the central runtime is unavailable.

## RC1512 Translator diagnostics
The existing admin-only `mode=i18n-status` endpoint must expose safe provider metadata from `translatorConfig()`:
- provider name (`azure-translator` or `not-configured`)
- `configured` boolean
- `regionConfigured` boolean
- endpoint host only, never the full key or any credential

This is diagnostic metadata only and must not weaken the existing admin authorization.

## Verification
- RED/GREEN Node contract tests for browser gate, locale formatting and safe translator status.
- Playwright six-language test on mobile-standard and laptop.
- Existing full regression suite.
- Existing three-environment build and strict i18n audit.
