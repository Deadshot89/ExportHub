import fs from 'node:fs';

// RC1505 compatibility reader: historical tests inspect the complete split release contract without re-coupling Production to Main.
export const MAIN_FLOW='.github/workflows/azure-static-web-apps-wonderful-forest-0f315e310.yml';
export const PRODUCTION_FLOW='.github/workflows/exporthub-production-release.yml';
export const BUILD_CONTRACT='.github/rc1505/verify-build-contract.mjs';
export const LIVE_CONTRACT='.github/rc1505/verify-production-live.mjs';

export const readMainFlow=()=>fs.readFileSync(MAIN_FLOW,'utf8');
export const readProductionFlow=()=>fs.readFileSync(PRODUCTION_FLOW,'utf8');
export const readBuildContract=()=>fs.readFileSync(BUILD_CONTRACT,'utf8');
export const readLiveContract=()=>fs.readFileSync(LIVE_CONTRACT,'utf8');

export function readReleaseContract(){
  return [
    readMainFlow(),
    readProductionFlow(),
    readBuildContract(),
    readLiveContract()
  ].join('\n\n# --- RC1505 split release contract ---\n\n');
}
