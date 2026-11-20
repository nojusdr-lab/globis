'use strict';
// One animal as seen on a source page. Mirrors public.snapshot_animals.
// Every fact is nullable; null means "the page did not say".
const { cleanText, stripPrivate } = require('./normalize.cjs');
const { fromProse } = require('./labels.cjs');

const STATUSES = new Set(['available', 'reserved', 'unknown', 'confirmed_adopted']);
const FIELDS = ['name', 'species', 'sex', 'age_text', 'size', 'chipped', 'vaccinated', 'neutered', 'bio_lt'];

// iOS blocks plain-http images. An https page's own http photo links are upgraded (same host serves https).
function photoUrl(p, page) {
  const u = new URL(p, page);
  if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password) throw new Error('Bad photo URL');
  if (u.protocol === 'http:' && page.protocol === 'https:' && u.hostname === page.hostname) u.protocol = 'https:';
  return u.href;
}

function makeAnimal(sourceId, input) {
  if (!input || typeof input !== 'object') throw new Error('Animal must be an object');
  const url = new URL(input.sourceUrl);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Bad sourceUrl');
  const nativeId = String(input.nativeId ?? '').trim();
  if (!/^[\w.:-]{1,120}$/u.test(nativeId)) throw new Error(`Bad nativeId: ${nativeId}`);
  const status = input.status ?? 'unknown';
  if (!STATUSES.has(status)) throw new Error(`Bad status: ${status}`);
  const statusEvidence = cleanText(input.statusEvidence);
  if (status !== 'unknown' && !statusEvidence) {
    throw new Error(`Status ${status} needs evidence text from the page`);
  }
  const animal = {
    id: `${sourceId}:${nativeId}`,
    source: sourceId,
    sourceUrl: url.href,
    name: cleanText(input.name),
    species: oneOf(input.species, ['dog', 'cat', 'other']),
    sex: oneOf(input.sex, ['male', 'female']),
    age_text: cleanText(input.age_text),
    size: oneOf(input.size, ['small', 'medium', 'large']),
    photos: [...new Set((input.photos || []).filter(Boolean).map(p => photoUrl(p, url)))].slice(0, 10),
    chipped: bool(input.chipped),
    vaccinated: bool(input.vaccinated),
    neutered: bool(input.neutered),
    bio_lt: stripPrivate(cleanText(input.bio_lt)),
    // How long or since when the animal is in the shelter, as the shelter writes it ("nuo 2026-09-13", "1mėn. 7d.").
    in_shelter: cleanText(input.in_shelter),
    status,
    statusEvidence,
    sourceUpdatedAt: input.sourceUpdatedAt ?? null,
    // Which shelter record of a multi-branch source this animal belongs to (to-app-data.cjs).
    shelterHint: cleanText(input.shelterHint),
  };
  // Labelled facts win; the description text fills only what the adapter left unknown.
  const prose = fromProse(animal.bio_lt);
  for (const k of ['chipped', 'vaccinated', 'neutered', 'age_text', 'size', 'in_shelter']) if (animal[k] === null && k in prose) animal[k] = prose[k];
  // A post named after several animals ("MARTA IR BAIKA", "TILI, MAURILĖ") never gets a sex from its story.
  if (animal.sex === null && prose.sex && !/,|&|\s(ir|su)\s/iu.test(animal.name || '')) animal.sex = prose.sex;
  if (animal.bio_lt && animal.bio_lt.length > 4000) animal.bio_lt = animal.bio_lt.slice(0, 4000) + '…';
  return animal;
}

const oneOf = (v, allowed) => (allowed.includes(v) ? v : null);
const bool = v => (v === true || v === false ? v : null);

module.exports = { makeAnimal, FIELDS, STATUSES };
