# 🍝 RISTOAPP v5.3

> **Trova ristoranti, pizzerie e trattorie in Italia e vai direttamente ai prezzi sui portali che usi già.**

PWA che cerca locali **reali** da OpenStreetMap e ti porta con un click al menu/prezzi su JustEat, Deliveroo, TheFork, Glovo, Google o TripAdvisor.

![Status](https://img.shields.io/badge/status-v5.3.1-C44536)
![PWA](https://img.shields.io/badge/PWA-ready-606C38)
![Data](https://img.shields.io/badge/data-OpenStreetMap-7A6A5C)

---

## 🎯 Filosofia

Perché non ci sono prezzi dentro l'app? **Perché nessuna API pubblica ha menu e prezzi dei ristoranti italiani**. Scraping dei portali = illegale e instabile. Quindi:

- **RistoApp trova il locale** (nome, indirizzo, orari, telefono, caratteristiche)
- **I portali specializzati mostrano menu e prezzi** (JustEat, Deliveroo, TheFork, Glovo...)
- **Una ricerca sola → tutti i canali**

È il modello Skyscanner/Trivago: non compete con i portali, li aggrega.

---

## ✨ Funzionalità

- 🔍 **Ricerca per piatto o tipo cucina** (pizza, sushi, trattoria, kebab…)
- 📍 **Geolocalizzazione**: un click e trova locali intorno a te (ovunque in Italia)
- 🏙️ **Ricerca libera per qualsiasi città** italiana — geocoding via Nominatim (OSM)
- 🍽️ **Filtri per tipo locale**: ristorante, pizzeria, bar, caffè, pub, gelateria
- 📏 **Raggio regolabile**: 1 / 3 / 5 / 10 km
- 🧭 **Ordinamento**: più vicini, A-Z, con orari disponibili prima
- 🔗 **Deep link diretti** ai portali per vedere menu e prezzi reali
- 📞 **Chiamata diretta** con un tap se il numero è pubblicato su OSM
- 🗺️ **Apri in Google Maps** per navigazione
- 📱 **PWA installabile** su iOS/Android/Desktop
- 🌐 **Funziona offline** (cache service worker)
- 🏷️ **Info extra** dai tag OSM: asporto, domicilio, tavoli all'aperto, vegano, senza glutine, accessibilità

---

## 🚀 Deploy su GitHub Pages

La repository `pezzaliapp/RISTOAPP` è già creata. Per aggiornare:

```bash
cd ~/Downloads
unzip -o RISTOAPP.zip
cd RISTOAPP

# Se è una repo già clonata salta init
git init
git add .
git commit -m "v2: OSM + deep linking ai portali"
git branch -M main
git remote add origin https://github.com/pezzaliapp/RISTOAPP.git  # solo la prima volta
git push -u origin main
```

Se hai già collegato la repo in precedenza:
```bash
git add .
git commit -m "v2: OSM + deep linking"
git push
```

Poi: **Settings → Pages → Branch: main → Save** e dopo 1-2 minuti è online su:
```
https://pezzaliapp.github.io/RISTOAPP/
```

---

## 🔧 Come funziona internamente

### Flusso di ricerca

1. **Utente digita** città (o clicca Posizione) + opzionalmente un piatto/cucina
2. **Geocoding** via Nominatim (OSM) se la città non è nei preset
3. **Query Overpass API** (OSM) per i ristoranti nel raggio scelto
4. **Filtri locali** per tipo e parola chiave cucina/piatto
5. **Deep link generati** a JustEat/Deliveroo/TheFork/Glovo/Google per ogni locale
6. **Rendering** con distanza, orari, caratteristiche, contatti

### Sorgenti dati

| Sorgente | Cosa fornisce | Costo | API key? |
|----------|---------------|-------|----------|
| **Overpass API** (OSM) | Ristoranti, indirizzi, orari, telefono, cucina, caratteristiche | Gratis | No |
| **Nominatim** (OSM) | Geocoding città → coordinate | Gratis | No |
| **Geolocation API** (browser) | Posizione utente | Gratis | No |

Endpoint Overpass usati (con fallback automatico):
- `https://overpass-api.de/api/interpreter`
- `https://overpass.kumi.systems/api/interpreter`
- `https://overpass.private.coffee/api/interpreter`

### Deep link ai portali

| Portale | URL | Note |
|---------|-----|------|
| JustEat | `justeat.it/search?q={nome}` | Ricerca per nome locale |
| Deliveroo | `deliveroo.it/it/?searchQuery={nome}` | Ricerca generica |
| TheFork | `thefork.it/ricerca?cityName={città}&searchText={nome}` | Con città |
| Glovo | `glovoapp.com/it/it/?search={nome}` | Ricerca |
| Google | `google.com/search?q={nome}+{città}+menu` | Fallback intelligente — spesso porta a Google Business con menu/foto |
| Google Maps | `google.com/maps/search/?api=1&query={lat},{lng}` | Navigazione |
| TripAdvisor | `tripadvisor.it/Search?q={nome}+{città}` | Recensioni |

---

## 📂 Struttura

```
RISTOAPP/
├── index.html              # UI principale
├── manifest.json           # Metadati PWA
├── sw.js                   # Service worker (cache offline)
├── css/styles.css          # Stili (Fraunces + DM Sans)
├── js/
│   ├── app.js              # Logica: Overpass, Nominatim, deep linking
│   └── data.js             # Config: città preset, keyword cucina, endpoint
├── icons/                  # Icone PWA (192, 512, maskable, SVG)
└── README.md
```

---

## 🔮 Roadmap

- [ ] **Programmi affiliati ufficiali** con JustEat/TheFork (commissioni su ordini/prenotazioni)
- [ ] Parser completo del formato `opening_hours` OSM per calcolare aperto/chiuso in tempo reale
- [ ] Cache localStorage dei risultati (ridurre query ripetute a Overpass)
- [ ] Preferiti salvati in locale
- [ ] Condivisione locale via link (Web Share API)
- [ ] Mappa interattiva Leaflet integrata
- [ ] Contributi OSM direttamente dall'app (per ristoratori che vogliono aggiornare i propri dati)

---

## 🎨 Design

- **Palette**: terracotta `#C44536`, crema `#F5EBDC`, verde oliva `#606C38`, inchiostro `#1A1410`
- **Display**: Fraunces, **Body**: DM Sans — ospitati nel sito (`fonts/`, licenza SIL OFL 1.1, file in `fonts/LICENSE-*.txt`): nessuna richiesta a Google Fonts.

## 📜 Licenze dei dati

- Dati dei luoghi: © OpenStreetMap contributors, licenza ODbL (vedi `data/README.md` e `data/LICENSE-ODbL.txt`).
- Elenco Comuni (`data-static/`): elaborazione su dati ISTAT, CC BY 4.0.
- Setup Firebase, regole, moderazione e passi manuali: `SETUP-FIREBASE.md`.

---

## 📄 Licenza e attribuzioni

Codice: **MIT**.
Dati dei locali: **© OpenStreetMap contributors** (licenza [ODbL](https://www.openstreetmap.org/copyright)) — l'attribuzione è già visibile nell'app.

I marchi JustEat, Deliveroo, TheFork, Glovo, TripAdvisor, Google Maps appartengono ai rispettivi proprietari. RistoApp li usa solo come destinazioni di link (deep linking), senza affiliazione ufficiale.

---

**Made with 🍅 in Italia.**
