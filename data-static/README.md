# data-static

File statici che **non** vengono rigenerati dal workflow settimanale
(la cartella `data/` invece viene ricostruita ogni settimana).

## istat-comuni.json

Tabella dei Comuni italiani usata per controllare il CIN delle strutture
ricettive (caratteri 3–8 del CIN = codice ISTAT del Comune):

```
{ "043013": ["Civitanova Marche", "MC", 43.3068, 13.7284], ... }
  codice ISTAT -> [nome, sigla provincia, lat, lng, (raggio km)]
```

Il quinto valore, se presente, è il raggio massimo (km) ammesso dal centro
del Comune quando supera i 20 km standard: Comuni molto estesi
(1,5 × raggio equivalente alla superficie: Roma, Ravenna, Cerignola) e
Comuni formati da isole lontane (Lampedusa e Linosa, Lipari, Favignana).

Contiene anche **389 alias** `"vecchio codice": "codice attuale"` per i Comuni
soppressi o ricodificati dal giugno 2023 in poi (fusioni e riordino delle
province sarde del 1° gennaio 2026): i CIN rilasciati prima mantengono il
vecchio codice del Comune e devono restare validi.

- **Comuni: 7.894** (situazione ISTAT al 7 ottobre 2026).
- **Nomi, sigle, coordinate e superfici**: pacchetto npm
  [`italian-cap-comuni-province`](https://www.npmjs.com/package/italian-cap-comuni-province)
  1.1.1 (licenza **MIT**), che ridistribuisce il *Database comuni italiani* di
  [Garda Informatica](https://www.gardainformatica.it/database-comuni-italiani),
  derivato dai dati ufficiali ISTAT. Coordinate arrotondate a 4 decimali (~10 m).
- **Controllo dei codici**: l'elenco dei codici è stato confrontato con il
  pacchetto npm [`italian-territories`](https://www.npmjs.com/package/italian-territories)
  1.20261007.0 (licenza **CC BY 4.0**, ricostruito da ISTAT SITUAS):
  coincide al 100% (7.894 Comuni attivi).
- I codici ISTAT sono pubblicati da ISTAT con licenza CC BY 3.0 IT / 4.0.

Rigenerazione: `python3 scripts/build_istat.py <gi_comuni_cap.json> <municipalities.json> data-static/istat-comuni.json`
(i due JSON si trovano nei pacchetti npm indicati sopra, `npm pack <nome>`).
Da rifare quando ISTAT cambia l'elenco dei Comuni (fusioni, di solito il 1° gennaio).
