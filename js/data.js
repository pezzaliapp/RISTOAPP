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
  // i ristoranti via tag OSM `cuisine`.
  cuisineKeywords: {
    pizza:        ['pizza','margherita','marinara','diavola','calzone','bufalina','capricciosa','napoletana','focaccia'],
    italian:      ['pasta','spaghetti','tagliatelle','lasagne','ravioli','cappelletti','tortellini','gnocchi','risotto','carbonara','amatriciana','bolognese','italiano','trattoria','osteria','vincisgrassi'],
    seafood:      ['pesce','cozze','vongole','brodetto','frutti di mare','scampi','gamberi'],
    japanese:     ['sushi','ramen','giapponese','tempura','nigiri','sashimi'],
    chinese:      ['cinese','involtini','riso alla cantonese'],
    kebab:        ['kebab','doner','shawarma'],
    burger:       ['burger','hamburger','cheeseburger'],
    regional:     ['tipico','tradizionale','casalingo'],
    vegetarian:   ['vegetariano','vegano','vegan','veggie'],
    mexican:      ['tacos','burrito','messicano','fajitas','nachos'],
    indian:       ['indiano','curry','naan','tikka','tandoori'],
    ice_cream:    ['gelato','gelateria'],
    coffee_shop:  ['caff\u00E8','caffetteria','cappuccino','espresso'],
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
  },

  // Istanze Overpass pubbliche con copertura mondiale (provate in ordine).
  // NB: overpass.kumi.systems e overpass.private.coffee sono lo STESSO
  // server (rinominato), quindi ne teniamo uno solo.
  overpassEndpoints: [
    'https://overpass-api.de/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
  ],
  overpassTimeoutMs: 20000,         // timeout per singolo server
  osmCacheTtlMs: 24 * 60 * 60 * 1000, // cache risultati OSM: 24 ore

  nominatimEndpoint: 'https://nominatim.openstreetmap.org/search',

  defaultRadius: 3000,
  maxRadius:    10000,
};

window.RISTOAPP_CONFIG = RISTOAPP_CONFIG;
