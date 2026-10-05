const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
  const entry = path.resolve(__dirname, '../widget/index.html');
  assert.ok(fs.existsSync(entry), 'native widget entry point must exist');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 840, height: 344 } });
  const errors = [];
  const requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  await page.clock.setFixedTime(new Date(2026, 9, 3, 23, 59, 47));
  const output = path.resolve(__dirname, '../verification');
  fs.mkdirSync(output, { recursive: true });
  const update = async values => {
    // Simulator for the documented property globals and onDataUpdated hook, not actual iCUE.
    await page.evaluate(values => { Object.assign(window, values); icueEvents.onDataUpdated(); }, values);
  };
  const checkBounds = async description => {
    const violations = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('.bit, .group-label, #readout, #period, #mode-label')];
      return nodes.filter(node => {
        if (!node.getClientRects().length || getComputedStyle(node).visibility === 'hidden') return false;
        const r = node.getBoundingClientRect();
        return r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1 ||
          node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1;
      }).map(node => ({ element: node.className || node.id, text: node.textContent, rect: node.getBoundingClientRect().toJSON() }));
    });
    assert.deepEqual(violations, [], description + ': all content must fit');
  };
  try {
    await page.goto(pathToFileURL(entry).href);
    assert.equal(await page.locator('#time').innerText(), '23:59:47');
    assert.equal(await page.locator('.bit').count(), 24);
    assert.equal(await page.locator('.group').count(), 3);
    assert.equal(await page.locator('.group').first().locator('.bit.on').count(), 3);
    assert.equal(await page.locator('.weight').first().isVisible(), false);
    await checkBounds('default small landscape');
    await page.screenshot({ path: path.join(output, 'atomic-purple-small.png') });
    await page.waitForTimeout(1150);
    assert.equal(await page.locator('#time').innerText(), '23:59:47');
    // Read current wall time each tick, never accumulate seconds; handles sleep/time adjustments.
    await page.clock.setFixedTime(new Date(2026, 9, 4, 0, 0, 0));
    await page.waitForTimeout(1150);
    assert.equal(await page.locator('#time').innerText(), '00:00:00');
    await page.clock.setFixedTime(new Date(2026, 9, 3, 23, 59, 47));
    await update({ hourFormat: '12', showSeconds: false, showWeights: true, accentColor: '#00FFCC',
      backgroundColor: '#050505', textColor: '#FFFFFF', offColor: '#333333', brightness: 65, blockSize: 75, blockGap: 0, groupGap: 0 });
    assert.equal(await page.locator('#time').innerText(), '11:59');
    assert.equal(await page.locator('#period').innerText(), 'PM');
    assert.equal(await page.locator('.bit').count(), 16);
    assert.equal(await page.locator('.weight').first().isVisible(), true);
    assert.equal(await page.locator('.bit.on').first().evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(0, 255, 204)');
    assert.equal(await page.locator('.bit.on').first().evaluate(node => getComputedStyle(node).opacity), '0.65');
    assert.equal(await page.locator('#widget-background').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(5, 5, 5)');
    await checkBounds('live settings');
    await update({ showNumbers: false, showLabels: false });
    assert.equal(await page.locator('#readout').isVisible(), false);
    assert.equal(await page.locator('.group-label').first().isVisible(), false);
    assert.equal(await page.locator('#mode-label').isVisible(), false);
    await update({ hourFormat: '24', showSeconds: true, showWeights: true, showNumbers: true, showLabels: true,
      accentColor: '#B784FF', backgroundColor: '#100D16', textColor: '#F0E8FF', offColor: '#292132', brightness: 100, blockSize: 100, blockGap: 14, groupGap: 45 });
    const sizes = [[840,344],[696,416],[840,696],[696,840],[1688,696],[696,1688],[2536,696],[696,2536]];
    let checks = 0;
    for (const clockMode of ['bcd', 'binary']) {
      await update({ clockMode });
      assert.match(await page.locator('#board').getAttribute('aria-label'),
        clockMode === 'bcd' ? /digit-by-digit binary$/ : /whole-value binary$/,
        'screen-reader description must follow mode changes immediately, even with unchanged time');
      assert.equal(await page.locator('.bit').count(), clockMode === 'bcd' ? 24 : 18);
      for (const [width, height] of sizes) {
        await page.setViewportSize({ width, height });
        await checkBounds(`${clockMode} ${width}x${height}`);
        checks++;
        if ((width === 2536 && height === 696) || (width === 696 && height === 840)) {
          await page.screenshot({ path: path.join(output, `${clockMode}-${width}x${height}.png`) });
        }
        await update({ blockSize: 125, blockGap: 30, groupGap: 80 });
        await checkBounds(`maximum spacing ${clockMode} ${width}x${height}`);
        checks++;
        await update({ blockSize: 50, blockGap: 0, groupGap: 0, showSeconds: false });
        await checkBounds(`minimum spacing ${clockMode} ${width}x${height}`);
        checks++;
        await update({ blockSize: 100, blockGap: 14, groupGap: 45, showSeconds: true });
      }
    }
    // Global lexical bindings (let/const) do not necessarily live on window.
    await page.goto(pathToFileURL(entry).href);
    await page.addScriptTag({ content: "let clockMode = 'binary'; let showSeconds = false;" });
    await page.evaluate(() => icueEvents.onICUEInitialized());
    assert.equal(await page.locator('.bit').count(), 12);
    await page.evaluate(() => { clockMode = 'bcd'; showSeconds = true; icueEvents.onDataUpdated(); });
    assert.equal(await page.locator('.bit').count(), 24);
    // Idempotent initialization: repeated calls must not duplicate nodes or timers.
    await page.evaluate(() => { icueEvents.onICUEInitialized(); icueEvents.onICUEInitialized(); });
    assert.equal(await page.locator('.bit').count(), 24);
    await page.clock.setFixedTime(new Date(2026, 9, 4, 0, 0, 0));
    await page.waitForTimeout(1150);
    assert.equal(await page.locator('#time').innerText(), '00:00:00');
    assert.deepEqual(errors, [], 'no browser JavaScript errors');
    assert.deepEqual(requests, [], 'widget must make no network requests');
    const summary = { passed: true, layoutChecks: checks, sizes, clockModes: ['bcd', 'binary'],
      settingsBridge: 'simulated documented iCUE globals/callbacks, including lexical bindings',
      checked: ['wall-clock rollover', 'live colors', 'brightness', 'zero spacing', 'hidden labels and numbers', '12-hour AM/PM', 'seconds toggle', 'bit weights', 'repeated initialization'],
      browserErrors: errors, networkRequests: requests, hardwareTested: false };
    fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
