const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const output = path.resolve(__dirname, '../verification');
  fs.mkdirSync(output, { recursive: true });
  const update = values => page.evaluate(values => {
    Object.assign(window, values);
    icueEvents.onDataUpdated();
  }, values);
  const size = () => page.locator('.bit').first().evaluate(node => {
    const rect = node.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  const bounds = async label => {
    const violations = await page.evaluate(() => [...document.querySelectorAll('.bit, .group-label, #readout, #mode-label')]
      .filter(node => {
        if (!node.getClientRects().length) return false;
        const r = node.getBoundingClientRect();
        return r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1 ||
          node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1;
      }).map(node => ({ element: node.className || node.id, rect: node.getBoundingClientRect().toJSON() })));
    assert.deepEqual(violations, [], label);
  };
  try {
    await page.clock.setFixedTime(new Date(2026, 9, 3, 23, 59, 47));
    await page.setViewportSize({ width: 840, height: 344 });
    await page.goto(pathToFileURL(path.resolve(__dirname, '../widget/index.html')).href);
    await update({ textEnabled: true, showNumbers: true, showLabels: true, showWeights: true });
    const initial = await size();
    await page.screenshot({ path: path.join(output, 'text-on-small.png') });
    await update({ textEnabled: false });
    assert.equal(await page.locator('#readout').isVisible(), false, 'text toggle off hides numeric time');
    assert.equal(await page.locator('#mode-label').isVisible(), false, 'text toggle off hides title');
    assert.equal(await page.locator('.group-label').first().isVisible(), false, 'text toggle off hides group labels');
    assert.equal(await page.locator('.weight').first().isVisible(), false, 'text toggle off hides weights');
    assert.ok((await size()).width > initial.width * 1.4, 'hiding text substantially enlarges blocks in small landscape');
    await page.screenshot({ path: path.join(output, 'text-off-small.png') });
    await update({ textEnabled: true });
    assert.equal(await page.locator('#readout').isVisible(), true);
    assert.equal(await page.locator('.group-label').first().isVisible(), true);
    assert.equal(await page.locator('.weight').first().isVisible(), true);
    assert.ok(Math.abs((await size()).width - initial.width) < 0.1, 'restoring text restores the same layout');
    await update({ showNumbers: false });
    assert.ok((await size()).width > initial.width, 'existing numeric-time toggle also reclaims space');
    await update({ showLabels: false, showWeights: false });
    const switchesOff = await size();
    await update({ textEnabled: false });
    assert.ok(Math.abs((await size()).width - switchesOff.width) < 0.1, 'all individual text switches off matches master off');
    const sizes = [[840,344],[696,416],[840,696],[696,840],[1688,696],[696,1688],[2536,696],[696,2536]];
    const configurations = [
      { blockSize: 100, blockGap: 14, groupGap: 45 },
      { blockSize: 125, blockGap: 30, groupGap: 80 },
      { blockSize: 50, blockGap: 0, groupGap: 0 }
    ];
    const comparisons = [];
    let layoutChecks = 0;
    for (const clockMode of ['bcd', 'binary']) {
      for (const showSeconds of [true, false]) {
        for (const [width, height] of sizes) {
          await page.setViewportSize({ width, height });
          for (const config of configurations) {
            await update({ ...config, clockMode, showSeconds, hourFormat: '12', textEnabled: true,
              showNumbers: true, showLabels: true, showWeights: true });
            const before = await size();
            const bits = await page.locator('.bit').evaluateAll(nodes => nodes.map(node => node.dataset.value));
            await bounds(`text on ${clockMode} ${width}x${height}`);
            layoutChecks++;
            await update({ textEnabled: false });
            const after = await size();
            assert.ok(after.width > before.width + 0.1, `text off must enlarge blocks: ${clockMode} ${width}x${height} ${JSON.stringify(config)}`);
            assert.ok(Math.abs(after.width - after.height) < 0.1, 'blocks remain square');
            assert.deepEqual(await page.locator('.bit').evaluateAll(nodes => nodes.map(node => node.dataset.value)), bits, 'text setting must not alter binary encoding');
            await bounds(`text off ${clockMode} ${width}x${height}`);
            layoutChecks++;
            comparisons.push({ clockMode, showSeconds, width, height, ...config, before: before.width, after: after.width });
            if (showSeconds && config.blockSize === 100 && ((width === 2536 && height === 696) || (width === 696 && height === 1688))) {
              await page.screenshot({ path: path.join(output, `text-off-${clockMode}-${width}x${height}.png`) });
            }
          }
        }
      }
    }
    assert.deepEqual(errors, []);
    const summary = { passed: true, layoutChecks, enlargementComparisons: comparisons.length, initialSmallBlock: initial.width,
      comparisons, browserErrors: errors, hardwareTested: false };
    fs.writeFileSync(path.join(output, 'text-layout-results.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify({ ...summary, comparisons: undefined }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
