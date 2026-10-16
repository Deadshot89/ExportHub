import fs from 'node:fs';

const testservicePath='.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml';
const productionPath='.github/workflows/exporthub-production-release.yml';

function insertBeforeOnce(source, anchor, marker, block) {
  if (source.includes(marker)) return source;
  const index=source.indexOf(anchor);
  if(index<0) throw new Error(`RC1553 anchor fehlt: ${anchor.trim()}`);
  return source.slice(0,index)+block+'\n'+source.slice(index);
}

const testMetadata=`      - name: RC1553 deployment metadata - TESTSERVICE
        shell: bash
        run: |
          set -euo pipefail
          build_id="$(git rev-parse HEAD)"
          BUILD_ID="$build_id" DEPLOY_ENVIRONMENT='testservice' node -e "
            const fs=require('fs');
            const release=JSON.parse(fs.readFileSync('release-version.json','utf8'));
            const metadata={
              buildId:process.env.BUILD_ID,
              visibleRelease:String(release.visibleRelease||'').trim(),
              technicalBuild:String(release.technicalBuild||'').trim(),
              builtAt:new Date().toISOString(),
              environment:process.env.DEPLOY_ENVIRONMENT
            };
            if(!/^[0-9a-f]{40}$/i.test(metadata.buildId)||!metadata.visibleRelease||!metadata.technicalBuild)throw new Error('RC1553: unvollstaendige TESTSERVICE Deployment-Metadaten');
            fs.writeFileSync('api/release-metadata.json',JSON.stringify(metadata,null,2)+'\\n');
          "
          test -s api/release-metadata.json
          node -e "const v=require('./api/release-metadata.json'); console.log('RC1553 TESTSERVICE deployment metadata',JSON.stringify({buildId:v.buildId,visibleRelease:v.visibleRelease,technicalBuild:v.technicalBuild,builtAt:v.builtAt,environment:v.environment}))"
`;

const testVerify=`      - name: RC1553 TESTSERVICE deployment identity prüfen
        shell: bash
        run: |
          set -euo pipefail
          base='https://ashy-grass-065b7b803-testservice.westeurope.6.azurestaticapps.net'
          expected="$(git rev-parse HEAD)"
          body="$(mktemp)"
          trap 'rm -f "$body"' EXIT
          for attempt in {1..24}; do
            code="$(curl -sS -L -o "$body" -w '%{http_code}' --max-time 20 "$base/api/exporthub-health?rc1553=${expected}-${attempt}" || true)"
            if [ "$code" = '200' ] && EXPECTED_BUILD_ID="$expected" BODY="$body" node -e "const fs=require('fs'),v=JSON.parse(fs.readFileSync(process.env.BODY,'utf8')||'{}');if(v.deployment&&v.deployment.verified===true&&v.deployment.buildId===process.env.EXPECTED_BUILD_ID&&v.deployment.environment==='testservice')process.exit(0);process.exit(1)"; then
              echo "RC1553 TESTSERVICE deployment.buildId=$expected deployment.verified=true"
              exit 0
            fi
            sleep 5
          done
          cat "$body" >&2 || true
          echo "RC1553: TESTSERVICE deployment identity stimmt nicht mit $expected ueberein." >&2
          exit 1
`;

const productionMetadata=`      - name: RC1553 deployment metadata - PRODUCTION
        shell: bash
        run: |
          set -euo pipefail
          build_id="$(git rev-parse HEAD)"
          test "$build_id" = "$RELEASE_SHA"
          BUILD_ID="$build_id" DEPLOY_ENVIRONMENT='production' node -e "
            const fs=require('fs');
            const release=JSON.parse(fs.readFileSync('release-version.json','utf8'));
            const metadata={
              buildId:process.env.BUILD_ID,
              visibleRelease:String(release.visibleRelease||'').trim(),
              technicalBuild:String(release.technicalBuild||'').trim(),
              builtAt:new Date().toISOString(),
              environment:process.env.DEPLOY_ENVIRONMENT
            };
            if(!/^[0-9a-f]{40}$/i.test(metadata.buildId)||!metadata.visibleRelease||!metadata.technicalBuild)throw new Error('RC1553: unvollstaendige PRODUCTION Deployment-Metadaten');
            fs.writeFileSync('api/release-metadata.json',JSON.stringify(metadata,null,2)+'\\n');
          "
          test -s api/release-metadata.json
          node -e "const v=require('./api/release-metadata.json'); console.log('RC1553 PRODUCTION deployment metadata',JSON.stringify({buildId:v.buildId,visibleRelease:v.visibleRelease,technicalBuild:v.technicalBuild,builtAt:v.builtAt,environment:v.environment}))"
`;

const productionVerify=`      - name: RC1553 PRODUCTION deployment identity prüfen
        shell: bash
        run: |
          set -euo pipefail
          base='https://wonderful-forest-0f315e310.7.azurestaticapps.net'
          body="$(mktemp)"
          trap 'rm -f "$body"' EXIT
          for attempt in {1..24}; do
            code="$(curl -sS -L -o "$body" -w '%{http_code}' --max-time 20 "$base/api/exporthub-health?rc1553=${RELEASE_SHA}-${attempt}" || true)"
            if [ "$code" = '200' ] && EXPECTED_BUILD_ID="$RELEASE_SHA" BODY="$body" node -e "const fs=require('fs'),v=JSON.parse(fs.readFileSync(process.env.BODY,'utf8')||'{}');if(v.deployment&&v.deployment.verified===true&&v.deployment.buildId===process.env.EXPECTED_BUILD_ID&&v.deployment.environment==='production')process.exit(0);process.exit(1)"; then
              echo "RC1553 PRODUCTION deployment.buildId=$RELEASE_SHA deployment.verified=true"
              exit 0
            fi
            sleep 5
          done
          cat "$body" >&2 || true
          echo "RC1553: PRODUCTION deployment identity stimmt nicht mit RELEASE_SHA=$RELEASE_SHA ueberein." >&2
          exit 1
`;

let testservice=fs.readFileSync(testservicePath,'utf8');
testservice=insertBeforeOnce(testservice,'      - name: Deploy ExportHUB TESTSERVICE\n','RC1553 deployment metadata - TESTSERVICE',testMetadata);
testservice=insertBeforeOnce(testservice,'      - name: Release-Center aktive Testversion auf deployten Stand setzen\n','RC1553 TESTSERVICE deployment identity prüfen',testVerify);
fs.writeFileSync(testservicePath,testservice);

let production=fs.readFileSync(productionPath,'utf8');
production=insertBeforeOnce(production,'      - name: Deploy ExportHUB production\n','RC1553 deployment metadata - PRODUCTION',productionMetadata);
production=insertBeforeOnce(production,'      - name: RC1170 PRODUCTION Kundenportal-Verschlüsselung prüfen\n','RC1553 PRODUCTION deployment identity prüfen',productionVerify);
fs.writeFileSync(productionPath,production);

console.log('RC1553: release workflows patched deterministisch.');
