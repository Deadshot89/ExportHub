#!/usr/bin/env bash
# RC2015: The GitHub runner may be unable to resolve Ubuntu apt mirrors.
# Download Playwright's pinned Chromium, then prove that the installed
# system libraries are sufficient by launching and navigating a real browser.
# Do not skip Playwright tests or ignore a failed launch.
set -euo pipefail
npx playwright install chromium
node <<'NODE'
'use strict';
const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: true, timeout: 30000 });
  try {
    const page = await browser.newPage();
    await page.goto('data:text/html,<title>RC2015-browser-ready</title>', { waitUntil: 'load' });
    if (await page.title() !== 'RC2015-browser-ready')
      throw new Error('Chromium failed the browser navigation smoke test');
    console.log('RC2015: Chromium launches and navigates; run the complete browser tests');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error('RC2015: Chromium unavailable; refusing to bypass the browser gate: ' +
    String(error && error.message || error).slice(0, 1200));
  process.exitCode = 1;
});
NODE
