/* ============================================================
 *  RISTOAPP - Store (Firebase Auth + Firestore)
 *  FASE 2: backend condiviso tra tutti gli utenti.
 *
 *  API pubblica (stessa della Fase 1 localStorage, in modo che
 *  owner.js e app.js funzionino senza modifiche invasive):
 *    Store.register(email, pwd, name)   -> Promise<user>
 *    Store.login(email, pwd)            -> Promise<user>
 *    Store.logout()                     -> Promise<void>
 *    Store.currentUser()                -> user | null  (sincrono)
 *    Store.authReady                    -> Promise<void> (primo auth check)
 *    Store.myRestaurants()              -> Promise<restaurant[]>
 *    Store.getRestaurant(id)            -> Promise<restaurant|null>
 *    Store.saveRestaurant(r)            -> Promise<restaurant>
 *    Store.deleteRestaurant(id)         -> Promise<void>
 *    Store.allPublicRestaurants()       -> Promise<restaurant[]>  (senza i nascosti)
 *    Store.resendVerification()         -> Promise<void>  (email di conferma)
 *    Store.reloadUser()                 -> Promise<user>  (aggiorna emailVerified)
 *    Store.report({restaurant, reason, text}) -> Promise<void> (senza login)
 *
 *  Campi gestiti SOLO dal server (scripts/verify-owners.mjs): verified,
 *  verifiedMethod, verifiedAt, verifiedFor, hidden, reportsCount.
 *  Il client non li invia mai (le Firestore Rules lo impongono).
 *
 *  Config Firebase pubblica (OK esposta nel client: la sicurezza
 *  \u00E8 garantita dalle Firestore Rules lato server).
 * ============================================================ */

(() => {
  // Messaggi tradotti (i18n.js e' caricato prima; fallback alla chiave)
  const t = (k, p) => (window.I18N ? window.I18N.t(k, p) : k);

  const firebaseConfig = {
    apiKey:            'AIzaSyDOat9cV39fu1OxVIn1tGFuDe_Owd5Er20',
    authDomain:        'ristoapp-b4215.firebaseapp.com',
    projectId:         'ristoapp-b4215',
    storageBucket:     'ristoapp-b4215.firebasestorage.app',
    messagingSenderId: '603049958177',
    appId:             '1:603049958177:web:c7fb1cff624f533f50bc60',
  };

  if (typeof firebase === 'undefined') {
    console.error('Firebase SDK non caricato (rete o blocco pubblicit\u00E0).');
    // Store "vuoto": la ricerca funziona lo stesso, l'area ristoratori
    // mostra un errore chiaro invece di bloccarsi.
    const offline = () => Promise.reject(new Error(t('auth.offline')));
    window.RistoStore = {
      authReady: Promise.resolve(),
      register: offline, login: offline, logout: async () => {},
      currentUser: () => null,
      myRestaurants: async () => [], getRestaurant: async () => null,
      saveRestaurant: offline, deleteRestaurant: offline,
      allPublicRestaurants: async () => [],
      resendVerification: offline, reloadUser: offline,
      report: () => Promise.reject(new Error(t('rep.offline'))),
    };
    return;
  }

  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db   = firebase.firestore();
  const RESTAURANTS = 'restaurants';
  const CINS = 'cin';
  const REPORTS = 'reports';
  const FV = firebase.firestore.FieldValue;

  // Tipologie di alloggio (valori salvati in Firestore, in italiano)
  const LODGING_TYPES = ['B&B','Agriturismo','Affittacamere','Casa vacanze','Hotel','Ostello'];
  const CIN_RE = /^IT\d{6}[A-Z0-9]{2}[A-Z0-9]{1,8}$/;
  const REPORT_REASONS = ['fake','not_owner','payment','wrong_data','other'];
  const normCin = s => String(s || '').toUpperCase().replace(/\s+/g, '');

  // Solo link http(s): un sito "javascript:..." non deve mai finire in un href
  function safeWebsite(u) {
    u = String(u || '').trim();
    if (!u) return '';
    if (/^https?:\/\/[^\s"'<>]+$/i.test(u)) return u;
    if (/^[a-z0-9.-]+\.[a-z]{2,}(\/[^\s"'<>]*)?$/i.test(u)) return 'https://' + u;
    return '';
  }
  function siteHost(u) {
    try { return new URL(safeWebsite(u)).hostname.toLowerCase().replace(/^www\./, ''); }
    catch { return ''; }
  }

  // ---------- Mapping UI -> OSM shape ----------
  const TYPE_TO_AMENITY = {
    'Pizzeria':'restaurant','Trattoria':'restaurant','Osteria':'restaurant',
    'Ristorante':'restaurant','Fast food':'fast_food','Bar':'bar',
    'Caff\u00E8':'cafe','Gelateria':'ice_cream','Pub':'pub',
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
  function toPublicShape(r) {
    const feats = r.features || [];
    return {
      id: r.id, name: r.name,
      amenity: TYPE_TO_AMENITY[r.type] || 'restaurant',
      cuisine: TYPE_TO_CUISINE[r.type] || '',
      lat: r.lat, lng: r.lng,
      address: r.address || '', phone: r.phone || '', website: safeWebsite(r.website),
      facebook: '', instagram: '', opening_hours: '',
      // caratteristiche scritte dal titolare, in qualsiasi lingua dell'app
      takeaway:        feats.some(f => /asporto|take ?away|para llevar|mitnehmen|emporter|\u30C6\u30A4\u30AF\u30A2\u30A6\u30C8|\u6301\u3061\u5E30\u308A/i.test(f)) ? 'yes' : '',
      delivery:        feats.some(f => /domicilio|delivery|lieferung|livraison|\u30C7\u30EA\u30D0\u30EA\u30FC|\u914D\u9054/i.test(f)) ? 'yes' : '',
      outdoor_seating: feats.some(f => /terrazza|dehors|aperto|terrace|outdoor|terraza|terrasse|\u30C6\u30E9\u30B9/i.test(f)) ? 'yes' : '',
      wheelchair:      feats.some(f => /accessib|barrierefrei|\u30D0\u30EA\u30A2\u30D5\u30EA\u30FC|\u8ECA\u6905\u5B50/i.test(f)) ? 'yes' : '',
      vegetarian:      feats.some(f => /vegetarian|vegetarisch|v[e\u00E9]g[e\u00E9]tarien|\u30D9\u30B8\u30BF\u30EA\u30A2\u30F3/i.test(f)) ? 'yes' : '',
      vegan:           feats.some(f => /vegan|v[e\u00E9]gan|\u30F4\u30A3\u30FC\u30AC\u30F3|\u30D3\u30FC\u30AC\u30F3/i.test(f)) ? 'yes' : '',
      gluten_free:     feats.some(f => /gluten|senza glutine|sin gluten|glutenfrei|sans gluten|\u30B0\u30EB\u30C6\u30F3/i.test(f)) ? 'yes' : '',
      payments: r.payments || [],
      rawTags: TYPE_TO_LODGING_KIND[r.type]
        ? { name: r.name, guest_house: TYPE_TO_LODGING_KIND[r.type] }
        : { name: r.name },
      userGenerated: true,
      type: r.type,
      hoursByDay: r.hours || {},
      menu: r.menu || [],
      features: feats,
      owner: r.owner,
      updatedAt: r.updatedAt || r.createdAt,
      // Prenotazione diretta / anti-truffa
      cin: r.cin || '',
      directDiscount: Number.isInteger(r.directDiscount) ? r.directDiscount : 0,
      whatsapp: r.whatsapp || '',
      contactEmail: r.contactEmail || '',
      // verificato solo per il sito controllato: se il titolare cambia sito
      // il segno sparisce subito (lo script poi azzera anche il campo)
      verified: r.verified === true && (!r.verifiedFor || r.verifiedFor === siteHost(r.website)),
    };
  }

  // ---------- Auth state cache ----------
  let currentUserObj = null;
  let authReadyResolve;
  const authReady = new Promise(res => { authReadyResolve = res; });
  let authReadyFired = false;

  const userShape = fbUser => fbUser ? {
    uid: fbUser.uid,
    email: fbUser.email,
    name: fbUser.displayName || '',
    emailVerified: !!fbUser.emailVerified,
  } : null;

  // Link di conferma che riporta all'app (se il dominio non e' autorizzato
  // in Firebase, riprova senza indirizzo di ritorno)
  async function sendVerification(fbUser) {
    try {
      await fbUser.sendEmailVerification({ url: location.origin + location.pathname });
    } catch (e) {
      if (/continue-uri|unauthorized/i.test(e?.code || '')) await fbUser.sendEmailVerification();
      else throw e;
    }
  }

  auth.onAuthStateChanged(fbUser => {
    currentUserObj = userShape(fbUser);
    if (!authReadyFired) { authReadyFired = true; authReadyResolve(); }
    // Propaga lo stato all'app
    if (window.refreshPublicResults) window.refreshPublicResults();
  });

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
      // permesso negato: CIN registrato nel frattempo da un altro account?
      if (e?.code === 'permission-denied') {
        const again = await db.collection(CINS).doc(cin).get().catch(() => null);
        if (again && again.exists) throw new Error(t('ed.cin.taken'));
      }
      throw e;
    }
  }

  const Store = {
    // esposta in modo che chi vuole pu\u00F2 attendere il primo check auth
    authReady,

    async register(email, password, ristoratoreName) {
      email = (email || '').trim().toLowerCase();
      if (!email || !password) throw new Error(t('auth.required'));
      if (password.length < 6) throw new Error(t('auth.tooShort'));
      try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        if (ristoratoreName) {
          await cred.user.updateProfile({ displayName: ristoratoreName });
        }
        // Email di conferma: obbligatoria per pubblicare strutture ricettive
        try { await sendVerification(cred.user); } catch (e) { console.warn('Email di conferma non inviata:', e); }
        currentUserObj = userShape(cred.user);
        if (ristoratoreName) currentUserObj.name = ristoratoreName;
        return currentUserObj;
      } catch (e) {
        throw new Error(friendlyAuthError(e));
      }
    },

    async login(email, password) {
      email = (email || '').trim().toLowerCase();
      try {
        const cred = await auth.signInWithEmailAndPassword(email, password);
        currentUserObj = userShape(cred.user);
        return currentUserObj;
      } catch (e) {
        throw new Error(friendlyAuthError(e));
      }
    },

    async logout() { await auth.signOut(); },

    currentUser() { return currentUserObj; },

    async resendVerification() {
      if (!auth.currentUser) throw new Error(t('auth.notLoggedIn'));
      try { await sendVerification(auth.currentUser); }
      catch (e) { throw new Error(friendlyAuthError(e)); }
    },

    // Dopo aver cliccato il link: ricarica l'utente e rinnova il token,
    // cosi' le Firestore Rules vedono subito email_verified == true
    async reloadUser() {
      const fbUser = auth.currentUser;
      if (!fbUser) throw new Error(t('auth.notLoggedIn'));
      await fbUser.reload();
      const fresh = auth.currentUser;
      if (fresh.emailVerified) await fresh.getIdToken(true);
      currentUserObj = userShape(fresh);
      return currentUserObj;
    },

    async myRestaurants() {
      const u = currentUserObj;
      if (!u) return [];
      const snap = await db.collection(RESTAURANTS).where('owner', '==', u.uid).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async getRestaurant(id) {
      const doc = await db.collection(RESTAURANTS).doc(id).get();
      if (!doc.exists) return null;
      return { id: doc.id, ...doc.data() };
    },

    async saveRestaurant(r) {
      const u = currentUserObj;
      if (!u) throw new Error(t('auth.notLoggedIn'));
      const lodging = LODGING_TYPES.includes(r.type);
      const discount = parseInt(r.directDiscount, 10);
      // NB: mai inviare verified/hidden/reportsCount/verifiedMethod/verifiedAt
      const payload = {
        name:     r.name,
        type:     r.type,
        address:  r.address || '',
        phone:    r.phone || '',
        website:  safeWebsite(r.website),
        lat:      r.lat,
        lng:      r.lng,
        hours:    r.hours || {},
        payments: r.payments || [],
        features: r.features || [],
        menu:     r.menu || [],
        owner:    u.uid,
        updatedAt: FV.serverTimestamp(),
        declarationAt: FV.serverTimestamp(),
      };
      if (lodging) {
        payload.directDiscount = Number.isInteger(discount) && discount > 0 && discount <= 30 ? discount : 0;
        payload.whatsapp = String(r.whatsapp || '').trim();
        payload.contactEmail = String(r.contactEmail || '').trim().toLowerCase();
        if (!u.emailVerified) throw new Error(t('ed.needVerifiedEmail'));
      }
      try {
        if (!r.id) {
          payload.createdAt = FV.serverTimestamp();
          if (!lodging) {
            const ref = await db.collection(RESTAURANTS).add(payload);
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
          return { id: ref.id, ...payload };
        }
        const docRef = db.collection(RESTAURANTS).doc(r.id);
        const existing = await docRef.get();
        if (!existing.exists) throw new Error(t('auth.notFound'));
        if (existing.data().owner !== u.uid) throw new Error(t('auth.notOwner'));
        // il CIN non cambia mai (non si invia); l'email del titolare non va
        // tenuta in un documento pubblico (dati vecchi: si cancella)
        if ('ownerEmail' in existing.data()) payload.ownerEmail = FV.delete();
        if (lodging && !existing.data().cin) {
          // annuncio creato prima dell'obbligo del CIN: si aggiunge una volta sola
          const cin = await reserveCheck(r.cin, u);
          payload.cin = cin;
          const batch = db.batch();
          batch.update(docRef, payload);
          batch.set(db.collection(CINS).doc(cin), { owner: u.uid, restaurant: r.id });
          await commitCin(batch, cin);
          return { id: r.id, ...existing.data(), ...payload };
        }
        await docRef.update(payload);
        return { id: r.id, ...existing.data(), ...payload };
      } catch (e) {
        if (e?.code === 'permission-denied') throw new Error(t('ed.permission'));
        throw e;
      }
    },

    async deleteRestaurant(id) {
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
    },

    async allPublicRestaurants() {
      const snap = await db.collection(RESTAURANTS).get();
      return snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(r => r.hidden !== true)      // nascosti dopo le segnalazioni
        // gli annunci di alloggi senza CIN (obbligatorio per legge) non si mostrano
        .filter(r => !LODGING_TYPES.includes(r.type) || CIN_RE.test(r.cin || ''))
        .map(toPublicShape);
    },

    // Segnalazione anonima (funziona senza login)
    async report({ restaurant, reason, text }) {
      restaurant = String(restaurant || '').slice(0, 199);
      if (!restaurant || !REPORT_REASONS.includes(reason)) throw new Error(t('rep.error'));
      try {
        await db.collection(REPORTS).add({
          restaurant, reason,
          text: String(text || '').slice(0, 500),
          lang: (window.I18N && window.I18N.lang) || 'it',
          createdAt: FV.serverTimestamp(),
        });
      } catch (e) {
        console.warn('Segnalazione non inviata:', e);
        throw new Error(t('rep.error'));
      }
    },
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
