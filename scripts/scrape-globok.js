// Scraper for globok.lt: 37 Lithuanian shelters & all ~1,073 rescue animals
const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_URL = 'https://globok.lt';
const { listingId, statusFromText, phone, email, validateImport } = require('../src/data/integrity.cjs');
const DELAY_MS = 200;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'lt,en-US;q=0.7,en;q=0.3',
        },
      },
      (res) => {
        if (res.statusCode !== 200 || !/^text\/html\b/i.test(res.headers['content-type'] || '')) {
          res.resume();
          reject(new Error(`Unexpected HTTP response ${res.statusCode} for ${url}`));
          return;
        }
        let data = '';
        res.on('error', reject);
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data));
      }
    );
    req.on('error', (err) => reject(err));
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}

function decodeHtml(html) {
  if (!html) return '';
  return html
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

async function scrapeShelters() {
  console.log('\n🐾 [1/4] Fetching all 37 shelters from https://globok.lt/prieglaudos...');
  const html = await fetchHtml(`${BASE_URL}/prieglaudos`);

  const cardRegex = /<a class="group[^"]*" href="(\/prieglaudos\/[^"]+)">([\s\S]*?)<\/a>/g;
  let match;
  const shelters = [];

  while ((match = cardRegex.exec(html)) !== null) {
    const slug = match[1].replace('/prieglaudos/', '').trim();
    const inner = match[2];

    const nameMatch = inner.match(/<h3[^>]*>(.*?)<\/h3>/);
    const name = nameMatch ? decodeHtml(nameMatch[1].replace(/<[^>]+>/g, '')) : null;

    const cityMatch = inner.match(/<span[^>]*>[\s\S]*?<\/svg>(.*?)<\/span>/);
    const city = cityMatch ? decodeHtml(cityMatch[1].replace(/<[^>]+>/g, '')) : null;

    const addressMatch = inner.match(/<p class="[^"]*text-stone-400[^"]*">(.*?)<\/p>/);
    const address = addressMatch ? decodeHtml(addressMatch[1].replace(/<[^>]+>/g, '')) : null;

    const countMatch = inner.match(/(\d+)\s*gyvūn/);
    const count = countMatch ? parseInt(countMatch[1], 10) : null;

    const logoMatch = inner.match(/src="([^"]+)"/);
    const logo = logoMatch
      ? logoMatch[1].startsWith('http')
        ? logoMatch[1]
        : BASE_URL + logoMatch[1]
      : null;

    shelters.push({
      id: slug,
      slug,
      name,
      city,
      address,
      sourceReportedCount: count,
      logo,
      url: `${BASE_URL}/prieglaudos/${slug}`,
      phone: '',
      email: '',
      website: '',
      dogsCount: 0,
      catsCount: 0,
    });
  }

  console.log(`✅ Found ${shelters.length} shelters on directory page.`);

  // Enrich shelter contact info from individual shelter pages
  console.log('\n📞 [2/4] Visiting all 37 shelter detail pages for contact info...');
  for (let i = 0; i < shelters.length; i++) {
    const s = shelters[i];
    try {
      await sleep(150);
      const sHtml = await fetchHtml(s.url);

      const phoneMatch = sHtml.match(/tel:([^"\s>]+)/);
      if (phoneMatch) s.phone = decodeURIComponent(phoneMatch[1]);

      const emailMatch = sHtml.match(/mailto:([^"\s>]+)/);
      if (emailMatch) s.email = decodeURIComponent(emailMatch[1]);

      const jsonLdMatch = sHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      if (jsonLdMatch) {
        try {
          const ld = JSON.parse(jsonLdMatch[1]);
          const shelterObj = Array.isArray(ld) ? ld[0] : ld;
          if (shelterObj) {
            if (shelterObj.telephone && !s.phone) s.phone = shelterObj.telephone;
            if (shelterObj.email && !s.email) s.email = shelterObj.email;
            if (shelterObj.sameAs) s.website = shelterObj.sameAs;
            if (shelterObj.address?.streetAddress && !s.address) {
              s.address = shelterObj.address.streetAddress;
            }
          }
        } catch (e) {}
      }

      s.phone = phone(s.phone);
      s.email = email(s.email?.split('?')[0]);
      s.website = [s.website].flat().find(value => typeof value === 'string' && /^https?:\/\//i.test(value)) || null;
      s.source = 'globok';
      s.fetchedAt = new Date().toISOString();
      process.stdout.write(
        `   [${i + 1}/${shelters.length}] ${s.name} (${s.city}) - Tel: ${s.phone}\n`
      );
    } catch (err) {
      throw new Error(`Shelter ${s.slug}: ${err.message}`);
    }
  }

  return shelters;
}

async function scrapeAllAnimals(sheltersMap) {
  console.log('\n🐶🐱 [3/4] Fetching animal listing pages...');
  const allCards = [];
  const seenUrls = new Set();

  for (let page = 1; page <= 100; page++) {
    try {
      await sleep(DELAY_MS);
      const url = `${BASE_URL}/gyvunai?page=${page}`;
      const pageHtml = await fetchHtml(url);

      const cards = pageHtml.split('<div class="relative rounded-2xl border border-stone-200 overflow-hidden bg-white card-hover">').slice(1);
      const pageCardCount = cards.length;
      const beforePage = allCards.length;

      for (const cardHtml of cards) {
        // Animal link & slug
        const linkMatch = cardHtml.match(/href="(\/gyvunai\/[a-z0-9\-]+)"/);
        if (!linkMatch) throw new Error('Unrecognized animal card');
        const petUrl = BASE_URL + linkMatch[1];
        if (seenUrls.has(petUrl)) continue;
        seenUrls.add(petUrl);

        // Name
        const nameMatch = cardHtml.match(/<a[^>]*data-umami-event="animal-open"[^>]*>([\s\S]*?)<\/a>/);
        const name = nameMatch ? decodeHtml(nameMatch[1].replace(/<[^>]+>/g, '').trim()) : null;

        // Species
        const speciesMatch = cardHtml.match(/data-umami-event-species="(dog|cat)"/);
        const species = speciesMatch ? speciesMatch[1] : null;

        // Shelter slug
        const shelterSlugMatch = cardHtml.match(/data-umami-event-shelter="([^"]+)"/);
        const shelterSlug = shelterSlugMatch ? shelterSlugMatch[1] : null;

        // Photo URL
        const imgMatch = cardHtml.match(/srcSet="([^"]+)"/) || cardHtml.match(/src="([^"]+)"/);
        let photo = '';
        if (imgMatch) {
          const rawUrl = imgMatch[1].split(' ')[0];
          const queryUrl = rawUrl.match(/url=([^&]+)/);
          if (queryUrl) {
            photo = decodeURIComponent(queryUrl[1]);
            if (!photo.startsWith('http')) photo = BASE_URL + photo;
          } else {
            photo = rawUrl.startsWith('http') ? rawUrl : BASE_URL + rawUrl;
          }
        }

        // Tags inside card (Sex, Age, Size)
        const badgeMatches = cardHtml.match(/<span class="badge-pop[^"]*"[^>]*>(.*?)<\/span>/g) || [];
        const badges = badgeMatches.map((b) => decodeHtml(b.replace(/<[^>]+>/g, '').trim()));

        const shelter = sheltersMap[shelterSlug];
        if (!name || !species || !shelter) throw new Error(`Incomplete card: ${petUrl}`);
        const age = badges.find(value => /^\d+\s*(?:m\.|mėn\.)$/u.test(value)) || null;
        allCards.push({
          id: listingId(petUrl),
          slug: linkMatch[1].split('/').pop(),
          url: petUrl,
          source: 'globok',
          name,
          species,
          sex: badges.find(value => ['Patinas', 'Patelė'].includes(value)) || null,
          ageLt: age,
          ageEn: age?.replace('mėn.', 'mos').replace('m.', 'yrs') || null,
          size: badges.find(value => ['Mažas', 'Vidutinis', 'Didelis'].includes(value)) || null,
          city: shelter.city,
          photos: photo ? [photo] : [],
          waitingDays: null,
          medical: { chipped: null, vaccinated: null, neutered: null },
          compatibilityTagsLt: [],
          compatibilityTagsEn: [],
          personalityTraitsLt: [],
          personalityTraitsEn: [],
          shelter: { id: shelter.id, name: shelter.name, city: shelter.city, address: shelter.address,
            phone: shelter.phone, email: shelter.email, website: shelter.website, url: shelter.url },
          bioLt: null,
          bioEn: null,
          ...statusFromText(badges.join('\n')),
        });

      }

      const markers = pageHtml.match(/class="relative rounded-2xl border border-stone-200 overflow-hidden bg-white card-hover"/g) || [];
      const nextPage = pageHtml.match(/aria-label="Kitas puslapis"[^>]*>\s*<a[^>]*href="\/gyvunai\?page=(\d+)#results"/);
      if (allCards.length === beforePage || markers.length !== pageCardCount) {
        throw new Error('Empty, duplicated or incompletely parsed listing page');
      }
      if (!nextPage) {
        if (/aria-label="Kitas puslapis"/.test(pageHtml) || pageCardCount >= 24) {
          throw new Error('Cannot verify end of listing pagination');
        }
        break;
      }
      if (Number(nextPage[1]) !== page + 1 || page === 100) throw new Error('Unexpected pagination');
    } catch (err) {
      throw new Error(`Listing page ${page}: ${err.message}`);
    }
  }

  for (const pet of allCards) {
    await sleep(DELAY_MS);
    const detail = await fetchHtml(pet.url);
    const description = detail.match(/<div class="[^"]*whitespace-pre-line[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    const bio = description ? decodeHtml(description[1].replace(/<[^>]+>/g, ' ')) : null;
    if (!description && !detail.includes(pet.slug)) throw new Error(`Unrecognized detail page: ${pet.url}`);
    const status = statusFromText(bio);
    if (status.status === 'reserved') Object.assign(pet, status);
    Object.assign(pet, { bioLt: bio || null, fetchedAt: new Date().toISOString() });
  }

  return allCards;
}

async function main() {
  console.log('🚀 Starting Globok.lt Scraper...');

  // Step 1 & 2: Shelters
  const shelters = await scrapeShelters();
  const sheltersMap = {};
  shelters.forEach((s) => {
    sheltersMap[s.slug] = s;
  });

  // Step 3 & 4: Animals
  const allPets = await scrapeAllAnimals(sheltersMap);

  const target = path.join(__dirname, '..', 'src', 'data');
  const previousPets = require('../src/data/allPets.json');
  const previousShelters = require('../src/data/shelters.json');
  validateImport(allPets, shelters, previousPets, previousShelters);
  console.log(`Animals: ${previousPets.length} → ${allPets.length}. Shelters: ${previousShelters.length} → ${shelters.length}. Reserved: ${allPets.filter(p => p.status === 'reserved').length}.`);
  if (process.argv.includes('--check')) return;
  for (const [name, rows] of [['shelters.json', shelters], ['allPets.json', allPets]]) {
    const file = path.join(target, name);
    fs.writeFileSync(file + '.tmp', JSON.stringify(rows, null, 2) + '\n');
  }
  for (const name of ['shelters.json', 'allPets.json']) {
    const file = path.join(target, name);
    fs.renameSync(file + '.tmp', file);
  }

}

main().catch((err) => {
  console.error('❌ Scraper error:', err);
  process.exit(1);
});
