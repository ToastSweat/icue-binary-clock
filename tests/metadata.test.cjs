const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '../widget');

test('Show text is a native boolean switch rather than a numeric slider', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const meta = html.match(/<meta[^>]*content="textEnabled"[^>]*>/)[0];
  assert.match(meta, /data-type="switch"/);
  assert.match(meta, /data-label="tr\('Show text'\)"/);
  assert.match(meta, /data-default="true"/);
  assert.doesNotMatch(meta, /data-(?:min|max|step)=/);
});

test('native entry point registers real iCUE event callbacks so CLI and runtime both recognize them', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /icueEvents\s*=\s*\{/, 'entry point must wire the iCUE bridge explicitly');
  assert.match(html, /onICUEInitialized\s*:/);
  assert.match(html, /onDataUpdated\s*:/);
});

test('all settings have translated labels, matching defaults, valid groups and XML-safe head metadata', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const core = require(path.join(root, 'scripts/clock-core.js'));
  const translated = JSON.parse(fs.readFileSync(path.join(root, 'translation.json'), 'utf8')).en.translation;
  const groups = JSON.parse(html.match(/<script[^>]*id="x-icue-groups"[^>]*>([\s\S]*?)<\/script>/)[1]);
  const metas = [...html.matchAll(/<meta\s+name="x-icue-property"[^>]*\/\s*>/g)].map(match => {
    const attrs = {};
    [...match[0].matchAll(/([\w-]+)="([^"]*)"/g)].forEach(attr => { attrs[attr[1]] = attr[2]; });
    return attrs;
  });
  assert.equal(metas.length, Object.keys(core.defaults).length);
  assert.deepEqual(metas.map(meta => meta.content).sort(), Object.keys(core.defaults).sort());
  for (const meta of metas) {
    const key = meta['data-label'].match(/^tr\('([^']+)'\)$/)[1];
    assert.equal(translated[key], key);
    const encoded = meta['data-default'];
    const value = encoded.startsWith("'") ? encoded.slice(1, -1) : JSON.parse(encoded);
    assert.equal(value, core.defaults[meta.content], `${meta.content} defaults agree`);
    assert.ok(['color', 'switch', 'slider', 'combobox'].includes(meta['data-type']));
  }
  assert.deepEqual(groups.flatMap(group => group.properties).sort(), Object.keys(core.defaults).sort());
  const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
  for (const match of head.matchAll(/<(?:meta|link)\b[^>]*>/g)) assert.match(match[0], /\/\s*>$/);
  for (const match of head.matchAll(/tr\('([^']+)'\)/g)) assert.ok(Object.hasOwn(translated, match[1]), match[1]);
  assert.doesNotMatch(html, /(?:src|href)="https?:/);
});
