from pathlib import Path
import re

PATH = Path("TESTVERSION.html")
STYLE_ID = "rc990-design-system"
LEGACY_STYLE_ID = "exporthub-rc364-mobile-overflow-fix"

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
  }

  /* Cards follow their content instead of stretching into artificial holes. */
  #content > :is(section, .card, article, .rc524-page, .rc504-warehouse, #index218Planner):not(#loadListDoc):not(.rc390-paper),
  body[data-exporthub-view="dashboard"] #content :is(.rc205-widget, .rc504-dashboard-item, #rc885Workspace .rc885-panel),
  body[data-exporthub-view="warehouse"] #content :is(.rc504-warehouse, .rc504-warehouse-kpi, .rc504-dashboard-item),
  body[data-exporthub-view="tasks"] #content :is(.card, .task, .rc205-planner-task),
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
  body[data-exporthub-view="tasks"] #content :is(.grid2, .grid3, .grid4, .task-groups, .rc628-task-groups),
  body[data-exporthub-view="planning"] #content :is(.grid2, .grid3, .grid4, .rc205-dashboard-grid),
  #index236NotificationCenter :is(.index236-statusbar, .index236-metrics, .index236-columns, .grid2, .grid3),
  #rc885WarningDrawer :is(.rc885-grid, .rc889-grid) {
    gap: var(--rc990-card-gap) !important;
    align-items: start !important;
  }

  body[data-exporthub-view="dashboard"] #content :is(.rc205-widget, .rc504-dashboard-item, #rc885Workspace .rc885-panel),
  body[data-exporthub-view="warehouse"] #content :is(.rc504-warehouse-kpi, .rc504-dashboard-item),
  body[data-exporthub-view="tasks"] #content :is(.task, .rc205-planner-task),
  body[data-exporthub-view="planning"] #content .rc205-planner-task,
  #index236NotificationCenter :is(.index236-item, .metric, .card, .index236-statusbar > div),
  #rc885WarningDrawer :is(.rc885-panel, .rc889-overview) {
    padding: var(--rc990-card-pad) !important;
    border-radius: var(--rc990-radius) !important;
    box-sizing: border-box !important;
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
  body[data-exporthub-view="tasks"] #content :is(.task, .rc205-planner-task, [draggable="true"]),
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


def replace_style(html: str, style_id: str, replacement: str | None) -> tuple[str, int]:
    pattern = re.compile(
        rf'<style\s+id=["\']{re.escape(style_id)}["\'][^>]*>.*?</style>',
        re.IGNORECASE | re.DOTALL,
    )
    if replacement is None:
        return pattern.subn('', html)
    return pattern.subn(replacement, html)


def main() -> None:
    html = PATH.read_text(encoding="utf-8")

    # Replace the exact legacy 100vw notifications layer instead of stacking another override.
    html, legacy_count = replace_style(html, LEGACY_STYLE_ID, None)
    if legacy_count > 1:
        raise SystemExit(f"Expected at most one {LEGACY_STYLE_ID}, found {legacy_count}")

    html, existing_count = replace_style(html, STYLE_ID, RC990_STYLE)
    if existing_count > 1:
        raise SystemExit(f"Expected at most one {STYLE_ID}, found {existing_count}")

    if existing_count == 0:
        body_close = html.lower().rfind("</body>")
        if body_close < 0:
            raise SystemExit("Could not find final </body> insertion point")
        html = html[:body_close] + "\n\n" + RC990_STYLE + "\n" + html[body_close:]

    if len(re.findall(r'<style\s+id=["\']rc990-design-system["\']', html, re.IGNORECASE)) != 1:
        raise SystemExit("RC990 design style must exist exactly once after apply")
    if re.search(r'<style\s+id=["\']exporthub-rc364-mobile-overflow-fix["\']', html, re.IGNORECASE):
        raise SystemExit("Legacy RC364 viewport-width style is still active")

    PATH.write_text(html, encoding="utf-8")
    print(
        "RC990 design applied: canonical style present once; "
        f"legacy mobile style removed={legacy_count == 1}; existing RC990 replaced={existing_count == 1}"
    )


if __name__ == "__main__":
    main()
