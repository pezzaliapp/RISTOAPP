/* ============================================================
 *  RISTOAPP - Logica applicazione (v2: OSM + deep linking)
 *
 *  - Ristoranti reali da OpenStreetMap via Overpass API
 *  - Geocoding libero via Nominatim (cerca qualsiasi localit\u00E0)
 *  - Deep link a JustEat, Deliveroo, TheFork, Glovo, Google Maps
 *  - Nessun database di prezzi: l'utente vede i prezzi sui portali
 * ============================================================ */

(() => {
  const CFG = window.RISTOAPP_CONFIG;
  const I18N = window.I18N;
  const t = (k, p) => I18N.t(k, p);
  const Trust = window.RistoTrust;

  // Errore con chiave di traduzione: il messaggio si ritraduce al cambio lingua
  function i18nError(key, params) {
    const e = new Error(t(key, params));
    e.i18nKey = key; e.i18nParams = params;
    return e;
  }
  const msgText = m => (m && typeof m === 'object') ? t(m.key, m.params) : (m || '');

  // Stato ---------------------------------------------------
  const state = {
    query: '',            // piatto o tipo cucina digitato
    cityName: 'Civitanova Marche',
    origin: { lat: 43.3065, lng: 13.7231 },  // punto di ricerca
    userPos: null,
    amenityFilter: 'all', // 'all' | 'restaurant' | 'fast_food' | 'cafe' | 'bar' | 'pub'
    radius: CFG.defaultRadius,
    sort: 'distance',     // 'distance' | 'name' | 'open'
    restaurants: [],      // risultati caricati
    loading: false,
    error: null,
    warning: null,
    lodgingRadius: null,
    lodgingType: 'all',   // 'all' | 'bnb' | 'agri' | 'hotel' | 'apartment' | 'hostel'
  };

  // Util DOM ------------------------------------------------
  const $ = (s, r = document) => r.querySelector(s);

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function normalize(str) {
    return (str || '').toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .replace(/['\u2018\u2019]/g,'').trim();
  }

  function haversine(a, b) {
    if (!a || !b) return null;
    const R = 6371, toRad = x => x * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
    const la1 = toRad(a.lat), la2 = toRad(b.lat);
    const h = Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  // -------------- CITY PRESETS ----------------------------
  function renderCityDatalist() {
    const dl = $('#cityOptions');
    dl.innerHTML = CFG.cities.map(c => `<option value="${escapeHtml(c.name)}"></option>`).join('');
    // Imposta city di default
    $('#cityInput').value = state.cityName;
  }

  // -------------- GEOCODING -------------------------------
  // 1) citta' preset  2) localita' italiane salvate sul sito (data/places)
  // 3) solo come ultima risorsa Nominatim (OSM in diretta).
  const placesCache = {};
  function loadPlacesBucket(letter) {
    if (!placesCache[letter]) {
      placesCache[letter] = fetch(`./data/places/${letter}.json`)
        .then(r => r.ok ? r.json() : [])
        .catch(() => { delete placesCache[letter]; return null; });
    }
    return placesCache[letter];
  }

  async function findPlaceLocal(cityName) {
    const q = normalize(cityName.split(',')[0]);
    if (!q) return null;
    const c = q[0];
    const letter = c >= 'a' && c <= 'z' ? c : '_';
    const list = await loadPlacesBucket(letter);
    if (!list || !list.length) return null;
    // [nome, lat, lng, rango(1=citta'...5=frazione), provincia?]
    const byRank = (a, b) => a[3] - b[3];
    const exact = list.filter(p => normalize(p[0]) === q).sort(byRank);
    const prefix = exact.length ? [] : list.filter(p => normalize(p[0]).startsWith(q)).sort(byRank);
    const best = exact[0] || prefix[0];
    return best ? { lat: best[1], lng: best[2], name: best[0] } : null;
  }

  async function resolveCity(cityName) {
    const norm = normalize(cityName);
    const preset = CFG.cities.find(c => normalize(c.name) === norm);
    if (preset) return { lat: preset.lat, lng: preset.lng, name: preset.name };

    const local = await findPlaceLocal(cityName);
    if (local) return local;

    // Nominatim (ultima risorsa)
    try {
      const url = `${CFG.nominatimEndpoint}?q=${encodeURIComponent(cityName + ', Italia')}&format=json&limit=1&countrycodes=it`;
      const resp = await fetchWithTimeout(url, { headers: { 'Accept': 'application/json' } }, 10000);
      if (resp.ok) {
        const arr = await resp.json();
        if (arr.length) return {
          lat: parseFloat(arr[0].lat),
          lng: parseFloat(arr[0].lon),
          name: arr[0].display_name.split(',')[0] || cityName,
        };
      }
    } catch {}
    throw i18nError('err.cityNotFound', { city: cityName });
  }

  // -------------- OVERPASS --------------------------------
  function buildOverpassQuery(lat, lng, radius) {
    const amenities = 'restaurant|fast_food|pub|bar|cafe|biergarten|food_court|ice_cream';
    const around = `(around:${radius},${lat.toFixed(5)},${lng.toFixed(5)})`;
    return `[out:json][timeout:20];
(nwr["amenity"~"^(${amenities})$"]["name"]${around};nwr["tourism"~"^(guest_house|hotel|motel|hostel|apartment|chalet)$"]["name"]${around};);
out center tags qt;`;
  }

  // ---- Cache locale dei risultati OSM (riduce le query ai server pubblici)
  function osmCacheKey(lat, lng, radius) {
    return `ristoapp-osm:${lat.toFixed(3)},${lng.toFixed(3)},${radius}`;
  }
  function osmCacheGet(key, allowStale = false) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const { t, data } = JSON.parse(raw);
      if (!allowStale && Date.now() - t > CFG.osmCacheTtlMs) return null;
      return data;
    } catch { return null; }
  }
  function osmCacheSet(key, data) {
    try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), data })); }
    catch {
      // Storage pieno: elimina le vecchie cache OSM e riprova una volta
      try {
        Object.keys(localStorage).filter(k => k.startsWith('ristoapp-osm:'))
          .forEach(k => localStorage.removeItem(k));
        localStorage.setItem(key, JSON.stringify({ t: Date.now(), data }));
      } catch {}
    }
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function fetchWithTimeout(url, opts, ms) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
    finally { clearTimeout(timer); }
  }

  async function fetchOverpass(query) {
    // Due giri su tutti i server, con pausa tra un giro e l'altro:
    // i server pubblici rispondono spesso 429/504 quando sono carichi
    // (e in quel caso il browser mostra solo "Failed to fetch").
    let lastErr = null;
    for (let round = 0; round < 2; round++) {
      if (round > 0) await sleep(3000);
      for (const endpoint of CFG.overpassEndpoints) {
        try {
          const resp = await fetchWithTimeout(endpoint, {
            method: 'POST',
            body: 'data=' + encodeURIComponent(query),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          }, CFG.overpassTimeoutMs || 20000);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const json = await resp.json();
          if (!json || !Array.isArray(json.elements)) throw new Error(t('err.badResponse'));
          // Overpass a volte risponde 200 ma con "remark" di timeout e 0 elementi
          if (!json.elements.length && json.remark && /timeout|runtime error/i.test(json.remark)) {
            throw new Error('Timeout server');
          }
          return json;
        } catch (e) {
          lastErr = e.name === 'AbortError' ? new Error('timeout') : e;
          console.warn('Overpass KO:', endpoint, lastErr.message);
        }
      }
    }
    throw i18nError('err.overpass', { detail: lastErr?.message || t('err.network') });
  }

  // ---- Dati di TUTTA ITALIA pre-scaricati da GitHub Actions (data/tiles/),
  // in quadranti da 0.1 gradi. Stanno sullo stesso sito dell'app: nessuna
  // rete o operatore li blocca e non dipendono dai server OSM pubblici.
  let tileIndexPromise = null;
  const tileCache = {};

  function loadTileIndex() {
    if (!tileIndexPromise) {
      tileIndexPromise = fetch('./data/tiles/index.json', { cache: 'no-cache' })
        .then(r => r.ok ? r.json() : null)
        .catch(() => null)
        .then(idx => { if (!idx) tileIndexPromise = null; return idx; });
    }
    return tileIndexPromise;
  }

  function loadTile(key) {
    if (!tileCache[key]) {
      tileCache[key] = fetch(`./data/tiles/${key}.json`)
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .catch(e => { delete tileCache[key]; throw e; });
    }
    return tileCache[key];
  }

  const EMPTY_FIELDS = ['cuisine','address','phone','website','facebook','instagram',
    'opening_hours','takeaway','delivery','outdoor_seating','wheelchair',
    'vegetarian','vegan','gluten_free'];
  function expandItem(r) {
    const out = { ...r };
    EMPTY_FIELDS.forEach(k => { if (out[k] == null) out[k] = ''; });
    if (!out.payments) out.payments = [];
    out.rawTags = { name: out.name, amenity: out.amenity, ...(out.rawTags || {}) };
    return out;
  }

  // Restituisce i dati dei quadranti che coprono il cerchio, oppure null
  // se la zona e' fuori dall'Italia o i dati non sono (ancora) pubblicati.
  // Chiavi dei quadranti che coprono il cerchio; null se fuori Italia
  function tileKeysAround(idx, origin, radius) {
    const T = idx.tile || 10;
    const dLat = radius / 111320;
    const dLng = radius / (111320 * Math.cos(origin.lat * Math.PI / 180));
    const [la0, lo0, la1, lo1] = idx.bbox;
    const a0 = Math.floor((origin.lat - dLat) * T), a1 = Math.floor((origin.lat + dLat) * T);
    const b0 = Math.floor((origin.lng - dLng) * T), b1 = Math.floor((origin.lng + dLng) * T);
    if (a1 < la0 || a0 > la1 || b1 < lo0 || b0 > lo1) return null;
    const keys = [];
    for (let a = a0; a <= a1; a++) for (let b = b0; b <= b1; b++) keys.push(`${a}_${b}`);
    return keys;
  }

  async function loadTilesAround(origin, radius) {
    const idx = await loadTileIndex();
    if (!idx || !idx.tiles) return null;
    const all = tileKeysAround(idx, origin, radius);
    if (!all) return null; // fuori Italia
    const keys = all.filter(k => k in idx.tiles); // assenti = mare/nessun locale
    const tiles = await Promise.all(keys.map(loadTile));
    return {
      items: tiles.flatMap(t => t.items || []),
      places: tiles.flatMap(t => t.places || []),
    };
  }

  async function loadStaticRestaurants(origin, radius) {
    const data = await loadTilesAround(origin, radius);
    if (!data) return null;
    return data.items
      .filter(r => haversine(origin, r) * 1000 <= radius)
      .map(expandItem);
  }

  // ---- Parcheggi pubblici vicino a un punto (per i B&B) ---------
  const parkingCache = {};
  function loadParkingTile(key) {
    if (!parkingCache[key]) {
      parkingCache[key] = fetch(`./data/parking/${key}.json`)
        .then(r => r.ok ? r.json() : (r.status === 404 ? [] : Promise.reject(new Error('HTTP ' + r.status))))
        .catch(e => { delete parkingCache[key]; throw e; });
    }
    return parkingCache[key];
  }

  async function findParkingNear(pos) {
    let list = null;
    const idx = await loadTileIndex();
    const keys = idx && idx.bbox ? tileKeysAround(idx, pos, 1500) : null;
    if (keys) {
      const tiles = await Promise.all(keys.map(loadParkingTile));
      list = tiles.flat().map(p => ({ lat: p[0], lng: p[1], name: p[2], fee: p[3], type: p[4], capacity: p[5] }));
    } else {
      // Dati del sito non disponibili: OpenStreetMap in diretta
      const q = `[out:json][timeout:15];nwr["amenity"="parking"]["access"!~"^(private|no|customers|permit|residents)$"](around:1500,${pos.lat.toFixed(5)},${pos.lng.toFixed(5)});out center tags qt;`;
      const json = await fetchOverpass(q);
      list = json.elements.map(el => ({
        lat: el.lat ?? el.center?.lat, lng: el.lon ?? el.center?.lon,
        name: el.tags?.name || '', fee: el.tags?.fee || '', type: el.tags?.parking || '', capacity: el.tags?.capacity || '',
      })).filter(p => p.lat && p.lng);
    }
    list.forEach(p => { p.distance = haversine(pos, p) * 1000; });
    const sorted = list.filter(p => p.distance <= 1500).sort((a, b) => a.distance - b.distance);
    const near = sorted.filter(p => p.distance <= 800);
    return (near.length >= 2 ? near : sorted).slice(0, 5);
  }

  const PARKING_TYPES = ['surface', 'underground', 'multi-storey', 'street_side',
    'lane', 'rooftop', 'carports', 'garage_boxes'];

  function parkingHtml(from, list) {
    if (!list.length) return `<p style="color:var(--c-muted)">${escapeHtml(t('park.none'))}</p>`;
    return `<ul class="menu-list">${list.map(p => {
      const type = PARKING_TYPES.includes(p.type) ? t('park.type.' + p.type) : '';
      const title = p.name || (type ? t('park.titleType', { type }) : t('park.title'));
      const fee = p.fee === 'no' ? t('park.free') : p.fee === 'yes' ? t('park.paid') : t('park.feeUnknown');
      const walkMin = Math.max(1, Math.round(p.distance * 1.3 / 80));
      const dist = I18N.fmtDist(p.distance);
      const details = [p.name && type ? type : '', fee, /^\d+$/.test(p.capacity) ? t('park.spaces', { n: I18N.fmtNum(+p.capacity) }) : ''].filter(Boolean).join(' \u00B7 ');
      const nav = `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${p.lat},${p.lng}&travelmode=driving`;
      return `<li style="display:flex;justify-content:space-between;align-items:center;gap:10px">
        <span><span class="dish-name">\uD83C\uDD7F\uFE0F ${escapeHtml(title)}</span><br>
          <small style="color:var(--c-muted)">${escapeHtml(details)} \u00B7 ${escapeHtml(t('park.walk', { dist, min: walkMin }))}</small></span>
        <a class="btn-outline" style="flex:0 0 auto;width:auto;padding:6px 14px" href="${nav}" target="_blank" rel="noopener">${escapeHtml(t('park.route'))}</a>
      </li>`;
    }).join('')}</ul>`;
  }

  // Nome della zona per "Posizione": localita' piu' vicina nei dati del sito
  async function nearestPlaceName(pos) {
    const data = await loadTilesAround(pos, 6000).catch(() => null);
    if (!data || !data.places.length) return null;
    let best = null, bestScore = Infinity;
    for (const p of data.places) {
      const d = haversine(pos, { lat: p[1], lng: p[2] });
      const score = d * (p[3] <= 2 ? 0.5 : p[3] >= 5 ? 1.6 : 1); // preferisci citta'/paesi
      if (score < bestScore) { bestScore = score; best = p; }
    }
    return best ? best[0] : null;
  }

  async function loadOsmRestaurants(origin, radius) {
    try {
      const list = await loadStaticRestaurants(origin, radius);
      if (list) return { list, stale: false };
    } catch (e) {
      console.warn('Dati OSM locali non disponibili:', e);
    }

    const key = osmCacheKey(origin.lat, origin.lng, radius);
    const fresh = osmCacheGet(key);
    if (fresh) return { list: fresh, stale: false };
    try {
      const osm = await fetchOverpass(buildOverpassQuery(origin.lat, origin.lng, radius));
      const list = (osm.elements || []).map(normalizeElement).filter(Boolean);
      osmCacheSet(key, list);
      return { list, stale: false };
    } catch (e) {
      // Fallback: ultimo risultato salvato, anche se vecchio
      const old = osmCacheGet(key, true);
      if (old) return { list: old, stale: true };
      throw e;
    }
  }

  async function loadUserRestaurants(origin, radius) {
    try {
      const all = await (window.RistoStore?.allPublicRestaurants?.() || Promise.resolve([]));
      return all.filter(r => {
        const d = haversine(origin, { lat: r.lat, lng: r.lng });
        return d != null && d * 1000 <= radius;
      });
    } catch (e) {
      console.warn('Impossibile caricare ristoranti registrati:', e);
      return [];
    }
  }

  // Normalizza un elemento OSM in un oggetto ristorante coerente
  function normalizeElement(el) {
    const tags = el.tags || {};
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (!lat || !lng || !tags.name) return null;

    const addressParts = [
      [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' '),
      [tags['addr:postcode'], tags['addr:city']].filter(Boolean).join(' '),
    ].filter(Boolean);

    // Tag pagamenti (OSM usa payment:* tags)
    const paymentTags = Object.keys(tags).filter(k => k.startsWith('payment:') && tags[k] === 'yes');
    const payments = paymentTags.map(k => k.replace('payment:', ''));

    return {
      id: el.type + '/' + el.id,
      name: tags.name,
      amenity: CFG.amenityLabels[tags.amenity] ? tags.amenity : (TOURISM_TO_LODGING[tags.tourism] || tags.amenity),
      cuisine: tags.cuisine || '',
      lat, lng,
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

  // -------------- RICERCA / FILTRI ------------------------
  // ---- Alloggi (B&B, agriturismi, hotel, case vacanze, ostelli)
  const LODGING = new Set(['guest_house', 'hotel', 'apartment', 'hostel']);
  const TOURISM_TO_LODGING = { guest_house: 'guest_house', hotel: 'hotel', motel: 'hotel',
    hostel: 'hostel', apartment: 'apartment', chalet: 'apartment' };
  const isLodging = r => LODGING.has(r.amenity);
  const lodgingMode = () => state.amenityFilter === 'lodging' || isLodgingQuery(state.query);
  const LODGING_MIN = 5, LODGING_MAX_RADIUS = 15000;

  // Sottotipo: 'bnb' | 'agri' | 'hotel' | 'apartment' | 'hostel'
  function lodgingKind(r) {
    if (!isLodging(r)) return null;
    const name = r.name || '', kind = (r.rawTags && r.rawTags.guest_house) || '';
    if (r.type === 'Agriturismo' || /agritur/i.test(name) || /agri/i.test(kind)) return 'agri';
    if (r.amenity === 'guest_house') return 'bnb';
    return r.amenity;
  }

  function lodgingLabel(r) {
    if (r.type) return I18N.typeLabel(r.type);
    const k = lodgingKind(r), name = r.name || '', kind = (r.rawTags && r.rawTags.guest_house) || '';
    if (k === 'agri') return t('type.agri');
    if (k === 'bnb') {
      return (kind === 'bed_and_breakfast' || /\bb ?& ?b\b|\bbnb\b|bed/i.test(name) || !kind) ? t('type.bnb') : t('type.rooms');
    }
    return CFG.amenityLabels[r.amenity] ? I18N.amenityLabel(r.amenity) : t('type.lodging');
  }

  // Sottotipo richiesto: dalla ricerca ("b&b", "hotel"...) o dal filtro
  // Parole in it/en/es/de/fr a parole intere; il giapponese (senza spazi)
  // si confronta come sottostringa.
  const word = src => new RegExp('(^|\\s)(' + src + ')(?=\\s|$)', 'i');
  const KIND_RES = {
    bnb: [word('b ?& ?b|bnb|b and b|bed|breakfast|affittacamer\\w*|chambres? d.?h[o\u00F4]tes?|g[a\u00E4]stezimmer'),
          /(?<!\u8FB2\u5BB6)\u6C11\u5BBF/],                                   // 民宿 (non 農家民宿)
    agri: [word('agriturism\\w*|agroturism\\w*|agritourisme?s?|farm ?stays?|farmhouses?|ferienh[o\u00F6]fe?|bauernh[o\u00F6]fe?|fermes?(-| )auberges?'),
           /\u30A2\u30B0\u30EA\u30C4\u30FC\u30EA\u30BA\u30E2|\u8FB2\u5BB6\u6C11\u5BBF|\u8FB2\u6CCA/], // アグリツーリズモ 農家民宿 農泊
    hotel: [word('h[o\u00F4]tel\\w*|alberg\\w*|hostal\\w*'),
            /\u30DB\u30C6\u30EB|\u65C5\u9928/],                                // ホテル 旅館
    apartment: [word('casa vacanze|case vacanze|appartament\\w*|apartments?|apartamentos?|appartements?|holiday (homes?|rentals?|lets?|apartments?)|vacation rentals?|casas? (vacacional(es)?|rurales?)|ferienwohnung\\w*|ferienh[a\u00E4]us\\w*|g[i\u00EE]tes?|locations? de vacances'),
                /\u8CB8\u5225\u8358|\u30D0\u30B1\u30FC\u30B7\u30E7\u30F3\u30EC\u30F3\u30BF\u30EB|\u30B3\u30F3\u30C9\u30DF\u30CB\u30A2\u30E0|\u30A2\u30D1\u30FC\u30C8\u30E1\u30F3\u30C8/], // 貸別荘 バケーションレンタル コンドミニアム アパートメント
    hostel: [word('ostell\\w*|hostels?|albergues?|jugendherberge\\w*|herbergen?|auberges? de jeunesse'),
             /\u30DB\u30B9\u30C6\u30EB/],                                     // ホステル
  };
  const LODGING_GENERIC = [
    word('alloggi\\w*|dormire|pernott\\w*|guest ?houses?|camer[ae]|' +
         'accommodations?|lodgings?|places? to stay|where to stay|stay|sleep|rooms?|' +
         'alojamientos?|hospedaje|dormir|habitaci[o\u00F3]n(es)?|d[o\u00F3]nde dormir|pensi[o\u00F3]n(es)?|' +
         'unterkunft|unterk[u\u00FC]nfte|[u\u00FC]bernacht\\w*|schlafen|zimmer|pensionen|' +
         'h[e\u00E9]bergements?|logements?|o[u\u00F9] dormir|chambres?|pensions?'),
    /\u5BBF|\u30B2\u30B9\u30C8\u30CF\u30A6\u30B9|\u6CCA\u307E\u308B|\u90E8\u5C4B/,          // 宿 ゲストハウス 泊まる 部屋
  ];
  const anyRe = (list, q) => list.some(re => re.test(q));

  function kindFromQuery(q) {
    if (!q) return null;
    for (const k of ['bnb', 'agri', 'hotel', 'apartment', 'hostel']) {
      if (anyRe(KIND_RES[k], q)) return k;
    }
    return null;
  }
  const wantedKind = () => kindFromQuery(state.query) || state.lodgingType || 'all';
  const matchesKind = r => { const w = wantedKind(); return w === 'all' || lodgingKind(r) === w; };

  function isLodgingQuery(q) { return !!q && (anyRe(LODGING_GENERIC, q) || !!kindFromQuery(q)); }

  function matchesQuery(r, query) {
    if (!query) return true;
    const nq = normalize(query);

    // Ricerca generica di alloggi: tutti i B&B corrispondono
    if (isLodging(r) && isLodgingQuery(query)) return true;

    // 0) match sui piatti del menu (ristoratori registrati)
    if (r.userGenerated && Array.isArray(r.menu) && r.menu.length) {
      const found = r.menu.find(m => normalize(m.dish).includes(nq) ||
                                     nq.split(/\s+/).every(w => normalize(m.dish).includes(w)));
      if (found) { r._dishMatch = found; return true; }
    }

    // 1) match sul nome
    if (normalize(r.name).includes(nq)) return true;

    // 2) match sulla cucina (tag OSM)
    if (normalize(r.cuisine).includes(nq)) return true;

    // 3) match per parole chiave -> cuisine class
    for (const [cuisineClass, words] of cuisineKeywordsNorm()) {
      if (words.some(w => nq.includes(w))) {
        const cuisineNorm = normalize(r.cuisine);
        if (cuisineNorm.includes(cuisineClass)) return true;
        if (cuisineClass === 'pizza' && normalize(r.name).includes('pizz')) return true;
        if (cuisineClass === 'italian' && /trattoria|osteria|ristorante/i.test(r.name)) return true;
      }
    }
    return false;
  }

  let _ckNorm = null;
  function cuisineKeywordsNorm() {
    if (!_ckNorm) _ckNorm = Object.entries(CFG.cuisineKeywords)
      .map(([k, words]) => [k, words.map(normalize).filter(Boolean)]);
    return _ckNorm;
  }

  function filterAndSort(list) {
    // Azzera i match piatto della ricerca precedente
    list.forEach(r => { delete r._dishMatch; });
    let res = list.slice();

    // Filtro tipo. "Tutti" = dove mangiare; i B&B compaiono col filtro
    // B&B oppure cercando "b&b", "dormire", "affittacamere"...
    const wantsLodging = isLodgingQuery(state.query);
    if (state.amenityFilter === 'lodging' || (state.amenityFilter === 'all' && wantsLodging)) {
      res = res.filter(r => isLodging(r) && matchesKind(r));
    } else if (state.amenityFilter !== 'all') {
      res = res.filter(r => r.amenity === state.amenityFilter);
    } else {
      res = res.filter(r => !isLodging(r));
    }

    // Filtro query
    if (state.query) {
      res = res.filter(r => matchesQuery(r, state.query));
    }

    // Calcola distanza rispetto all'origin di ricerca
    res.forEach(r => {
      r.distance = haversine(state.userPos || state.origin, { lat: r.lat, lng: r.lng });
    });

    // Ordinamento
    switch (state.sort) {
      case 'distance':
        res.sort((a,b) => (a.distance ?? 9e9) - (b.distance ?? 9e9));
        break;
      case 'name':
        res.sort((a,b) => a.name.localeCompare(b.name, 'it'));
        break;
      case 'open':
        res.sort((a,b) => (b.opening_hours ? 1 : 0) - (a.opening_hours ? 1 : 0));
        break;
    }

    // In cima: alloggi verificati, poi gli altri dati dei titolari, poi OSM
    const rank = r => (r.userGenerated ? 1 : 0) + (r.userGenerated && r.verified ? 1 : 0);
    res.sort((a,b) => rank(b) - rank(a));

    return res;
  }

  // -------------- OPENING HOURS (semplificato) ------------
  // OSM usa un formato complesso. Qui interpretiamo solo i casi pi\u00F9
  // comuni e in altri casi mostriamo la stringa raw.
  function parseOpeningHoursQuick(str) {
    if (!str) return { status: 'unknown', raw: '' };
    if (/^24\/7/i.test(str.trim())) return { status: 'open', raw: str, label: t('hours.247') };
    return { status: 'unknown', raw: str, label: str };
  }

  // -------------- DEEP LINKS -------------------------------
  // "menu prezzi" -> "+menu+prezzi" (parole localizzate)
  const plusWords = key => '+' + t(key).split(/\s+/).map(encodeURIComponent).join('+');
  const bookingUrl = ss => `https://www.booking.com/searchresults.${I18N.bookingLocale()}.html?ss=${ss}`;

  function deepLinks(r) {
    const q = encodeURIComponent(r.name);
    const qWithCity = encodeURIComponent(`${r.name} ${state.cityName}`);
    const links = {
      call: r.phone ? `tel:${r.phone.replace(/\s/g,'')}` : null,
      maps: `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`,
      mapsName: `https://www.google.com/maps/search/?api=1&query=${qWithCity}`,
      website: r.website || null,
      justEat: `https://www.justeat.it/search?q=${q}`,
      deliveroo: `https://deliveroo.it/it/?searchQuery=${q}`,
      glovo: `https://glovoapp.com/it/it/?search=${q}`,
      thefork: `https://www.thefork.it/ricerca?cityName=${encodeURIComponent(state.cityName)}&searchText=${q}`,
      googleSearch: `https://www.google.com/search?q=${qWithCity}${plusWords('link.menuPrices')}`,
      googleMenu: `https://www.google.com/search?q=${qWithCity}${plusWords('link.menu')}`,
      tripadvisor: `https://www.tripadvisor.it/Search?q=${qWithCity}`,
      booking: bookingUrl(qWithCity),
      airbnb: `https://www.airbnb.it/s/${encodeURIComponent(state.cityName)}/homes`,
      googleHotel: `https://www.google.com/search?q=${qWithCity}${plusWords('link.roomPrices')}`,
    };
    return links;
  }

  // -------------- RICERCA PRINCIPALE ----------------------
  let searchSeq = 0;      // per ignorare risposte di ricerche superate
  let lastOsm = [];       // ultimi risultati OSM (per refresh rapido)

  async function search() {
    const cityInput = $('#cityInput').value.trim();
    const query = $('#queryInput').value.trim();
    if (!cityInput && !state.userPos) { toast(t('toast.needCity')); return; }

    const mySeq = ++searchSeq;
    setLoading(true);
    state.query = query;
    state.warning = null;
    try {
      // Risolvi citt\u00E0 (se non stiamo usando GPS)
      if (!state.userPos) {
        const city = await resolveCity(cityInput);
        state.origin = { lat: city.lat, lng: city.lng };
        state.cityName = city.name;
      }
      const origin = state.userPos || state.origin;

      // OSM e Firestore in parallelo
      const [osmRes, userGen] = await Promise.all([
        loadOsmRestaurants(origin, state.radius).catch(e => ({ error: e })),
        loadUserRestaurants(origin, state.radius),
      ]);
      if (mySeq !== searchSeq) return; // nel frattempo \u00E8 partita un'altra ricerca

      if (osmRes.error) {
        lastOsm = [];
        if (!userGen.length) throw osmRes.error;
        state.warning = { key: 'warn.osmUserOnly' };
      } else {
        lastOsm = osmRes.list;
        if (osmRes.stale) state.warning = { key: 'warn.osmStale' };
      }

      // Alloggi: se entro il raggio scelto sono pochi, allarga fino a 15 km
      state.lodgingRadius = null;
      const kindNeeded = wantedKind() === 'all' ? 'bnb' : wantedKind();
      const enough = [...userGen, ...lastOsm].filter(r => lodgingKind(r) === kindNeeded).length >= LODGING_MIN;
      if (!osmRes.error && lodgingMode() && state.radius < LODGING_MAX_RADIUS && !enough) {
        try {
          const wide = await loadOsmRestaurants(origin, LODGING_MAX_RADIUS);
          if (mySeq !== searchSeq) return;
          const have = new Set(lastOsm.map(r => r.id));
          lastOsm = lastOsm.concat(wide.list.filter(r => isLodging(r) && !have.has(r.id)));
          state.lodgingRadius = LODGING_MAX_RADIUS;
        } catch {}
      }

      state.restaurants = [...userGen, ...lastOsm];
      state.error = null;
    } catch (e) {
      if (mySeq !== searchSeq) return;
      state.error = e.i18nKey ? { key: e.i18nKey, params: e.i18nParams }
        : (e.message || { key: 'err.search' });
      state.restaurants = [];
    }
    setLoading(false);
    renderResults();
  }

  // Ricarica SOLO i locali registrati (Firestore), senza interrogare di
  // nuovo OpenStreetMap: usato dopo login/salvataggi del ristoratore.
  async function refreshUserRestaurants() {
    if (state.loading || state.error) return;
    const origin = state.userPos || state.origin;
    const userGen = await loadUserRestaurants(origin, state.radius);
    state.restaurants = [...userGen, ...lastOsm];
    renderResults();
  }

  function setLoading(on) {
    state.loading = on;
    $('#loading').style.display = on ? 'flex' : 'none';
    $('#searchBtn').disabled = on;
  }

  // -------------- RENDERING -------------------------------
  function renderResults() {
    const listEl = $('#results');
    const countEl = $('#resultsCount');
    const titleEl = $('#resultsTitle');

    const filtered = filterAndSort(state.restaurants);
    syncLodgingChips();

    // Titolo
    const tp = { q: escapeHtml(state.query), where: escapeHtml(state.cityName) };
    titleEl.innerHTML = state.userPos
      ? t(state.query ? 'results.titleQueryHere' : 'results.titleHere', tp)
      : t(state.query ? 'results.titleQuery' : 'results.title', tp);

    // Conteggio
    if (state.error) {
      countEl.textContent = '';
      listEl.innerHTML = `<div class="empty">
        <div class="empty-mark">${escapeHtml(t('results.errMark'))}</div>
        <p><strong>${escapeHtml(msgText(state.error))}</strong></p>
        <p>${escapeHtml(t('results.errRetry'))}</p>
      </div>`;
      return;
    }

    countEl.textContent = t(filtered.length === 1 ? 'results.count.one' : 'results.count.other',
      { n: I18N.fmtNum(filtered.length) });

    if (!filtered.length) {
      listEl.innerHTML = lodgingBannerHtml() + `<div class="empty">
        <div class="empty-mark">${escapeHtml(t('results.emptyMark'))}</div>
        <p><strong>${escapeHtml(t('results.emptyTitle'))}</strong></p>
        <p>${escapeHtml(t('results.emptyHint'))}</p>
      </div>` + ownerLineHtml();
      return;
    }

    const warnHtml = state.warning
      ? `<div class="empty" style="padding:14px 18px;margin-bottom:12px;grid-column:1/-1"><p style="margin:0">${escapeHtml(msgText(state.warning))}</p></div>`
      : '';
    listEl.innerHTML = warnHtml + lodgingBannerHtml() + filtered.map((r, idx) => cardHtml(r, idx)).join('') + ownerLineHtml();
  }

  function syncLodgingChips() {
    const box = $('#lodgingFilters');
    if (!box) return;
    box.style.display = lodgingMode() ? '' : 'none';
    const k = wantedKind();
    document.querySelectorAll('#lodgingChips .chip').forEach(c =>
      c.classList.toggle('is-active', c.dataset.lodging === k));
  }


  // Riga discreta per i titolari, DOPO gli alloggi (gli ospiti vedono prima i risultati)
  function ownerLineHtml() {
    if (!lodgingMode()) return '';
    const city = state.cityName || '';
    return `<p class="owner-line owner-line--results">${city
      ? t('ownerline.city', { city: escapeHtml(city) }) : t('ownerline.generic')}</p>`;
  }

  function lodgingBannerHtml() {
    if (!lodgingMode()) return '';
    const city = state.cityName || '';
    const km = m => I18N.fmtNum(m / 1000);
    const kind = wantedKind() === 'all' ? 'bnb' : wantedKind();
    const widened = state.lodgingRadius && state.lodgingRadius > state.radius
      ? `<p style="margin:0 0 8px"><strong>${escapeHtml(t('lodging.widened', { kind: t('kindpl.' + kind), r: km(state.radius), w: km(state.lodgingRadius) }))}</strong></p>` : '';
    const b = bookingUrl(encodeURIComponent(city));
    const a = `https://www.airbnb.it/s/${encodeURIComponent(city)}/homes`;
    return `<div class="empty" style="padding:14px 18px;margin-bottom:12px;grid-column:1/-1;text-align:left">
      ${widened}
      <p style="margin:0 0 10px">${t('lodging.portals', { city: escapeHtml(city) })}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <a class="portal-btn" href="${b}" target="_blank" rel="noopener"><span class="portal-name">Booking \u2197</span></a>
        <a class="portal-btn" href="${a}" target="_blank" rel="noopener"><span class="portal-name">Airbnb \u2197</span></a>
      </div>
    </div>`;
  }

  function cardHtml(r, idx) {
    const links = deepLinks(r);
    const oh = parseOpeningHoursQuick(r.opening_hours);
    const amenityLabel = I18N.amenityLabel(r.amenity);
    const cuisineLabel = r.cuisine
      ? r.cuisine.split(';').slice(0,3).map(c => c.trim()).join(' \u00B7 ')
      : '';
    const distTxt = (r.distance != null)
      ? I18N.fmtDist(r.distance * 1000)
      : '';

    // Tag features
    const badges = [];
    if (r.takeaway === 'yes')        badges.push(t('badge.takeaway'));
    if (r.delivery === 'yes')        badges.push(t('badge.delivery'));
    if (r.outdoor_seating === 'yes') badges.push(t('badge.outdoor'));
    if (r.wheelchair === 'yes')      badges.push(t('badge.wheelchair'));
    if (r.vegetarian === 'yes')      badges.push(t('badge.vegetarian'));
    if (r.vegan === 'yes')           badges.push(t('badge.vegan'));
    if (r.gluten_free === 'yes')     badges.push(t('badge.gluten_free'));
    const badgesHtml = badges.slice(0,4).map(b => `<span class="card-tag">${escapeHtml(b)}</span>`).join('');

    const hoursHtml = r.opening_hours
      ? `<div class="card-hours is-unknown"><span class="clock">\u25F7</span><span>${escapeHtml(oh.label)}</span></div>`
      : '';

    // Link primari: sempre Maps + chiamata se disponibile
    const callBtn = links.call
      ? `<a class="btn-outline" href="${links.call}">\u260E ${escapeHtml(t('card.call'))}</a>`
      : '';

    const isBnb = isLodging(r);
    const discount = Trust.discountOf(r, isBnb);
    // Alloggi dei titolari: "Verificato" solo se il titolare ha provato il sito
    const ownerVerified = r.userGenerated && (!isBnb || r.verified === true);
    const badgeHtml = !r.userGenerated ? ''
      : isBnb
        ? (r.verified === true
            ? `<div class="verified-badge">\u2713 ${escapeHtml(t('card.verified'))}</div>`
            : `<div class="verified-badge is-unverified">${escapeHtml(t('card.unverified'))}</div>`)
        : `<div class="verified-badge">\u2713 ${escapeHtml(t('card.verifiedFood'))}</div>`;
    const stars = /^\d$/.test(r.rawTags?.stars || '') ? ' ' + '\u2605'.repeat(+r.rawTags.stars) : '';

    // Deep link portali (sempre visibili come riga principale)
    const portalBtns = isBnb ? `
      <a class="portal-btn" href="${links.booking}" target="_blank" rel="noopener" title="${escapeHtml(t('portal.searchOn', { p: 'Booking.com' }))}">
        <span class="portal-name">Booking</span>
      </a>
      <a class="portal-btn" href="${links.airbnb}" target="_blank" rel="noopener" title="${escapeHtml(t('portal.airbnbArea'))}">
        <span class="portal-name">Airbnb</span>
      </a>
      <a class="portal-btn" href="${links.tripadvisor}" target="_blank" rel="noopener" title="${escapeHtml(t('portal.searchOn', { p: 'TripAdvisor' }))}">
        <span class="portal-name">TripAdvisor</span>
      </a>
      <a class="portal-btn" href="${links.googleHotel}" target="_blank" rel="noopener" title="${escapeHtml(t('portal.pricesGoogle'))}">
        <span class="portal-name">${escapeHtml(t('portal.prices'))}</span>
      </a>` : `
      <a class="portal-btn" href="${links.justEat}" target="_blank" rel="noopener" title="${escapeHtml(t('portal.searchOn', { p: 'JustEat' }))}">
        <span class="portal-name">JustEat</span>
      </a>
      <a class="portal-btn" href="${links.deliveroo}" target="_blank" rel="noopener" title="${escapeHtml(t('portal.searchOn', { p: 'Deliveroo' }))}">
        <span class="portal-name">Deliveroo</span>
      </a>
      <a class="portal-btn" href="${links.thefork}" target="_blank" rel="noopener" title="${escapeHtml(t('portal.searchOn', { p: 'TheFork' }))}">
        <span class="portal-name">TheFork</span>
      </a>
      <a class="portal-btn" href="${links.glovo}" target="_blank" rel="noopener" title="${escapeHtml(t('portal.searchOn', { p: 'Glovo' }))}">
        <span class="portal-name">Glovo</span>
      </a>
      <a class="portal-btn" href="${links.googleMenu}" target="_blank" rel="noopener" title="${escapeHtml(t('portal.menuGoogle'))}">
        <span class="portal-name">${escapeHtml(t('portal.menu'))}</span>
      </a>`;

    return `
      <article class="card ${ownerVerified ? 'is-verified' : r.userGenerated ? 'is-owner' : ''}" style="animation-delay:${Math.min(idx*30,500)}ms">
        ${badgeHtml}
        <div class="card-top">
          <div>
            <h3 class="card-title">${escapeHtml(r.name)}</h3>
            <div class="card-type">
              ${escapeHtml(r.type ? I18N.typeLabel(r.type) : (isBnb ? lodgingLabel(r) : amenityLabel))}${stars}${cuisineLabel && !r.userGenerated && !isBnb ? ' \u00B7 ' + escapeHtml(cuisineLabel) : ''}
            </div>
          </div>
          ${r._dishMatch ? `
            <div class="card-price">
              <span class="amount">${escapeHtml(I18N.fmtPrice(r._dishMatch.price))}</span>
              <span class="suffix">${escapeHtml(r._dishMatch.dish)}</span>
            </div>
          ` : (distTxt ? `<div class="dist-pill">${distTxt}</div>` : '')}
        </div>

        ${r.address ? `<div class="card-meta"><span>${escapeHtml(r.address)}</span>${r._dishMatch && distTxt ? ` \u00B7 <span>${distTxt}</span>` : ''}</div>` : ''}
        ${hoursHtml}
        ${badgesHtml ? `<div class="card-tags">${badgesHtml}</div>` : ''}

        ${discount ? Trust.discountBtnHtml(r, discount) : ''}

        ${r.userGenerated ? '' : `<div class="portals-row">${portalBtns}</div>`}

        <div class="card-actions">
          <a class="btn-ghost" href="${links.maps}" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            ${escapeHtml(t('card.map'))}
          </a>
          ${callBtn}
          <button class="btn-outline" data-details="${escapeHtml(r.id)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><circle cx="12" cy="8" r="0.5" fill="currentColor"/></svg>
            ${escapeHtml(t(isBnb ? (r.userGenerated ? 'card.roomsParking' : 'card.infoParking') : r.userGenerated ? 'card.fullMenu' : 'card.info'))}
          </button>
        </div>
      </article>`;
  }

  // -------------- MODAL DETTAGLIO -------------------------
  function openDetails(id) {
    const r = state.restaurants.find(x => x.id === id);
    if (!r) return;
    openDetailsId = id;
    const links = deepLinks(r);
    const amenityLabel = I18N.amenityLabel(r.amenity);
    const lodging = isLodging(r);
    const discount = Trust.discountOf(r, lodging);
    const cin = lodging ? Trust.cinOf(r) : '';
    const titleCheck = r.userGenerated && (!lodging || r.verified === true);
    const verifyNote = r.userGenerated && lodging
      ? `<p class="verify-note ${r.verified === true ? 'is-ok' : ''}">${escapeHtml(t(r.verified === true ? 'modal.verifiedNote' : 'modal.unverifiedNote'))}</p>` : '';
    const waNum = r.userGenerated ? Trust.waDigits(r.whatsapp) : '';
    const mail = r.userGenerated && Trust.validEmail(r.contactEmail) ? r.contactEmail : '';

    // Per ristoranti user-gen: menu completo + orari strutturati
    const userGenMenuHtml = r.userGenerated && Array.isArray(r.menu) && r.menu.length ? `
      <div class="modal-section">
        <h4>${escapeHtml(t(isLodging(r) ? 'modal.rooms' : 'modal.menu'))}</h4>
        <ul class="menu-list">
          ${r.menu.slice().sort((a,b)=>a.price-b.price).map(m => {
            const isMatch = state.query && normalize(m.dish).includes(normalize(state.query));
            return `<li class="${isMatch ? 'is-match' : ''}">
              <span class="dish-name">${escapeHtml(m.dish)}</span>
              <span class="dish-price">${escapeHtml(I18N.fmtPrice(m.price))}</span>
            </li>`;
          }).join('')}
        </ul>
      </div>` : '';

    const userGenHoursHtml = r.userGenerated && r.hoursByDay ? (() => {
      const DAYS = [0, 1, 2, 3, 4, 5, 6].map(i => t('day.' + i));
      const today = new Date().getDay();
      return `<div class="modal-section">
        <h4>${escapeHtml(t(isLodging(r) ? 'modal.hoursLodging' : 'modal.hoursWeek'))}</h4>
        <div class="hours-grid">
          ${DAYS.map((name, i) => {
            const ranges = r.hoursByDay[i] || [];
            const txt = ranges.length ? ranges.join(' \u00B7 ') : t('modal.closed');
            return `<div class="day">${escapeHtml(name)}${i===today?` <span class="today-mark">${escapeHtml(t('modal.today'))}</span>`:''}</div>
                    <div class="ranges ${ranges.length?'':'closed'}">${escapeHtml(txt)}</div>`;
          }).join('')}
        </div>
      </div>`;
    })() : '';

    const paymentsHtml = r.userGenerated && r.payments?.length ? `
      <div class="modal-section">
        <h4>${escapeHtml(t('modal.payments'))}</h4>
        <div class="card-payments">
          ${r.payments.map(p => `<span class="pay-badge">${escapeHtml(I18N.has('pay.' + p) ? t('pay.' + p) : p)}</span>`).join('')}
        </div>
      </div>` : '';

    const featuresHtml = r.userGenerated && r.features?.length ? `
      <div class="modal-section">
        <h4>${escapeHtml(t('modal.features'))}</h4>
        <div class="card-tags">
          ${r.features.map(f => `<span class="card-tag">${escapeHtml(f)}</span>`).join('')}
        </div>
      </div>` : '';

    // Per ristoranti OSM: tabella tag grezzi
    const tagsList = !r.userGenerated ? Object.entries(r.rawTags || {})
      .filter(([k]) => !['name','amenity','addr:street','addr:housenumber','addr:postcode','addr:city','phone','contact:phone','website','contact:website','opening_hours','cuisine'].includes(k))
      .slice(0, 20)
      .map(([k,v]) => `<tr><td class="tag-k">${escapeHtml(k)}</td><td class="tag-v">${escapeHtml(String(v))}</td></tr>`)
      .join('') : '';

    $('#modalContent').innerHTML = `
      <div class="modal-head">
        <div>
          <h3>${escapeHtml(r.name)}${titleCheck ? ' <span class="verified-inline">\u2713</span>' : ''}</h3>
          <div class="card-type">${escapeHtml(r.type ? I18N.typeLabel(r.type) : (isLodging(r) ? lodgingLabel(r) : amenityLabel))}${r.cuisine && !r.userGenerated && !isLodging(r) ? ' \u00B7 ' + escapeHtml(r.cuisine) : ''}</div>
        </div>
        <button class="modal-close" id="modalCloseBtn" aria-label="${escapeHtml(t('modal.close'))}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal-body">
        ${discount ? `<div class="modal-section">${Trust.discountBtnHtml(r, discount)}</div>` : ''}
        ${verifyNote}
        ${userGenMenuHtml}
        ${userGenHoursHtml}

        <div class="modal-section">
          <h4>${escapeHtml(t('modal.contacts'))}</h4>
          ${r.address ? `<p><strong>${escapeHtml(t('modal.address'))}</strong> ${escapeHtml(r.address)}</p>` : ''}
          ${r.phone   ? `<p><strong>${escapeHtml(t('modal.phone'))}</strong> <a href="tel:${r.phone.replace(/\s/g,'')}">${escapeHtml(r.phone)}</a></p>` : ''}
          ${/^https?:\/\//i.test(r.website || '') ? `<p><strong>${escapeHtml(t('modal.site'))}</strong> <a href="${escapeHtml(r.website)}" target="_blank" rel="noopener">${escapeHtml(r.website)}</a></p>` : ''}
          ${waNum ? `<p><strong>${escapeHtml(t('modal.whatsapp'))}</strong> <a href="https://wa.me/${waNum}" target="_blank" rel="noopener">+${escapeHtml(waNum)}</a></p>` : ''}
          ${mail ? `<p><strong>${escapeHtml(t('modal.email'))}</strong> <a href="mailto:${escapeHtml(mail)}">${escapeHtml(mail)}</a></p>` : ''}
          <p style="margin-top:12px">
            <a class="btn-outline" style="display:inline-flex;padding:10px 18px" href="${links.maps}" target="_blank" rel="noopener">${escapeHtml(t('modal.openMaps'))} \u2197</a>
          </p>
        </div>

        ${paymentsHtml}
        ${featuresHtml}

        ${r.userGenerated ? '' : (r.opening_hours ? `
        <div class="modal-section">
          <h4>${escapeHtml(t('modal.osmHours'))}</h4>
          <p><code style="background:var(--c-bg-2);padding:6px 10px;border-radius:6px">${escapeHtml(r.opening_hours)}</code></p>
          <p style="color:var(--c-muted);font-size:12px">${escapeHtml(t('modal.osmHoursNote'))}</p>
        </div>` : `
        <div class="modal-section">
          <h4>${escapeHtml(t('modal.hours'))}</h4>
          <p style="color:var(--c-muted)">${escapeHtml(t('modal.noHours'))}</p>
        </div>`)}

        ${Trust.cinHtml(cin)}
        ${lodging ? Trust.safetyHtml(r.id, r.name) : ''}

        ${isLodging(r) ? `
        <div class="modal-section">
          <h4>${escapeHtml(t('modal.parking'))}</h4>
          <div id="parkingList" data-for="${escapeHtml(r.id)}"><p style="color:var(--c-muted)">${escapeHtml(t('modal.parkingLoading'))}</p></div>
        </div>
        <div class="modal-section">
          <h4>${escapeHtml(t('modal.pricesAvail'))}</h4>
          <p style="color:var(--c-muted);font-size:13px;margin-bottom:12px">${escapeHtml(t('modal.noBooking'))}</p>
          <div class="portals-grid">
            <a class="portal-btn lg" href="${links.booking}" target="_blank" rel="noopener">\uD83D\uDECF\uFE0F Booking.com</a>
            <a class="portal-btn lg" href="${links.airbnb}" target="_blank" rel="noopener">\uD83C\uDFE0 ${escapeHtml(t('modal.airbnbArea'))}</a>
            <a class="portal-btn lg" href="${links.tripadvisor}" target="_blank" rel="noopener">\u2728 TripAdvisor</a>
            <a class="portal-btn lg" href="${links.googleHotel}" target="_blank" rel="noopener">\uD83D\uDD0D ${escapeHtml(t('modal.pricesGoogle'))}</a>
          </div>
        </div>` : r.userGenerated ? '' : `
        <div class="modal-section">
          <h4>${escapeHtml(t('modal.whereMenu'))}</h4>
          <p style="color:var(--c-muted);font-size:13px;margin-bottom:12px">${t('modal.noPrices')}</p>
          <div class="portals-grid">
            <a class="portal-btn lg" href="${links.justEat}" target="_blank" rel="noopener">\uD83D\uDEF5 JustEat</a>
            <a class="portal-btn lg" href="${links.deliveroo}" target="_blank" rel="noopener">\uD83C\uDF54 Deliveroo</a>
            <a class="portal-btn lg" href="${links.glovo}" target="_blank" rel="noopener">\uD83D\uDED2 Glovo</a>
            <a class="portal-btn lg" href="${links.thefork}" target="_blank" rel="noopener">\uD83C\uDF74 TheFork</a>
            <a class="portal-btn lg" href="${links.googleMenu}" target="_blank" rel="noopener">\uD83D\uDD0D ${escapeHtml(t('modal.menuGoogle'))}</a>
            <a class="portal-btn lg" href="${links.tripadvisor}" target="_blank" rel="noopener">\u2728 TripAdvisor</a>
          </div>
        </div>`}

        ${tagsList ? `
        <div class="modal-section">
          <h4>${escapeHtml(t('modal.otherInfo'))}</h4>
          <table class="tag-table">${tagsList}</table>
        </div>` : ''}

        <div class="modal-section" style="border-top:1px solid var(--c-line);padding-top:14px">
          <p style="color:var(--c-muted);font-size:12px;margin:0">
            ${r.userGenerated
              ? escapeHtml(t('modal.ownerData'))
              : t('modal.osmData', { url: 'https://www.openstreetmap.org/' + escapeHtml(r.id) })}
          </p>
          <p style="margin:8px 0 0">${Trust.reportLinkHtml(r.id, r.name)}</p>
        </div>
      </div>`;
    $('#modalBackdrop').classList.add('is-open');
    $('#modalCloseBtn').addEventListener('click', closeModal);

    if (isLodging(r)) {
      const from = { lat: r.lat, lng: r.lng };
      findParkingNear(from)
        .then(list => parkingHtml(from, list))
        .catch(() => `<p style="color:var(--c-muted)">${escapeHtml(t('park.error'))}</p>`)
        .then(html => {
          const el = $('#parkingList');
          if (el && el.dataset.for === r.id) el.innerHTML = html; // il dettaglio \u00E8 ancora aperto
        });
    }
  }

  let openDetailsId = null;
  function closeModal() { openDetailsId = null; $('#modalBackdrop').classList.remove('is-open'); }

  // -------------- TOAST -----------------------------------
  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2600);
  }

  // -------------- GEOLOCALIZZAZIONE -----------------------
  function useGeolocation() {
    if (!navigator.geolocation) { toast(t('toast.geoUnsupported')); return; }
    toast(t('toast.geoLocating'));
    navigator.geolocation.getCurrentPosition(
      async pos => {
        state.userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        state.origin = state.userPos;
        // Nome della zona: prima dai dati del sito, poi Nominatim
        let display = await nearestPlaceName(state.userPos);
        if (!display) {
          try {
            const rev = await fetchWithTimeout(`https://nominatim.openstreetmap.org/reverse?lat=${state.userPos.lat}&lon=${state.userPos.lng}&format=json&zoom=14&accept-language=it`, {}, 8000);
            const j = await rev.json();
            display = j.address?.city || j.address?.town || j.address?.village || j.address?.county;
          } catch {}
        }
        if (display) {
          state.cityName = display;
          $('#cityInput').value = display;
        }
        toast(t('toast.geoFound'));
        search();
      },
      err => {
        const msg = t(err.code === 1 ? 'toast.geoDenied' : 'toast.geoFail');
        toast(msg);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // -------------- PWA INSTALL -----------------------------
  let deferredInstall = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e;
    $('#installBanner').classList.add('is-visible');
  });
  function promptInstall() {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    deferredInstall.userChoice.then(() => {
      deferredInstall = null;
      $('#installBanner').classList.remove('is-visible');
    });
  }

  // -------------- INIT ------------------------------------
  function init() {
    renderCityDatalist();

    // Ricerca
    $('#searchBtn').addEventListener('click', () => {
      state.userPos = null;  // override geo se cambia citt\u00E0 manualmente
      search();
    });
    $('#geoBtn').addEventListener('click', useGeolocation);

    // Enter su qualsiasi campo = cerca
    ['queryInput','cityInput'].forEach(id => {
      $('#' + id).addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); $('#searchBtn').click(); }
      });
    });
    $('#cityInput').addEventListener('change', () => { state.userPos = null; });

    // Filtri veloci
    $('#amenityChips').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-amenity]');
      if (!btn) return;
      const wasLodging = state.amenityFilter === 'lodging';
      state.amenityFilter = btn.dataset.amenity;
      document.querySelectorAll('#amenityChips .chip').forEach(c =>
        c.classList.toggle('is-active', c.dataset.amenity === state.amenityFilter));
      if (state.amenityFilter === 'lodging' && !wasLodging && !state.error) search();
      else renderResults();
    });
    $('#lodgingChips').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-lodging]');
      if (!btn) return;
      state.lodgingType = btn.dataset.lodging;
      // una ricerca testuale tipo "hotel" non deve bloccare il filtro scelto
      if (kindFromQuery(state.query)) { $('#queryInput').value = ''; state.query = ''; }
      if (state.amenityFilter !== 'lodging') {
        state.amenityFilter = 'lodging';
        document.querySelectorAll('#amenityChips .chip').forEach(c =>
          c.classList.toggle('is-active', c.dataset.amenity === 'lodging'));
      }
      search();
    });
    $('#sortSelect').addEventListener('change', (e) => {
      state.sort = e.target.value;
      renderResults();
    });
    $('#radiusSelect').addEventListener('change', (e) => {
      state.radius = parseInt(e.target.value, 10) || CFG.defaultRadius;
      search();
    });

    // Delegation card
    const openDiscountFor = id => {
      const r = state.restaurants.find(x => x.id === id);
      if (r) Trust.openDiscount(r);
    };
    $('#results').addEventListener('click', (e) => {
      const disc = e.target.closest('[data-discount]');
      if (disc) { openDiscountFor(disc.dataset.discount); return; }
      const btn = e.target.closest('[data-details]');
      if (btn) openDetails(btn.dataset.details);
    });
    $('#modalContent').addEventListener('click', (e) => {
      const disc = e.target.closest('[data-discount]');
      if (disc) openDiscountFor(disc.dataset.discount);
    });

    // Modal
    $('#modalBackdrop').addEventListener('click', (e) => {
      if (e.target.id === 'modalBackdrop') closeModal();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

    // Install
    $('#installBtn').addEventListener('click', promptInstall);
    $('#installBannerBtn').addEventListener('click', promptInstall);

    // Service worker
    // Aggiornamento automatico: controlla se c'è una nuova versione
    // all'apertura e ogni volta che l'app torna in primo piano; quando
    // il nuovo service worker prende il controllo, ricarica la pagina.
    if ('serviceWorker' in navigator) {
      const hadController = !!navigator.serviceWorker.controller;
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || reloading) return; // primo avvio: niente reload
        reloading = true;
        location.reload();
      });
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
          .then(reg => {
            reg.update().catch(()=>{});
            document.addEventListener('visibilitychange', () => {
              if (document.visibilityState === 'visible') reg.update().catch(()=>{});
            });
          })
          .catch(()=>{});
      });
    }

    // Cambio lingua: ridisegna risultati e dettaglio aperto senza ricaricare
    I18N.onChange(() => {
      if (!state.loading) renderResults(); else syncLodgingChips();
      if (openDetailsId && $('#modalBackdrop').classList.contains('is-open')) openDetails(openDetailsId);
    });

    // Prima ricerca automatica sulla citt\u00E0 di default
    search();

    // Esposto per il modulo ristoratori: aggiorna la lista quando il
    // ristoratore salva/elimina un locale
    window.refreshPublicResults = () => { refreshUserRestaurants(); };
  }

  document.addEventListener('DOMContentLoaded', init);
})();
