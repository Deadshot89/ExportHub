from __future__ import annotations

from pathlib import Path
import re

PATH = Path("TESTVERSION.html")
html = PATH.read_text(encoding="utf-8")

TERMS = [
    "RC950",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "document.activeElement",
    "selectionStart",
    "selectionEnd",
    "setSelectionRange",
    "scrollX",
    "scrollY",
    "scrollTo",
    "scrollTop",
    "history.pushState",
    "history.replaceState",
    "popstate",
    "history.back",
    "data-exporthub-view",
    "setView",
    "showView",
    "navigate",
    "loading",
    "working",
    "setBusy",
    "RC946",
    "pointermove",
    "pointerup",
    "renderAll",
    "renderDashboard",
    "BroadcastChannel",
    "azure",
    "team state",
    "teamState",
]


def contexts(term: str, max_hits: int = 8, radius: int = 900) -> None:
    matches = list(re.finditer(re.escape(term), html, flags=re.IGNORECASE))
    print(f"\n===== {term} :: {len(matches)} hit(s) =====")
    for i, match in enumerate(matches[:max_hits], start=1):
        lo = max(0, match.start() - radius)
        hi = min(len(html), match.end() + radius)
        snippet = html[lo:hi]
        print(f"\n--- hit {i} @ {match.start()} ---")
        print(snippet.replace("\r", ""))


print(f"TESTVERSION bytes={len(html.encode('utf-8')):,} chars={len(html):,}")
for term in TERMS:
    contexts(term)

print("\n===== FUNCTION CANDIDATES =====")
patterns = [
    r"function\s+([A-Za-z_$][\w$]*(?:render|Render|view|View|nav|Nav|focus|Focus|scroll|Scroll|batch|Batch|frame|Frame|busy|Busy|loading|Loading)[\w$]*)\s*\(",
    r"(?:const|let|var)\s+([A-Za-z_$][\w$]*(?:render|Render|view|View|nav|Nav|focus|Focus|scroll|Scroll|batch|Batch|frame|Frame|busy|Busy|loading|Loading)[\w$]*)\s*=",
]
seen = set()
for pattern in patterns:
    for match in re.finditer(pattern, html):
        name = match.group(1)
        if name in seen:
            continue
        seen.add(name)
        print(f"{match.start():>9}  {name}")

print("\n===== HISTORY / VIEW ASSIGNMENTS =====")
for pattern in [
    r"currentView\s*=",
    r"dataset\.exporthubView\s*=",
    r"setAttribute\([^\n]{0,100}data-exporthub-view",
    r"pushState\s*\(",
    r"replaceState\s*\(",
    r"addEventListener\s*\(\s*['\"]popstate['\"]",
]:
    hits = list(re.finditer(pattern, html, re.IGNORECASE))
    print(f"{pattern}: {len(hits)}")
    for match in hits[:12]:
        lo=max(0, match.start()-500); hi=min(len(html), match.end()+900)
        print(f"--- @{match.start()} ---")
        print(html[lo:hi].replace("\r", ""))

print("\n===== SCRIPT COUNT =====")
print(len(re.findall(r"<script\b[^>]*>[\s\S]*?</script>", html, re.IGNORECASE)))
