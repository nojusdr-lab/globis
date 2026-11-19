'use strict';
// Shelter-site animal -> app pet. Shared by scripts/scrapers/to-app-data.cjs (bundled JSON)
// and the app's Supabase read (published_animals rows). Pure: no fs, safe for the app bundle.

// Adapter id -> shelters.json id, where it is not `${id}lt`. beglobis has no shelter record yet:
// skipped until mapped by a person. lese has two branches: each animal's shelterHint picks one.
const SHELTER = { gyvunugloba: 'gyvunuglobacom' };
const BRANCHES = { lese: { vilnius: 'leseltvilnius', kaunas: 'leseltkaunas' } };

function shelterResolver(source, byId) {
  const branches = BRANCHES[source];
  return branches ? a => byId.get(branches[a.shelterHint]) : () => byId.get(SHELTER[source] ?? `${source}lt`);
}

function toAppPet(a, shelter) {
  return {
    id: a.id, url: a.sourceUrl, source: a.source, name: a.name, species: a.species ?? null,
    city: shelter.city ?? null, photos: a.photos ?? [], status: a.status ?? 'unknown',
    statusEvidence: a.statusEvidence ?? null, sex: a.sex ?? null, ageLt: a.age_text ?? null, ageEn: null,
    size: a.size ?? null, waitingDays: null,
    medical: { chipped: a.chipped ?? null, vaccinated: a.vaccinated ?? null, neutered: a.neutered ?? null },
    compatibilityTagsLt: [], compatibilityTagsEn: [], personalityTraitsLt: [], personalityTraitsEn: [],
    bioLt: a.bio_lt ?? null, bioEn: null, sourceUpdatedAt: a.sourceUpdatedAt ?? null,
    shelter: { id: shelter.id, name: shelter.name, city: shelter.city, address: shelter.address, url: shelter.url },
  };
}

// published_animals rows -> app pets. Sources present remotely replace their bundled rows;
// sources absent remotely (not loaded yet, or unpublished) keep the bundled copy.
function fromRemote(rows, shelters, bundledDirect) {
  const byId = new Map(shelters.map(s => [s.id, s]));
  const remote = [];
  const sources = new Set();
  for (const r of rows) {
    const a = {
      id: r.animal_id, sourceUrl: r.source_url, source: r.source, name: r.name, species: r.species,
      sex: r.sex, age_text: r.age_text, size: r.size, photos: r.photos, chipped: r.chipped,
      vaccinated: r.vaccinated, neutered: r.neutered, bio_lt: r.bio_lt, status: r.status,
      statusEvidence: r.status_evidence, shelterHint: r.shelter_hint,
    };
    const shelter = shelterResolver(a.source, byId)(a);
    if (!shelter) continue; // unmapped source or unknown branch: not shown, same as the bundled bridge
    sources.add(a.source);
    if (a.name?.trim()) remote.push(toAppPet(a, shelter));
  }
  return [...bundledDirect.filter(p => !sources.has(p.source)), ...remote];
}

// All published_animals rows, page by page. The server may cap a page below `limit` (PostgREST
// max-rows), so a short page is not the end: only an empty page is. Any failed page throws, so the
// caller keeps its bundled copy instead of replacing sources with a partial list.
async function fetchPublishedRows(url, key, fetchImpl, limit = 1000) {
  const rows = [];
  for (;;) {
    const res = await fetchImpl(`${url}/rest/v1/published_animals?select=*&order=animal_id&limit=${limit}&offset=${rows.length}`,
      { headers: { apikey: key } });
    if (!res.ok) throw new Error(`published_animals ${res.status}`);
    const page = await res.json();
    if (!Array.isArray(page)) throw new Error('published_animals: unexpected response');
    if (!page.length) return rows;
    rows.push(...page);
  }
}

// Sources whose terms forbid using their content. Their rows stay hidden even if the server or an
// old globok.lt copy still has them (the server copy must be removed in the database by the owner).
const BLOCKED = { sources: new Set(['mazijausmai']), shelters: new Set(['mazijausmailt']) };
const withoutBlocked = pets => pets.filter(p => !BLOCKED.sources.has(p.source) && !BLOCKED.shelters.has(p.shelter?.id));

module.exports = { SHELTER, BRANCHES, shelterResolver, toAppPet, fromRemote, fetchPublishedRows, withoutBlocked };
