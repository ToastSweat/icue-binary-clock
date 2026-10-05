const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const runtime = path.join(__dirname, '../widget/scripts/clock-core.js');

test('settings preserve false and zero, clamp layout controls, and reject invalid values', () => {
  const api = require(runtime);
  assert.equal(typeof api.normalizeSettings, 'function', 'settings normalization is required');
  const settings = api.normalizeSettings({
    showSeconds: false, showNumbers: false, showLabels: false, showWeights: false,
    blockGap: 0, groupGap: 0, blockSize: 999, brightness: -1,
    clockMode: 'unknown', accentColor: 'url(https://example.org)', backgroundColor: '#123456',
    offColor: '#222', textColor: '#FF00FF', hourFormat: '12', timeZone: 'utc'
  });
  assert.equal(settings.showSeconds, false);
  assert.equal(settings.showNumbers, false);
  assert.equal(settings.showLabels, false);
  assert.equal(settings.showWeights, false);
  assert.equal(settings.blockGap, 0);
  assert.equal(settings.groupGap, 0);
  assert.equal(settings.blockSize, 125);
  assert.equal(settings.brightness, 20);
  assert.equal(settings.clockMode, 'bcd');
  assert.equal(settings.accentColor, '#B784FF');
  assert.equal(settings.backgroundColor, '#123456');
  assert.equal(settings.offColor, '#222');
  assert.equal(settings.hourFormat, '12');
  assert.equal(settings.timeZone, 'utc');
  assert.equal(api.normalizeSettings({ showSeconds: 'false', blockSize: '75', brightness: NaN }).showSeconds, false);
  assert.equal(api.normalizeSettings({ blockSize: '75' }).blockSize, 75);
  assert.equal(api.normalizeSettings({ brightness: NaN }).brightness, 100);
});

test('standard iCUE transparency setting accepts zero and clamps percentages', () => {
  const { normalizeSettings } = require(runtime);
  assert.equal(normalizeSettings().transparency, 80);
  for (const [value, expected] of [[0, 0], ['25', 25], [50, 50], [100, 100], [-10, 0], [110, 100], [NaN, 80]]) {
    assert.equal(normalizeSettings({ transparency: value }).transparency, expected);
  }
});

test('master text toggle uses booleans and preserves legacy slider settings', () => {
  const { normalizeSettings } = require(runtime);
  assert.equal(normalizeSettings().textEnabled, true);
  for (const value of [false, 0, '0', 'false']) {
    assert.equal(normalizeSettings({ textEnabled: value }).textEnabled, false);
  }
  for (const value of [true, 1, '1', 'true']) {
    assert.equal(normalizeSettings({ textEnabled: value }).textEnabled, true);
  }
});

test('12-hour time includes AM/PM, correctly handles midnight and noon, and can hide seconds', () => {
  const { buildClock } = require(runtime);
  for (const [hour, expected, period] of [[0, '12:07', 'AM'], [12, '12:07', 'PM'], [23, '11:07', 'PM']]) {
    const model = buildClock(new Date(2026, 9, 3, hour, 7, 8), { hourFormat: '12', showSeconds: false });
    assert.equal(model.text, expected);
    assert.equal(model.period, period);
    assert.equal(model.groups.length, 2);
    assert.equal(model.groups[0].value, hour % 12 || 12);
  }
  const utc = buildClock(new Date('2026-10-03T15:07:08Z'), { timeZone: 'utc' });
  assert.equal(utc.text, '15:07:08');
});

test('digit mode encodes each digit of 23:59:47 as four high-to-low bits', () => {
  assert.ok(fs.existsSync(runtime), 'clock-core.js must implement the clock model');
  const { buildClock } = require(runtime);
  const model = buildClock(new Date(2026, 9, 3, 23, 59, 47), {});
  assert.equal(model.text, '23:59:47');
  assert.deepEqual(model.groups.map(group => group.columns.map(column => column.bits)), [
    [[0, 0, 1, 0], [0, 0, 1, 1]],
    [[0, 1, 0, 1], [1, 0, 0, 1]],
    [[0, 1, 0, 0], [0, 1, 1, 1]]
  ]);
  assert.deepEqual(model.weights, [8, 4, 2, 1]);
});

test('whole-value mode uses six high-to-low bits for each time component', () => {
  const { buildClock } = require(runtime);
  const model = buildClock(new Date(2026, 9, 3, 23, 59, 47), { clockMode: 'binary' });
  assert.deepEqual(model.weights, [32, 16, 8, 4, 2, 1]);
  assert.deepEqual(model.groups.map(group => group.columns.map(column => column.bits)), [
    [[0, 1, 0, 1, 1, 1]], [[1, 1, 1, 0, 1, 1]], [[1, 0, 1, 1, 1, 1]]
  ]);
});
