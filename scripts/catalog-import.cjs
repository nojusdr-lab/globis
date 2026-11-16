const { listingId, statusFromText, validateImport } = require('../src/data/integrity.cjs');

// Offline contract. The counts/page numbers must come from source evidence supplied
// by a future verified adapter, never inferred from the number of parsed rows.
function validateCatalog({ decision, now, catalogId, total, pageSize, pages, shelters }, previous) {
  if (decision?.source !== 'globok' || decision.state !== 'approved' ||
      !Number.isSafeInteger(now) || !Number.isSafeInteger(decision.expiresAt) ||
      decision.expiresAt <= now || typeof decision.evidence !== 'string' || !decision.evidence.trim()) {
    throw Error('Source access not verified');
  }
  if (typeof catalogId !== 'string' || !catalogId.trim() || !Number.isSafeInteger(total) ||
      total < 1 || total > 100000 || !Number.isSafeInteger(pageSize) || pageSize < 1 ||
      !Array.isArray(pages) || pages.length !== Math.ceil(total/pageSize) || !Array.isArray(shelters)) {
    throw Error('Missing or inconsistent catalog pagination');
  }
  const priorById = new Map(previous.pets.map(pet => [pet.id, pet]));
  const ids = new Set();
  const pets = [];
  for (const [index,page] of pages.entries()) {
    const current = index+1;
    const next = current < pages.length ? current+1 : null;
    if (page?.httpStatus !== 200 || page.error) throw Error('Catalog transport failed');
    if (!Number.isSafeInteger(page.observedAt) || page.observedAt < 0 ||
        page.observedAt > now || page.observedAt > 8.64e15) {
      throw Error('Invalid catalog page observation time');
    }
    if (page.number !== current || page.next !== next || page.catalogId !== catalogId ||
        page.total !== total || !Array.isArray(page.listings) ||
        page.listings.length !== Math.min(pageSize,total-index*pageSize)) {
      throw Error('Partial, repeated or inconsistent catalog page');
    }
    const observedAt = new Date(page.observedAt).toISOString();
    for (const listing of page.listings) {
      const id = listingId(listing.url);
      if ((listing.id != null && listing.id !== id) || ids.has(id)) throw Error('Duplicate or mismatched listing ID');
      if (typeof listing.name !== 'string' || !listing.name.trim() ||
          !['dog','cat'].includes(listing.species) || typeof listing.shelterId !== 'string' ||
          (listing.statusText != null && typeof listing.statusText !== 'string')) throw Error('Invalid listing fields');
      const prior = priorById.get(id);
      const priorObservedAt = Date.parse(prior?.observedAt);
      if (priorObservedAt > page.observedAt) {
        throw Error('Catalog observation would move backwards');
      }
      const status = statusFromText(listing.statusText);
      if (priorObservedAt === page.observedAt &&
          (prior.status !== status.status || prior.statusEvidence !== status.statusEvidence)) {
        throw Error('Conflicting reservation evidence for the same observation');
      }
      ids.add(id);
      pets.push({id,source:'globok',url:listing.url,name:listing.name,species:listing.species,
        shelter:{id:listing.shelterId},observedAt,...status});
    }
  }
  validateImport(pets,shelters,previous.pets,previous.shelters);
  return {pets,shelters};
}

module.exports = { validateCatalog };
