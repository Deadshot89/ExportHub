from __future__ import annotations

from hashlib import sha256
from pathlib import Path
import re
import subprocess

PATH = Path("TESTVERSION.html")
SCRIPT_RE = re.compile(r"<script\b[^>]*>([\s\S]*?)</script>", re.IGNORECASE)


def scripts(html: str) -> list[str]:
    return [m.group(1) for m in SCRIPT_RE.finditer(html)]


def digest(text: str) -> str:
    return sha256(text.encode("utf-8")).hexdigest()


before_html = PATH.read_text(encoding="utf-8")
before_scripts = scripts(before_html)
print(f"before: html={digest(before_html)} scripts={len(before_scripts)}")
print("before script digests:", [digest(s) for s in before_scripts])

subprocess.run(["python", ".github/rc990_design_apply.py"], check=True)

after_html = PATH.read_text(encoding="utf-8")
after_scripts = scripts(after_html)
print(f"after:  html={digest(after_html)} scripts={len(after_scripts)}")
print("after script digests: ", [digest(s) for s in after_scripts])

if len(before_scripts) != len(after_scripts):
    raise SystemExit(f"Script count changed: {len(before_scripts)} -> {len(after_scripts)}")

changed = [i + 1 for i, (a, b) in enumerate(zip(before_scripts, after_scripts)) if a != b]
if changed:
    raise SystemExit(f"RC990 design apply changed script block(s): {changed}")

print("PASS: RC990 design apply leaves every <script> block byte-identical.")
