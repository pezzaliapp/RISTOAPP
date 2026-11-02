/* ============================================================
 *  RISTOAPP - Store (Firebase Auth + Firestore)
 *
 *  v5.3: l'SDK Firebase (gstatic.com) NON viene piu' caricato
 *  all'avvio. La ricerca legge gli annunci pubblici con l'API REST
 *  di Firestore (stesse Firestore Rules, nessun login, nessuna
 *  inizializzazione di Firebase Auth). L'SDK si carica solo quando
 *  serve davvero: apertura dell'area titolari, invio di una
 *  segnalazione, moderazione.
 *
 *  API pubblica (window.RistoStore):
 *    ready()                       -> Promise<void>  carica SDK + primo controllo auth
 *    loaded()                      -> bool           SDK gia' inizializzato?
 *    register(email, pwd, name)    -> Promise<user>  (registra anche l'accettazione dei termini)
 *    login(email, pwd) / logout()
 *    currentUser()                 -> user | null (sincrono; null finche' l'SDK non e' caricato)
 *    isAdmin()                     -> bool (solo per mostrare il pannello: decidono le Rules)
 *    publicNear(origin, radiusM)   -> Promise<listing[]>  annunci visibili nella fascia di latitudine
 *    osmHiddenIds()                -> Promise<Set<osmId>> luoghi OSM nascosti dopo moderazione
 *    clearPublicCache()
 *    myRestaurants() / getRestaurant(id) / saveRestaurant(r) / deleteRestaurant(id)
 *    deleteAccount(password)
 *    resendVerification() / reloadUser()
 *    cinStatus(cin)                -> {taken, mine}
 *    report({restaurant, name, reason, text}) -> Promise<id> (senza login)
 *    termsStatus() / acceptTerms()
 *    requestVerification(id)       -> chiede un nuovo controllo del sito
 *    myAppeals() / createAppeal(restaurantId, text)
 *    myCinClaims() / createCinClaim(cin, text)
 *    admin*: vedi in fondo (moderazione)
 *
 *  Campi gestiti SOLO dal server o dall'amministratore: verified,
 *  verifiedMethod, verifiedAt, verifiedFor, verifiedSnapshot, hidden
 *  (il client lo crea a false), hiddenReason, hiddenNote, moderatedAt,
 *  lastRecheck. Le Firestore Rules lo impongono.
 *
 *  Config Firebase pubblica (OK esposta nel client: la sicurezza
 *  e' garantita dalle Firestore Rules lato server).
 * ============================================================ */

(() => {
  const t = (k, p) => (window.I18N ? window.I18N.t(k, p) : k);
  const CFG = window.RISTOAPP_CONFIG || {};

  const firebaseConfig = {
    apiKey:            'AIzaSyDOat9cV39fu1OxVIn1tGFuDe_Owd5Er20',
    authDomain:        'ristoapp-b4215.firebaseapp.com',
    projectId:         'ristoapp-b4215',
    storageBucket:     'ristoapp-b4215.firebasestorage.app',
    messagingSenderId: '603049958177',
    appId:             '1:603049958177:web:c7fb1cff624f533f50bc60',
  };
  const SDK_BASE = 'https://www.gstatic.com/firebasejs/10.14.1/';
  const REST_BASE = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;

  const RESTAURANTS = 'restaurants';
  const CINS = 'cin';
  const REPORTS = 'reports';
  const APPEALS = 'appeals';
  const CIN_CLAIMS = 'cinClaims';
  const OSM_HIDDEN = 'osmHidden';
  const USERS = 'users';
  const TERMS_VERSION = '2026-11';

  const LODGING_TYPES = ['B&B','Agriturismo','Affittacamere','Casa vacanze','Hotel','Ostello'];
  const FOOD_TYPES = ['Pizzeria','Trattoria','Osteria','Ristorante','Fast food','Bar','Caffè','Gelateria','Pub'];
  const CIN_RE = /^IT\d{6}[A-Z0-9]{2}[A-Z0-9]{1,8}$/;
  const PHONE_RE = /^[+0-9 ()./-]*$/;
  const HOURS_RE = /^\d{2}:\d{2}-\d{2}:\d{2}$/;
  const REPORT_REASONS = ['fake','not_owner','payment','discount','wrong_data','other'];
  // Campi che, se cambiano, fanno decadere la verifica (= Firestore Rules)
  const IDENTITY_FIELDS = ['name','website','phone','whatsapp','contactEmail','cin','address'];
  const BBOX = CFG.italyBbox || { minLat: 35.2, maxLat: 47.2, minLng: 6.5, maxLng: 18.7 };
  const PUBLIC_TTL_MS = 10 * 60 * 1000;
  const PUBLIC_LIMIT = 300;
  const normCin = s => String(s || '').toUpperCase().replace(/\s+/g, '');
  const osmDocId = id => String(id || '').replace(/\//g, '_');
  const isOsmId = id => /^(node|way|relation)\/\d+$/.test(String(id || ''));

  // ---------- helper difensivi ----------
  const str = (v, max = 500) => typeof v === 'string' ? v.slice(0, max)
    : (typeof v === 'number' && isFinite(v) ? String(v).slice(0, max) : '');
  const strList = (v, maxItems = 50, maxLen = 120) => Array.isArray(v)
    ? v.filter(x => typeof x === 'string' && x.trim()).slice(0, maxItems).map(x => x.slice(0, maxLen)) : [];
  const num = v => (typeof v === 'number' && isFinite(v)) ? v : (typeof v === 'string' && v.trim() !== '' && isFinite(+v) ? +v : NaN);

  // Solo link http(s): un sito "javascript:..." non deve mai finire in un href
  function safeWebsite(u) {
    u = typeof u === 'string' ? u.trim() : '';
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) {
      if (!/^[a-z0-9.-]+\.[a-z]{2,}(\/[^\s"'<>]*)?$/i.test(u)) return '';
      u = 'https://' + u;
    }
    try {
      const url = new URL(u);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
      if (url.username || url.password) return '';
      const href = url.href;
      return /^https?:\/\/[!#-;=?-~]+$/.test(href) && href.length <= 300 ? href : '';
    } catch { return ''; }
  }
  function siteHost(u) {
    try { return new URL(safeWebsite(u)).hostname.toLowerCase().replace(/^www\./, ''); }
    catch { return ''; }
  }
  const cleanPhone = p => { const s = str(p, 40).trim(); return PHONE_RE.test(s) ? s : ''; };

  function cleanHours(h) {
    const out = {};
    if (!h || typeof h !== 'object' || Array.isArray(h)) return out;
    for (let i = 0; i < 7; i++) {
      const v = h[i] ?? h[String(i)];
      const list = Array.isArray(v) ? v : (typeof v === 'string' && v ? v.split(',') : []);
      const ok = list.filter(x => typeof x === 'string').map(x => x.trim()).filter(x => HOURS_RE.test(x)).slice(0, 4);
      if (ok.length) out[i] = ok;
    }
    return out;
  }
  function cleanMenu(m) {
    if (!Array.isArray(m)) return [];
    const out = [];
    for (const it of m.slice(0, 200)) {
      if (!it || typeof it !== 'object') continue;
      const dish = str(it.dish, 120).trim();
      const price = num(it.price);
      if (dish && isFinite(price) && price >= 0 && price < 100000) out.push({ dish, price });
    }
    return out;
  }
  const tsMillis = v => {
    if (!v) return 0;
    if (typeof v === 'number') return v;
    if (typeof v.toMillis === 'function') { try { return v.toMillis(); } catch { return 0; } }
    if (typeof v === 'string') { const d = Date.parse(v); return isNaN(d) ? 0 : d; }
    if (typeof v.seconds === 'number') return v.seconds * 1000;
    return 0;
  };

  // ---------- Mapping UI -> OSM shape ----------
  const TYPE_TO_AMENITY = {
    'Pizzeria':'restaurant','Trattoria':'restaurant','Osteria':'restaurant',
    'Ristorante':'restaurant','Fast food':'fast_food','Bar':'bar',
    'Caffè':'cafe','Gelateria':'ice_cream','Pub':'pub',
    'B&B':'guest_house','Agriturismo':'guest_house','Affittacamere':'guest_house',
    'Casa vacanze':'apartment','Hotel':'hotel','Ostello':'hostel',
  };
  const TYPE_TO_LODGING_KIND = {
    'B&B':'bed_and_breakfast','Agriturismo':'agritourism','Affittacamere':'affittacamere',
  };
  const TYPE_TO_CUISINE = {
    'Pizzeria':'pizza','Trattoria':'italian;regional','Osteria':'italian;regional',
    'Ristorante':'italian','Gelateria':'ice_cream',
  };

  /** Documento Firestore (anche malformato) -> oggetto mostrabile, oppure null.
   *  Ogni campo e' controllato: tipi sbagliati vengono scartati o azzerati. */
  function toPublicShape(r) {
    try {
      if (!r || typeof r !== 'object') return null;
      const id = str(r.id, 200);
      const name = typeof r.name === 'string' ? r.name.slice(0, 200).trim() : '';
      const lat = num(r.lat), lng = num(r.lng);
      if (!id || !name || !isFinite(lat) || !isFinite(lng)) return null;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
      const type = (typeof r.type === 'string' && (FOOD_TYPES.includes(r.type) || LODGING_TYPES.includes(r.type))) ? r.type : 'Ristorante';
      const feats = strList(r.features, 30, 80);
      const website = safeWebsite(r.website);
      const has = re => feats.some(f => re.test(f)) ? 'yes' : '';
      const discount = Number.isInteger(r.directDiscount) && r.directDiscount > 0 && r.directDiscount <= 30 ? r.directDiscount : 0;
      const cin = normCin(str(r.cin, 30));
      return {
        id, name,
        amenity: TYPE_TO_AMENITY[type] || 'restaurant',
        cuisine: TYPE_TO_CUISINE[type] || '',
        lat, lng,
        address: str(r.address, 300), phone: cleanPhone(r.phone), website,
        facebook: '', instagram: '', opening_hours: '',
        // caratteristiche scritte dal titolare, in qualsiasi lingua dell'app
        takeaway:        has(/asporto|take ?away|para llevar|mitnehmen|emporter|テイクアウト|持ち帰り/i),
        delivery:        has(/domicilio|delivery|lieferung|livraison|デリバリー|配達/i),
        outdoor_seating: has(/terrazza|dehors|aperto|terrace|outdoor|terraza|terrasse|テラス/i),
        wheelchair:      has(/accessib|barrierefrei|バリアフリー|車椅子/i),
        vegetarian:      has(/vegetarian|vegetarisch|v[eé]g[eé]tarien|ベジタリアン/i),
        vegan:           has(/vegan|v[eé]gan|ヴィーガン|ビーガン/i),
        gluten_free:     has(/gluten|senza glutine|sin gluten|glutenfrei|sans gluten|グルテン/i),
        payments: strList(r.payments, 12, 40),
        rawTags: TYPE_TO_LODGING_KIND[type]
          ? { name, guest_house: TYPE_TO_LODGING_KIND[type] }
          : { name },
        userGenerated: true,
        type,
        hoursByDay: cleanHours(r.hours),
        menu: cleanMenu(r.menu),
        features: feats,
        owner: str(r.owner, 128),
        updatedAt: tsMillis(r.updatedAt) || tsMillis(r.createdAt),
        // Prenotazione diretta / anti-truffa
        cin: CIN_RE.test(cin) ? cin : '',
        directDiscount: discount,
        whatsapp: cleanPhone(r.whatsapp),
        contactEmail: str(r.contactEmail, 200).trim(),
        // verificato solo per il sito controllato: se il titolare cambia sito
        // il segno sparisce subito (le Rules e lo script fanno il resto)
        verified: r.verified === true && (!r.verifiedFor || r.verifiedFor === siteHost(website)),
      };
    } catch (e) {
      console.warn('Annuncio scartato (dati non validi):', r && r.id, e && e.message);
      return null;
    }
  }
  // Annuncio visibile al pubblico? (nascosti e alloggi senza CIN esclusi)
  function publicOk(raw, shaped) {
    if (!shaped || raw.hidden === true) return false;
    if (LODGING_TYPES.includes(shaped.type) && !shaped.cin) return false;
    return true;
  }

  // ---------- REST (lettura pubblica, senza SDK) ----------
  function decodeValue(v) {
    if (!v || typeof v !== 'object') return undefined;
    if ('stringValue' in v) return v.stringValue;
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return Number(v.doubleValue);
    if ('booleanValue' in v) return v.booleanValue === true;
    if ('nullValue' in v) return null;
    if ('timestampValue' in v) return v.timestampValue;
    if ('arrayValue' in v) return ((v.arrayValue && v.arrayValue.values) || []).map(decodeValue);
    if ('mapValue' in v) return decodeFields((v.mapValue && v.mapValue.fields) || {});
    return undefined;
  }
  function decodeFields(fields) {
    const out = {};
    if (fields && typeof fields === 'object') for (const k of Object.keys(fields)) out[k] = decodeValue(fields[k]);
    return out;
  }
  const docIdFromName = name => String(name || '').split('/').pop();

  async function restFetch(url, opts = {}, ms = 12000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try { return await fetch(url, { ...opts, signal: ctrl.signal, credentials: 'omit' }); }
    finally { clearTimeout(timer); }
  }
  const fieldFilter = (path, op, value) => ({ fieldFilter: { field: { fieldPath: path }, op, value } });

  let indexMissing = false;  // indice composito (hidden, lat) non ancora creato
  async function runPublicQuery(minLat, maxLat) {
    const filters = [fieldFilter('hidden', 'EQUAL', { booleanValue: false })];
    if (!indexMissing) {
      filters.push(fieldFilter('lat', 'GREATER_THAN_OR_EQUAL', { doubleValue: minLat }));
      filters.push(fieldFilter('lat', 'LESS_THAN_OR_EQUAL', { doubleValue: maxLat }));
    }
    const structuredQuery = {
      from: [{ collectionId: RESTAURANTS }],
      where: filters.length === 1 ? filters[0] : { compositeFilter: { op: 'AND', filters } },
    };
    if (!indexMissing) structuredQuery.limit = PUBLIC_LIMIT;
    const resp = await restFetch(`${REST_BASE}:runQuery?key=${firebaseConfig.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ structuredQuery }),
    });
    if (!resp.ok) {
      let body = null;
      try { body = await resp.json(); } catch {}
      const err = body && (Array.isArray(body) ? body[0] && body[0].error : body.error);
      // Indice composito mancante: si ripiega su hidden == false (funziona
      // senza indice, legge di piu'). Vedi SETUP-FIREBASE.md per crearlo.
      if (!indexMissing && err && err.status === 'FAILED_PRECONDITION') {
        indexMissing = true;
        console.info('RistoApp: indice Firestore (hidden, lat) non presente: uso la lettura semplice. Vedi SETUP-FIREBASE.md.');
        return runPublicQuery(minLat, maxLat);
      }
      throw new Error('Firestore HTTP ' + resp.status);
    }
    const rows = await resp.json();
    const out = [];
    for (const row of Array.isArray(rows) ? rows : []) {
      try {
        if (!row || !row.document) continue;
        out.push({ id: docIdFromName(row.document.name), ...decodeFields(row.document.fields) });
      } catch (e) { console.warn('Documento non leggibile:', e && e.message); }
    }
    return out;
  }

  // Cache in memoria per fascia di latitudine (quadranti da 0.1 gradi), 10 minuti
  const publicCache = new Map();
  async function publicNear(origin, radiusM) {
    const lat = num(origin && origin.lat), lng = num(origin && origin.lng);
    if (!isFinite(lat) || !isFinite(lng)) return [];
    const r = Math.max(0, num(radiusM) || 0);
    const dLat = r / 111320;
    const dLng = r / (111320 * Math.max(0.2, Math.cos(lat * Math.PI / 180)));
    const minLat = Math.floor((lat - dLat) * 10) / 10;
    const maxLat = Math.ceil((lat + dLat) * 10) / 10;
    if (maxLat < BBOX.minLat || minLat > BBOX.maxLat) return [];
    const key = indexMissing ? 'all' : `${minLat.toFixed(1)}_${maxLat.toFixed(1)}`;
    let entry = publicCache.get(key);
    if (!entry || Date.now() - entry.t > PUBLIC_TTL_MS) {
      const p = runPublicQuery(minLat, maxLat).then(rows => {
        const list = [];
        for (const raw of rows) {
          const shaped = toPublicShape(raw);
          if (publicOk(raw, shaped)) list.push(shaped);
        }
        return list;
      });
      entry = { t: Date.now(), p };
      publicCache.set(indexMissing ? 'all' : key, entry);
      p.catch(() => { if (publicCache.get(key) === entry) publicCache.delete(key); });
    }
    const list = await entry.p;
    return list.filter(x => x.lat >= lat - dLat - 0.05 && x.lat <= lat + dLat + 0.05
                         && x.lng >= lng - dLng - 0.05 && x.lng <= lng + dLng + 0.05);
  }

  let osmHiddenEntry = null;
  async function osmHiddenIds() {
    if (osmHiddenEntry && Date.now() - osmHiddenEntry.t < PUBLIC_TTL_MS) return osmHiddenEntry.p;
    const p = (async () => {
      const ids = new Set();
      let pageToken = '';
      for (let page = 0; page < 5; page++) {
        const url = `${REST_BASE}/${OSM_HIDDEN}?pageSize=300&key=${firebaseConfig.apiKey}` +
          (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
        const resp = await restFetch(url);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const body = await resp.json();
        for (const d of (body && body.documents) || []) {
          const f = decodeFields(d.fields);
          const osmId = typeof f.osmId === 'string' && isOsmId(f.osmId) ? f.osmId : docIdFromName(d.name).replace('_', '/');
          if (isOsmId(osmId)) ids.add(osmId);
        }
        pageToken = body && body.nextPageToken;
        if (!pageToken) break;
      }
      return ids;
    })();
    osmHiddenEntry = { t: Date.now(), p };
    p.catch(() => { osmHiddenEntry = null; });
    return p;
  }
  function clearPublicCache() { publicCache.clear(); osmHiddenEntry = null; }

  // ---------- SDK Firebase: caricamento su richiesta ----------
  let sdkPromise = null;
  let auth = null, db = null, FV = null;
  let currentUserObj = null;
  let sdkOk = false;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = false;            // ordine garantito (app prima di auth/firestore)
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('load ' + src));
      document.head.appendChild(s);
    });
  }

  const userShape = fbUser => fbUser ? {
    uid: fbUser.uid,
    email: fbUser.email || '',
    name: fbUser.displayName || '',
    emailVerified: !!fbUser.emailVerified,
  } : null;

  function ready() {
    if (!sdkPromise) {
      sdkPromise = (async () => {
        if (typeof firebase === 'undefined' || !firebase.firestore || !firebase.auth) {
          await loadScript(SDK_BASE + 'firebase-app-compat.js');
          await Promise.all([
            loadScript(SDK_BASE + 'firebase-auth-compat.js'),
            loadScript(SDK_BASE + 'firebase-firestore-compat.js'),
          ]);
        }
        if (typeof firebase === 'undefined') throw new Error('sdk');
        if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();
        FV = firebase.firestore.FieldValue;
        await new Promise(resolve => {
          let first = true;
          auth.onAuthStateChanged(fbUser => {
            currentUserObj = userShape(fbUser);
            if (first) { first = false; resolve(); return; }
            if (window.refreshPublicResults) window.refreshPublicResults();
          });
        });
        sdkOk = true;
      })().catch(e => {
        console.warn('Firebase SDK non caricato (rete o blocco pubblicità):', e && e.message);
        sdkPromise = null;
        throw new Error(t('auth.offline'));
      });
    }
    return sdkPromise;
  }
  async function need() { await ready(); }

  // Email di conferma: UN solo invio semplice (senza link di ritorno).
  async function sendVerification(fbUser) {
    await fbUser.sendEmailVerification();
    try { localStorage.setItem('ristoapp-verify-sent', String(Date.now())); } catch {}
  }

  // CIN: formato valido e non gia' registrato
  async function reserveCheck(raw, u) {
    const cin = normCin(raw);
    if (!cin) throw new Error(t('ed.cin.required'));
    if (!CIN_RE.test(cin)) throw new Error(t('ed.cin.bad'));
    const taken = await db.collection(CINS).doc(cin).get().catch(() => null);
    if (taken && taken.exists) {
      throw new Error(t(taken.data().owner === u.uid ? 'ed.cin.yours' : 'ed.cin.taken'));
    }
    return cin;
  }
  async function commitCin(batch, cin) {
    try {
      await batch.commit();
    } catch (e) {
      if (e?.code === 'permission-denied') {
        const again = await db.collection(CINS).doc(cin).get().catch(() => null);
        if (again && again.exists) throw new Error(t('ed.cin.taken'));
      }
      throw e;
    }
  }
  const okText = (s, max) => String(s || '').trim().slice(0, max);
  function requireAdmin() {
    if (!Store.isAdmin()) throw new Error(t('adm.notAdmin'));
  }

  const Store = {
    ready,
    loaded: () => sdkOk,
    // compatibilita': chi attende authReady carica l'SDK
    get authReady() { return ready().catch(() => {}); },

    currentUser() { return currentUserObj; },
    isAdmin() {
      const u = currentUserObj;
      return !!(u && u.emailVerified && CFG.adminEmail && u.email.toLowerCase() === CFG.adminEmail.toLowerCase());
    },

    async register(email, password, ristoratoreName) {
      await need();
      email = (email || '').trim().toLowerCase();
      if (!email || !password) throw new Error(t('auth.required'));
      if (password.length < 6) throw new Error(t('auth.tooShort'));
      let cred;
      try {
        cred = await auth.createUserWithEmailAndPassword(email, password);
        if (ristoratoreName) await cred.user.updateProfile({ displayName: String(ristoratoreName).slice(0, 100) });
      } catch (e) {
        throw new Error(friendlyAuthError(e));
      }
      currentUserObj = userShape(cred.user);
      if (ristoratoreName) currentUserObj.name = String(ristoratoreName).slice(0, 100);
      // Accettazione di informativa e condizioni (spuntata nel modulo)
      try { await Store.acceptTerms(); } catch (e) { console.warn('Accettazione termini non salvata:', e && e.message); }
      try { await sendVerification(cred.user); } catch (e) { console.warn('Email di conferma non inviata:', e); }
      return currentUserObj;
    },

    async login(email, password) {
      await need();
      email = (email || '').trim().toLowerCase();
      try {
        const cred = await auth.signInWithEmailAndPassword(email, password);
        currentUserObj = userShape(cred.user);
        return currentUserObj;
      } catch (e) {
        throw new Error(friendlyAuthError(e));
      }
    },

    async logout() { if (auth) await auth.signOut(); currentUserObj = null; },

    async termsStatus() {
      await need();
      const u = currentUserObj;
      if (!u) return { accepted: false };
      try {
        const snap = await db.collection(USERS).doc(u.uid).get();
        const d = snap.exists ? snap.data() : null;
        return { accepted: !!(d && d.acceptedTermsAt), version: d && d.termsVersion };
      } catch { return { accepted: true, unknown: true }; } // non bloccare il titolare se la lettura fallisce
    },
    async acceptTerms() {
      await need();
      const u = currentUserObj;
      if (!u) throw new Error(t('auth.notLoggedIn'));
      await db.collection(USERS).doc(u.uid).set({ acceptedTermsAt: FV.serverTimestamp(), termsVersion: TERMS_VERSION });
    },

    // Il CIN e' gia' registrato?
    async cinStatus(raw) {
      await need();
      const cin = normCin(raw);
      let snap;
      try { snap = await db.collection(CINS).doc(cin).get(); }
      catch (e) { console.warn('Controllo CIN non riuscito:', e); throw new Error(t('cin.err.network')); }
      const u = currentUserObj;
      return { taken: snap.exists, mine: !!(snap.exists && u && snap.data().owner === u.uid) };
    },

    async resendVerification() {
      await need();
      if (!auth.currentUser) throw new Error(t('auth.notLoggedIn'));
      try { await sendVerification(auth.currentUser); }
      catch (e) { throw new Error(friendlyAuthError(e)); }
    },

    // Dopo aver cliccato il link: ricarica l'utente e rinnova il token,
    // cosi' le Firestore Rules vedono subito email_verified == true
    async reloadUser() {
      await need();
      const fbUser = auth.currentUser;
      if (!fbUser) throw new Error(t('auth.notLoggedIn'));
      await fbUser.reload();
      const fresh = auth.currentUser;
      if (fresh.emailVerified) await fresh.getIdToken(true);
      currentUserObj = userShape(fresh);
      return currentUserObj;
    },

    async myRestaurants() {
      await need();
      const u = currentUserObj;
      if (!u) return [];
      const snap = await db.collection(RESTAURANTS).where('owner', '==', u.uid).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async getRestaurant(id) {
      await need();
      const doc = await db.collection(RESTAURANTS).doc(String(id)).get();
      if (!doc.exists) return null;
      return { id: doc.id, ...doc.data() };
    },

    async saveRestaurant(r) {
      await need();
      const u = currentUserObj;
      if (!u) throw new Error(t('auth.notLoggedIn'));
      const lodging = LODGING_TYPES.includes(r.type);
      const discount = parseInt(r.directDiscount, 10);
      const hours = cleanHours(r.hours);
      const hoursMap = {};
      Object.keys(hours).forEach(k => { hoursMap[String(k)] = hours[k]; });
      // NB: il client non invia mai i campi del server (verified, hiddenReason...)
      const payload = {
        name:     okText(r.name, 200),
        type:     r.type,
        address:  okText(r.address, 300),
        phone:    cleanPhone(r.phone),
        website:  safeWebsite(r.website),
        lat:      Number(r.lat),
        lng:      Number(r.lng),
        hours:    hoursMap,
        payments: strList(r.payments, 12, 40),
        features: strList(r.features, 30, 80),
        menu:     cleanMenu(r.menu),
        owner:    u.uid,
        updatedAt: FV.serverTimestamp(),
        declarationAt: FV.serverTimestamp(),
      };
      if (lodging) {
        payload.directDiscount = Number.isInteger(discount) && discount > 0 && discount <= 30 ? discount : 0;
        payload.whatsapp = cleanPhone(r.whatsapp);
        payload.contactEmail = okText(r.contactEmail, 200).toLowerCase();
        if (!u.emailVerified) throw new Error(t('ed.needVerifiedEmail'));
      }
      try {
        if (!r.id) {
          payload.createdAt = FV.serverTimestamp();
          payload.hidden = false;
          if (!lodging) {
            const ref = await db.collection(RESTAURANTS).add(payload);
            clearPublicCache();
            return { id: ref.id, ...payload };
          }
          // Alloggio: CIN univoco -> doc cin/{CIN} scritto nello STESSO batch
          const cin = await reserveCheck(r.cin, u);
          payload.cin = cin;
          const ref = db.collection(RESTAURANTS).doc(); // id generato prima
          const batch = db.batch();
          batch.set(ref, payload);
          batch.set(db.collection(CINS).doc(cin), { owner: u.uid, restaurant: ref.id });
          await commitCin(batch, cin);
          clearPublicCache();
          return { id: ref.id, ...payload };
        }
        const docRef = db.collection(RESTAURANTS).doc(r.id);
        const existing = await docRef.get();
        if (!existing.exists) throw new Error(t('auth.notFound'));
        const old = existing.data();
        if (old.owner !== u.uid) throw new Error(t('auth.notOwner'));
        // Dati vecchi non piu' ammessi: si cancellano (l'email del titolare
        // non va tenuta in un documento pubblico)
        ['ownerEmail', 'reportsCount'].forEach(k => { if (k in old) payload[k] = FV.delete(); });
        if (!('hidden' in old)) payload.hidden = false;
        // Nome, sito, telefono, WhatsApp, email, CIN o indirizzo cambiati:
        // la verifica decade subito (lo impongono anche le Rules)
        if (old.verified === true && IDENTITY_FIELDS.some(k => k in payload && payload[k] !== old[k])) {
          payload.verified = false;
        }
        if (lodging && !old.cin) {
          // annuncio creato prima dell'obbligo del CIN: si aggiunge una volta sola
          const cin = await reserveCheck(r.cin, u);
          payload.cin = cin;
          if (old.verified === true) payload.verified = false;
          const batch = db.batch();
          batch.update(docRef, payload);
          batch.set(db.collection(CINS).doc(cin), { owner: u.uid, restaurant: r.id });
          await commitCin(batch, cin);
          clearPublicCache();
          return { id: r.id, ...old, ...payload };
        }
        await docRef.update(payload);
        clearPublicCache();
        return { id: r.id, ...old, ...payload };
      } catch (e) {
        if (e?.code === 'permission-denied') throw new Error(t('ed.permission'));
        throw e;
      }
    },

    // "Ho pubblicato il codice": il controllo automatico lo riprende entro un'ora
    async requestVerification(id) {
      await need();
      const now = FV.serverTimestamp();
      await db.collection(RESTAURANTS).doc(String(id)).update({ verifyRequestedAt: now, updatedAt: now });
    },

    async deleteRestaurant(id) {
      await need();
      const u = currentUserObj;
      if (!u) throw new Error(t('auth.notLoggedIn'));
      const ref = db.collection(RESTAURANTS).doc(id);
      const snap = await ref.get();
      const cin = snap.exists ? snap.data().cin : null;
      const batch = db.batch();
      batch.delete(ref);
      if (cin) {
        const cinRef = db.collection(CINS).doc(cin);
        const c = await cinRef.get().catch(() => null);
        if (c && c.exists && c.data().owner === u.uid) batch.delete(cinRef);
      }
      await batch.commit();
      clearPublicCache();
    },

    // Cancellazione completa dell'account (diritto alla cancellazione, GDPR)
    async deleteAccount(password) {
      await need();
      const fbUser = auth.currentUser;
      if (!fbUser) throw new Error(t('auth.notLoggedIn'));
      try {
        const cred = firebase.auth.EmailAuthProvider.credential(fbUser.email, password || '');
        await fbUser.reauthenticateWithCredential(cred);
      } catch (e) { throw new Error(friendlyAuthError(e)); }
      const snap = await db.collection(RESTAURANTS).where('owner', '==', fbUser.uid).get();
      for (const doc of snap.docs) {
        const batch = db.batch();
        batch.delete(doc.ref);
        const cin = doc.data().cin;
        if (cin) {
          const cinRef = db.collection(CINS).doc(cin);
          const c = await cinRef.get().catch(() => null);
          if (c && c.exists && c.data().owner === fbUser.uid) batch.delete(cinRef);
        }
        await batch.commit();
      }
      // Rivendicazioni di CIN (contengono l'email) e registro dei termini.
      // Le contestazioni (appeals) restano fino a 24 mesi (vedi informativa).
      try {
        const claims = await db.collection(CIN_CLAIMS).where('owner', '==', fbUser.uid).get();
        for (const c of claims.docs) await c.ref.delete().catch(() => {});
      } catch {}
      await db.collection(USERS).doc(fbUser.uid).delete().catch(() => {});
      try { await fbUser.delete(); } catch (e) { throw new Error(friendlyAuthError(e)); }
      try { ['ristoapp-pending-cin', 'ristoapp-verify-sent', 'ristoapp-pending-claim'].forEach(k => localStorage.removeItem(k)); } catch {}
      currentUserObj = null;
      clearPublicCache();
    },

    publicNear, osmHiddenIds, clearPublicCache,
    // compatibilita' con il codice precedente (ora limitata alla zona)
    allPublicRestaurants: (origin, radius) => publicNear(origin, radius),

    // Segnalazione anonima (funziona senza login). Ritorna il codice di riferimento.
    async report({ restaurant, name, reason, text }) {
      restaurant = String(restaurant || '').slice(0, 199);
      if (!restaurant || !REPORT_REASONS.includes(reason)) throw new Error(t('rep.error'));
      try { await need(); }
      catch { throw new Error(t('rep.offline')); }
      try {
        const ref = await db.collection(REPORTS).add({
          restaurant, reason,
          name: String(name || '').slice(0, 200),
          text: String(text || '').slice(0, 500),
          lang: ((window.I18N && window.I18N.lang) || 'it').slice(0, 5),
          status: 'open',
          createdAt: FV.serverTimestamp(),
        });
        return ref.id;
      } catch (e) {
        console.warn('Segnalazione non inviata:', e);
        throw new Error(t('rep.error'));
      }
    },

    // ---------- Contestazioni del titolare (annuncio nascosto) ----------
    async myAppeals() {
      await need();
      const u = currentUserObj;
      if (!u) return [];
      const snap = await db.collection(APPEALS).where('owner', '==', u.uid).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    async createAppeal(restaurantId, text) {
      await need();
      const u = currentUserObj;
      if (!u) throw new Error(t('auth.notLoggedIn'));
      text = okText(text, 1000);
      if (!text) throw new Error(t('appeal.empty'));
      const ref = await db.collection(APPEALS).add({
        restaurant: String(restaurantId), owner: u.uid, text, status: 'open', createdAt: FV.serverTimestamp(),
      });
      return ref.id;
    },

    // ---------- Rivendicazione di un CIN usato da altri ----------
    async myCinClaims() {
      await need();
      const u = currentUserObj;
      if (!u) return [];
      const snap = await db.collection(CIN_CLAIMS).where('owner', '==', u.uid).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },
    async createCinClaim(rawCin, text) {
      await need();
      const u = currentUserObj;
      if (!u) throw new Error(t('auth.notLoggedIn'));
      if (!u.emailVerified) throw new Error(t('claim.needVerified'));
      const cin = normCin(rawCin);
      if (!CIN_RE.test(cin)) throw new Error(t('ed.cin.bad'));
      text = okText(text, 1000);
      if (!text) throw new Error(t('claim.empty'));
      try {
        const ref = await db.collection(CIN_CLAIMS).add({
          cin, owner: u.uid, email: u.email, text, status: 'open', createdAt: FV.serverTimestamp(),
        });
        return ref.id;
      } catch (e) {
        if (e?.code === 'permission-denied') throw new Error(t('claim.denied'));
        throw e;
      }
    },

    // ---------- Moderazione (solo amministratore: lo impongono le Rules) ----------
    isOsmId,
    async adminOpen(collection) {
      await need(); requireAdmin();
      if (![REPORTS, APPEALS, CIN_CLAIMS].includes(collection)) throw new Error('collection');
      const snap = await db.collection(collection).where('status', '==', 'open').limit(200).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => tsMillis(b.createdAt) - tsMillis(a.createdAt));
    },
    async adminHidden() {
      await need(); requireAdmin();
      const snap = await db.collection(RESTAURANTS).where('hidden', '==', true).limit(200).get();
      const osm = await db.collection(OSM_HIDDEN).limit(300).get();
      return {
        listings: snap.docs.map(d => ({ id: d.id, ...d.data() })),
        osm: osm.docs.map(d => ({ id: d.id, ...d.data() })),
      };
    },
    async adminGetListing(id) {
      await need(); requireAdmin();
      if (isOsmId(id)) {
        const s = await db.collection(OSM_HIDDEN).doc(osmDocId(id)).get();
        return { id, osm: true, hidden: s.exists, ...(s.exists ? s.data() : {}) };
      }
      const s = await db.collection(RESTAURANTS).doc(String(id)).get();
      return s.exists ? { id, ...s.data() } : null;
    },
    async adminHide(id, note, opts = {}) {
      const reason = opts.reason === 'cin_claim' ? 'cin_claim' : 'moderation';
      await need(); requireAdmin();
      note = okText(note, 1000);
      if (!note) throw new Error(t('adm.noteRequired'));
      if (isOsmId(id)) {
        await db.collection(OSM_HIDDEN).doc(osmDocId(id)).set({
          osmId: String(id), name: okText(opts.name || '', 200), note, hiddenAt: FV.serverTimestamp(),
        });
      } else {
        await db.collection(RESTAURANTS).doc(String(id)).update({
          hidden: true, hiddenReason: reason, hiddenNote: note, moderatedAt: FV.serverTimestamp(),
        });
      }
      clearPublicCache();
    },
    async adminUnhide(id) {
      await need(); requireAdmin();
      if (isOsmId(id)) await db.collection(OSM_HIDDEN).doc(osmDocId(id)).delete();
      else await db.collection(RESTAURANTS).doc(String(id)).update({
        hidden: false, hiddenReason: FV.delete(), hiddenNote: FV.delete(), moderatedAt: FV.serverTimestamp(),
      });
      clearPublicCache();
    },
    async adminClose(collection, id, resolution) {
      await need(); requireAdmin();
      if (![REPORTS, APPEALS, CIN_CLAIMS].includes(collection)) throw new Error('collection');
      await db.collection(collection).doc(String(id)).update({
        status: 'closed', resolution: String(resolution).slice(0, 20), closedAt: FV.serverTimestamp(),
      });
    },
    // Chiude tutte le segnalazioni aperte di un annuncio
    async adminCloseReportsFor(restaurantId, resolution) {
      await need(); requireAdmin();
      const snap = await db.collection(REPORTS).where('restaurant', '==', String(restaurantId)).get();
      const open = snap.docs.filter(d => d.data().status === 'open');
      for (const d of open) {
        await d.ref.update({ status: 'closed', resolution: String(resolution).slice(0, 20), closedAt: FV.serverTimestamp() });
      }
      return open.length;
    },
    // "Libera CIN": elimina cin/{CIN} e nasconde l'annuncio che lo occupava
    async adminReleaseCin(claim, note) {
      await need(); requireAdmin();
      note = okText(note, 1000);
      if (!note) throw new Error(t('adm.noteRequired'));
      const cin = normCin(claim.cin);
      const cinRef = db.collection(CINS).doc(cin);
      const c = await cinRef.get();
      const batch = db.batch();
      if (c.exists) {
        const rid = c.data().restaurant;
        const rs = rid ? await db.collection(RESTAURANTS).doc(rid).get() : null;
        if (rs && rs.exists) batch.update(rs.ref, {
          hidden: true, hiddenReason: 'cin_claim', hiddenNote: note, moderatedAt: FV.serverTimestamp(),
        });
        batch.delete(cinRef);
      }
      batch.update(db.collection(CIN_CLAIMS).doc(claim.id), {
        status: 'closed', resolution: 'released', closedAt: FV.serverTimestamp(),
      });
      await batch.commit();
      clearPublicCache();
    },
    async adminCinHolder(rawCin) {
      await need(); requireAdmin();
      const s = await db.collection(CINS).doc(normCin(rawCin)).get();
      return s.exists ? s.data() : null;
    },
    // per i test
    _toPublicShape: toPublicShape,
    _decodeFields: decodeFields,
    _safeWebsite: safeWebsite,
  };

  function friendlyAuthError(e) {
    const code = e?.code || '';
    switch (code) {
      case 'auth/email-already-in-use':  return t('auth.emailInUse');
      case 'auth/invalid-email':         return t('auth.invalidEmail');
      case 'auth/weak-password':         return t('auth.weakPassword');
      case 'auth/user-not-found':        return t('auth.userNotFound');
      case 'auth/wrong-password':
      case 'auth/invalid-credential':    return t('auth.wrongPassword');
      case 'auth/too-many-requests':     return t('auth.tooMany');
      case 'auth/network-request-failed':return t('auth.network');
      default: return e?.message || t('auth.generic');
    }
  }

  window.RistoStore = Store;
})();
