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
 *    Store.allPublicRestaurants()       -> Promise<restaurant[]>
 *    Store.onPublicChange(cb)           -> unsubscribe fn
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
    };
    return;
  }

  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db   = firebase.firestore();
  const RESTAURANTS = 'restaurants';

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
      address: r.address || '', phone: r.phone || '', website: r.website || '',
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
      verifiedAt: r.updatedAt || r.createdAt,
    };
  }

  // ---------- Auth state cache ----------
  let currentUserObj = null;
  let authReadyResolve;
  const authReady = new Promise(res => { authReadyResolve = res; });
  let authReadyFired = false;

  auth.onAuthStateChanged(fbUser => {
    if (fbUser) {
      currentUserObj = {
        uid: fbUser.uid,
        email: fbUser.email,
        name: fbUser.displayName || '',
      };
    } else {
      currentUserObj = null;
    }
    if (!authReadyFired) { authReadyFired = true; authReadyResolve(); }
    // Propaga lo stato all'app
    if (window.refreshPublicResults) window.refreshPublicResults();
  });

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
        return { uid: cred.user.uid, email: cred.user.email, name: ristoratoreName || '' };
      } catch (e) {
        throw new Error(friendlyAuthError(e));
      }
    },

    async login(email, password) {
      email = (email || '').trim().toLowerCase();
      try {
        const cred = await auth.signInWithEmailAndPassword(email, password);
        return { uid: cred.user.uid, email: cred.user.email, name: cred.user.displayName || '' };
      } catch (e) {
        throw new Error(friendlyAuthError(e));
      }
    },

    async logout() { await auth.signOut(); },

    currentUser() { return currentUserObj; },

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
      const payload = {
        name:     r.name,
        type:     r.type,
        address:  r.address || '',
        phone:    r.phone || '',
        website:  r.website || '',
        lat:      r.lat,
        lng:      r.lng,
        hours:    r.hours || {},
        payments: r.payments || [],
        features: r.features || [],
        menu:     r.menu || [],
        owner:    u.uid,
        ownerEmail: u.email,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      };
      if (!r.id) {
        payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        const ref = await db.collection(RESTAURANTS).add(payload);
        return { id: ref.id, ...payload };
      } else {
        const existing = await db.collection(RESTAURANTS).doc(r.id).get();
        if (!existing.exists) throw new Error(t('auth.notFound'));
        if (existing.data().owner !== u.uid) throw new Error(t('auth.notOwner'));
        await db.collection(RESTAURANTS).doc(r.id).update(payload);
        return { id: r.id, ...payload };
      }
    },

    async deleteRestaurant(id) {
      const u = currentUserObj;
      if (!u) throw new Error(t('auth.notLoggedIn'));
      await db.collection(RESTAURANTS).doc(id).delete();
    },

    async allPublicRestaurants() {
      const snap = await db.collection(RESTAURANTS).get();
      return snap.docs.map(d => toPublicShape({ id: d.id, ...d.data() }));
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
