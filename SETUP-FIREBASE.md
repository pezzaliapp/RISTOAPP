# 🔐 Firebase e GitHub — Setup (versione 5.3)

La config Firebase (`ristoapp-b4215`) è già nel codice (`js/store.js`).
Tutto resta **gratuito**: piano Spark di Firebase (senza carta), GitHub Free.

Con la 5.3 ci sono **cose da fare a mano**, una volta sola:

| # | Cosa | Obbligatorio? |
|---|------|---------------|
| 1 | Incollare le **nuove regole** Firestore (`firestore.rules`) | **Sì** |
| 2 | Creare l'**indice** `restaurants (hidden, lat)` | Consigliato (l'app funziona anche senza) |
| 3 | Segreto `FIREBASE_SERVICE_ACCOUNT` su GitHub (se non c'è già) + Issues attivi | Sì, per verifica e moderazione |
| 4 | Compilare i **dati del gestore** in `js/data.js` | **Sì** (testi legali) |
| 5 | Accettare i **termini sul trattamento dei dati** di Firebase | **Sì** (GDPR) |

---

## 1️⃣ Incolla le regole Firestore (obbligatorio, a ogni versione che le cambia)

> **Aggiornamento 5.3:** le regole sono cambiate molto (nuove collezioni, amministratore,
> lettura pubblica solo degli annunci visibili, controlli su tutti i campi).
> Anche se avevi incollato quelle della 5.2, **incolla di nuovo tutto `firestore.rules`**.
> Finché non lo fai: le segnalazioni non si inviano e la moderazione non funziona.

1. Vai su https://console.firebase.google.com/ e apri il progetto **ristoapp**
2. Menu a sinistra: **Firestore Database** → tab **Regole**
3. **Cancella tutto** quello che c'è nell'editor
4. Apri il file **`firestore.rules`** (cartella principale del repository),
   copia **tutto** il contenuto e incollalo nell'editor
5. Clicca **Pubblica** e aspetta circa un minuto

### Cosa fanno, in parole semplici

- **Annunci** (`restaurants`): il pubblico vede **solo quelli visibili** (`hidden == false`);
  il titolare vede sempre i propri, l'amministratore tutti. Crea/modifica/elimina solo il titolare.
  Ogni campo è controllato: lunghezze massime, telefono e WhatsApp solo con cifre e `+ ( ) . / -`,
  sito solo `http(s)://`, orari `HH:MM-HH:MM` (max 4 fasce per giorno), liste con numero massimo
  di elementi, sconto intero 0–30, **posizione dentro l'Italia**. Il CIN è ammesso solo per gli alloggi.
- **Verifica**: se il titolare cambia nome, sito, telefono, WhatsApp, email, CIN o indirizzo,
  le regole **obbligano** a togliere il ✓ (`verified: false`) finché lo script non lo riverifica.
- **Alloggi**: servono **email confermata** e **CIN valido**; un CIN = un solo annuncio (collezione `cin`).
  Per riservare un CIN serve l'email confermata.
- **Campi del server** (`verified`, `verifiedMethod`, `verifiedAt`, `verifiedFor`, `verifiedSnapshot`,
  `hidden`, `hiddenReason`, `hiddenNote`, `moderatedAt`, `lastRecheck`): nessun titolare può impostarli.
- **Amministratore** = `pezzalialessandro@gmail.com` **con email confermata**. Solo lui può:
  nascondere/ripristinare annunci (con motivazione obbligatoria), leggere e chiudere segnalazioni,
  contestazioni e richieste CIN, liberare un CIN, nascondere luoghi OpenStreetMap.
- **Segnalazioni** (`reports`): chiunque può inviarne una (anche senza account) e riceve un
  codice di riferimento; le legge solo l'amministratore. **Nessuna segnalazione nasconde
  automaticamente un annuncio**: decide sempre una persona.
- **Contestazioni** (`appeals`): il titolare di un annuncio nascosto può contestare (solo per i propri annunci).
- **Richieste CIN** (`cinClaims`): chi trova il proprio CIN già usato da un altro account può chiedere
  di liberarlo (serve l'email confermata; viene salvata l'email dell'account per rispondere).
- **Luoghi OSM nascosti** (`osmHidden`): lettura pubblica (l'app li toglie dai risultati), scrittura solo amministratore.
- **Accettazione termini** (`users/{uid}`): data e versione di accettazione di informativa e condizioni.
- **Tutto il resto** (incluso `meta/`, usato solo dallo script): bloccato.

---

## 2️⃣ Indice per la ricerca (consigliato)

La ricerca legge solo gli annunci nella fascia di latitudine della zona cercata
(`hidden == false` e `lat` tra due valori, massimo 300). Questa query usa un **indice composito**.
**Senza l'indice l'app funziona lo stesso**: se ne accorge e ripiega su una lettura più semplice
(tutti gli annunci visibili, tenuti in memoria 10 minuti), che però consuma più letture.

Per crearlo (gratis, una volta sola):

1. Console Firebase → **Firestore Database** → tab **Indici** → **Composito** → **Aggiungi indice**
2. ID raccolta: `restaurants` · Ambito query: **Raccolta**
3. Campi: `hidden` **Crescente**, poi `lat` **Crescente**
4. **Crea** e attendi che lo stato diventi **Abilitato** (qualche minuto)

(La stessa definizione è nel file `firestore.indexes.json`.)

---

## 3️⃣ Controlli automatici su GitHub (segreto + Issues)

Ogni ora GitHub esegue `scripts/verify-owners.mjs` (workflow **Verifica titolari**,
file `.github/workflows/verify-owners.yml`), che:

- dà il segno **✓ Verificato** (a locali e alloggi) **solo** se:
  - la **home page** del sito ufficiale contiene nel `<head>` il tag
    `<meta name="ristoapp-verification" content="ristoapp-verifica-<id annuncio>">`, oppure
  - esiste il file `https://<sito>/.well-known/ristoapp-verification.txt` con una riga uguale al codice, oppure
  - il titolare si è registrato con un'email **confermata** dello stesso dominio del sito.

  Non valgono codici in altre pagine o nel corpo della pagina, redirect verso altri domini,
  siti gratuiti/condivisi (github.io, netlify.app, vercel.app, wixsite.com, wordpress.com,
  altervista.org, blogspot, jimdo, Google Sites, Linktree…), social e portali (Facebook, Instagram,
  Booking, Airbnb, Tripadvisor…);
- salva un'**impronta** dei dati verificati: se cambiano, la verifica decade;
- **ricontrolla** ogni annuncio quando viene modificato e comunque **ogni 24 ore** (a qualsiasi ora);
- **nasconde** gli alloggi il cui CIN indica un Comune inesistente o lontano dalla posizione
  (unico oscuramento automatico) e li rende visibili quando il titolare corregge i dati;
- apre/aggiorna **un solo issue** *"RistoApp: segnalazioni da controllare"* con i **soli numeri**
  di segnalazioni, contestazioni e richieste CIN aperte (nessun dato personale) e lo chiude quando
  sono tutti a zero — così ricevi la notifica di GitHub;
- **cancella** le segnalazioni più vecchie di 12 mesi, contestazioni e richieste CIN più vecchie di 24 mesi;
- al primo giro esegue la **migrazione 5.3**: aggiunge `hidden: false` dove manca (senza, gli annunci
  vecchi non sarebbero più visibili al pubblico con le nuove regole), toglie `ownerEmail` e
  `reportsCount`, rende di nuovo visibili gli annunci nascosti in passato solo per numero di segnalazioni.

> ⚠️ **Dopo aver incollato le regole, lancia subito il workflow a mano** (Actions → *Verifica titolari*
> → *Run workflow*): finché la migrazione non gira, gli annunci creati prima della 5.3 non compaiono
> nella ricerca.

### Segreto (se non l'hai già creato con la 5.2)

1. Console Firebase → ⚙️ **Impostazioni progetto** → tab **Account di servizio**
2. **Genera nuova chiave privata** → si scarica un file `.json`
3. GitHub → repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Secret: incolla **tutto** il contenuto del file JSON
4. **Add secret**, poi cancella il file dal computer

> ⚠️ **Non caricare MAI quel file `.json` nel repository** (il `.gitignore` lo esclude, ma fai attenzione).
> Se pensi che sia finito in mani altrui: Impostazioni progetto → Account di servizio → elimina la chiave e generane una nuova.

### Permessi per l'issue

- Il workflow dichiara `permissions: issues: write` (e `contents: read`): di solito basta.
- Controlla che gli **Issues** siano attivi: repository → **Settings** → **General** → *Features* → ✅ **Issues**.
- Se nel log compare *"Issue GitHub non aggiornato: … HTTP 403"*: **Settings** → **Actions** → **General** →
  *Workflow permissions* → **Read and write permissions** → *Save*.

**Prova:** GitHub → tab **Actions** → **Verifica titolari** → **Run workflow**. Nel log trovi il riepilogo.
Senza segreto il workflow termina subito con *"Segreto FIREBASE_SERVICE_ACCOUNT non impostato"* e **non** fallisce.

---

## 4️⃣ Dati del gestore (testi legali)

Apri `js/data.js` e compila l'oggetto `operator` (è l'unico punto da modificare):

```js
operator: {
  name:  'Nome Cognome',
  city:  'Città (provincia)',
  email: 'indirizzo@esempio.it',   // contatto privacy e punto di contatto DSA
},
```

Finché un valore resta vuoto o `{{...}}`, le finestre *Chi gestisce RistoApp*, *Privacy e cookie*
e *Condizioni d'uso* mostrano **"[da completare]"**. Se cambi i testi legali aggiorna anche
`legalUpdated` (mese e anno dell'ultimo aggiornamento).

---

## 5️⃣ Termini sul trattamento dei dati (Firebase / Google Cloud)

Per il GDPR Google deve trattare i dati come responsabile del trattamento:

1. Console Firebase → ⚙️ **Impostazioni progetto** → tab **Generali** (sezione *Privacy* / *Impostazioni dati*)
   oppure **Impostazioni progetto → Privacy e sicurezza**
2. Leggi e **accetta** i *Firebase Data Processing and Security Terms* (o *Google Cloud Data Processing Addendum*)
3. Se richiesto, indica i contatti (titolare del trattamento: i dati del punto 4)

L'informativa in app dichiara che questi termini sono accettati: fallo prima di pubblicare la 5.3.

---

## 👮 Moderazione (amministratore)

1. Apri l'app → **Area titolari** → accedi con `pezzalialessandro@gmail.com`
   (la prima volta: registrati con quell'email e **conferma l'email**, poi premi *Ho confermato*)
2. In cima al pannello compare **Moderazione** con quattro schede:
   - **Segnalazioni**: per ognuna *Nascondi* (serve una **motivazione**, che il titolare vede),
     *Ignora* (chiude la segnalazione), *Ripristina* (se l'annuncio è già nascosto).
     Per i luoghi di OpenStreetMap *Nascondi* li toglie dai risultati dell'app (`osmHidden`).
   - **Contestazioni**: *Ripristina* (rende visibile e chiude) o *Respingi*.
   - **CIN contesi**: *Libera CIN* (elimina `cin/{CIN}` e nasconde con motivazione l'annuncio che lo
     occupava; serve una motivazione) o *Respingi*.
   - **Nascosti**: elenco di annunci e luoghi OSM nascosti, con *Ripristina*.
3. Chi ha segnalato ha ricevuto un **codice di riferimento** (= id del documento in `reports`).

---

## ↩️ Se qualcosa non va: tornare alle regole precedenti

Le nuove regole sono state controllate con attenzione ma **non** nell'emulatore ufficiale di Firebase
(non scaricabile nell'ambiente di sviluppo). Se dopo averle pubblicate la console segnala un errore
quando premi **Pubblica**, o nessun titolare riesce più a salvare:

1. Console Firebase → Firestore → **Regole** → in alto a destra l'elenco delle **versioni pubblicate**:
   seleziona quella precedente e premi **Ripristina** (è il modo più rapido), **oppure**
2. incolla il file **`rules-history/firestore-5.2.2.rules`** (le regole pubblicate con la versione 5.2.2)
   e premi **Pubblica**.

Con le regole 5.2.2 la ricerca e il salvataggio degli annunci continuano a funzionare, ma
**segnalazioni, contestazioni, richieste CIN e moderazione restano bloccate** finché non ripubblichi
le regole 5.3. Non usare mai regole che consentono `allow read, write: if true` o scritture senza
controllo del titolare.

---

## 🧪 Come testare

1. Apri l'app e fai un **hard refresh** (⌘+Shift+R / Ctrl+Shift+R)
2. **Area titolari** → **Registrati gratis**: spunta la casella su informativa e condizioni,
   conferma l'email e premi **Ho confermato**
3. Aggiungi un **B&B** con un CIN valido (es. `IT043013C2ABC12345`), sconto, contatti,
   spunta la dichiarazione → **Pubblica**
4. Nel pannello: **In attesa di verifica** e il tag da copiare. Mettilo nella home page del sito
   (o usa il file `.well-known`), premi **Ho pubblicato il codice: controlla** e lancia a mano
   il workflow **Verifica titolari**
5. Da un altro browser (senza login), filtro **Dormire**: l'annuncio ha il pulsante
   *"Offerta di …: −10% prenotando direttamente"*
6. Invia una **segnalazione** dalla scheda: ricevi il codice; entro un'ora compare l'issue su GitHub;
   come amministratore la trovi in **Moderazione**

---

## 💰 Costi (zero)

- Piano **Spark** (gratis), nessuna carta collegata. Quote: 50k letture/giorno, 20k scritture/giorno, 1 GB.
- Ricerca: legge solo gli annunci della zona (massimo 300), con cache di 10 minuti nel browser.
- Script orario: legge solo gli annunci modificati e quelli da ricontrollare (circa una volta al giorno
  ciascuno), più i conteggi; con qualche centinaio di annunci si resta molto sotto le quote.
- GitHub Actions su repository pubblico: gratis.
- Se le quote si superano l'app smette di leggere/scrivere per qualche ora, **non addebita nulla**.

Utilizzo: Console Firebase → **Firestore Database** → tab **Utilizzo**.
