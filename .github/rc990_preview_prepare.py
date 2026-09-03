from __future__ import annotations

from pathlib import Path
import json
import re
import shutil

ROOT = Path('.')
DIST = Path('rc990-preview-dist')
PREVIEW_PREFIX = 'rc990-preview'


def copy_file(src: str, dst: str | None = None) -> None:
    source = ROOT / src
    if not source.is_file():
        raise SystemExit(f'Missing required preview file: {src}')
    target = DIST / (dst or src)
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)


def copy_dir(src: str, dst: str | None = None) -> None:
    source = ROOT / src
    if not source.is_dir():
        raise SystemExit(f'Missing required preview directory: {src}')
    target = DIST / (dst or src)
    shutil.copytree(source, target, dirs_exist_ok=True)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


def patch_auth_store(path: Path) -> None:
    text = path.read_text(encoding='utf-8')
    old_constants = """const TEAM_BLOB = process.env.EXPORTHUB_STORAGE_BLOB || process.env.EXPORTHUB_STATE_BLOB || 'team-state.json';\nconst AUTH_BLOB = process.env.EXPORTHUB_AUTH_BLOB || 'auth-sessions.json';"""
    new_constants = """const PRODUCTION_TEAM_BLOB = process.env.EXPORTHUB_STORAGE_BLOB || process.env.EXPORTHUB_STATE_BLOB || 'team-state.json';\nconst TEAM_BLOB = 'rc990-preview/' + String(PRODUCTION_TEAM_BLOB || 'team-state.json').replace(/^\\/+/, '');\nconst AUTH_BLOB = 'rc990-preview/auth-sessions.json';"""
    text = replace_once(text, old_constants, new_constants, 'auth-store preview constants')

    old_clients = """  const container = service.getContainerClient(TEAM_CONTAINER);\n  await container.createIfNotExists();\n  return {\n    team: container.getBlockBlobClient(TEAM_BLOB),\n    auth: container.getBlockBlobClient(AUTH_BLOB)\n  };"""
    new_clients = """  const container = service.getContainerClient(TEAM_CONTAINER);\n  await container.createIfNotExists();\n  const team = container.getBlockBlobClient(TEAM_BLOB);\n  const auth = container.getBlockBlobClient(AUTH_BLOB);\n  const productionTeam = container.getBlockBlobClient(PRODUCTION_TEAM_BLOB);\n\n  // RC990 browser preview: seed its own isolated team state exactly once.\n  try {\n    await team.getProperties();\n  } catch (e) {\n    const status = Number(e && (e.statusCode || e.status) || 0);\n    if (status !== 404) throw e;\n    const source = await readJson(productionTeam, emptyTeam());\n    const seed = clone(source.value || emptyTeam());\n    seed.revision = 1;\n    seed.updatedAt = now();\n    seed.updatedBy = 'RC990 Preview Initialisierung';\n    seed.clientVersion = 'RC990-preview-seed';\n    seed.dataEnvironment = 'rc990-preview';\n    seed.state = seed.state && typeof seed.state === 'object' ? seed.state : {};\n    seed.state._exporthubEnvironment = {\n      name: 'rc990-preview',\n      isolated: true,\n      seededAt: seed.updatedAt,\n      sourceBlob: PRODUCTION_TEAM_BLOB\n    };\n    try {\n      await writeJson(team, seed, null);\n    } catch (writeError) {\n      const writeStatus = Number(writeError && (writeError.statusCode || writeError.status) || 0);\n      if (writeStatus !== 409 && writeStatus !== 412) throw writeError;\n    }\n  }\n\n  return { team, auth };"""
    text = replace_once(text, old_clients, new_clients, 'auth-store preview seeding')
    path.write_text(text, encoding='utf-8')


def patch_state_api(path: Path) -> None:
    text = path.read_text(encoding='utf-8')
    text = replace_once(
        text,
        "const TEST_TEAM_BLOB = process.env.EXPORTHUB_TEST_STORAGE_BLOB || ('testservice/'+String(TEAM_BLOB_BASE||'team-state.json').replace(/^\\/+/, ''));",
        "const TEST_TEAM_BLOB = 'rc990-preview/' + String(TEAM_BLOB_BASE || 'team-state.json').replace(/^\\/+/, '');",
        'state preview team blob',
    )
    text = replace_once(
        text,
        "const AUTH_BLOB = process.env.EXPORTHUB_AUTH_BLOB || 'auth-sessions.json';",
        "const AUTH_BLOB = 'rc990-preview/auth-sessions.json';",
        'state preview auth blob',
    )
    text = replace_once(
        text,
        "const TEST_DIAGNOSTICS_BLOB = process.env.EXPORTHUB_TEST_DIAGNOSTICS_BLOB || 'testservice/diagnostics/team-diagnostics.json';",
        "const TEST_DIAGNOSTICS_BLOB = 'rc990-preview/diagnostics/team-diagnostics.json';",
        'state preview diagnostics blob',
    )

    pattern = re.compile(
        r"function requestedEnvironment\(req,payload\)\{.*?\n\}\nfunction teamBlobForEnvironment",
        re.S,
    )
    match = pattern.search(text)
    if not match:
        raise SystemExit('state preview environment resolver: function not found')
    replacement = """function requestedEnvironment(req,payload){\n const h=req&&req.headers||{},raw=lower(h['x-exporthub-environment']||h['X-ExportHUB-Environment']||(payload&&payload.environment)||'');\n if(raw&&raw!=='production'&&raw!=='testservice')throw error('ENVIRONMENT_INVALID','Unbekannte ExportHUB-Datenumgebung.',400);\n const evidence=lower(requestEnvironmentEvidence(req)),origin=lower(h.origin||h.Origin||h.referer||h.Referer||'');\n const preview=/-rc990-preview\\./i.test(evidence);\n if(preview)return'testservice';\n const originTest=/-testservice\\./i.test(origin),originAzure=/\\.azurestaticapps\\.net(?:[:/]|$)/i.test(origin),originProd=originAzure&&!originTest;\n if(originTest){if(raw&&raw!=='testservice')throw error('ENVIRONMENT_MISMATCH','Ein Testservice-Aufruf darf keine Produktionsdaten anfordern.',409);return'testservice'}\n if(originProd){if(raw&&raw!=='production')throw error('ENVIRONMENT_MISMATCH','Die Produktionsseite darf keine Testservice-Daten anfordern.',409);return'production'}\n if(raw)return raw;\n return /-testservice\\./i.test(evidence)?'testservice':'production';\n}\nfunction teamBlobForEnvironment"""
    text = text[:match.start()] + replacement + text[match.end():]
    path.write_text(text, encoding='utf-8')


def main() -> None:
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)

    copy_file('TESTVERSION.html', 'index.html')
    copy_file('TESTVERSION.html', 'TESTVERSION.html')
    if (ROOT / 'assets').is_dir():
        copy_dir('assets', 'assets')

    copy_file('api/package.json', 'api/package.json')
    copy_file('api/host.json', 'api/host.json')
    for directory in ['api/shared', 'api/exporthub-auth', 'api/exporthub-auth-probe', 'api/exporthub-state', 'api/exporthub-health']:
        copy_dir(directory, directory)

    patch_auth_store(DIST / 'api/shared/auth-store.js')
    patch_state_api(DIST / 'api/exporthub-state/index.js')

    config = {
        '$schema': 'https://json.schemastore.org/staticwebapp.config.json',
        'routes': [
            {'route': '/', 'rewrite': '/index.html', 'allowedRoles': ['anonymous'], 'headers': {'Cache-Control': 'no-store', 'X-ExportHUB-Environment': 'preview'}},
            {'route': '/index.html', 'allowedRoles': ['anonymous'], 'headers': {'Cache-Control': 'no-store', 'X-ExportHUB-Environment': 'preview'}},
            {'route': '/TESTVERSION.html', 'allowedRoles': ['anonymous'], 'headers': {'Cache-Control': 'no-store', 'X-ExportHUB-Environment': 'preview'}},
            {'route': '/preview-environment.json', 'allowedRoles': ['anonymous'], 'headers': {'Cache-Control': 'no-store'}},
            {'route': '/api/*', 'allowedRoles': ['anonymous'], 'headers': {'Cache-Control': 'no-store'}},
            {'route': '/assets/*', 'allowedRoles': ['anonymous'], 'headers': {'Cache-Control': 'no-store'}},
        ],
        'navigationFallback': {
            'rewrite': '/index.html',
            'exclude': ['/api/*', '/assets/*', '/preview-environment.json', '/*.{css,js,json,png,jpg,jpeg,gif,svg,ico,pdf,webp,woff,woff2}'],
        },
        'platform': {'apiRuntime': 'node:20'},
        'trailingSlash': 'never',
    }
    (DIST / 'staticwebapp.config.json').write_text(json.dumps(config, indent=2) + '\n', encoding='utf-8')
    (DIST / 'preview-environment.json').write_text(json.dumps({
        'environment': PREVIEW_PREFIX,
        'isolated': True,
        'productionWritesAllowed': False,
        'testserviceWritesAllowed': False,
        'teamBlobPrefix': PREVIEW_PREFIX + '/',
        'sourceBranch': 'rc990-large-ux',
    }, indent=2) + '\n', encoding='utf-8')

    # Hard safety checks before Azure receives the payload.
    auth_text = (DIST / 'api/shared/auth-store.js').read_text(encoding='utf-8')
    state_text = (DIST / 'api/exporthub-state/index.js').read_text(encoding='utf-8')
    if "const TEAM_BLOB = 'rc990-preview/'" not in auth_text or "const AUTH_BLOB = 'rc990-preview/auth-sessions.json'" not in auth_text:
        raise SystemExit('Preview auth isolation check failed')
    if "const TEST_TEAM_BLOB = 'rc990-preview/'" not in state_text or "const AUTH_BLOB = 'rc990-preview/auth-sessions.json'" not in state_text:
        raise SystemExit('Preview state isolation check failed')
    if "preview=/-rc990-preview\\./i.test(evidence)" not in state_text:
        raise SystemExit('Preview hostname isolation check failed')
    if 'rc990-design-system' not in (DIST / 'index.html').read_text(encoding='utf-8'):
        raise SystemExit('RC990 design layer missing from preview index')

    print('RC990 preview payload prepared safely.')
    print('Frontend: TESTVERSION.html -> isolated preview index')
    print('APIs: auth/auth-probe/state/health only')
    print('Storage: rc990-preview/* only for team/session/diagnostics writes')


if __name__ == '__main__':
    main()
