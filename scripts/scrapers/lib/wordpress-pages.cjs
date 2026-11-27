'use strict';
// WordPress documents X-WP-Total / X-WP-TotalPages and uses one specific
// error code for an out-of-range post page. A generic HTTP 400 is a failure.
// https://developer.wordpress.org/rest-api/using-the-rest-api/pagination/
async function readWordpressPages(fetcher, makeUrl, { perPage = 100, maxPages = 30 } = {}) {
  if (!Number.isSafeInteger(perPage) || perPage < 1 || !Number.isSafeInteger(maxPages) || maxPages < 1) {
    throw Error('WordPress pagination requires positive page size and limit');
  }
  const items = [], seen = new Set();
  let total, pages, stable = true;
  for (let page = 1; page <= maxPages; page++) {
    let res;
    try { res = await fetcher.getJson(makeUrl(page)); }
    catch (error) {
      if (page > 1 && error.status === 400 && error.responseCode === 'rest_post_invalid_page_number') {
        return { items, complete: stable && (pages == null || page > pages) && (total == null || items.length === total) };
      }
      throw error;
    }
    if (!Array.isArray(res.json)) throw Error(`Expected WordPress collection array: ${res.url}`);
    for (const [key, previous] of [['wpTotal', total], ['wpTotalPages', pages]]) {
      const value = res[key];
      if (value == null) continue;
      if (!Number.isSafeInteger(value) || value < 0) throw Error(`Invalid WordPress ${key}`);
      if (previous != null && value !== previous) stable = false;
    }
    if (res.wpTotal != null) total = res.wpTotal;
    if (res.wpTotalPages != null) pages = res.wpTotalPages;
    for (const row of res.json) {
      if (row?.id != null) {
        const id = String(row.id);
        if (seen.has(id)) stable = false; // shifted/repeated pages cannot prove a complete snapshot
        seen.add(id);
      }
      items.push(row);
    }
    const noHints = total == null && pages == null;
    if (!res.json.length || (pages != null && page >= pages) || (total != null && items.length >= total) ||
        (noHints && res.json.length < perPage)) {
      const countMatches = total == null || items.length === total;
      const pageMatches = pages == null || (pages === 0 ? page === 1 && !items.length : page === pages);
      const nonemptyDeclaredPage = pages == null || pages === 0 || res.json.length > 0;
      return { items, complete: stable && countMatches && pageMatches && nonemptyDeclaredPage };
    }
  }
  return { items, complete: false };
}

module.exports = { readWordpressPages };
