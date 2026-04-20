# 🔐 Fase 2 Firebase — Setup finale

## ✅ Cosa ho già fatto

- `js/store.js` — riscritto per usare **Firebase Auth + Firestore**
- `index.html` — aggiunti gli SDK Firebase da CDN
- `js/owner.js` — adattato all'asincronia
- `js/app.js` — la ricerca ora unisce OSM + ristoranti Firestore condivisi
- `sw.js` — bumpato a v3.0.0

**La tua config Firebase** (`ristoapp-b4215`) è integrata nel codice.

---

## ⚠️ DA FARE DOPO IL DEPLOY: imposta le regole Firestore

Le regole sono **critiche per la sicurezza** — senza, chiunque potrebbe modificare o cancellare i ristoranti degli altri.

### Passaggi

1. Vai su https://console.firebase.google.com/
2. Seleziona il progetto **ristoapp**
3. Menu a sinistra: **Firestore Database** → tab **Regole** (la seconda tab in alto)
4. Vedrai un editor con le regole attuali (`allow read, write: if false`)
5. **Cancella tutto** quello che c'è nell'editor
6. **Incolla esattamente** il blocco qui sotto:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Ristoranti: lettura pubblica (chiunque può vederli nell'app)
    // Scrittura riservata: solo chi è loggato può creare un locale,
    // e solo il proprietario può modificarlo o eliminarlo.
    match /restaurants/{restaurantId} {
      allow read: if true;

      allow create: if request.auth != null
        && request.resource.data.owner == request.auth.uid
        && request.resource.data.name is string
        && request.resource.data.name.size() > 0
        && request.resource.data.name.size() < 200
        && request.resource.data.lat is number
        && request.resource.data.lng is number
        && request.resource.data.menu.size() <= 200;

      allow update: if request.auth != null
        && resource.data.owner == request.auth.uid
        && request.resource.data.owner == request.auth.uid;

      allow delete: if request.auth != null
        && resource.data.owner == request.auth.uid;
    }

    // Blocca tutto il resto per sicurezza
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

7. Clicca **"Pubblica"** (bottone in alto a destra)
8. Aspetta 30 secondi che si propaghi

### Cosa fanno queste regole

- **Lettura dei ristoranti**: pubblica (chi usa l'app deve poterli vedere)
- **Creazione di un ristorante**: solo utenti loggati; devono scrivere il proprio `uid` nel campo `owner`; il nome deve esserci ed essere sotto i 200 caratteri; le coordinate devono essere numeri; massimo 200 piatti nel menu (evita abusi)
- **Modifica**: solo il proprietario del ristorante, e non può cambiarsi owner (evita furti di locali)
- **Eliminazione**: solo il proprietario
- **Qualsiasi altra collezione**: bloccata

---

## 🧪 Come testare

1. Vai su https://pezzaliapp.github.io/RISTOAPP/
2. Hard refresh: **⌘+Shift+R** (Mac) o **Ctrl+Shift+R** (Windows)
3. Clicca **"Sei un ristoratore?"** → Registrati
4. Crea un locale con menu e prezzi
5. Apri l'app **da un altro dispositivo o browser** (incognito) → NON fare login
6. Cerca nella stessa città → il locale deve apparire ✓

Se l'ultimo passo funziona, la Fase 2 è completa: i dati sono condivisi tra tutti gli utenti.

---

## 💰 Monitoraggio costi (zero)

- Piano **Spark** (gratis)
- Nessuna carta di credito collegata
- Quote: 50k letture/giorno, 20k scritture/giorno, 1 GB storage
- Se le superi: l'app smette di leggere/scrivere per qualche ora, **non ti addebita nulla**

Per verificare l'utilizzo:
- Console Firebase → **Firestore Database** → tab **Utilizzo**
- Console Firebase → **Authentication** → tab **Utilizzo**

---

## 🗑️ Rimuovere gli utenti "Mario" e "Pluto" di test (opzionale)

Se vuoi fare pulizia dei test fatti in Fase 1 (quelli erano solo in localStorage e non sono mai finiti su Firebase, quindi non serve fare niente — partono da zero).

Sul telefono invece, se hai usato la v2.1 e ci sono dati vecchi in localStorage, puoi:
1. Aprire l'app
2. DevTools (se su browser desktop) → Application → Storage → Clear site data
3. Su iOS: impostazioni Safari → Cancella dati siti web → cerca e cancella il dominio

Non è necessario, quei dati vecchi in localStorage non danno fastidio.
