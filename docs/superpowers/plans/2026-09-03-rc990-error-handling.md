# RC990 Error Handling & Local-State Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render-, Netzwerk- und Release-Center-Fehler sichtbar abschließen, ohne lokale Eingaben zu verlieren oder die Oberfläche auf einen unbestimmten Anfangszustand zurückzusetzen.

**Architecture:** RC990 verwendet ausschließlich das vorhandene Loading-/Operation-Status-System und die bestehenden lokalen Draft-/Snapshot-Mechanismen. Fehlerpfade werden an aktiven Promise/catch-/Rendergrenzen ergänzt; es entsteht kein zweites Meldungs- oder Persistenzsystem.

**Tech Stack:** Vanilla JavaScript, Promise/catch, bestehendes ExportHUB Loading-/Operation-Status-System, Node.js >=20, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-03-rc990-large-ux-design.md`

## Global Constraints
- Jede Benutzereingabe bleibt lokal erhalten, wenn ein Render- oder Netzfehler auftritt.
- Ein fehlgeschlagener Release-Center- oder Speicherabgleich darf die Oberfläche nicht auf einen unbestimmten Anfangszustand zurücksetzen.
- Aktionen müssen entweder erfolgreich abschließen oder eine sichtbare konkrete Fehlermeldung liefern.
- UI-Optimierungen dürfen keine Fehler verschlucken, die bisher korrekt angezeigt wurden.
- Längere Aktionen verwenden das bestehende Arbeitsstatus-/Loading-System; kein zweites paralleles Statussystem.

---

### Task 1: RED-Vertrag für sichtbare Fehler und lokalen Eingabeschutz

**Files:**
- Create: `test/rc990-error-handling.test.mjs`
- Modify later: `TESTVERSION.html`

**Interfaces:**
- Produces static contract for `rc990FailOperation`, local-state restore calls and no silent empty catches in RC990 blocks.

- [ ] **Step 1: Failing tests schreiben**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync('TESTVERSION.html','utf8');

test('RC990: sichtbarer Fehlerabschluss verwendet bestehendes Statussystem',()=>{
  assert.match(html,/function\s+rc990FailOperation\s*\(/);
  const fn=html.match(/function\s+rc990FailOperation[\s\S]{0,1800}?\n}/)?.[0]||'';
  assert.match(fn,/operationFail|ExportHUBOperationStatus|loadingBarFail/);
});

test('RC990: Fehlerpfade besitzen lokalen UI-State-Restore',()=>{
  assert.match(html,/rc990RestoreUiState/);
  assert.match(html,/catch[\s\S]{0,1200}rc990(?:RestoreUiState|RestoreReleaseViewport)/);
});
```

- [ ] **Step 2: RED ausführen**

Run: `node --test test/rc990-error-handling.test.mjs`

Expected: FAIL until RC990 error bridge exists.

- [ ] **Step 3: Commit**

```bash
git add test/rc990-error-handling.test.mjs
git commit -m "RC990 RED: sichtbare Fehler und lokalen Zustand absichern"
```

### Task 2: Einheitlichen RC990-Fehlerabschluss an bestehendes Statussystem anbinden

**Files:**
- Modify: `TESTVERSION.html`
- Test: `test/rc990-error-handling.test.mjs`

**Interfaces:**
- Produces: `rc990FailOperation(token, message, snapshot, root)` → false after visible error and UI-state restore.

- [ ] **Step 1: Minimal implementation contract**

Implement in the active runtime block:

```js
function rc990FailOperation(token,message,snapshot,root){
  var text=String(message||'Vorgang nicht abgeschlossen');
  try{
    if(typeof operationFail==='function')operationFail(token,text);
    else if(window.ExportHUBOperationStatus&&typeof window.ExportHUBOperationStatus.fail==='function')window.ExportHUBOperationStatus.fail(token,text);
    else if(typeof loadingBarFail==='function')loadingBarFail(token,text);
  }catch(_){}
  if(snapshot){
    requestAnimationFrame(function(){
      try{rc990RestoreUiState(snapshot,root);}catch(_){}
    });
  }
  return false;
}
```

This helper may tolerate failure while reporting, but application action handlers must not swallow their original error silently.

- [ ] **Step 2: Test ausführen**

Run: `node --test test/rc990-error-handling.test.mjs`

Expected: PASS for helper contract.

- [ ] **Step 3: Commit**

```bash
git add TESTVERSION.html test/rc990-error-handling.test.mjs
git commit -m "RC990: Fehlerabschluss an bestehendes Statussystem anbinden"
```

### Task 3: Release-/Render-/Netzfehler an aktiven Grenzen absichern

**Files:**
- Modify: `TESTVERSION.html`
- Tests: `test/rc990-error-handling.test.mjs`, `test/rc990-release-center.test.mjs`, `test/rc990-render-navigation.test.mjs`

**Interfaces:**
- Consumes: `rc990CaptureUiState`, `rc990RestoreUiState`, `rc990CaptureReleaseViewport`, `rc990RestoreReleaseViewport`, `rc990FailOperation`.
- Produces no new persistence API.

- [ ] **Step 1: Release-Center confirmation failure path**

Capture UI/release snapshot before the existing async mutation. In its failure branch, call `rc990FailOperation(...)`, restore the snapshot and keep the still-open change visible. Do not reset the Release Center to top.

- [ ] **Step 2: Render/partial-update failure path**

When an RC990-scheduled render callback throws/rejects, clear the single frame handle, report through `rc990FailOperation`, restore local UI state and leave the previous DOM intact where possible. Do not replace the entire root with a generic empty state when valid prior content exists.

- [ ] **Step 3: Netzwerk-/Teamstandfehler**

At existing catch/rejection points touched by RC990, preserve the current local draft/visible values and show the server/network message. Do not call a remote-to-local merge after a failed write merely to “refresh” the screen.

- [ ] **Step 4: Static no-silent-error assertion ergänzen**

Add a test that extracts RC990 action blocks and rejects patterns equivalent to `catch(_){}` when the catch belongs to the primary operation rather than best-effort cleanup/reporting.

- [ ] **Step 5: Tests ausführen**

Run:

```bash
node --test \
  test/rc990-error-handling.test.mjs \
  test/rc990-release-center.test.mjs \
  test/rc990-render-navigation.test.mjs \
  test/rc975-global-render-integrity.test.mjs \
  test/rc976-render-fallback-recovery.test.mjs
```

Expected: PASS, 0 failures.

- [ ] **Step 6: Commit**

```bash
git add TESTVERSION.html test/rc990-error-handling.test.mjs
git commit -m "RC990: Render Netzwerk und Releasefehler sichtbar absichern"
```
