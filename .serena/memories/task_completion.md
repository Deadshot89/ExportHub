# Task completion
1. Gezielt betroffene Tests laufen lassen (`node --test test/<datei>`), bei Sprachtexten `npm run verify:i18n`.
2. Vor PR: `npm run verify:release`.
3. Secrets: `npm run test:security`.
4. Nur im Entwicklungsbranch arbeiten; Commit/Merge/Deploy nur nach ausdruecklicher Freigabe.
5. Nach bestaetigter groesserer Aenderung `docs/WORK_STATUS.md` aktualisieren.
