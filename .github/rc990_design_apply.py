from __future__ import annotations

from pathlib import Path
import re

PATH = Path("TESTVERSION.html")
STYLE_ID = "rc990-design-system"
LEGACY_STYLE_ID = "exporthub-rc364-mobile-overflow-fix"
SCRIPT_RE = re.compile(r"<script\b[^>]*>([\s\S]*?)</script>", re.IGNORECASE)

RC990_STYLE = r'''<style id="rc990-design-system">
/*
 * RC990 canonical screen design system.
 * Scope: Dashboard, Aufgaben/Planer, Lager, Benachrichtigungen and Warncenter.
 * Document/print/CMR and Colli geometry remain outside this screen layer.
 */
@media screen {
  :root {
    --rc990-card-gap: 12px;
    --rc990-card-pad: 14px;
    --rc990-action-h: 40px;
    --rc990-radius: 14px;
    --rc990-title-size: 18px;
    --rc990-muted-size: 12px;
    --rc990-focus: #2563eb;
    --rc990-action-gap: 8px;
    --rc990-info: #2563eb;
    --rc990-warning: #d97706;
    --rc990-card-border: #c8ddf0;
    --rc990-card-shadow: 0 8px 24px rgba(15, 23, 42, .08);
    --rc990-task-accent: #f97316;
    --rc990-surface: #ffffff;
    --rc990-surface-soft: #f7fbff;
  }

  /* Cards follow their content instead of stretching into artificial holes. */
  #content > :is(section, .card, article, .rc524-page, .rc504-warehouse, #index218Planner):not(#loadListDoc):not(.rc390-paper),
  body[data-exporthub-view="dashboard"] #content :is(.rc205-widget, .rc504-dashboard-item, #rc885Workspace .rc885-panel),
  body[data-exporthub-view="warehouse"] #content :is(.rc504-warehouse, .rc504-warehouse-kpi, .rc504-dashboard-item),
  body[data-exporthub-view="tasks"] #content :is(.card, .task, .rc205-planner-task, .rc229-task-card.rc628-unified-task),
  body[data-exporthub-view="planning"] #content :is(#index218Planner, .rc205-planner-task),
  #index236NotificationCenter :is(.card, .metric, .index236-item),
  #rc885WarningDrawer :is(.rc885-drawer, .rc885-panel, .rc889-overview) {
    align-self: start !important;
    height: auto !important;
    min-height: 0 !important;
    box-sizing: border-box !important;
  }

  /* One compact density for Dashboard, Lager, Task/Aufgabe and Planner surfaces. */
  body[data-exporthub-view="dashboard"] #content :is(.rc205-dashboard-grid, .grid2, .grid3, .grid4, .metrics, .quick-grid),
  body[data-exporthub-view="warehouse"] #content :is(.rc504-warehouse-summary, .rc504-dashboard-list, .grid2, .grid3, .grid4),
  body[data-exporthub-view="tasks"] #content :is(.grid2, .grid3, .grid4, .task-groups, .rc628-task-groups, .rc229-task-grid),
  body[data-exporthub-view="planning"] #content :is(.grid2, .grid3, .grid4, .rc205-dashboard-grid),
  #index236NotificationCenter :is(.index236-statusbar, .index236-metrics, .index236-columns, .grid2, .grid3),
  #rc885WarningDrawer :is(.rc885-grid, .rc889-grid) {
    gap: var(--rc990-card-gap) !important;
    align-items: start !important;
  }

  body[data-exporthub-view="dashboard"] #content :is(.rc205-widget, .rc504-dashboard-item, #rc885Workspace .rc885-panel),
  body[data-exporthub-view="warehouse"] #content :is(.rc504-warehouse-kpi, .rc504-dashboard-item),
  body[data-exporthub-view="tasks"] #content :is(.task, .rc205-planner-task, .rc229-task-card.rc628-unified-task),
  body[data-exporthub-view="planning"] #content .rc205-planner-task,
  #index236NotificationCenter :is(.index236-item, .metric, .card, .index236-statusbar > div),
  #rc885WarningDrawer :is(.rc885-panel, .rc889-overview) {
    padding: var(--rc990-card-pad) !important;
    border-radius: var(--rc990-radius) !important;
    box-sizing: border-box !important;
  }

  /* Stronger screen-card identity makes RC990 visible without touching documents. */
  body[data-exporthub-view="dashboard"] #content :is(.rc205-widget, .rc504-dashboard-item, #rc885Workspace .rc885-panel),
  body[data-exporthub-view="warehouse"] #content :is(.rc504-warehouse-kpi, .rc504-dashboard-item) {
    background: var(--rc990-surface) !important;
    border: 1px solid var(--rc990-card-border) !important;
    box-shadow: var(--rc990-card-shadow) !important;
    border-radius: var(--rc990-radius) !important;
  }

  /* RC990 task tile grid: current RC628 task lists and planner lists are compact responsive grids. */
  #content .rc229-task-grid {
    display: grid !important;
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    gap: var(--rc990-card-gap) !important;
    align-items: start !important;
  }
  body[data-exporthub-view="tasks"] #content .rc229-task-grid {
    display: grid !important;
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    gap: var(--rc990-card-gap) !important;
    align-items: start !important;
  }
  body[data-exporthub-view="tasks"] #content :is(.task-groups, .rc628-task-groups):has(> :is(.task, .rc205-planner-task)),
  body[data-exporthub-view="tasks"] #content :is(.task-groups, .rc628-task-groups) :has(> :is(.task, .rc205-planner-task)),
  body[data-exporthub-view="planning"] #content #index218Planner :has(> .rc205-planner-task) {
    display: grid !important;
    grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
    gap: var(--rc990-card-gap) !important;
    align-items: start !important;
  }

  body[data-exporthub-view="tasks"] #content :is(.task-groups, .rc628-task-groups):has(> :is(.task, .rc205-planner-task)) > :not(.task):not(.rc205-planner-task),
  body[data-exporthub-view="tasks"] #content :is(.task-groups, .rc628-task-groups) :has(> :is(.task, .rc205-planner-task)) > :not(.task):not(.rc205-planner-task),
  body[data-exporthub-view="planning"] #content #index218Planner :has(> .rc205-planner-task) > :not(.rc205-planner-task) {
    grid-column: 1 / -1;
  }

  /* Current tasks section shells: visible RC990 hierarchy without changing task logic. */
  #content .rc229-day-section {
    background: linear-gradient(180deg, #f8fbff 0%, #f3f8fd 100%) !important;
    border: 1px solid var(--rc990-card-border) !important;
    border-radius: calc(var(--rc990-radius) + 2px) !important;
    box-shadow: 0 5px 18px rgba(15, 23, 42, .05) !important;
    padding: 12px !important;
  }
  #content .rc229-task-group {
    background: rgba(255,255,255,.72) !important;
    border: 1px solid #d7e7f4 !important;
    border-radius: var(--rc990-radius) !important;
    overflow: hidden !important;
  }
  #content .rc229-task-group > :first-child {
    background: #eef7fd !important;
  }

  /* RC990 task card identity: compact, clearly bounded and fast to scan. */
  body[data-exporthub-view="tasks"] #content :is(.task, .rc205-planner-task, .rc229-task-card.rc628-unified-task),
  body[data-exporthub-view="planning"] #content .rc205-planner-task {
    position: relative;
    width: auto !important;
    min-width: 0 !important;
    max-width: none !important;
    margin: 0 !important;
    background: linear-gradient(180deg, var(--rc990-surface) 0%, var(--rc990-surface-soft) 100%) !important;
    border: 1px solid var(--rc990-card-border) !important;
    border-left: 5px solid var(--rc990-task-accent) !important;
    box-shadow: var(--rc990-card-shadow) !important;
    padding: 12px 14px !important;
    border-radius: var(--rc990-radius) !important;
    box-sizing: border-box !important;
    overflow: hidden;
  }

  #content .rc229-task-card.rc628-unified-task {
    position: relative;
    width: auto !important;
    min-width: 0 !important;
    max-width: none !important;
    margin: 0 !important;
    background: linear-gradient(180deg, var(--rc990-surface) 0%, var(--rc990-surface-soft) 100%) !important;
    border: 1px solid var(--rc990-card-border) !important;
    border-left: 5px solid var(--rc990-task-accent) !important;
    box-shadow: var(--rc990-card-shadow) !important;
    padding: 12px 14px !important;
    border-radius: var(--rc990-radius) !important;
    box-sizing: border-box !important;
    overflow: hidden;
  }

  /* RC628 cards previously reserved too much vertical space; RC990 keeps all information but removes empty padding. */
  #content .rc229-task-card.rc628-unified-task :is(.rc628-task-ref, .rc628-task-customer),
  body[data-exporthub-view="tasks"] #content .rc229-task-card.rc628-unified-task :is(.rc628-task-ref, .rc628-task-customer) {
    min-height: 0 !important;
    padding: 8px 10px !important;
    border-radius: 10px !important;
    line-height: 1.25 !important;
  }
  #content .rc229-task-card.rc628-unified-task .rc628-task-customer,
  body[data-exporthub-view="tasks"] #content .rc229-task-card.rc628-unified-task .rc628-task-customer {
    font-size: 15px !important;
  }
  #content .rc229-task-card.rc628-unified-task .rc628-task-status,
  body[data-exporthub-view="tasks"] #content .rc229-task-card.rc628-unified-task .rc628-task-status {
    min-height: 0 !important;
    gap: 5px !important;
  }
  #content .rc229-task-card.rc628-unified-task .rc628-task-status :is(.pill, span),
  body[data-exporthub-view="tasks"] #content .rc229-task-card.rc628-unified-task .rc628-task-status :is(.pill, span) {
    padding: 3px 8px !important;
    font-size: 10px !important;
  }

  body[data-exporthub-view="tasks"] #content :is(.task, .rc205-planner-task) :is(.i218-task-name, .rc896-task-name),
  body[data-exporthub-view="planning"] #content .rc205-planner-task :is(.i218-task-name, .rc896-task-name) {
    line-height: 1.3;
    margin-bottom: 6px;
  }

  body[data-exporthub-view="tasks"] #content :is(.task, .rc205-planner-task) :is(.rc896-task-meta, .i218-task-links),
  body[data-exporthub-view="planning"] #content .rc205-planner-task :is(.rc896-task-meta, .i218-task-links) {
    gap: 6px !important;
    flex-wrap: wrap !important;
  }

  :is(
    body[data-exporthub-view="dashboard"] #content,
    body[data-exporthub-view="warehouse"] #content,
    body[data-exporthub-view="tasks"] #content,
    body[data-exporthub-view="planning"] #content,
    #index236NotificationCenter,
    #rc885WarningDrawer
  ) :is(h2, h3, .title, .page-title, .rc885-drawer-title) {
    font-size: var(--rc990-title-size);
  }

  :is(
    body[data-exporthub-view="dashboard"] #content,
    body[data-exporthub-view="warehouse"] #content,
    body[data-exporthub-view="tasks"] #content,
    body[data-exporthub-view="planning"] #content,
    #index236NotificationCenter,
    #rc885WarningDrawer
  ) :is(.muted, .sub, .rc885-sub) {
    font-size: var(--rc990-muted-size);
  }

  /* Primary / secondary / danger keep existing theme colors but share reliable geometry. */
  :is(
    body[data-exporthub-view="dashboard"] #content,
    body[data-exporthub-view="warehouse"] #content,
    body[data-exporthub-view="tasks"] #content,
    body[data-exporthub-view="planning"] #content,
    #index236NotificationCenter,
    #rc885WarningDrawer
  ) :is(button, .btn, [role="button"], [data-action-role="primary"], [data-action-role="secondary"], [data-action-role="danger"]):not(#rc363BlockColli *) {
    min-height: var(--rc990-action-h);
    border-radius: calc(var(--rc990-radius) - 4px);
    box-sizing: border-box;
  }

  :is(
    body[data-exporthub-view="dashboard"] #content,
    body[data-exporthub-view="warehouse"] #content,
    body[data-exporthub-view="tasks"] #content,
    body[data-exporthub-view="planning"] #content,
    #index236NotificationCenter,
    #rc885WarningDrawer
  ) :is(.ghost, .soft, [data-action-role="secondary"], .danger, [data-action-role="danger"]) {
    min-height: var(--rc990-action-h);
  }

  :is(
    body[data-exporthub-view="dashboard"] #content,
    body[data-exporthub-view="warehouse"] #content,
    body[data-exporthub-view="tasks"] #content,
    body[data-exporthub-view="planning"] #content,
    #index236NotificationCenter,
    #rc885WarningDrawer
  ) :is(.actions, .rc504-warehouse-actions, .i218-task-actions, .rc896-task-planning, .page-head) {
    gap: var(--rc990-action-gap) !important;
    flex-wrap: wrap !important;
  }

  /* Visible keyboard focus, scoped away from the specialized Colli controls. */
  :is(
    body[data-exporthub-view="dashboard"] #content,
    body[data-exporthub-view="warehouse"] #content,
    body[data-exporthub-view="tasks"] #content,
    body[data-exporthub-view="planning"] #content,
    #index236NotificationCenter,
    #rc885WarningDrawer
  ) :is(button, a[href], [role="button"], input, select, textarea):not(#rc363BlockColli *):focus-visible {
    outline: 2px solid var(--rc990-focus) !important;
    outline-offset: 2px !important;
  }

  /* RC946 pointer behavior remains authoritative: no new drag/card animation. */
  body[data-exporthub-view="dashboard"] #content :is(.rc205-widget, .rc504-dashboard-item, [draggable="true"]),
  body[data-exporthub-view="warehouse"] #content :is(.rc504-dashboard-item, .rc504-warehouse [draggable="true"]),
  body[data-exporthub-view="tasks"] #content :is(.task, .rc205-planner-task, .rc229-task-card.rc628-unified-task, [draggable="true"]),
  body[data-exporthub-view="planning"] #content :is(.rc205-planner-task, .i218-task-actions, .rc896-task-planning, [draggable="true"]) {
    transition: none !important;
  }

  /* Benachrichtigungen / notification center = informational blue. */
  #index236NotificationCenter {
    --rc990-center-accent: var(--rc990-info);
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    box-sizing: border-box !important;
  }
  #index236NotificationCenter :is(.index236-kicker, .index236-title, [data-semantic="info"]) {
    color: #2563eb !important;
  }
  body[data-exporthub-view="notifications"] :is(.main, #content, #index236NotificationCenter),
  body[data-exporthub-view="notifications"] #content > * {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    box-sizing: border-box !important;
  }

  /* Warncenter = amber and therefore visibly different from information events. */
  #rc885WarningDrawer { --rc990-center-accent: var(--rc990-warning); }
  #rc885WarningDrawer :is(.rc885-drawer-title, .rc889-title, [data-semantic="warning"]),
  #rc885WarningButton { color: #d97706 !important; }

  @media (max-width: 1000px) {
    /* RC990 task tile grid: two columns on medium screens. */
    #content .rc229-task-grid,
    body[data-exporthub-view="tasks"] #content .rc229-task-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }
    body[data-exporthub-view="tasks"] #content :is(.task-groups, .rc628-task-groups):has(> :is(.task, .rc205-planner-task)),
    body[data-exporthub-view="tasks"] #content :is(.task-groups, .rc628-task-groups) :has(> :is(.task, .rc205-planner-task)),
    body[data-exporthub-view="planning"] #content #index218Planner :has(> .rc205-planner-task) {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }
  }

  @media (max-width: 900px) {
    #index236NotificationCenter :is(.index236-statusbar, .index236-metrics, .index236-columns),
    body[data-exporthub-view="warehouse"] #content :is(.rc504-warehouse-summary, .rc504-dashboard-list) {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }
    :is(
      body[data-exporthub-view="dashboard"] #content,
      body[data-exporthub-view="warehouse"] #content,
      body[data-exporthub-view="tasks"] #content,
      body[data-exporthub-view="planning"] #content,
      #index236NotificationCenter
    ) :is(.actions, .rc504-warehouse-actions, .i218-task-actions, .rc896-task-planning, .page-head) {
      flex-wrap: wrap !important;
    }
  }

  @media (max-width: 700px) {
    /* RC990 task tile grid: one column on phones. */
    #content .rc229-task-grid,
    body[data-exporthub-view="tasks"] #content .rc229-task-grid {
      grid-template-columns: minmax(0, 1fr) !important;
    }
    body[data-exporthub-view="tasks"] #content :is(.task-groups, .rc628-task-groups):has(> :is(.task, .rc205-planner-task)),
    body[data-exporthub-view="tasks"] #content :is(.task-groups, .rc628-task-groups) :has(> :is(.task, .rc205-planner-task)),
    body[data-exporthub-view="planning"] #content #index218Planner :has(> .rc205-planner-task) {
      grid-template-columns: minmax(0, 1fr) !important;
    }

    #index236NotificationCenter :is(.index236-statusbar, .index236-metrics, .index236-columns, .grid2, .grid3),
    body[data-exporthub-view="warehouse"] #content :is(.rc504-warehouse-summary, .rc504-dashboard-list) {
      grid-template-columns: minmax(0, 1fr) !important;
    }
    :is(
      body[data-exporthub-view="dashboard"] #content,
      body[data-exporthub-view="warehouse"] #content,
      body[data-exporthub-view="tasks"] #content,
      body[data-exporthub-view="planning"] #content,
      #index236NotificationCenter,
      #rc885WarningDrawer
    ) :is(.actions, .rc504-warehouse-actions, .i218-task-actions, .rc896-task-planning) > :is(button, .btn, [role="button"]) {
      flex: 1 1 12rem;
      max-width: 100%;
    }
  }

  @media (max-width: 420px) {
    :root {
      --rc990-card-gap: 10px;
      --rc990-card-pad: 12px;
    }
    :is(
      body[data-exporthub-view="dashboard"] #content,
      body[data-exporthub-view="warehouse"] #content,
      body[data-exporthub-view="tasks"] #content,
      body[data-exporthub-view="planning"] #content,
      #index236NotificationCenter,
      #rc885WarningDrawer
    ) :is(.actions, .rc504-warehouse-actions, .i218-task-actions, .rc896-task-planning) > :is(button, .btn, [role="button"]) {
      flex-basis: 100%;
    }
  }
}

/* RC990 is screen-only; documents keep their existing print rules. */
@media print {
  :root { --rc990-screen-only: 0; }
}
</style>'''


def style_pattern(style_id: str) -> re.Pattern[str]:
    return re.compile(
        rf'<style\s+id=["\']{re.escape(style_id)}["\'][^>]*>.*?</style>',
        re.IGNORECASE | re.DOTALL,
    )


def script_blocks(html: str) -> list[str]:
    return [m.group(1) for m in SCRIPT_RE.finditer(html)]


def main() -> None:
    original = PATH.read_text(encoding="utf-8")
    before_scripts = script_blocks(original)
    html = original

    rc990_matches = list(style_pattern(STYLE_ID).finditer(html))
    legacy_matches = list(style_pattern(LEGACY_STYLE_ID).finditer(html))
    if len(rc990_matches) > 1:
        raise SystemExit(f"Expected at most one {STYLE_ID}, found {len(rc990_matches)}")
    if len(legacy_matches) > 1:
        raise SystemExit(f"Expected at most one {LEGACY_STYLE_ID}, found {len(legacy_matches)}")

    if rc990_matches:
        html = style_pattern(STYLE_ID).sub(RC990_STYLE, html, count=1)
        html = style_pattern(LEGACY_STYLE_ID).sub("", html)
        mode = "updated existing RC990 style"
    elif legacy_matches:
        html = style_pattern(LEGACY_STYLE_ID).sub(RC990_STYLE, html, count=1)
        mode = "replaced standalone legacy style in-place"
    else:
        raise SystemExit(
            "No safe RC990 insertion anchor found. Refusing to guess an HTML closing tag position."
        )

    if len(style_pattern(STYLE_ID).findall(html)) != 1:
        raise SystemExit("RC990 design style must exist exactly once after apply")
    if style_pattern(LEGACY_STYLE_ID).search(html):
        raise SystemExit("Legacy RC364 viewport-width style is still active")

    after_scripts = script_blocks(html)
    if len(after_scripts) != len(before_scripts):
        raise SystemExit(
            f"RC990 apply changed script count: {len(before_scripts)} -> {len(after_scripts)}"
        )
    changed_scripts = [
        index + 1
        for index, (before, after) in enumerate(zip(before_scripts, after_scripts))
        if before != after
    ]
    if changed_scripts:
        raise SystemExit(f"RC990 apply modified script block(s): {changed_scripts}")

    PATH.write_text(html, encoding="utf-8")
    print(
        "RC990 design applied safely: "
        f"{mode}; scripts preserved byte-identically={len(before_scripts)}"
    )


if __name__ == "__main__":
    main()
