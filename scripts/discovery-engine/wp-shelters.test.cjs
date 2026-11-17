// WordPress shelter adapters. Synthetic WordPress REST responses only. No network: fetch is injected.
const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePost, collect, SOURCE } = require('./lietuva-gyvunams.cjs');
const kggn = require('./kggn.cjs');
const sos = require('./sos-gyvunai.cjs');

const post = (id, slug, over = {}) => ({
  id, slug, link: `https://lietuvagyvunams.com/${slug}/`,
  date: '2026-11-01T10:00:00', modified: '2026-11-02T10:00:00',
  title: { rendered: 'Testas &#8211; A' },
  excerpt: { rendered: '<p>Amžius: 3,5 m. | Miestas: Kaunas</p>\n' },
  content: { rendered:
    '<figure><img src="https://lietuvagyvunams.com/wp-content/uploads/2026/11/a1-768x1024.jpg" ' +
    'srcset="https://lietuvagyvunams.com/wp-content/uploads/2026/11/a1.jpg 1200w"></figure>' +
    '<p>Pirma pastraipa <img alt="❤️" src="https://static.xx.fbcdn.net/images/emoji.php/x.png"></p>' +
    '<script>alert(1)</script><p>Antra &amp; paskutinė.</p>' },
  categories: [SOURCE.category], ...over,
});

function fakeFetch(pages, { total, status = 200, robots = 'User-agent: *\nDisallow: /wp-admin/\n' } = {}) {
  const calls = [];
  const fetch = async url => {
    calls.push(url);
    if (url.endsWith('/robots.txt')) return { status: 200, headers: new Map(), text: async () => robots };
    const page = Number(new URL(url).searchParams.get('page'));
    const body = pages[page - 1];
    return {
      status: body ? status : 400,
      headers: new Map([['x-wp-total', String(total ?? pages.flat().length)], ['x-wp-totalpages', String(pages.length)]]),
      json: async () => body,
    };
  };
  return { fetch, calls };
}
const opts = extra => ({ now: () => Date.parse('2026-11-16T12:00:00Z'), sleep: async () => {}, ...extra });

test('parses only sourced facts; everything else stays null', () => {
  const pet = parsePost(post(7, 'testas'), '2026-11-16T12:00:00.000Z');
  assert.deepEqual(pet, {
    id: 'lietuvagyvunams:7', source: 'lietuvagyvunams', url: 'https://lietuvagyvunams.com/testas/',
    name: 'Testas – A', species: null, sex: null, size: null,
    ageText: '3,5 m.', city: 'Kaunas',
    photos: ['https://lietuvagyvunams.com/wp-content/uploads/2026/11/a1-768x1024.jpg'],
    medical: { chipped: null, vaccinated: null, neutered: null },
    bioLt: 'Pirma pastraipa ❤️\n\nAntra & paskutinė.',
    status: 'available', statusEvidence: 'Kategorija „Ieško namų“',
    sourceUpdatedAt: '2026-11-02T10:00:00', observedAt: '2026-11-16T12:00:00.000Z',
    shelter: { id: SOURCE.shelterId },
  });
});

test('unknown age and missing excerpt are null, not guessed', () => {
  const unknown = parsePost(post(1, 'a', { excerpt: { rendered: 'Amžius: nežinomas | Miestas: Kaunas' } }), 'x');
  assert.equal(unknown.ageText, null);
  assert.equal(unknown.city, 'Kaunas');
  const none = parsePost(post(2, 'b', { excerpt: { rendered: '' } }), 'x');
  assert.equal(none.ageText, null);
  assert.equal(none.city, null);
});

test('reserved wording in the title or excerpt is kept as evidence', () => {
  const pet = parsePost(post(3, 'c', { title: { rendered: 'Rokis (REZERVUOTAS)' } }), 'x');
  assert.equal(pet.status, 'reserved');
  assert.equal(pet.statusEvidence, 'Rokis (REZERVUOTAS)');
});

test('rejects posts from other hosts, other categories or with bad IDs', () => {
  assert.throws(() => parsePost(post(4, 'd', { link: 'https://evil.example/d/' }), 'x'), /Unexpected listing URL/);
  assert.throws(() => parsePost(post(5, 'e', { categories: [1] }), 'x'), /not in the adoption category/);
  assert.throws(() => parsePost(post('6', 'f'), 'x'), /Invalid post ID/);
  assert.throws(() => parsePost(post(8, 'g', { title: { rendered: '  ' } }), 'x'), /Missing name/);
});

test('collects every page and reports a complete run', async () => {
  const { fetch, calls } = fakeFetch([[post(1, 'a'), post(2, 'b')], [post(3, 'c')]]);
  const run = await collect(opts({ fetch, perPage: 2 }));
  assert.equal(run.state, 'complete');
  assert.deepEqual(run.pets.map(p => p.id), ['lietuvagyvunams:1', 'lietuvagyvunams:2', 'lietuvagyvunams:3']);
  assert.equal(run.total, 3);
  assert.equal(calls[0], 'https://lietuvagyvunams.com/robots.txt');
  assert.ok(calls.slice(1).every(u => u.startsWith('https://lietuvagyvunams.com/wp-json/wp/v2/posts?')));
});

test('fails closed: transport error, count mismatch, duplicate or broken post', async () => {
  const cases = [
    fakeFetch([[post(1, 'a')]], { status: 500 }),
    fakeFetch([[post(1, 'a')]], { total: 5 }),
    fakeFetch([[post(1, 'a'), post(1, 'a')]]),
    fakeFetch([[post(1, 'a'), post(2, 'b', { link: 'http://lietuvagyvunams.com/b/' })]]),
    fakeFetch([[]], { total: 0 }),
  ];
  for (const { fetch } of cases) {
    const run = await collect(opts({ fetch }));
    assert.equal(run.state, 'failed');
    assert.deepEqual(run.pets, []);
    assert.ok(run.error);
  }
});

test('stops before any API call when robots.txt disallows the API', async () => {
  const { fetch, calls } = fakeFetch([[post(1, 'a')]], { robots: 'User-agent: *\nDisallow: /wp-json/\n' });
  const run = await collect(opts({ fetch }));
  assert.equal(run.state, 'failed');
  assert.match(run.error, /robots/);
  assert.equal(calls.length, 1);
});

test('waits between requests', async () => {
  const waits = [];
  const { fetch } = fakeFetch([[post(1, 'a')], [post(2, 'b')]]);
  await collect(opts({ fetch, perPage: 1, sleep: async ms => { waits.push(ms); } }));
  assert.ok(waits.length >= 2 && waits.every(ms => ms >= 2000));
});

// KGGN and SOS gyvūnai use the same reader; their facts come from the site's own categories.
const embedded = (terms, photo) => ({
  'wp:term': terms.map(([taxonomy, slug, name]) => [{ taxonomy, slug, name }]),
  ...(photo ? { 'wp:featuredmedia': [{ source_url: photo }] } : {}),
});
const kggnPost = (terms, over = {}) => ({
  id: 2640, link: 'https://kggn.lt/globotiniai/kovas/', modified: '2025-02-05T09:38:59',
  title: { rendered: 'KOVAS' }, content: { rendered: '<p>Draugiškas.</p>' },
  _embedded: embedded(terms, 'https://kggn.lt/wp-content/uploads/2025/02/kovas-scaled.jpg'), ...over,
});

test('KGGN: species, sex, age and status come from the site categories', () => {
  const pet = kggn.parsePost(kggnPost([['gyvunas', 'suo', 'Šuo'], ['lytis', 'patinas', 'Patinas'],
    ['statusas', 'dovanojamas', 'Dovanojamas'], ['amzius', '2-3metai', '2-3metai']]), 'x');
  assert.deepEqual([pet.id, pet.species, pet.sex, pet.ageText, pet.status, pet.shelter.id],
    ['kggn:2640', 'dog', 'male', '2-3metai', 'available', 'kggnlt']);
  assert.deepEqual(pet.photos, ['https://kggn.lt/wp-content/uploads/2025/02/kovas-scaled.jpg']);
  const bare = kggn.parsePost(kggnPost([['statusas', 'dovanojamas', 'Dovanojamas']]), 'x');
  assert.deepEqual([bare.species, bare.sex, bare.ageText], [null, null, null]);
  assert.throws(() => kggn.parsePost(kggnPost([['statusas', 'rado-namus', 'Rado namus']]), 'x'), /Dovanojamas/);
  assert.throws(() => kggn.parsePost(kggnPost([]), 'x'), /Dovanojamas/);
});

test('SOS gyvūnai: species and age group only; status stays unknown', () => {
  const sosPost = terms => ({
    id: 4468, link: 'https://sos-gyvunai.lt/imbieras/', modified: '2026-11-13T16:46:54',
    title: { rendered: 'Imbieras' }, content: { rendered: '<p>Atvyko jau kastruotas.</p>' },
    _embedded: embedded(terms, 'https://evil.example/x.jpg'),
  });
  const pet = sos.parsePost(sosPost([['gyvunai', 'visi-gyvunai', 'Visi gyvūnai'], ['gyvunai', 'kates', 'Katės'],
    ['gyvunai', 'kates-suaugusios', 'Katės suaugusios']]), 'x');
  assert.deepEqual([pet.species, pet.ageText, pet.sex, pet.status, pet.statusEvidence, pet.medical.neutered],
    ['cat', 'Suaugęs', null, 'unknown', null, null]);
  assert.deepEqual(pet.photos, []);
  const mixed = sos.parsePost(sosPost([['gyvunai', 'kates', 'Katės'], ['gyvunai', 'sunys-jauni', 'Šunys jauni']]), 'x');
  assert.equal(mixed.species, null);
});

test('honours Crawl-delay from robots.txt', async () => {
  const waits = [];
  const fetch = async url => url.endsWith('/robots.txt')
    ? { status: 200, text: async () => 'User-agent: *\nCrawl-delay: 10\n' }
    : { status: 200, headers: new Map([['x-wp-total', '1'], ['x-wp-totalpages', '1']]),
        json: async () => [kggnPost([['statusas', 'dovanojamas', 'Dovanojamas']])] };
  const run = await kggn.collect(opts({ fetch, sleep: async ms => { waits.push(ms); } }));
  assert.equal(run.state, 'complete');
  assert.deepEqual(waits, [10000]);
});
