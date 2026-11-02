/* ============================================================
 *  RISTOAPP - Configurazione
 *  Lista di citt\u00E0 italiane con coordinate per accesso rapido.
 *  L'utente pu\u00F2 comunque cercare QUALSIASI localit\u00E0: se non \u00E8
 *  in questa lista viene geocodificata tramite Nominatim (OSM).
 * ============================================================ */

const RISTOAPP_CONFIG = {
  // Citt\u00E0 preset (Marche + capoluoghi principali)
  cities: [
    { name: 'Civitanova Marche',   lat: 43.3065, lng: 13.7231 },
    { name: 'Porto Sant\u2019Elpidio', lat: 43.2583, lng: 13.7589 },
    { name: 'Porto San Giorgio',   lat: 43.1833, lng: 13.8000 },
    { name: 'Fermo',               lat: 43.1600, lng: 13.7180 },
    { name: 'Macerata',            lat: 43.3000, lng: 13.4530 },
    { name: 'Porto Recanati',      lat: 43.4333, lng: 13.6600 },
    { name: 'Montegranaro',        lat: 43.2333, lng: 13.6333 },
    { name: 'San Benedetto del Tronto', lat: 42.9440, lng: 13.8810 },
    { name: 'Ancona',              lat: 43.6158, lng: 13.5189 },
    { name: 'Pesaro',              lat: 43.9102, lng: 12.9139 },
    { name: 'Roma',                lat: 41.9028, lng: 12.4964 },
    { name: 'Milano',              lat: 45.4642, lng: 9.1900 },
    { name: 'Bologna',             lat: 44.4949, lng: 11.3426 },
    { name: 'Firenze',             lat: 43.7696, lng: 11.2558 },
    { name: 'Napoli',              lat: 40.8518, lng: 14.2681 },
    { name: 'Torino',              lat: 45.0703, lng: 7.6869 },
    { name: 'Bari',                lat: 41.1171, lng: 16.8719 },
    { name: 'Pescara',             lat: 42.4584, lng: 14.2081 },
  ],

  // Parole chiave che riconosciamo come "tipo cucina" per filtrare
  // i ristoranti via tag OSM `cuisine`. Oltre all'italiano: inglese,
  // spagnolo, tedesco, francese e giapponese (confronto per sottostringa,
  // senza accenti: vedi normalize() in app.js).
  cuisineKeywords: {
    pizza:        ['pizza','margherita','marinara','diavola','calzone','bufalina','capricciosa','napoletana','focaccia',
                   'pizzer\u00EDa','\u30D4\u30B6','\u30D4\u30C3\u30C4\u30A1'],                       // ピザ ピッツァ
    italian:      ['pasta','spaghetti','tagliatelle','lasagne','ravioli','cappelletti','tortellini','gnocchi','risotto','carbonara','amatriciana','bolognese','italiano','trattoria','osteria','vincisgrassi',
                   'italian','italienisch','italien',
                   '\u30D1\u30B9\u30BF','\u30A4\u30BF\u30EA\u30A2\u30F3','\u30A4\u30BF\u30EA\u30A2\u6599\u7406','\u30EA\u30BE\u30C3\u30C8'], // パスタ イタリアン イタリア料理 リゾット
    seafood:      ['pesce','cozze','vongole','brodetto','frutti di mare','scampi','gamberi',
                   'fish','seafood','prawn','shrimp','mussel','clam',
                   'pescado','marisco','gambas',
                   'fisch','meeresfr\u00FCchte','garnelen',
                   'poisson','fruits de mer','crevette','moule',
                   '\u9B5A','\u6D77\u9BAE','\u30B7\u30FC\u30D5\u30FC\u30C9'],                    // 魚 海鮮 シーフード
    japanese:     ['sushi','ramen','giapponese','tempura','nigiri','sashimi',
                   'japanese','japon\u00E9s','japonesa','japanisch','japonais',
                   '\u5BFF\u53F8','\u3059\u3057','\u30E9\u30FC\u30E1\u30F3','\u548C\u98DF','\u65E5\u672C\u6599\u7406','\u5929\u3077\u3089'], // 寿司 すし ラーメン 和食 日本料理 天ぷら
    chinese:      ['cinese','involtini','riso alla cantonese',
                   'chinese','comida china','chinesisch','chinois',
                   '\u4E2D\u83EF','\u4E2D\u56FD\u6599\u7406'],                                 // 中華 中国料理
    kebab:        ['kebab','doner','shawarma','d\u00F6ner','\u30B1\u30D0\u30D6'],               // ケバブ
    burger:       ['burger','hamburger','cheeseburger','hamburguesa','\u30CF\u30F3\u30D0\u30FC\u30AC\u30FC','\u30D0\u30FC\u30AC\u30FC'], // ハンバーガー バーガー
    regional:     ['tipico','tradizionale','casalingo',
                   'typical','traditional','local food','home cooking',
                   't\u00EDpico','tradicional','casero',
                   'traditionell','regional','hausmannskost',
                   'typique','traditionnel','fait maison',
                   '\u90F7\u571F\u6599\u7406','\u5BB6\u5EAD\u6599\u7406'],                     // 郷土料理 家庭料理
    vegetarian:   ['vegetariano','vegano','vegan','veggie',
                   'vegetarian','vegetarisch','v\u00E9g\u00E9tarien','v\u00E9g\u00E9',
                   '\u30D9\u30B8\u30BF\u30EA\u30A2\u30F3','\u30F4\u30A3\u30FC\u30AC\u30F3','\u83DC\u98DF'], // ベジタリアン ヴィーガン 菜食
    mexican:      ['tacos','burrito','messicano','fajitas','nachos',
                   'mexican','mexicano','mexikanisch','mexicain',
                   '\u30E1\u30AD\u30B7\u30B3','\u30BF\u30B3\u30B9'],                           // メキシコ タコス
    indian:       ['indiano','curry','naan','tikka','tandoori',
                   'indian','india','indisch','indien',
                   '\u30A4\u30F3\u30C9','\u30AB\u30EC\u30FC'],                                 // インド カレー
    ice_cream:    ['gelato','gelateria',
                   'ice cream','helado','helader\u00EDa','eiscreme','eisdiele','speiseeis','glace','glacier',
                   '\u30B8\u30A7\u30E9\u30FC\u30C8','\u30A2\u30A4\u30B9'],                     // ジェラート アイス
    coffee_shop:  ['caff\u00E8','caffetteria','cappuccino','espresso',
                   'coffee','caf\u00E9','cafeter\u00EDa','kaffee',
                   '\u30B3\u30FC\u30D2\u30FC','\u30AB\u30D5\u30A7'],                           // コーヒー カフェ
  },

  amenityLabels: {
    restaurant: 'Ristorante',
    fast_food:  'Fast food',
    pub:        'Pub',
    bar:        'Bar',
    cafe:       'Caff\u00E8',
    biergarten: 'Birreria',
    food_court: 'Food court',
    ice_cream:  'Gelateria',
    guest_house: 'B&B',
    hotel:      'Hotel',
    apartment:  'Casa vacanze',
    hostel:     'Ostello',
  },

  // Istanze Overpass pubbliche con copertura mondiale (provate in ordine).
  // NB: overpass.kumi.systems e overpass.private.coffee sono lo STESSO
  // server (rinominato), quindi ne teniamo uno solo.
  overpassEndpoints: [
    // Solo server nell'UE (vedi informativa privacy): il server extra-UE e' stato rimosso in 5.3.
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
  ],
  overpassTimeoutMs: 20000,         // timeout per singolo server
  osmCacheTtlMs: 24 * 60 * 60 * 1000, // cache risultati OSM: 24 ore

  nominatimEndpoint: 'https://nominatim.openstreetmap.org/search',

  defaultRadius: 3000,
  maxRadius:    10000,

  version: '5.3.1',

  // ------------------------------------------------------------------
  //  CHI GESTISCE RISTOAPP (unico punto da compilare)
  //  Mostrati in "Chi gestisce RistoApp", "Privacy e cookie" e
  //  "Condizioni d'uso". Finche' un valore e' vuoto o resta un
  //  segnaposto {{...}}, l'app mostra "[da completare]" (tradotto).
  // ------------------------------------------------------------------
  operator: {
    name:  'Alessandro Pezzali',   // es. 'Mario Rossi'
    city:  '',                    // non mostrato (non obbligatorio)   // es. 'Civitanova Marche (MC)'
    email: 'pezzaliapp@gmail.com',   // es. 'info@esempio.it'
  },
  // Data dell'ultimo aggiornamento dei testi legali (mese anno, per lingua)
  legalUpdated: { year: 2026, month: 11 },

  // Amministratore (moderazione). La vera protezione sono le Firestore
  // Rules (isAdmin): questo valore serve solo a mostrare il pannello.
  adminEmail: 'pezzalialessandro@gmail.com',

  // Area geografica ammessa per gli annunci (= Firestore Rules)
  italyBbox: { minLat: 35.2, maxLat: 47.2, minLng: 6.5, maxLng: 18.7 },
};

window.RISTOAPP_CONFIG = RISTOAPP_CONFIG;
