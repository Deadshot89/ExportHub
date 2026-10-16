# RC1555 Packaging hardening ruling

RC1554 (`24329fe80952375be139305247465f361b358db6`) landed on `main` while RC1552 was being implemented. It already provides packaging CRUD, activation/deactivation, used-vs-unused deletion behavior, admin UI and pack-station suppression.

The approved RC1552 specification remains the binding acceptance contract. RC1554 is therefore treated as the new implementation baseline instead of building a second competing packaging administration.

## Verified gaps against the approved RC1552 contract

1. Runtime master data is still split across `state.colliTypes`, `state.inactiveColliTypes`, `state.disabledPackagingAliases` and the hard-coded `assets/packaging-catalog.js` fallback instead of one canonical `state.packagingTypes` collection.
2. Repository search on current `main` finds no `packagingTypeId` and no `packagingSnapshot`, so shipments do not yet persist the required master-data reference plus immutable snapshot.
3. `api/shared/packaging-admin-store.js` enforces normalized name uniqueness but not case-insensitive code uniqueness.
4. Packaging audit entries do not yet contain immutable before/after payloads.
5. RC1554 navigation is attached to the Packmeldungen area; the approved target path remains `Management → Stammdaten → Verpackungen`.
6. RC1554 UI uses a private inline six-language table instead of the existing central ExportHUB i18n packs.

## Execution ruling

Continue from current `main` as RC1555 hardening. Preserve every working RC1554 behavior and its release gates. Do not merge the stale RC1552 implementation branch. Implement only missing RC1552 acceptance requirements with RED→GREEN regression coverage, then run full release and production gates. Production may be marked 100% only after live verification.
