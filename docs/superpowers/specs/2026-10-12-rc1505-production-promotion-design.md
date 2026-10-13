# RC1505 – Sichere Production-Promotion

## Ziel

Ein normaler Merge oder Push auf `main` darf ExportHUB nicht mehr automatisch nach Production deployen. `main` bleibt Integrations- und Verifikationszweig. Production wird ausschließlich über eine explizite, manuell bestätigte Promotion eines bereits getesteten Commits freigegeben.

## Ausgangslage

Der aktuelle Workflow `.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml` wird bei deploy-relevanten Änderungen auf `main` gestartet und enthält sowohl `Deploy ExportHUB TESTSERVICE` als auch `Deploy ExportHUB production`. Dadurch koppelt das Repository Code-Integration und Production-Freigabe direkt aneinander.

Bestehende Tests wie `test/rc1005-three-env-sync.test.mjs` und `test/rc1018-production-deploy.test.mjs` erzwingen diese historische Kopplung ausdrücklich. Diese Verträge müssen im selben RC bewusst auf das neue Freigabemodell umgestellt werden.

## Zielarchitektur

### 1. Main-Workflow

Der bisherige RC1112-Workflow bleibt der zentrale Build- und Release-Gate-Workflow für `main`, aber seine Verantwortung endet vor Production.

Ablauf:

1. Checkout des exakten `main`-Commits.
2. Vollständiger Freigabevertrag und Regressionstests.
3. Gemeinsamer Drei-Umgebungen-Build bleibt als reproduzierbare Buildbasis erhalten.
4. Lokale Browser-Gates.
5. TESTSERVICE-Deploy.
6. TESTSERVICE-Browser-Gates und Readiness-Prüfungen.
7. Demo bleibt Bestandteil derselben getesteten Buildbasis.
8. Der Workflow endet erfolgreich, ohne Azure-Upload auf Production.

Der Schritt `Deploy ExportHUB production` und alle ausschließlich nach einem Production-Deploy sinnvollen Live-Prüfungen werden aus dem automatischen `push`-Pfad entfernt.

### 2. Manueller Production-Workflow

Neue Datei: `.github/workflows/exporthub-production-release.yml`.

Trigger ausschließlich über `workflow_dispatch`.

Pflichteingaben:

- `release_sha`: vollständiger Commit-SHA des freizugebenden getesteten Stands.
- `confirm_production`: muss exakt `PRODUCTION FREIGEBEN` entsprechen.

Der Workflow darf keinen beliebigen historischen Stand veröffentlichen. Vor dem Deploy wird geprüft:

1. SHA existiert im Repository.
2. SHA ist von `main` erreichbar.
3. SHA entspricht dem explizit angegebenen Release-Stand.
4. RC1505-Freigabevertrag ist auf diesem SHA grün.
5. Build wird aus genau diesem SHA reproduziert.
6. Production-Paket wird aus derselben RC1112-Buildkette erzeugt wie TESTSERVICE/Demo.
7. Direkt vor Upload wird erneut geprüft, dass `release_sha` nicht stillschweigend ersetzt wurde.
8. Erst danach erfolgt `Deploy ExportHUB production`.
9. Anschließend laufen die bisherigen Production-Readiness-, Live-HTML-, Print-, QR-/POD- und Browser-Smoke-Prüfungen.

## Sicherheitsregeln

- Ein `push` auf `main` darf im auf Push reagierenden Workflow keinen Production-Azure-Token verwenden.
- Ein normaler PR-Merge darf keinen Production-Deploy auslösen.
- Production darf nur über `workflow_dispatch` des Production-Release-Workflows verändert werden.
- Der Bestätigungstext ist Pflicht und case-sensitiv.
- Der freigegebene SHA wird nicht automatisch auf den neuesten `main`-Stand verschoben.
- Stale-Deploy-Guards bleiben bestehen und werden auf die neue Promotion-Semantik angepasst.
- Production-spezifische Secrets bleiben ausschließlich im manuellen Production-Workflow.
- TESTSERVICE/Demo und Production verwenden weiterhin dieselbe Buildkette; getrennt wird nur der Zeitpunkt der Promotion.

## Nachgelagerte Workflows

`packmeldungen-production.yml` darf künftig nicht mehr auf den Abschluss des automatischen Main-Workflows reagieren, weil dieser keine Production-Freigabe mehr repräsentiert.

Stattdessen soll er ausschließlich auf den erfolgreichen Abschluss von `ExportHUB Production Release` oder auf einen ausdrücklich manuellen Dispatch reagieren. Damit kann ein erfolgreicher TESTSERVICE-Build keine Packmeldungen nach Production ziehen.

## Vertrags- und Regressionstests

RC1505 ergänzt Tests, die mindestens Folgendes erzwingen:

1. Der Main-Workflow enthält keinen ausführbaren Production-Deploy im `push`-Pfad.
2. Der Main-Workflow enthält weiterhin TESTSERVICE, Demo-Buildbasis und alle relevanten Gates.
3. Der Production-Workflow besitzt ausschließlich `workflow_dispatch` als Release-Trigger.
4. `confirm_production` muss exakt `PRODUCTION FREIGEBEN` sein.
5. `release_sha` ist Pflicht und wird für Checkout, Build und Guard verwendet.
6. Production-Secret und Production-Azure-Deploy befinden sich nur im manuellen Production-Workflow.
7. `packmeldungen-production.yml` hört auf den erfolgreichen Production-Release und nicht mehr auf einen normalen Main-Build.
8. Historische Tests, die den gekoppelten Drei-Umgebungen-Deploy verlangen, werden auf „gemeinsame Buildbasis, getrennte Promotion“ migriert.
9. Ein Test simuliert einen normalen `main`-Push und muss beweisen, dass kein Production-Deploy erreichbar ist.
10. Ein Test simuliert einen manuellen Production-Dispatch mit falschem Bestätigungstext und muss vor jedem Deploy abbrechen.

## Migration

Die Umstellung erfolgt in einem eigenen RC1505-Branch und wird nicht direkt auf `main` editiert.

Reihenfolge:

1. Neue RC1505-Vertragstests zunächst rot hinzufügen.
2. Main-Workflow in Build/TESTSERVICE-Verantwortung überführen.
3. Manuellen Production-Workflow ergänzen.
4. Packmeldungen-Production auf Production-Release umstellen.
5. Historische Vertragsprüfungen an das neue Sicherheitsmodell anpassen.
6. Vollständige Node-/Contract-/i18n-/Browser-Gates ausführen.
7. PR bleibt bis zur vollständigen Verifikation ohne Merge.

## Rollback

Falls RC1505 vor dem Merge fehlschlägt, wird nur der RC1505-Branch verworfen; `main` und Production bleiben unverändert.

Nach einem späteren RC1505-Merge darf ein Rollback der Release-Architektur nicht automatisch Production deployen. Ein Rückbau erfolgt ebenfalls per PR und durchläuft dieselben Gates. Production bleibt bis zu einer separaten manuellen Promotion unverändert.

## Abnahmekriterien

RC1505 gilt erst als fertig, wenn:

- alle neuen Sicherheitsverträge grün sind,
- alle bestehenden Release-Gates grün sind,
- ein `main`-Push nachweislich keinen Production-Deploy auslösen kann,
- ein manueller Production-Dispatch ohne korrekte Bestätigung nachweislich blockiert,
- ein gültiger Dispatch den exakten freigegebenen SHA verwendet,
- nachgelagerte Production-Workflows ausschließlich an die echte Production-Promotion gekoppelt sind,
- `main` und Production während der Entwicklung von RC1505 nicht verändert wurden.
