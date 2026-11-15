const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { pathToFileURL } = require('node:url');

const inventoryPath = new URL(
  '../../docs/discovery-engine/vmvt-guardian-inventory.tsv',
  pathToFileURL(__filename),
);

test('reviewed VMVT inventory has consistent rows, statuses and destinations', () => {
  const [header, ...rows] = readFileSync(inventoryPath, 'utf8').trimEnd().split(/\r?\n/);
  const columns = [
    'vmvt_row', 'registered_name', 'legal_form_hint', 'activity_hint',
    'vmvt_status', 'vmvt_link_label', 'listed_urls', 'channel_types', 'access_gate',
  ];
  assert.deepEqual(header.split('\t'), columns);
  assert.equal(rows.length, 96);

  const statuses = { unknown: 0, inactive: 0, temporarily_not_accepting: 0 };
  const rowTypes = { none: 0, website: 0, facebook: 0, 'facebook website': 0 };
  const urlTypes = { website: 0, facebook: 0 };
  let rowsWithUrls = 0;
  let httpUrls = 0;

  rows.forEach((row, index) => {
    const rowNumber = String(index + 1);
    const fields = row.split('\t');
    assert.equal(fields.length, columns.length, `Row ${rowNumber}: column count`);
    const [number, name, , , status, , listedUrls, channelTypes, accessGate] = fields;
    assert.equal(number, rowNumber);
    assert.ok(name.trim(), `Row ${number}: missing registered name`);
    assert.ok(Object.hasOwn(statuses, status), `Row ${number}: invalid status`);
    statuses[status]++;

    const urls = listedUrls ? listedUrls.split(' ') : [];
    const detectedTypes = urls.map((raw) => {
      const url = new URL(raw);
      assert.ok(['https:', 'http:'].includes(url.protocol), `Row ${number}: invalid protocol`);
      if (url.protocol === 'http:') httpUrls++;
      const hostname = url.hostname;
      const type = hostname === 'facebook.com' || hostname.endsWith('.facebook.com')
        ? 'facebook'
        : 'website';
      urlTypes[type]++;
      return type;
    });

    assert.equal(channelTypes, detectedTypes.join(' '), `Row ${number}: channel types`);
    const rowType = channelTypes || 'none';
    assert.ok(Object.hasOwn(rowTypes, rowType), `Row ${number}: invalid channel combination`);
    rowTypes[rowType]++;
    if (urls.length) rowsWithUrls++;

    const expectedGate = detectedTypes.includes('website')
      ? 'website_review_required'
      : detectedTypes.includes('facebook') ? 'social_authorization_required' : 'no_channel';
    assert.equal(accessGate, expectedGate, `Row ${number}: access gate`);
  });

  assert.deepEqual(statuses, { unknown: 94, inactive: 1, temporarily_not_accepting: 1 });
  assert.deepEqual(rowTypes, { none: 1, website: 39, facebook: 55, 'facebook website': 1 });
  assert.equal(rowsWithUrls, 95);
  assert.deepEqual(urlTypes, { website: 40, facebook: 56 });
  assert.equal(urlTypes.website + urlTypes.facebook, 96);
  assert.equal(httpUrls, 12);
  assert.equal(rows[4].split('\t')[4], 'temporarily_not_accepting');
  assert.equal(rows[26].split('\t')[4], 'inactive');
  assert.equal(rows[89].split('\t')[7], 'facebook website');
});

const { parseInventory, summarize } = require('./vmvt-inventory.cjs');
test('destinations have independent unverified data and image permissions', () => {
  const text = readFileSync(inventoryPath,'utf8');
  const rows = parseInventory(text);
  const mixed = rows.find(row=>row.destinations.length===2);
  assert.deepEqual(mixed.destinations.map(d=>d.accessState),['social_authorization_required','website_review_required']);
  assert.ok(rows.flatMap(row=>row.destinations).every(d=>d.dataPermission==='unverified' && d.photoPermission==='unverified'));
  assert.equal(summarize(rows).registryRows,96);
  assert.equal(summarize(rows).destinationLinks,96);
  assert.equal(summarize(rows).approvedChannels,0);
  for (const invalid of [text.replace('website_review_required','approved'),text.replace('http://animal.lt','javascript://animal.lt'),text.replace('http://animal.lt','http://user:password@animal.lt'),text.replace('1\tUAB','2\tUAB')]) assert.throws(()=>parseInventory(invalid));
});
