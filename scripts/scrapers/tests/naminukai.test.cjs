'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePage, listedSlugs, sizeOf } = require('../adapters/naminukai.cjs')._test;

// Shape of https://naminukai.com/otas/ REST content (2026-11-17), shortened.
const OTAS = '<div><img src="https://naminukai.com/wp-content/uploads/2026/06/OTAS-scaled.jpg" alt="OTAS"/>'
  + '<h2>OTAS</h2><p>Mišrūnas &#9794;</p><h3>AMŽIUS</h3><h3>DYDIS</h3><h3>KASTRACIJA</h3>'
  + '<p>~5 metai</p><p>Vidutinis</p><p>Atlikta</p><p>Naujų NAMŲ PAIEŠKAS pradeda Otas!</p><p>O tai tau šuo!</p></div>';

test('naminukai: header facts and story from the page', () => {
  assert.deepEqual(parsePage(OTAS), {
    sex: 'male', age_text: '~5 metai', size: 'medium', neutered: true,
    bio_lt: 'Naujų NAMŲ PAIEŠKAS pradeda Otas! O tai tau šuo!',
    photos: ['https://naminukai.com/wp-content/uploads/2026/06/OTAS-scaled.jpg'],
  });
});

test('naminukai: page without the header is not an animal', () => {
  assert.equal(parsePage('<p>Kontaktai</p>'), null);
});

test('naminukai: listing keeps own one-segment links only', () => {
  const html = '<a href="https://naminukai.com/otas/">Otas</a><a href="https://naminukai.com/wp-json/">x</a>'
    + '<a href="https://facebook.com/naminukai/">fb</a><a href="https://naminukai.com/otas/">again</a>';
  assert.deepEqual(listedSlugs(html), ['otas']);
});

test('naminukai: size words incl. site typos', () => {
  assert.equal(sizeOf('Neidelė'), 'small');
  assert.equal(sizeOf('Nedidelis'), 'small');
  assert.equal(sizeOf('Viduinis'), 'medium');
  assert.equal(sizeOf('Didelis'), 'large');
});
