const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 840, height: 344 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const output = path.resolve(__dirname, '../verification');
  fs.mkdirSync(output, { recursive: true });
  try {
    await page.clock.setFixedTime(new Date(2026, 9, 3, 23, 59, 47));
    await page.goto(pathToFileURL(path.resolve(__dirname, 'fixtures/transparency-preview.html')).href);
    const frame = page.frames().find(frame => frame.url().endsWith('/widget/index.html'));
    assert.ok(frame, 'test widget loads over a simulated page wallpaper');
    await frame.waitForSelector('.bit.on');
    const update = values => frame.evaluate(values => {
      // Simulates the standard iCUE page/widget property injection, not hardware iCUE.
      Object.assign(window, values);
      icueEvents.onDataUpdated();
    }, values);
    const foreground = () => frame.evaluate(() => [...document.querySelectorAll('.clock, #readout, #time, #mode-label, .bit')].map(node => {
      const style = getComputedStyle(node);
      const r = node.getBoundingClientRect();
      return { element: node.id || node.className, color: style.color, opacity: style.opacity,
        width: r.width, height: r.height, value: node.dataset.value, background: style.backgroundColor };
    }));
    await update({ transparency: 100, brightness: 100 });
    const original = await foreground();
    await update({ transparency: 0 });
    assert.equal(await frame.locator('body').evaluate(node => getComputedStyle(node).backgroundColor),
      'rgba(0, 0, 0, 0)', 'page setting must not be blocked by an opaque body background');
    assert.equal(await frame.locator('html').evaluate(node => getComputedStyle(node).backgroundColor), 'rgba(0, 0, 0, 0)');
    assert.equal(await frame.locator('#widget-background').evaluate(node => getComputedStyle(node).opacity), '0');
    assert.deepEqual(await foreground(), original, 'background transparency must not fade or resize foreground content');
    await page.locator('iframe').evaluate(node => { node.style.visibility = 'hidden'; });
    await page.screenshot({ path: path.join(output, 'transparency-host-only.png') });
    await page.locator('iframe').evaluate(node => { node.style.visibility = 'visible'; });
    const readings = [];
    for (const value of [0, 25, 50, 75, 100, -10, 110]) {
      await update({ transparency: value });
      const expected = Math.min(100, Math.max(0, value)) / 100;
      const actual = Number(await frame.locator('#widget-background').evaluate(node => getComputedStyle(node).opacity));
      assert.equal(actual, expected, `native transparency ${value} matches Corsair's value/100 background-opacity mapping`);
      assert.deepEqual(await foreground(), original);
      readings.push({ input: value, backgroundOpacity: actual });
      if ([0, 50, 100].includes(value)) {
        await page.screenshot({ path: path.join(output, `transparency-${value}.png`) });
      }
    }
    const blockSample = await frame.locator('.bit.on').first().evaluate(node => {
      const r = node.getBoundingClientRect();
      return { x: Math.floor(r.x + r.width / 2), y: Math.floor(r.y + r.height / 2) };
    });
    await update({ transparency: 25, brightness: 65 });
    assert.equal(await frame.locator('.bit.on').first().evaluate(node => getComputedStyle(node).opacity), '0.65');
    assert.equal(await frame.locator('#widget-background').evaluate(node => getComputedStyle(node).opacity), '0.25');
    await update({ brightness: 100, textEnabled: false });
    assert.equal(await frame.locator('#readout').isVisible(), false);
    assert.equal(await frame.locator('#widget-background').evaluate(node => getComputedStyle(node).opacity), '0.25');
    await update({ textEnabled: true, backgroundColor: '#050505' });
    assert.equal(await frame.locator('#widget-background').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(5, 5, 5)');
    // Lexical injected globals must also work, including zero and initialization/update events.
    await frame.evaluate(() => { delete window.transparency; });
    await frame.addScriptTag({ content: 'let transparency = 0;' });
    await frame.evaluate(() => icueEvents.onICUEInitialized());
    assert.equal(await frame.locator('#widget-background').evaluate(node => getComputedStyle(node).opacity), '0');
    await frame.evaluate(() => { transparency = 50; icueEvents.onDataUpdated(); });
    assert.equal(await frame.locator('#widget-background').evaluate(node => getComputedStyle(node).opacity), '0.5');
    assert.deepEqual(errors, []);
    const summary = { passed: true, property: 'transparency', mapping: 'background opacity = clamped transparency / 100, matching bundled Corsair widgets',
      readings, foregroundUnchanged: true, rootAndBodyTransparent: true, lexicalGlobals: true, independentBrightness: true,
      hostSample: { x: 4, y: 4 }, blockSample, browserErrors: errors, hardwareTested: false };
    fs.writeFileSync(path.join(output, 'transparency-results.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
