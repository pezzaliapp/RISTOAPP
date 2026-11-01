// ============================================================
//  RISTOAPP - Scarica da OpenStreetMap (Overpass) i locali delle
//  citta' preset e li salva in data/osm/*.json.
//  Gira su GitHub Actions (vedi .github/workflows/update-osm.yml):
//  cosi' i telefoni leggono i dati dal sito stesso dell'app e non
//  dipendono dai server Overpass pubblici.
//
//  Uso locale:  node scripts/build-osm.mjs
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'data', 'osm');

// Legge la configurazione da js/data.js (unica fonte della lista citta')
function loadConfig() {
  const code = fs.readFileSync(path.join(ROOT, 'js', 'data.js'), 'utf8');
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return ctx.window.RISTOAPP_CONFIG;
}

const CFG = loadConfig();
const BIG_CITIES = new Set(['Roma', 'Milano', 'Napoli', 'Torino', 'Bologna', 'Firenze', 'Bari']);
const AMENITIES = 'restaurant|fast_food|pub|bar|cafe|biergarten|food_court|ice_cream';
const UA = 'RistoApp/3 (+https://github.com/pezzaliapp/RISTOAPP)';

export function slugify(name) {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function coverRadius(city) {
  return BIG_CITIES.has(city.name) ? 5000 : 10000;
}

function buildQuery(lat, lng, radius) {
  return `[out:json][timeout:90];
nwr["amenity"~"^(${AMENITIES})$"]["name"](around:${radius},${lat},${lng});
out center tags qt;`;
}

// Stessa forma prodotta da normalizeElement() in js/app.js
export function normalizeElement(el) {
  const tags = el.tags || {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (!lat || !lng || !tags.name) return null;
  const addressParts = [
    [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' '),
    [tags['addr:postcode'], tags['addr:city']].filter(Boolean).join(' '),
  ].filter(Boolean);
  const payments = Object.keys(tags)
    .filter(k => k.startsWith('payment:') && tags[k] === 'yes')
    .map(k => k.replace('payment:', ''));
  return {
    id: el.type + '/' + el.id,
    name: tags.name,
    amenity: tags.amenity,
    cuisine: tags.cuisine || '',
    lat: +lat.toFixed(6), lng: +lng.toFixed(6),
    address: addressParts.join(', ') || '',
    phone: tags.phone || tags['contact:phone'] || '',
    website: tags.website || tags['contact:website'] || '',
    facebook: tags['contact:facebook'] || '',
    instagram: tags['contact:instagram'] || '',
    opening_hours: tags.opening_hours || '',
    takeaway: tags.takeaway || '',
    delivery: tags.delivery || '',
    outdoor_seating: tags.outdoor_seating || '',
    wheelchair: tags.wheelchair || '',
    vegetarian: tags['diet:vegetarian'] || '',
    vegan: tags['diet:vegan'] || '',
    gluten_free: tags['diet:gluten_free'] || '',
    payments,
    rawTags: tags,
  };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function overpass(query) {
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const endpoint of CFG.overpassEndpoints) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 120000);
        const resp = await fetch(endpoint, {
          method: 'POST',
          body: 'data=' + encodeURIComponent(query),
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
          signal: ctrl.signal,
        }).finally(() => clearTimeout(t));
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json();
        if (!Array.isArray(json.elements)) throw new Error('risposta non valida');
        if (json.remark && /timeout|runtime error/i.test(json.remark)) throw new Error(json.remark);
        return json;
      } catch (e) {
        lastErr = e;
        console.warn(`  ${endpoint}: ${e.message}`);
      }
    }
    await sleep(15000 * (attempt + 1));
  }
  throw lastErr;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const indexPath = path.join(OUT_DIR, 'index.json');
  let oldIndex = { cities: [] };
  try { oldIndex = JSON.parse(fs.readFileSync(indexPath, 'utf8')); } catch {}

  const index = { generated: new Date().toISOString(), cities: [] };
  let failures = 0;

  for (const city of CFG.cities) {
    const slug = slugify(city.name);
    const radius = coverRadius(city);
    const file = `${slug}.json`;
    process.stdout.write(`${city.name} (${radius / 1000} km)... `);
    try {
      const json = await overpass(buildQuery(city.lat, city.lng, radius));
      const items = json.elements.map(normalizeElement).filter(Boolean);
      const seen = new Set();
      const unique = items.filter(i => !seen.has(i.id) && seen.add(i.id));
      unique.sort((a, b) => a.id.localeCompare(b.id));
      fs.writeFileSync(path.join(OUT_DIR, file), JSON.stringify({ name: city.name, lat: city.lat, lng: city.lng, radius, items: unique }));
      index.cities.push({ name: city.name, slug, file, lat: city.lat, lng: city.lng, radius, count: unique.length, updated: index.generated });
      console.log(`${unique.length} locali`);
    } catch (e) {
      failures++;
      console.log(`ERRORE (${e.message}) - tengo i dati precedenti`);
      const prev = oldIndex.cities.find(c => c.slug === slug);
      if (prev && fs.existsSync(path.join(OUT_DIR, prev.file))) index.cities.push(prev);
    }
    await sleep(5000); // gentilezza verso i server pubblici
  }

  fs.writeFileSync(indexPath, JSON.stringify(index, null, 1));
  console.log(`Fatto: ${index.cities.length} citta' disponibili, ${failures} errori.`);
  if (!index.cities.length) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
