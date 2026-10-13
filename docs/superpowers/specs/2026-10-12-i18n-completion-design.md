# ExportHUB360 i18n Completion Design

## Goal
Harden the existing six-language ExportHUB360 internationalization so every new visible UI change is release-gated and dynamically stored note/hint/description fields remain translatable without modifying identifiers or business logic.

## Existing architecture to preserve
- Central browser runtime: `assets/rc1267-i18n.js`.
- Static locale catalogs: `assets/i18n/{de,en,pl,es,fr,it}.json`.
- Dynamic translation sidecars: `api/shared/dynamic-i18n.js` using `_localizedText` with original text, source language, all six translations, version/hash, timestamp and error/status metadata.
- State integration and migration/status endpoints: `api/exporthub-state/index.js`.
- Release verification: `.github/workflows/rc1267-i18n-verify.yml` plus `scripts/i18n-audit.mjs`.

## Required behavior
1. Supported languages stay exactly `de`, `en`, `pl`, `es`, `fr`, `it`.
2. Existing login/profile/public-page language behavior remains unchanged.
3. Business rules, calculations, permissions, shipment/status logic and document logic must not change.
4. Any change under production-facing UI assets must trigger the i18n verification workflow on pull requests to `main`.
5. The normal `verify:i18n` command must fail when the strict audit finds missing/extra/empty keys, visible translation-key literals or hardcoded German UI candidates.
6. Dynamic translatable text matching must cover common future field-name variants for notes, hints, instructions, descriptions and remarks (for example `customerNote`, `internalNote`, `externalNote`, `customerHint`, `taskDescription`) while continuing to skip histories, files, documents/attachments and identifier-like branches.
7. Product names, customer names, references, article numbers, tracking numbers and other identifiers are not translated.
8. Source text is never overwritten; stale translations are invalidated by the existing hash/version mechanism.

## Design
### Release gate
Broaden the pull-request path filter in `rc1267-i18n-verify.yml` from a list of selected asset files to all `assets/**` production assets. Keep API, HTML, tests, package and build tooling in scope. This makes new feature runtimes impossible to add without running the strict i18n gate.

### Local/CI verification command
Change `verify:i18n` to run `i18n:audit:strict`. The workflow may keep its final explicit strict gate as defense in depth.

### Dynamic field classification
Replace the single exact-match `LOCALIZABLE_FIELD` regex with a small `isLocalizableField(key)` classifier. It keeps the existing exact names and additionally accepts camelCase/snake-case/kebab-case field names ending in semantic text suffixes such as `Note(s)`, `Hint(s)`, `Description`, `Instruction(s)` or `Remark(s)`. Explicit identifier/name/number/code/reference/tracking fields remain excluded.

## Error handling and performance
No new translation call is introduced. The existing save limit, `retryPending:false`, deduplication, cached sidecars and migration endpoint remain unchanged. Classification is local string matching only.

## Tests
- Dynamic-i18n test proves new note/hint field names are collected and translated.
- Dynamic-i18n test proves identifiers/names/references remain untouched.
- i18n contract test proves `verify:i18n` uses the strict audit and the PR workflow covers `assets/**`.
- Existing full regression suite remains mandatory in the i18n workflow.
