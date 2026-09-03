from __future__ import annotations

from pathlib import Path
import re

PATH = Path('rc990-preview-dist/api/exporthub-state/index.js')

text = PATH.read_text(encoding='utf-8')

pattern = re.compile(
    r"function requestedEnvironment\(req,payload\)\{.*?\n\}\nfunction teamBlobForEnvironment",
    re.S,
)
match = pattern.search(text)
if not match:
    raise SystemExit('Preview state guard: requestedEnvironment() not found')

replacement = """function requestedEnvironment(req,payload){
 // RC990 preview build is physically isolated. Every state request is forced
 // into the preview namespace, independent of Azure's normalized host name.
 return 'testservice';
}
function teamBlobForEnvironment"""
text = text[:match.start()] + replacement + text[match.end():]

required = [
    "const TEST_TEAM_BLOB = 'rc990-preview/'",
    "const AUTH_BLOB = 'rc990-preview/auth-sessions.json'",
    "const TEST_DIAGNOSTICS_BLOB = 'rc990-preview/diagnostics/team-diagnostics.json'",
    "function requestedEnvironment(req,payload){",
    "return 'testservice';",
]
for marker in required:
    if marker not in text:
        raise SystemExit(f'Preview state guard missing safety marker: {marker}')

# The preview build must not retain the production-origin fallback resolver.
for forbidden in [
    "return'production'",
    "return 'production'",
    "originProd=",
    "ENVIRONMENT_MISMATCH",
]:
    resolver = text[text.find('function requestedEnvironment'):text.find('function teamBlobForEnvironment')]
    if forbidden in resolver:
        raise SystemExit(f'Preview state guard retained unsafe resolver path: {forbidden}')

PATH.write_text(text, encoding='utf-8')
print('RC990 preview state guard active: every state request -> isolated preview namespace.')
