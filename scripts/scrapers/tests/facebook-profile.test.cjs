'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseProfile, facebookRows } = require('../facebook-pages.cjs');

test('Lithuanian Facebook login prompts cannot be reported as a shelter profile', () => {
  assert.deepEqual(parseProfile('<meta property="og:title" content="Jei norite peržiūrėti, prisijunkite arba prisiregistruokite"><meta property="og:description" content="Žr. įrašus, nuotraukas ir daugiau sistemoje Facebook.">'), { state: 'login_wall' });
  assert.deepEqual(parseProfile('<meta property="og:title" content="Facebook">'), { state: 'login_wall' });
});

test('mixed website/social registry rows yield only the individual Facebook destination', () => {
  const tsv = fs.readFileSync(path.join(__dirname, '../../../docs/discovery-engine/vmvt-guardian-inventory.tsv'), 'utf8');
  const rows = facebookRows(tsv);
  assert.equal(rows.length, 56);
  assert.equal(rows.find(r => r.vmvtRow === 90).url, 'https://www.facebook.com/DevyniGyvenimai');
  assert.ok(rows.every(r => !r.url.includes(' ') && /(^|\.)facebook\.com$/.test(new URL(r.url).hostname)));
});
