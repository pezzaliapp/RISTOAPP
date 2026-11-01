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
  // Se la citt\u00E0 scritta dall'utente \u00E8 nella lista preset uso quelle coordinate.
  // Altrimenti interrogo Nominatim (OSM).
  async function resolveCity(cityName) {
    const norm = normalize(cityName);
    const preset = CFG.cities.find(c => normalize(c.name) === norm);
    if (preset) return { lat: preset.lat, lng: preset.lng, name: preset.name };

    // Nominatim
    const url = `${CFG.nominatimEndpoint}?q=${encodeURIComponent(cityName + ', Italia')}&format=json&limit=1&countrycodes=it`;
    const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!resp.ok) throw new Error('Impossibile trovare la localit\u00E0');
    const arr = await resp.json();
    if (!arr.length) throw new Error(`Localit\u00E0 non trovata: "${cityName}"`);
    return {
      lat: parseFloat(arr[0].lat),
      lng: parseFloat(arr[0].lon),
      name: arr[0].display_name.split(',')[0] || cityName,
    };
  }

  // -------------- OVERPASS --------------------------------
  function buildOverpassQuery(lat, lng, radius) {
    const amenities = 'restaurant|fast_food|pub|bar|cafe|biergarten|food_court|ice_cream';
    return `[out:json][timeout:20];
nwr["amenity"~"^(${amenities})$"]["name"](around:${radius},${lat.toFixed(5)},${lng.toFixed(5)});
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
          if (!json || !Array.isArray(json.elements)) throw new Error('Risposta non valida');
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
    throw new Error('I server di OpenStreetMap sono momentaneamente sovraccarichi (' + (lastErr?.message || 'errore di rete') + ')');
  }

  async function loadOsmRestaurants(origin, radius) {
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
      amenity: tags.amenity,
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
  function matchesQuery(r, query) {
    if (!query) return true;
    const nq = normalize(query);

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
    for (const [cuisineClass, words] of Object.entries(CFG.cuisineKeywords)) {
      if (words.some(w => nq.includes(w))) {
        const cuisineNorm = normalize(r.cuisine);
        if (cuisineNorm.includes(cuisineClass)) return true;
        if (cuisineClass === 'pizza' && normalize(r.name).includes('pizz')) return true;
        if (cuisineClass === 'italian' && /trattoria|osteria|ristorante/i.test(r.name)) return true;
      }
    }
    return false;
  }

  function filterAndSort(list) {
    // Azzera i match piatto della ricerca precedente
    list.forEach(r => { delete r._dishMatch; });
    let res = list.slice();

    // Filtro amenity
    if (state.amenityFilter !== 'all') {
      res = res.filter(r => r.amenity === state.amenityFilter);
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

    // I ristoranti verificati dal titolare vanno sempre in cima
    res.sort((a,b) => (b.userGenerated ? 1 : 0) - (a.userGenerated ? 1 : 0));

    return res;
  }

  // -------------- OPENING HOURS (semplificato) ------------
  // OSM usa un formato complesso. Qui interpretiamo solo i casi pi\u00F9
  // comuni e in altri casi mostriamo la stringa raw.
  function parseOpeningHoursQuick(str) {
    if (!str) return { status: 'unknown', raw: '' };
    if (/^24\/7/i.test(str.trim())) return { status: 'open', raw: str, label: 'Aperto 24/7' };
    return { status: 'unknown', raw: str, label: str };
  }

  // -------------- DEEP LINKS -------------------------------
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
      googleSearch: `https://www.google.com/search?q=${qWithCity}+menu+prezzi`,
      googleMenu: `https://www.google.com/search?q=${qWithCity}+menu`,
      tripadvisor: `https://www.tripadvisor.it/Search?q=${qWithCity}`,
    };
    return links;
  }

  // -------------- RICERCA PRINCIPALE ----------------------
  let searchSeq = 0;      // per ignorare risposte di ricerche superate
  let lastOsm = [];       // ultimi risultati OSM (per refresh rapido)

  async function search() {
    const cityInput = $('#cityInput').value.trim();
    const query = $('#queryInput').value.trim();
    if (!cityInput && !state.userPos) { toast('Scrivi una localit\u00E0 o usa "Posizione"'); return; }

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
        state.warning = 'OpenStreetMap non risponde: mostro solo i locali registrati su RistoApp. Riprova tra poco per vedere gli altri.';
      } else {
        lastOsm = osmRes.list;
        if (osmRes.stale) state.warning = 'OpenStreetMap non risponde: mostro gli ultimi risultati salvati.';
      }

      state.restaurants = [...userGen, ...lastOsm];
      state.error = null;
    } catch (e) {
      if (mySeq !== searchSeq) return;
      state.error = e.message || 'Errore durante la ricerca';
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

    // Titolo
    const where = state.userPos ? 'posizione attuale' : state.cityName;
    titleEl.innerHTML = state.query
      ? `Locali che corrispondono a <em>"${escapeHtml(state.query)}"</em> a ${escapeHtml(where)}`
      : `Locali a <em>${escapeHtml(where)}</em>`;

    // Conteggio
    if (state.error) {
      countEl.textContent = '';
      listEl.innerHTML = `<div class="empty">
        <div class="empty-mark">ops</div>
        <p><strong>${escapeHtml(state.error)}</strong></p>
        <p>Riprova tra qualche istante o cambia localit\u00E0.</p>
      </div>`;
      return;
    }

    countEl.textContent = `${filtered.length} ${filtered.length === 1 ? 'locale trovato' : 'locali trovati'}`;

    if (!filtered.length) {
      listEl.innerHTML = `<div class="empty">
        <div class="empty-mark">non pervenuto</div>
        <p><strong>Nessun locale trovato</strong></p>
        <p>Prova a allargare il raggio, a cambiare il termine cercato o a selezionare "Tutti i locali".</p>
      </div>`;
      return;
    }

    const warnHtml = state.warning
      ? `<div class="empty" style="padding:14px 18px;margin-bottom:12px;grid-column:1/-1"><p style="margin:0">${escapeHtml(state.warning)}</p></div>`
      : '';
    listEl.innerHTML = warnHtml + filtered.map((r, idx) => cardHtml(r, idx)).join('');
  }

  function cardHtml(r, idx) {
    const links = deepLinks(r);
    const oh = parseOpeningHoursQuick(r.opening_hours);
    const amenityLabel = CFG.amenityLabels[r.amenity] || 'Locale';
    const cuisineLabel = r.cuisine
      ? r.cuisine.split(';').slice(0,3).map(c => c.trim()).join(' \u00B7 ')
      : '';
    const distTxt = (r.distance != null)
      ? `${r.distance < 1 ? Math.round(r.distance*1000) + ' m' : r.distance.toFixed(1) + ' km'}`
      : '';

    // Tag features
    const badges = [];
    if (r.takeaway === 'yes')        badges.push('Asporto');
    if (r.delivery === 'yes')        badges.push('Domicilio');
    if (r.outdoor_seating === 'yes') badges.push('Tavoli all\u2019aperto');
    if (r.wheelchair === 'yes')      badges.push('Accessibile');
    if (r.vegetarian === 'yes')      badges.push('Vegetariano');
    if (r.vegan === 'yes')           badges.push('Vegano');
    if (r.gluten_free === 'yes')     badges.push('Senza glutine');
    const badgesHtml = badges.slice(0,4).map(b => `<span class="card-tag">${escapeHtml(b)}</span>`).join('');

    const hoursHtml = r.opening_hours
      ? `<div class="card-hours is-unknown"><span class="clock">\u25F7</span><span>${escapeHtml(oh.label)}</span></div>`
      : '';

    // Link primari: sempre Maps + chiamata se disponibile
    const callBtn = links.call
      ? `<a class="btn-outline" href="${links.call}">\u260E Chiama</a>`
      : '';

    // Deep link portali (sempre visibili come riga principale)
    const portalBtns = `
      <a class="portal-btn" href="${links.justEat}" target="_blank" rel="noopener" title="Cerca su JustEat">
        <span class="portal-name">JustEat</span>
      </a>
      <a class="portal-btn" href="${links.deliveroo}" target="_blank" rel="noopener" title="Cerca su Deliveroo">
        <span class="portal-name">Deliveroo</span>
      </a>
      <a class="portal-btn" href="${links.thefork}" target="_blank" rel="noopener" title="Cerca su TheFork">
        <span class="portal-name">TheFork</span>
      </a>
      <a class="portal-btn" href="${links.glovo}" target="_blank" rel="noopener" title="Cerca su Glovo">
        <span class="portal-name">Glovo</span>
      </a>
      <a class="portal-btn" href="${links.googleMenu}" target="_blank" rel="noopener" title="Cerca menu su Google">
        <span class="portal-name">Menu</span>
      </a>`;

    return `
      <article class="card ${r.userGenerated ? 'is-verified' : ''}" style="animation-delay:${Math.min(idx*30,500)}ms">
        ${r.userGenerated ? `<div class="verified-badge">\u2713 Menu aggiornato dal titolare</div>` : ''}
        <div class="card-top">
          <div>
            <h3 class="card-title">${escapeHtml(r.name)}</h3>
            <div class="card-type">
              ${escapeHtml(r.type || amenityLabel)}${cuisineLabel && !r.userGenerated ? ' \u00B7 ' + escapeHtml(cuisineLabel) : ''}
            </div>
          </div>
          ${r._dishMatch ? `
            <div class="card-price">
              <span class="amount">\u20AC ${r._dishMatch.price.toFixed(2)}</span>
              <span class="suffix">${escapeHtml(r._dishMatch.dish)}</span>
            </div>
          ` : (distTxt ? `<div class="dist-pill">${distTxt}</div>` : '')}
        </div>

        ${r.address ? `<div class="card-meta"><span>${escapeHtml(r.address)}</span>${r._dishMatch && distTxt ? ` \u00B7 <span>${distTxt}</span>` : ''}</div>` : ''}
        ${hoursHtml}
        ${badgesHtml ? `<div class="card-tags">${badgesHtml}</div>` : ''}

        ${r.userGenerated ? '' : `<div class="portals-row">${portalBtns}</div>`}

        <div class="card-actions">
          <a class="btn-ghost" href="${links.maps}" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            Mappa
          </a>
          ${callBtn}
          <button class="btn-outline" data-details="${escapeHtml(r.id)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><circle cx="12" cy="8" r="0.5" fill="currentColor"/></svg>
            ${r.userGenerated ? 'Menu completo' : 'Info'}
          </button>
        </div>
      </article>`;
  }

  // -------------- MODAL DETTAGLIO -------------------------
  function openDetails(id) {
    const r = state.restaurants.find(x => x.id === id);
    if (!r) return;
    const links = deepLinks(r);
    const amenityLabel = CFG.amenityLabels[r.amenity] || 'Locale';

    // Per ristoranti user-gen: menu completo + orari strutturati
    const userGenMenuHtml = r.userGenerated && Array.isArray(r.menu) && r.menu.length ? `
      <div class="modal-section">
        <h4>Menu e prezzi</h4>
        <ul class="menu-list">
          ${r.menu.slice().sort((a,b)=>a.price-b.price).map(m => {
            const isMatch = state.query && normalize(m.dish).includes(normalize(state.query));
            return `<li class="${isMatch ? 'is-match' : ''}">
              <span class="dish-name">${escapeHtml(m.dish)}</span>
              <span class="dish-price">\u20AC ${m.price.toFixed(2)}</span>
            </li>`;
          }).join('')}
        </ul>
      </div>` : '';

    const userGenHoursHtml = r.userGenerated && r.hoursByDay ? (() => {
      const DAYS = ['Domenica','Luned\u00EC','Marted\u00EC','Mercoled\u00EC','Gioved\u00EC','Venerd\u00EC','Sabato'];
      const today = new Date().getDay();
      return `<div class="modal-section">
        <h4>Orari settimanali</h4>
        <div class="hours-grid">
          ${DAYS.map((name, i) => {
            const ranges = r.hoursByDay[i] || [];
            const txt = ranges.length ? ranges.join(' \u00B7 ') : 'Chiuso';
            return `<div class="day">${name}${i===today?' <span class="today-mark">oggi</span>':''}</div>
                    <div class="ranges ${ranges.length?'':'closed'}">${txt}</div>`;
          }).join('')}
        </div>
      </div>`;
    })() : '';

    const paymentsHtml = r.userGenerated && r.payments?.length ? `
      <div class="modal-section">
        <h4>Pagamenti accettati</h4>
        <div class="card-payments">
          ${r.payments.map(p => `<span class="pay-badge">${escapeHtml(p)}</span>`).join('')}
        </div>
      </div>` : '';

    const featuresHtml = r.userGenerated && r.features?.length ? `
      <div class="modal-section">
        <h4>Caratteristiche</h4>
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
          <h3>${escapeHtml(r.name)}${r.userGenerated ? ' <span class="verified-inline">\u2713</span>' : ''}</h3>
          <div class="card-type">${escapeHtml(r.type || amenityLabel)}${r.cuisine && !r.userGenerated ? ' \u00B7 ' + escapeHtml(r.cuisine) : ''}</div>
        </div>
        <button class="modal-close" id="modalCloseBtn" aria-label="Chiudi">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal-body">
        ${userGenMenuHtml}
        ${userGenHoursHtml}

        <div class="modal-section">
          <h4>Contatti e posizione</h4>
          ${r.address ? `<p><strong>Indirizzo:</strong> ${escapeHtml(r.address)}</p>` : ''}
          ${r.phone   ? `<p><strong>Telefono:</strong> <a href="tel:${r.phone.replace(/\s/g,'')}">${escapeHtml(r.phone)}</a></p>` : ''}
          ${r.website ? `<p><strong>Sito:</strong> <a href="${escapeHtml(r.website)}" target="_blank" rel="noopener">${escapeHtml(r.website)}</a></p>` : ''}
          <p style="margin-top:12px">
            <a class="btn-outline" style="display:inline-flex;padding:10px 18px" href="${links.maps}" target="_blank" rel="noopener">Apri in Google Maps \u2197</a>
          </p>
        </div>

        ${paymentsHtml}
        ${featuresHtml}

        ${r.userGenerated ? '' : (r.opening_hours ? `
        <div class="modal-section">
          <h4>Orari (come dichiarati su OpenStreetMap)</h4>
          <p><code style="background:var(--c-bg-2);padding:6px 10px;border-radius:6px">${escapeHtml(r.opening_hours)}</code></p>
          <p style="color:var(--c-muted);font-size:12px">Il formato \u00E8 quello standard OSM. Per orari aggiornati clicca "Mappa" o "Google".</p>
        </div>` : `
        <div class="modal-section">
          <h4>Orari</h4>
          <p style="color:var(--c-muted)">Non disponibili su OpenStreetMap. Verifica chiamando il locale o su Google Maps.</p>
        </div>`)}

        ${r.userGenerated ? '' : `
        <div class="modal-section">
          <h4>Dove vedere menu e prezzi</h4>
          <p style="color:var(--c-muted);font-size:13px;margin-bottom:12px">Per scelta \u2014 e per rispetto delle piattaforme \u2014 <strong>RistoApp non memorizza i prezzi</strong>. Clicca un portale per vedere menu e prezzi aggiornati del ristorante (se presente):</p>
          <div class="portals-grid">
            <a class="portal-btn lg" href="${links.justEat}" target="_blank" rel="noopener">\uD83D\uDEF5 JustEat</a>
            <a class="portal-btn lg" href="${links.deliveroo}" target="_blank" rel="noopener">\uD83C\uDF54 Deliveroo</a>
            <a class="portal-btn lg" href="${links.glovo}" target="_blank" rel="noopener">\uD83D\uDED2 Glovo</a>
            <a class="portal-btn lg" href="${links.thefork}" target="_blank" rel="noopener">\uD83C\uDF74 TheFork</a>
            <a class="portal-btn lg" href="${links.googleMenu}" target="_blank" rel="noopener">\uD83D\uDD0D Menu su Google</a>
            <a class="portal-btn lg" href="${links.tripadvisor}" target="_blank" rel="noopener">\u2728 TripAdvisor</a>
          </div>
        </div>`}

        ${tagsList ? `
        <div class="modal-section">
          <h4>Altre informazioni (da OpenStreetMap)</h4>
          <table class="tag-table">${tagsList}</table>
        </div>` : ''}

        <div class="modal-section" style="border-top:1px solid var(--c-line);padding-top:14px">
          <p style="color:var(--c-muted);font-size:12px;margin:0">
            ${r.userGenerated
              ? `Dati forniti direttamente dal titolare del locale.`
              : `Dati: <a href="https://www.openstreetmap.org/${r.id}" target="_blank" rel="noopener">OpenStreetMap contributors</a> (ODbL).`}
          </p>
        </div>
      </div>`;
    $('#modalBackdrop').classList.add('is-open');
    $('#modalCloseBtn').addEventListener('click', closeModal);
  }

  function closeModal() { $('#modalBackdrop').classList.remove('is-open'); }

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
    if (!navigator.geolocation) { toast('Geolocalizzazione non supportata'); return; }
    toast('Sto cercando la tua posizione...');
    navigator.geolocation.getCurrentPosition(
      async pos => {
        state.userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        state.origin = state.userPos;
        // Nominatim reverse per mostrare il nome della zona
        try {
          const rev = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${state.userPos.lat}&lon=${state.userPos.lng}&format=json&zoom=14&accept-language=it`);
          const j = await rev.json();
          const display = j.address?.city || j.address?.town || j.address?.village || j.address?.county || 'Posizione attuale';
          state.cityName = display;
          $('#cityInput').value = display;
        } catch {}
        toast('Posizione rilevata. Cerco locali in zona...');
        search();
      },
      err => {
        const msg = err.code === 1 ? 'Permesso di geolocalizzazione negato' : 'Impossibile ottenere la posizione';
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
      state.amenityFilter = btn.dataset.amenity;
      document.querySelectorAll('#amenityChips .chip').forEach(c =>
        c.classList.toggle('is-active', c.dataset.amenity === state.amenityFilter));
      renderResults();
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
    $('#results').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-details]');
      if (btn) openDetails(btn.dataset.details);
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

    // Prima ricerca automatica sulla citt\u00E0 di default
    search();

    // Esposto per il modulo ristoratori: aggiorna la lista quando il
    // ristoratore salva/elimina un locale
    window.refreshPublicResults = () => { refreshUserRestaurants(); };
  }

  document.addEventListener('DOMContentLoaded', init);
})();
