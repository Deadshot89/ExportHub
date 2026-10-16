# ExportHUB360 RC1552 Packaging Master Data Design

## Goal
Introduce one central packaging master-data system for ExportHUB360. Administrators can create, edit, duplicate, activate, deactivate and delete packaging types. All current and future shipment/packing flows consume the same canonical source. Historical shipments remain immutable through packaging snapshots.

## Scope
This change covers:
- Management → Stammdaten → Verpackungen
- canonical packaging persistence
- admin CRUD and server-side authorization
- searchable active-packaging selectors
- migration from existing `state.colliTypes` and the hard-coded shared packaging catalog
- QR pack-station integration
- shipment create/edit integration
- Colli capture, pickup, loading list, print, AVIS and shipping-cost consumers
- immutable historical snapshots
- audit trail
- regression and production proof

It must not change shipment status logic, QR token semantics, pickup authorization, print document count/order, AVIS token generation, existing dimensions/weight calculations or unrelated UI behavior.

## Current State and Problem
ExportHUB360 currently has more than one packaging source:
- `state.colliTypes` is used by the main application and by the pack-station API.
- `assets/packaging-catalog.js` contains a second hard-coded catalog with canonical pallet names and dimensions.
- the pack-station API has a fixed E3 override (`43 × 31 × 31 cm`, `0.06 LDM`) that intentionally wins over stale saved E3 values.
- some shipment consumers read different row aliases (`rows`, `colli`, `collis`, `packages`, `packagingRows`, etc.).

RC1552 must remove the need for parallel packaging lists without breaking the existing row compatibility layer.

## Architecture Decision
Use the existing ExportHUB team-state persistence as the canonical packaging master-data store. Do not introduce a separate database for RC1552.

Canonical state collection:

```js
state.packagingTypes = []
```

All packaging-management writes go through a dedicated server-side packaging API/service. Read-only consumers use one normalization layer that exposes only canonical active master data for new selections, while historical documents use the saved shipment/package snapshot.

`state.colliTypes` becomes a migration/compatibility input only and must not remain an independently editable source after RC1552 is live.

`assets/packaging-catalog.js` must no longer own an independent mutable/authoritative list. Its existing entries are migration seeds/legacy aliases only. Consumers must read the canonical source.

## Canonical Data Model
Each packaging type stores at least:

```js
{
  id: 'PKG-...',
  name: 'Euro Palette',
  normalizedName: 'europalette',
  code: 'EUR',
  description: '',
  active: true,

  // Existing ExportHUB packaging behavior requires dimensions/LDM.
  lengthCm: 120,
  widthCm: 80,
  heightCm: null,
  ldm: null,

  createdAt: 'ISO-8601',
  createdBy: { id: '...', name: '...' },
  updatedAt: 'ISO-8601',
  updatedBy: { id: '...', name: '...' },
  deactivatedAt: null,
  deactivatedBy: null
}
```

### Name normalization
Duplicate detection is case-insensitive and whitespace/punctuation tolerant enough to stop obvious duplicates.

Minimum contract:
- trim
- Unicode normalize
- lowercase
- collapse/remove non-semantic whitespace

`Europalette`, ` EUROPALETTE ` and equivalent normalized input must resolve to the same duplicate key.

Name uniqueness is enforced server-side against all non-hard-deleted records, including inactive records. Reactivation/editing must not create collisions.

Code uniqueness should also be enforced case-insensitively when a non-empty code is provided.

## Protected Packaging Rules
Current business-correct canonical values must survive migration. In particular E3 remains `43 × 31 × 31 cm` and `0.06 LDM` unless the product owner later explicitly changes this business rule.

If existing sources disagree during migration, authoritative canonical values win over stale historical master values. This preserves the existing E3 precedence behavior.

The migration must document every conflict rather than silently choosing an arbitrary source.

## Historical Snapshot Contract
A shipment must never depend on the current master-data label for historical display.

Whenever a shipment/package row is saved after RC1552, persist both the master-data reference and a snapshot:

```js
{
  packagingTypeId: 'PKG-...',
  packagingSnapshot: {
    name: 'Einwegpalette',
    code: 'EWP',
    description: '',
    lengthCm: 120,
    widthCm: 80,
    heightCm: null,
    ldm: null
  }
}
```

The snapshot is copied at shipment-save time. Later master-data edits do not mutate it.

### Historical rendering precedence
For saved historical data:
1. `packagingSnapshot` if present
2. already-saved row label/type fields from the shipment
3. current master lookup only as a last-resort compatibility fallback for records that never contained a usable historical label

Print, loading list, AVIS, POD/archive and other historical renderers must follow this rule.

### Editing an old shipment
Opening an old shipment must display its historical saved packaging label. If the user deliberately changes the packaging selector and saves, that row gets a new current snapshot. Merely opening/saving unrelated fields must not silently replace the old snapshot with a renamed master value.

## API / Service Contract
Introduce one packaging master-data service exposed through the existing authenticated ExportHUB backend/state architecture.

Required operations:
- list packaging types
- create packaging type
- update packaging type
- duplicate packaging type
- activate packaging type
- deactivate packaging type
- delete packaging type

The exact URL shape may follow the repository's existing API conventions, but all writes must go through one canonical implementation.

### Read behavior
Admin management view:
- may request active + inactive records
- receives audit/display metadata needed by the management UI

Normal application selectors:
- receive active records only
- receive only fields required for selection/dimensions

QR pack station:
- remains accessible through its station-token contract
- `packaging-list` must source the canonical packaging master data
- inactive entries are excluded
- sensitive admin/audit fields are never returned

## Authorization
Authorization is server-side.

Administrator:
- create
- edit
- duplicate
- activate
- deactivate
- delete/archive

Normal user:
- read active packaging choices
- select packaging types
- cannot mutate master data

Management navigation/actions should also be hidden/disabled for normal users, but UI hiding is not considered a security boundary.

Direct unauthorized API calls must return an authorization error and leave state unchanged.

## Create and Update Validation
Required validation:
- `name` required
- normalized name unique
- optional code unique when present
- lengths/widths/heights/LDM, when present, must be finite positive values
- description length bounded
- status boolean
- trim all user-facing strings

Create default: `active = true`.

Successful create message:
`Verpackung wurde erfolgreich angelegt.`

Successful update message:
`Änderungen wurden gespeichert.`

No full application reload is allowed after create/update/status changes.

## Delete / Archive Semantics
Before delete, UI always asks:
`Verpackung „<Name>“ wirklich löschen?`

The server performs the usage decision.

### Hard delete allowed
Only when the packaging type has never been referenced by:
- shipments/current shipments
- shipment history/archive
- tasks
- pack notifications
- pack drafts
- pickup data
- saved AVIS/shipping records
- any other persisted row containing its id or an attributable historical reference

### Already used
If any persisted use exists, hard delete is denied and the canonical operation becomes deactivation/archive.

Return a structured result allowing the UI to show:
`Diese Verpackung wurde bereits verwendet und kann aus Gründen der Datenhistorie nicht vollständig gelöscht werden. Sie wird deaktiviert und künftig nicht mehr zur Auswahl angeboten.`

Historical snapshots/labels remain unchanged.

## Usage Detection
Usage detection must be centralized, not reimplemented independently in the UI.

Because the repository supports multiple legacy row shapes, the server-side detector must check canonical ids and legacy persisted labels where necessary. A false-negative that hard-deletes historically used master data is considered a release blocker.

The detector should expose a testable result such as:

```js
{
  used: true,
  references: {
    shipments: 4,
    tasks: 1,
    packNotifications: 2,
    other: 0
  }
}
```

The UI does not need to expose all counts initially; the server contract makes deletion decisions deterministic and auditable.

## Audit Trail
Every mutation creates an append-only audit entry:

```js
{
  id: 'AUD-...',
  entityType: 'packaging_type',
  entityId: 'PKG-...',
  action: 'created|updated|activated|deactivated|deleted',
  packagingName: 'Euro Palette',
  before: {...},
  after: {...},
  actor: { id: '...', name: '...', role: '...' },
  at: 'ISO-8601'
}
```

Audit entries are not changed when the packaging entry is later edited or hard-deleted.

Hard delete therefore removes only the master-data record, not its audit history.

## Management UI
Navigation:
`Management → Stammdaten → Verpackungen`

Desktop/table columns:
- Verpackungsbezeichnung
- Kurzbezeichnung / Code
- Beschreibung
- Status
- zuletzt geändert
- geändert von
- Aktionen

Controls:
- `+ Verpackung hinzufügen`
- search
- status filter: Aktiv / Inaktiv / Alle
- sorting

Per-row actions:
- Bearbeiten
- Duplizieren
- Deaktivieren / Aktivieren
- Löschen

Status:
- 🟢 Aktiv
- ⚪ Inaktiv

Responsive behavior:
- desktop: table
- narrow/mobile: compact cards or horizontally safe table layout
- no clipped action menus or horizontal page overflow

Create/edit uses a modal or side panel consistent with the current ExportHUB design system.

## Searchable Packaging Selector
All new/edit selection surfaces use one shared searchable packaging selector behavior.

Requirements:
- active records only for new selection
- searchable by name and code
- keyboard accessible
- no duplicated options
- dimensions may be auto-filled from the selected packaging master where the existing flow currently supports auto-fill
- manually editable dimensions remain editable where the existing flow permits this

An inactive packaging used historically remains visible as the selected historical value but does not appear in the new-choice option list.

## Live State Synchronization
CRUD must not reload the complete application.

Use one in-memory packaging store/cache fed from canonical state. After successful mutation:
1. merge/replace the local packaging record set
2. emit one packaging-master-data-changed event or invoke the existing state refresh mechanism at collection granularity
3. refresh currently mounted packaging selectors and the management table
4. preserve unsaved unrelated form fields and scroll/focus where possible

Do not trigger global re-render/navigation as a side effect of packaging CRUD.

## Migration
RC1552 requires an idempotent migration.

### Inputs
- existing `state.colliTypes`
- current entries from `assets/packaging-catalog.js`
- protected canonical values such as E3

### Rules
1. normalize names
2. merge obvious duplicates
3. preserve existing ids when safe; otherwise generate stable canonical ids
4. preserve existing dimensions/LDM unless an existing protected canonical rule intentionally supersedes stale values
5. import hard-coded catalog aliases only as migration/lookup aliases, not as a second runtime authority
6. default migrated records to active unless explicitly inactive in existing data
7. record migration conflicts for verification
8. migration can run more than once without duplicating records

### Legacy compatibility
Existing saved shipment data is not mass-rewritten merely to adopt master-data ids. Historical labels remain valid. Optional lazy/backfill linking may add ids only when it can do so without changing historical display semantics.

## Consumer Migration Matrix
The following consumers must use canonical packaging data for new selections and snapshot data for historical display:

- shipment create
- shipment edit
- QR pack-station task
- Colli entry
- pickup views
- loading list
- print documents
- customer AVIS
- shipping-cost/UPS tooling
- task conversion into shipment
- POD/archive/historical views

Repository-wide search must also identify any additional fixed lists/options and either migrate or explicitly document them.

## Packaging Catalog Compatibility
`assets/packaging-catalog.js` may remain temporarily as a compatibility adapter only if required by existing clients/tests. In that case:
- it must not define an independent production list
- it must expose canonical data supplied by state/API or contain only aliases/normalization helpers
- the final runtime must have one authoritative packaging dataset

A release contract test must fail if a new independent hard-coded production packaging list is introduced.

## Internationalization
All new management labels, dialogs, validation messages, status text and selector text must use the existing central i18n system for:
- de
- en
- pl
- es
- fr
- it

Business/master-data names entered by administrators are data and are not automatically translated by RC1552.

## Performance and Concurrency
Packaging list reads must remain lightweight enough for shipment forms and the QR pack station.

Writes use the existing optimistic/serialized team-state mutation protections. Two admins editing concurrently must not silently overwrite unrelated changes.

QR pack-station read calls remain read-only and must not acquire unnecessary global write serialization.

## Error Handling
Examples of explicit error states:
- duplicate normalized name
- duplicate code
- record changed/deleted concurrently
- unauthorized mutation
- hard delete forbidden because usage exists
- persistence failure

The UI preserves entered form data after recoverable errors and shows a clear message without a page reload.

## Test Strategy
Use RED → GREEN tests before implementation changes for each contract.

### Unit/contract tests
- create packaging
- duplicate normalized name rejected
- code duplicate rejected
- update packaging
- activate/deactivate
- hard delete unused packaging
- used packaging delete becomes deactivate/archive
- admin authorization required
- normal user read-only access
- audit before/after values
- migration idempotency
- E3 canonical dimensions preserved
- canonical list excludes inactive entries for normal selectors
- QR `packaging-list` uses canonical source and excludes sensitive fields
- snapshot creation on shipment save
- master-data rename does not change historical snapshot
- inactive historical packaging still renders

### UI tests
- management table renders
- search/filter/sort
- create/edit/duplicate modal
- confirm delete
- status changes without full reload
- searchable selector updates immediately after CRUD
- mobile/narrow layout does not overflow

### End-to-end regression tests
1. add packaging
2. immediately select it in new shipment
3. edit packaging
4. new shipment sees edited value
5. old shipment keeps old snapshot
6. delete unused packaging
7. delete used packaging → auto deactivate
8. inactive packaging unavailable for new shipment
9. reactivate packaging
10. normal-user permissions
11. search/filter/sort
12. print/loading list existing packaging
13. QR pack-station flow
14. shipping-cost/UPS source selection
15. AVIS historical display
16. full test suite
17. three-environment build
18. production deployment
19. production browser smoke test

## Production Completion Rule
RC1552 is not 100% complete when code is written, tests are green or the branch is merged.

It may be reported as 100% only when:
- implementation complete
- focused tests green
- full regression green
- release build green
- deployment to production succeeded
- production live checks confirm management CRUD, selector propagation, QR pack station and historical print/loading-list behavior

If deployment or production verification fails, status remains below 100% and the failure is treated as an open release blocker.

## Acceptance Criteria Mapping
The user-provided 15 acceptance criteria are mandatory release gates. None may be waived because a lower-level unit test passed.

RC1552 specifically closes only when all of the following are proven on the released code:
1. add
2. immediate new-shipment availability
3. edit
4. edited value for new shipments
5. historical shipment unchanged
6. delete unused
7. used delete auto-deactivates
8. inactive unavailable for new selections
9. reactivate
10. normal-user permissions
11. search/filter
12. print/loading-list regression
13. QR pack-station regression
14. build/full regression
15. production deployment + live verification
