# 🔐 Firebase — Setup (versione 5.2: sconto diretto, CIN, anti-truffa)

La config Firebase (`ristoapp-b4215`) è già nel codice (`js/store.js`).
Restano **due cose da fare a mano**, una volta sola:

1. **Incollare le nuove regole di sicurezza** di Firestore
2. **Creare il segreto su GitHub** per la verifica automatica dei titolari

Non serve attivare nient'altro (niente piano a pagamento, niente Cloud Functions).

---

## 1️⃣ Incolla le regole Firestore (obbligatorio)

> **Aggiornamento 5.2:** le regole sono cambiate (nuovo campo del server `hiddenReason`).
> Se avevi già incollato quelle della 5.1, incolla di nuovo tutto `firestore.rules`.

Le regole sono **la vera protezione** dell'app: decidono chi può scrivere cosa.
Senza le nuove regole la nuova versione non riesce a salvare gli alloggi.

1. Vai su https://console.firebase.google.com/ e apri il progetto **ristoapp**
2. Menu a sinistra: **Firestore Database** → tab **Regole**
3. **Cancella tutto** quello che c'è nell'editor
4. Apri il file **`firestore.rules`** (è nella cartella principale del repository),
   copia **tutto** il contenuto e incollalo nell'editor
5. Clicca **Pubblica** e aspetta circa un minuto

### Cosa fanno, in parole semplici

- **Annunci** (`restaurants`): li vedono tutti. Può crearli solo chi ha un account,
  e solo a proprio nome. Modifica ed eliminazione: solo il titolare.
- **Alloggi** (B&B, agriturismi, affittacamere, case vacanze, hotel, ostelli):
  per pubblicarli servono **l'email confermata** e un **CIN valido**.
- **Un CIN = un solo annuncio** (collezione `cin`): se qualcuno ha già usato quel CIN,
  il secondo annuncio viene rifiutato. Il CIN non si può cambiare dopo la pubblicazione.
- **Campi del server** (`verified`, `hidden`, `reportsCount`, `verifiedMethod`,
  `verifiedAt`, `verifiedFor`, `hiddenReason`): **nessun titolare può impostarli**. Li scrive solo lo
  script automatico (punto 2).
- **Sconto** per prenotazione diretta: numero intero da 0 a 30.
- **Segnalazioni** (`reports`): chiunque può inviarne una, anche senza account,
  ma **nessuno può leggerle** dall'app (si vedono solo nella console Firebase).
- **Tutto il resto**: bloccato.

---

## 2️⃣ Verifica automatica dei titolari (segreto GitHub)

Ogni ora GitHub esegue `scripts/verify-owners.mjs`
(workflow **Verifica titolari**, file `.github/workflows/verify-owners.yml`), che:

- dà il segno **✓ Verificato** agli alloggi il cui sito ufficiale contiene il codice
  `ristoapp-verifica-<id annuncio>`, oppure il cui titolare si è registrato con un'email
  dello stesso dominio del sito (es. `info@villaaurora.it` per `villaaurora.it`;
  gmail, libero, hotmail, ecc. non valgono);
- toglie la verifica se il sito cambia o (controllo giornaliero) se il codice sparisce;
- conta le segnalazioni e **nasconde** gli annunci con 3 segnalazioni (6 se verificati);
- **nasconde** gli alloggi il cui CIN indica un Comune inesistente o che si trovano a più
  di 20 km dal centro di quel Comune (tabella `data-static/istat-comuni.json`), e li rende
  di nuovo visibili quando il titolare corregge le coordinate.

Per funzionare ha bisogno di una **chiave di servizio** di Firebase:

1. Console Firebase → icona ⚙️ **Impostazioni progetto** → tab **Account di servizio**
2. Clicca **Genera nuova chiave privata** → conferma: si scarica un file `.json`
3. Apri il file con un editor di testo e **copia tutto il contenuto** (dalla prima `{` all'ultima `}`)
4. Vai sul repository GitHub → **Settings** → **Secrets and variables** → **Actions**
5. **New repository secret**
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Secret: incolla tutto il contenuto del file JSON
6. **Add secret**

> ⚠️ **Non caricare MAI quel file `.json` nel repository** (né su GitHub né altrove):
> chi lo possiede può leggere e modificare tutto il database. Dopo averlo incollato
> nel segreto puoi cancellarlo dal computer. Se pensi che sia finito in mani altrui:
> Impostazioni progetto → Account di servizio → elimina la chiave e generane una nuova.

**Prova:** GitHub → tab **Actions** → **Verifica titolari** → **Run workflow**.
Nel log trovi un riepilogo (annunci controllati, verificati, nascosti).
Finché il segreto non c'è, il workflow termina subito con il messaggio
*"Segreto FIREBASE_SERVICE_ACCOUNT non impostato"* e **non** risulta in errore.

### Rendere di nuovo visibile un annuncio nascosto

Se un annuncio è stato nascosto ingiustamente dalle segnalazioni:
Console Firebase → **Firestore Database** → `restaurants` → apri il documento →
metti `hidden` a `false` (e cancella il campo `hiddenReason`). Per evitare che venga nascosto di nuovo cancella
le relative segnalazioni nella collezione `reports` (campo `restaurant` = id dell'annuncio).

---

## ↩️ Se qualcosa non va: torna alle regole precedenti

Le nuove regole sono state controllate con attenzione ma non nell'emulatore ufficiale di Firebase.
Se dopo averle pubblicate:
- la console segnala un errore quando premi **Pubblica**, oppure
- nessun titolare riesce più a salvare,

incolla di nuovo queste regole precedenti e premi **Pubblica**. L'app continua a funzionare per la ricerca;
solo il salvataggio di nuovi alloggi con CIN resterà bloccato finché le regole nuove non saranno a posto.

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

## 🧪 Come testare

1. Apri l'app e fai un **hard refresh** (⌘+Shift+R su Mac, Ctrl+Shift+R su Windows)
2. **Registrati gratis** con una nuova email → nel pannello compare
   *"Conferma la tua email"*: apri il link ricevuto e premi **Ho confermato**
3. Aggiungi un **B&B** con un CIN valido (es. `IT043013C2ABC12345`),
   sconto (es. 10%), telefono/WhatsApp/email, spunta la dichiarazione → **Pubblica**
4. Nel pannello vedi **In attesa di verifica** e il tuo codice: mettilo sul sito
   (o usa un'email del dominio), poi lancia a mano il workflow **Verifica titolari**
5. Da un altro browser (senza login) cerca nella stessa città, filtro **Dormire**:
   l'annuncio ha il pulsante verde **"Prenota qui: paghi il 10% in meno"**

---

## 💰 Costi (zero)

- Piano **Spark** (gratis), nessuna carta di credito collegata
- Quote: 50k letture/giorno, 20k scritture/giorno, 1 GB
- Lo script orario legge tutti gli annunci una volta all'ora: con qualche centinaio
  di annunci restiamo molto sotto le quote gratuite
- Se le quote si superano l'app smette di leggere/scrivere per qualche ora,
  **non addebita nulla**

Utilizzo: Console Firebase → **Firestore Database** → tab **Utilizzo**.
