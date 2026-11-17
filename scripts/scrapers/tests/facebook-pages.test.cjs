'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseProfile, facebookRows } = require('../facebook-pages.cjs');

test('parses og tags only, decodes entities', () => {
  const p = parseProfile(fs.readFileSync(path.join(__dirname, '../fixtures/facebook/page-keturkojoviltis.html'), 'utf8'));
  assert.equal(p.state, 'ok');
  assert.match(p.name, /^Asociacija „Keturkojo viltis“/);
  assert.equal(p.url, 'https://www.facebook.com/keturkojoviltis/');
});

test('missing or login title is a login wall, nothing guessed', () => {
  assert.deepEqual(parseProfile('<html></html>'), { state: 'login_wall' });
  assert.deepEqual(parseProfile('<meta property="og:title" content="Log in to Facebook">'), { state: 'login_wall' });
});

test('inventory yields 56 facebook rows', () => {
  const rows = facebookRows(fs.readFileSync(path.join(__dirname, '../../../docs/discovery-engine/vmvt-guardian-inventory.tsv'), 'utf8'));
  assert.equal(rows.length, 56);
});
