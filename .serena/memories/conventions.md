# Conventions
- Neue Frontend-Module: eigene Datei `assets/rcNNNN-<thema>.js`, IIFE mit `'use strict'` und Doppelstart-Guard `w.__EXPORTHUB_RCNNNN_..__`. Kopfkommentar nennt RC und Zweck. Daten bleiben in `state.*` der Haupt-App.
- Texte immer in alle sechs Sprachpakete (de,en,pl,es,fr,it); `assets/i18n/rcNNNN-*.js` fuer modulbezogene Texte.
- API-Funktionen: `'use strict'`, CommonJS, dünner `index.js`, Logik in `api/shared/`.
- Tests heissen `rcNNNN-<thema>.test.mjs` bzw `.cjs`; Release-Gates als Workflows `rcNNNN-*.yml`.
- Commits/PRs tragen Prefix `RCNNNN:` und deutschen Titel.
