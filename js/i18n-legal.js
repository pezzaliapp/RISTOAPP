/* ============================================================
 *  RISTOAPP - Testi legali (v5.3), 6 lingue
 *  Chi gestisce RistoApp · Privacy e cookie · Condizioni d'uso ·
 *  Come ordiniamo i risultati e lo sconto.
 *
 *  Segnaposto sostituiti a runtime (trust.js, openLegal):
 *    {name} {city} {email} {date}
 *  I valori vengono da RISTOAPP_CONFIG.operator (js/data.js):
 *  se vuoti o ancora "{{...}}" si mostra "[da completare]".
 *  Fonte: bozze della verifica legale del 2 novembre 2026.
 *  Testo informativo: non sostituisce una consulenza legale.
 * ============================================================ */

(() => {
  const X = window.I18N && window.I18N.extend;
  if (!X) return;
  const OSM = '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>';
  const ODBL = '<a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener">ODbL</a>';
  const GARANTE = '<a href="https://www.garanteprivacy.it/" target="_blank" rel="noopener">garanteprivacy.it</a>';
  const BRANDS = 'JustEat, Deliveroo, TheFork, Glovo, Google, Tripadvisor, Booking.com, Airbnb';

  // ================================================================ IT
  X('it', {
    'legal.todo': '[da completare]',
    'legal.about.title': 'Chi gestisce RistoApp',
    'legal.about.body':
      '<p>RistoApp è un progetto gratuito e senza scopo di lucro gestito da {name}, persona fisica.</p>' +
      '<p>Partita IVA: non presente (attività non commerciale).</p>' +
      '<p>Contatti, anche come punto di contatto unico per utenti e autorità ai sensi degli artt. 11 e 12 del Regolamento UE 2022/2065 (Digital Services Act): {email} — lingue: italiano, inglese.</p>' +
      '<p>RistoApp è un elenco informativo: non vende, non incassa pagamenti e non è parte dei contratti tra utenti e strutture.</p>' +
      '<p>Dati dei luoghi: © ' + OSM + ', licenza ' + ODBL + '. Elenco Comuni: elaborazione su dati ISTAT (CC BY 4.0).</p>' +
      '<p>I nomi ' + BRANDS + ' sono marchi dei rispettivi titolari. RistoApp non è affiliata né sponsorizzata da loro: i pulsanti aprono soltanto una ricerca sui loro siti.</p>',

    'legal.privacy.title': 'Privacy e cookie',
    'legal.privacy.body':
      '<p class="legal-date">Informativa ai sensi degli artt. 13 e 14 GDPR · Ultimo aggiornamento: {date}</p>' +
      '<h4>1. Titolare del trattamento</h4>' +
      '<p>{name}, email {email}. Non è stato nominato un responsabile della protezione dei dati (DPO), perché non obbligatorio.</p>' +
      '<h4>2. Dati trattati, finalità e basi giuridiche</h4>' +
      '<h5>A. Tutti i visitatori</h5><ul>' +
      '<li><strong>Dati tecnici di navigazione</strong> (indirizzo IP, browser, data e ora) raccolti dai fornitori che rendono disponibile il sito: GitHub Inc. (hosting GitHub Pages, USA) e Google (database Cloud Firestore, interrogato dal browser per mostrare gli annunci dei titolari; le librerie Firebase di gstatic.com si caricano solo se apri l’area titolari o invii una segnalazione). Finalità: funzionamento e sicurezza del sito. Base: interesse legittimo (art. 6.1.f). Nessuna profilazione né pubblicità. I caratteri tipografici sono ospitati direttamente sul sito (nessuna richiesta a Google Fonts).</li>' +
      '<li><strong>Posizione</strong> (facoltativa): solo se premi “Posizione” e lo autorizzi nel browser. Le distanze sono calcolate sul tuo dispositivo. Solo se i dati locali non bastano, coordinate arrotondate (circa 100 m) e indirizzo IP possono essere inviati ai servizi OpenStreetMap: Nominatim (OpenStreetMap Foundation, Regno Unito, Paese con decisione di adeguatezza UE) e server Overpass nell’UE. RistoApp non conserva la tua posizione. Base: tua richiesta (art. 6.1.b) / interesse legittimo.</li>' +
      '<li><strong>Ricerche</strong>: restano sul tuo dispositivo; possono essere inviate ai servizi OpenStreetMap sopra indicati se i dati locali non bastano.</li>' +
      '<li><strong>Link esterni</strong>: i pulsanti ' + BRANDS + ' e Google Maps aprono i siti di quei servizi, che applicano le proprie informative. RistoApp non riceve dati da loro.</li></ul>' +
      '<h5>B. Chi invia una segnalazione</h5>' +
      '<p>Dati: motivo, testo facoltativo, annuncio segnalato (codice e nome), data e ora, lingua. Ti chiediamo di non inserire dati personali di altre persone nel testo. Finalità: valutare contenuti illeciti o non veritieri (Reg. UE 2022/2065). Base: obbligo legale e interesse legittimo (art. 6.1.c e f). Conservazione: 12 mesi, poi cancellazione automatica.</p>' +
      '<h5>C. Titolari che creano un account</h5>' +
      '<p>Dati: email e password (gestita da Firebase in forma cifrata); data e ora di accettazione di questa informativa e delle condizioni d’uso; dati dell’attività pubblicati (nome, indirizzo, posizione, orari, prezzi, menù o camere, telefono, WhatsApp, email di contatto, sito, metodi di pagamento, sconto per prenotazione diretta); CIN per gli alloggi; data e ora della dichiarazione di veridicità; esito della verifica dell’email e del sito ufficiale; stato dell’annuncio (visibile o nascosto) con motivazione; eventuali contestazioni e richieste di liberare un CIN (con l’email dell’account, per poterti rispondere). Firebase Authentication registra indirizzo IP e user agent per sicurezza per alcune settimane.</p>' +
      '<p>Finalità e basi: creare l’account e pubblicare l’annuncio (art. 6.1.b); controlli anti-frode e coerenza del CIN (art. 6.1.f e c); gestione di segnalazioni e contestazioni (art. 6.1.c).</p>' +
      '<p>I dati dell’annuncio sono pubblici per scelta del titolare, incluso il CIN che la legge impone di indicare negli annunci. L’email di accesso non è pubblica.</p>' +
      '<p>Conservazione: finché l’account è attivo. Con “Elimina il mio account” i dati vengono cancellati subito dai sistemi attivi e dai backup del fornitore entro i tempi tecnici di Google (fino a circa 180 giorni). Le contestazioni sono conservate fino a 24 mesi per difesa in giudizio.</p>' +
      '<p>L’account è riservato a maggiorenni che agiscono per un’attività.</p>' +
      '<h5>D. Dati presi da OpenStreetMap (art. 14 GDPR)</h5>' +
      '<p>Nomi, indirizzi, telefoni e siti delle attività provengono da OpenStreetMap (banca dati pubblica, licenza ODbL), aggiornati ogni settimana. Possono contenere dati di persone fisiche (es. titolare di un B&amp;B). Base: interesse legittimo a offrire un elenco informativo (art. 6.1.f). Puoi chiedere rimozione o correzione scrivendo a {email} o correggendo il dato su openstreetmap.org.</p>' +
      '<h4>3. Fornitori e trasferimenti fuori dall’UE</h4><ul>' +
      '<li>Google Ireland Ltd / Google LLC (Firebase Authentication, Cloud Firestore) con i Firebase Data Processing and Security Terms. Firebase Authentication tratta i dati negli Stati Uniti: trasferimento basato sulla decisione di adeguatezza EU-US Data Privacy Framework (Google è certificata) e, in subordine, sulle clausole contrattuali standard.</li>' +
      '<li>GitHub Inc. (hosting del sito e controlli automatici), USA: Data Privacy Framework e clausole contrattuali standard.</li>' +
      '<li>OpenStreetMap Foundation (Regno Unito) e gestori dei server Overpass nell’UE: solo per le richieste fatte dal tuo browser.</li></ul>' +
      '<p>I dati non vengono venduti né usati per pubblicità.</p>' +
      '<h4>4. Cookie e memoria del browser</h4>' +
      '<p>RistoApp non usa cookie di profilazione né statistici. Salva nel browser (localStorage e cache del service worker) solo informazioni tecniche: lingua scelta, copia dei dati dei luoghi per funzionare più velocemente e offline, CIN in attesa durante la registrazione, data dell’ultima email di verifica. Firebase salva un dato tecnico di sessione per mantenere l’accesso dei titolari. Sono strumenti tecnici: secondo le Linee guida del Garante (10 giugno 2021) non serve consenso. Puoi cancellarli dalle impostazioni del browser.</p>' +
      '<h4>5. Diritti</h4>' +
      '<p>Accesso, rettifica, cancellazione, limitazione, portabilità e opposizione (artt. 15–22 GDPR) scrivendo a {email}. Il titolare può cancellare in autonomia account e annunci dalla sua area. Reclamo al Garante per la protezione dei dati personali (' + GARANTE + ').</p>' +
      '<h4>6. Moderazione</h4>' +
      '<p>Le segnalazioni sono esaminate da una persona: nessun annuncio viene nascosto automaticamente in base alle segnalazioni. Il titolare di un annuncio nascosto vede il motivo nella sua area e può contestare la decisione. Un controllo automatico può nascondere un annuncio di alloggio se il CIN non corrisponde al Comune della struttura; il titolare vede il motivo e può correggere i dati.</p>' +
      '<h4>7. Modifiche</h4>' +
      '<p>Le modifiche sono indicate in questa pagina con la data di aggiornamento.</p>',

    'legal.terms.title': 'Condizioni d’uso',
    'legal.terms.body':
      '<h4>Che cos’è RistoApp</h4>' +
      '<p>RistoApp è un elenco informativo gratuito di ristoranti, strutture ricettive e parcheggi in Italia, gestito da {name} (vedi “Chi gestisce RistoApp”). I dati provengono dai contributori di OpenStreetMap e dai titolari che registrano la propria attività. RistoApp non è un’agenzia né un intermediario nella prenotazione e nel pagamento: non è parte dei contratti tra ospiti e strutture e non gestisce prenotazioni né pagamenti.</p>' +
      '<h4>Chi può registrarsi</h4>' +
      '<p>Possono creare un account solo persone maggiorenni che agiscono per un’attività: il titolare o un gestore autorizzato della struttura o del locale.</p>' +
      '<h4>Cosa si può pubblicare e cosa è vietato</h4>' +
      '<p>Puoi pubblicare solo dati veritieri sulla tua attività. È vietato pubblicare dati falsi, usare il CIN di un’altra struttura, inserire strutture inesistenti, indicare prezzi o sconti ingannevoli e pubblicare contenuti illeciti o che violano diritti di altri.</p>' +
      '<h4>Obblighi del titolare</h4>' +
      '<p>Per le strutture ricettive la legge italiana richiede un CIN (Codice Identificativo Nazionale) valido, che RistoApp mostra nell’annuncio. Ti impegni a mantenere i dati veritieri e aggiornati. Lo sconto per la prenotazione diretta che dichiari deve essere reale rispetto alla tariffa che applichi pubblicamente (sul tuo sito o sui portali) per le stesse date e condizioni, e va rispettato con chi ti contatta da RistoApp.</p>' +
      '<h4>Verifica</h4>' +
      '<p>Il segno <strong>✓ Verificato</strong> indica soltanto che il titolare ha dimostrato di gestire il sito ufficiale (codice nella home page o nel file .well-known del sito, oppure email dello stesso dominio) e, per gli alloggi, che il CIN è coerente con il Comune: non è una garanzia sulla qualità né sulla regolarità della struttura. Se il titolare cambia nome, sito, telefono, WhatsApp, email, CIN o indirizzo, il segno viene tolto finché la verifica non viene ripetuta.</p>' +
      '<h4>Segnalazioni e moderazione</h4>' +
      '<p>Ogni scheda ha il link “Segnala un problema”. Le segnalazioni sono esaminate da una persona: nessun annuncio viene nascosto automaticamente in base al numero di segnalazioni. Dopo l’esame un annuncio può essere oscurato; il titolare vede nella sua area il motivo e la motivazione e può contestare la decisione. Un controllo automatico può nascondere un annuncio di alloggio se il CIN non corrisponde al Comune della struttura: il titolare vede il motivo e può correggere i dati.</p>' +
      '<h4>Per gli ospiti</h4>' +
      '<p>Prima di pagare verifica il CIN sul sito del Ministero del Turismo e controlla che i contatti siano quelli ufficiali della struttura. Non pagare mai con bonifico a sconosciuti, carte regalo, ricariche o criptovalute. Diffida di prezzi troppo bassi e di richieste di anticipo urgenti.</p>' +
      '<h4>Responsabilità</h4>' +
      '<p>RistoApp è un elenco informativo. I contenuti inseriti dai titolari sono sotto la loro responsabilità; RistoApp li rimuove rapidamente quando una segnalazione risulta fondata. I dati di OpenStreetMap possono essere incompleti o non aggiornati.</p>' +
      '<h4>Servizio gratuito</h4>' +
      '<p>Il servizio è gratuito. Eventuali modifiche al servizio o a queste condizioni saranno comunicate prima della loro applicazione, in questa pagina e nell’area titolari.</p>' +
      '<h4>Marchi di terzi</h4>' +
      '<p>I nomi ' + BRANDS + ' sono marchi dei rispettivi titolari. RistoApp non è affiliata né sponsorizzata da loro: i pulsanti aprono soltanto una ricerca sui loro siti.</p>' +
      '<h4>Legge applicabile</h4>' +
      '<p>Si applica la legge italiana. Se sei un consumatore, resta competente il foro del tuo luogo di residenza o domicilio.</p>' +
      '<h4>Contatti</h4>' +
      '<p>{email}, oppure il pulsante “Segnala” nella scheda interessata.</p>' +
      '<p class="terms-foot">Testo informativo, non sostituisce una consulenza legale. Ultimo aggiornamento: {date}.</p>',

    'legal.ranking.title': 'Come ordiniamo i risultati e lo sconto',
    'legal.ranking.body':
      '<h4>Come ordiniamo i risultati</h4>' +
      '<p>RistoApp è gratuito e nessuno paga per comparire prima. Dopo i filtri e l’ordinamento che scegli (distanza, nome, orari), i risultati sono raggruppati così:</p>' +
      '<ol><li>locali e strutture registrati dal titolare e verificati (il titolare ha dimostrato di gestire il sito ufficiale);</li>' +
      '<li>registrati dal titolare non ancora verificati;</li>' +
      '<li>luoghi presi da OpenStreetMap.</li></ol>' +
      '<p>Dentro ogni gruppo vale l’ordinamento scelto. Gli annunci nascosti dopo una revisione non compaiono. “Verificato” significa solo che abbiamo controllato il legame con il sito ufficiale e la coerenza del CIN: non è una garanzia sulla qualità né sulla regolarità della struttura.</p>' +
      '<p>Per gli alloggi mostriamo solo strutture con CIN: quelle registrate dai titolari e quelle che su OpenStreetMap riportano il CIN.</p>' +
      '<h4>Lo sconto “prenotando direttamente”</h4>' +
      '<p>È un’offerta della struttura, che ne è l’unica responsabile. La percentuale si intende rispetto alla tariffa che la struttura applica pubblicamente (sul proprio sito o sui portali) per le stesse date e condizioni. RistoApp non partecipa alla prenotazione, non riceve pagamenti né commissioni e non può garantire lo sconto. Se una struttura non lo rispetta, usa “Segnala un problema”.</p>',
  });

  // ================================================================ EN
  X('en', {
    'legal.todo': '[to be completed]',
    'legal.about.title': 'Who runs RistoApp',
    'legal.about.body':
      '<p>RistoApp is a free, non-profit project run by {name}, a private individual.</p>' +
      '<p>VAT number: none (non-commercial activity).</p>' +
      '<p>Contact, also as the single point of contact for users and authorities under Articles 11 and 12 of Regulation (EU) 2022/2065 (Digital Services Act): {email} — languages: Italian, English.</p>' +
      '<p>RistoApp is an information directory: it sells nothing, collects no payments and is not a party to any contract between users and businesses.</p>' +
      '<p>Place data: © ' + OSM + ', ' + ODBL + ' licence. List of municipalities: based on ISTAT data (CC BY 4.0).</p>' +
      '<p>The names ' + BRANDS + ' are trademarks of their respective owners. RistoApp is not affiliated with or sponsored by them: the buttons only open a search on their websites.</p>',

    'legal.privacy.title': 'Privacy and cookies',
    'legal.privacy.body':
      '<p class="legal-date">Notice under Articles 13 and 14 GDPR · Last updated: {date}</p>' +
      '<h4>1. Data controller</h4>' +
      '<p>{name}, email {email}. No data protection officer (DPO) has been appointed, as none is required.</p>' +
      '<h4>2. Data processed, purposes and legal bases</h4>' +
      '<h5>A. All visitors</h5><ul>' +
      '<li><strong>Technical browsing data</strong> (IP address, browser, date and time) collected by the providers that make the site available: GitHub Inc. (GitHub Pages hosting, USA) and Google (Cloud Firestore database, queried by your browser to show owners’ listings; the Firebase libraries from gstatic.com are loaded only if you open the owners’ area or send a report). Purpose: operation and security of the site. Basis: legitimate interest (Art. 6(1)(f)). No profiling and no advertising. Fonts are hosted on the site itself (no requests to Google Fonts).</li>' +
      '<li><strong>Location</strong> (optional): only if you press “My location” and allow it in your browser. Distances are calculated on your device. Only if the local data is not enough, rounded coordinates (about 100 m) and your IP address may be sent to OpenStreetMap services: Nominatim (OpenStreetMap Foundation, United Kingdom, a country with an EU adequacy decision) and Overpass servers in the EU. RistoApp does not store your location. Basis: your request (Art. 6(1)(b)) / legitimate interest.</li>' +
      '<li><strong>Searches</strong>: stay on your device; they may be sent to the OpenStreetMap services above if the local data is not enough.</li>' +
      '<li><strong>External links</strong>: the ' + BRANDS + ' and Google Maps buttons open those services’ websites, which apply their own privacy notices. RistoApp receives no data from them.</li></ul>' +
      '<h5>B. People who send a report</h5>' +
      '<p>Data: reason, optional text, reported listing (code and name), date and time, language. Please do not include other people’s personal data in the text. Purpose: assessing illegal or untruthful content (Regulation (EU) 2022/2065). Basis: legal obligation and legitimate interest (Art. 6(1)(c) and (f)). Retention: 12 months, then automatic deletion.</p>' +
      '<h5>C. Owners who create an account</h5>' +
      '<p>Data: email and password (stored by Firebase in encrypted form); date and time you accepted this notice and the terms of use; published business data (name, address, location, hours, prices, menu or rooms, phone, WhatsApp, contact email, website, payment methods, direct-booking discount); CIN for accommodation; date and time of the truthfulness declaration; outcome of the email and official-website verification; listing status (visible or hidden) with the statement of reasons; any appeals and requests to release a CIN (with the account email, so we can reply). Firebase Authentication logs IP address and user agent for security for a few weeks.</p>' +
      '<p>Purposes and bases: creating the account and publishing the listing (Art. 6(1)(b)); anti-fraud checks and CIN consistency (Art. 6(1)(f) and (c)); handling reports and appeals (Art. 6(1)(c)).</p>' +
      '<p>Listing data is public by the owner’s choice, including the CIN that the law requires in listings. The login email is not public.</p>' +
      '<p>Retention: while the account is active. With “Delete my account” the data is deleted immediately from live systems, and from the provider’s backups within Google’s technical timeframes (up to about 180 days). Appeals are kept for up to 24 months for legal defence.</p>' +
      '<p>Accounts are reserved for adults acting for a business.</p>' +
      '<h5>D. Data taken from OpenStreetMap (Art. 14 GDPR)</h5>' +
      '<p>Business names, addresses, phone numbers and websites come from OpenStreetMap (public database, ODbL licence), updated weekly. They may include data about individuals (e.g. the owner of a B&amp;B). Basis: legitimate interest in offering an information directory (Art. 6(1)(f)). You can ask for removal or correction by writing to {email} or by correcting the data on openstreetmap.org.</p>' +
      '<h4>3. Providers and transfers outside the EU</h4><ul>' +
      '<li>Google Ireland Ltd / Google LLC (Firebase Authentication, Cloud Firestore) under the Firebase Data Processing and Security Terms. Firebase Authentication processes data in the United States: transfer based on the EU-US Data Privacy Framework adequacy decision (Google is certified) and, alternatively, on standard contractual clauses.</li>' +
      '<li>GitHub Inc. (site hosting and automated checks), USA: Data Privacy Framework and standard contractual clauses.</li>' +
      '<li>OpenStreetMap Foundation (United Kingdom) and operators of Overpass servers in the EU: only for requests made by your browser.</li></ul>' +
      '<p>Data is never sold or used for advertising.</p>' +
      '<h4>4. Cookies and browser storage</h4>' +
      '<p>RistoApp uses no profiling or analytics cookies. It stores only technical information in your browser (localStorage and the service worker cache): chosen language, a copy of place data to work faster and offline, a pending CIN during sign-up, the date of the last verification email. Firebase stores a technical session item to keep owners signed in. These are technical tools: under the Italian Data Protection Authority guidelines (10 June 2021) no consent is needed. You can delete them in your browser settings.</p>' +
      '<h4>5. Your rights</h4>' +
      '<p>Access, rectification, erasure, restriction, portability and objection (Articles 15–22 GDPR) by writing to {email}. Owners can delete their account and listings themselves in their area. You may lodge a complaint with the Italian Data Protection Authority (' + GARANTE + ').</p>' +
      '<h4>6. Moderation</h4>' +
      '<p>Reports are reviewed by a person: no listing is hidden automatically because of reports. The owner of a hidden listing sees the reason in their area and can appeal the decision. An automated check may hide an accommodation listing if its CIN does not match the municipality of the property; the owner sees the reason and can correct the data.</p>' +
      '<h4>7. Changes</h4>' +
      '<p>Changes are shown on this page with the date of the update.</p>',

    'legal.terms.title': 'Terms of use',
    'legal.terms.body':
      '<h4>What RistoApp is</h4>' +
      '<p>RistoApp is a free information directory of restaurants, accommodation and car parks in Italy, run by {name} (see “Who runs RistoApp”). The data comes from OpenStreetMap contributors and from owners who register their business. RistoApp is not an agency, nor an intermediary in bookings or payments: it is not a party to any contract between guests and accommodation providers and it handles no bookings or payments.</p>' +
      '<h4>Who can register</h4>' +
      '<p>Only adults acting for a business can create an account: the owner or an authorised manager of the property or venue.</p>' +
      '<h4>What may be published and what is forbidden</h4>' +
      '<p>You may only publish truthful data about your business. It is forbidden to publish false data, use another property’s CIN, list non-existent properties, show misleading prices or discounts, or publish illegal content or content that infringes the rights of others.</p>' +
      '<h4>Owners’ obligations</h4>' +
      '<p>For accommodation, Italian law requires a valid CIN (national identification code), which RistoApp shows in the listing. You undertake to keep your data truthful and up to date. The direct-booking discount you declare must be real compared with the rate you publicly charge (on your website or on booking portals) for the same dates and conditions, and must be honoured for guests who contact you through RistoApp.</p>' +
      '<h4>Verification</h4>' +
      '<p>The <strong>✓ Verified</strong> badge only means that the owner has proved they manage the official website (a code on the website’s home page or in its .well-known file, or an email address on the same domain) and, for accommodation, that the CIN is consistent with the municipality. It is not a guarantee of quality or of the property’s compliance. If the owner changes the name, website, phone, WhatsApp, email, CIN or address, the badge is removed until the verification is repeated.</p>' +
      '<h4>Reports and moderation</h4>' +
      '<p>Every listing has a “Report a problem” link. Reports are reviewed by a person: no listing is hidden automatically because of the number of reports. After review a listing may be hidden; the owner sees the reason and the statement of reasons in their area and can appeal the decision. An automated check may hide an accommodation listing if its CIN does not match the municipality of the property: the owner sees the reason and can correct the data.</p>' +
      '<h4>For guests</h4>' +
      '<p>Before paying, check the CIN on the Italian Ministry of Tourism website and make sure the contact details are the property’s official ones. Never pay by bank transfer to strangers, gift cards, top-ups or cryptocurrency. Be wary of prices that are too low and of urgent requests for a deposit.</p>' +
      '<h4>Liability</h4>' +
      '<p>RistoApp is an information directory. Content entered by owners is their responsibility; RistoApp removes it promptly when a report proves well-founded. OpenStreetMap data may be incomplete or out of date.</p>' +
      '<h4>Free service</h4>' +
      '<p>The service is free of charge. Any changes to the service or to these terms will be announced before they apply, on this page and in the owners’ area.</p>' +
      '<h4>Third-party trademarks</h4>' +
      '<p>The names ' + BRANDS + ' are trademarks of their respective owners. RistoApp is not affiliated with or sponsored by them: the buttons only open a search on their websites.</p>' +
      '<h4>Governing law</h4>' +
      '<p>Italian law applies. If you are a consumer, the courts of your place of residence or domicile remain competent.</p>' +
      '<h4>Contact</h4>' +
      '<p>{email}, or the “Report” button in the relevant listing.</p>' +
      '<p class="terms-foot">This text is for information only and is not a substitute for legal advice. Last updated: {date}.</p>',

    'legal.ranking.title': 'How we rank results and the discount',
    'legal.ranking.body':
      '<h4>How we rank results</h4>' +
      '<p>RistoApp is free and nobody pays to appear first. After the filters and the sort order you choose (distance, name, hours), results are grouped as follows:</p>' +
      '<ol><li>venues and properties registered by their owner and verified (the owner has proved they manage the official website);</li>' +
      '<li>registered by their owner but not yet verified;</li>' +
      '<li>places taken from OpenStreetMap.</li></ol>' +
      '<p>Within each group the sort order you chose applies. Listings hidden after a review do not appear. “Verified” only means we checked the link with the official website and the consistency of the CIN: it is not a guarantee of quality or of the property’s compliance.</p>' +
      '<p>For accommodation we only show properties with a CIN: those registered by their owners and those whose CIN is recorded on OpenStreetMap.</p>' +
      '<h4>The “book directly” discount</h4>' +
      '<p>It is an offer made by the property, which is solely responsible for it. The percentage is relative to the rate the property publicly charges (on its own website or on booking portals) for the same dates and conditions. RistoApp takes no part in the booking, receives no payments or commissions and cannot guarantee the discount. If a property does not honour it, use “Report a problem”.</p>',
  });

  // ================================================================ ES
  X('es', {
    'legal.todo': '[por completar]',
    'legal.about.title': 'Quién gestiona RistoApp',
    'legal.about.body':
      '<p>RistoApp es un proyecto gratuito y sin ánimo de lucro gestionado por {name}, persona física.</p>' +
      '<p>NIF-IVA: no tiene (actividad no comercial).</p>' +
      '<p>Contacto, también como punto de contacto único para usuarios y autoridades conforme a los artículos 11 y 12 del Reglamento (UE) 2022/2065 (Ley de Servicios Digitales): {email} — idiomas: italiano, inglés.</p>' +
      '<p>RistoApp es un directorio informativo: no vende, no cobra pagos y no es parte de los contratos entre usuarios y establecimientos.</p>' +
      '<p>Datos de los lugares: © ' + OSM + ', licencia ' + ODBL + '. Lista de municipios: elaboración a partir de datos del ISTAT (CC BY 4.0).</p>' +
      '<p>Los nombres ' + BRANDS + ' son marcas de sus respectivos titulares. RistoApp no está afiliada ni patrocinada por ellos: los botones solo abren una búsqueda en sus webs.</p>',

    'legal.privacy.title': 'Privacidad y cookies',
    'legal.privacy.body':
      '<p class="legal-date">Información conforme a los artículos 13 y 14 del RGPD · Última actualización: {date}</p>' +
      '<h4>1. Responsable del tratamiento</h4>' +
      '<p>{name}, email {email}. No se ha designado delegado de protección de datos (DPD), porque no es obligatorio.</p>' +
      '<h4>2. Datos tratados, finalidades y bases jurídicas</h4>' +
      '<h5>A. Todos los visitantes</h5><ul>' +
      '<li><strong>Datos técnicos de navegación</strong> (dirección IP, navegador, fecha y hora) recogidos por los proveedores que hacen disponible el sitio: GitHub Inc. (alojamiento GitHub Pages, EE. UU.) y Google (base de datos Cloud Firestore, consultada por tu navegador para mostrar los anuncios de los propietarios; las bibliotecas Firebase de gstatic.com solo se cargan si abres el área de propietarios o envías un aviso). Finalidad: funcionamiento y seguridad del sitio. Base: interés legítimo (art. 6.1.f). Sin elaboración de perfiles ni publicidad. Las fuentes tipográficas se alojan en el propio sitio (sin peticiones a Google Fonts).</li>' +
      '<li><strong>Ubicación</strong> (opcional): solo si pulsas «Mi ubicación» y lo autorizas en el navegador. Las distancias se calculan en tu dispositivo. Solo si los datos locales no bastan, unas coordenadas redondeadas (unos 100 m) y la dirección IP pueden enviarse a los servicios de OpenStreetMap: Nominatim (OpenStreetMap Foundation, Reino Unido, país con decisión de adecuación de la UE) y servidores Overpass en la UE. RistoApp no conserva tu ubicación. Base: tu solicitud (art. 6.1.b) / interés legítimo.</li>' +
      '<li><strong>Búsquedas</strong>: se quedan en tu dispositivo; pueden enviarse a los servicios de OpenStreetMap indicados si los datos locales no bastan.</li>' +
      '<li><strong>Enlaces externos</strong>: los botones ' + BRANDS + ' y Google Maps abren las webs de esos servicios, que aplican sus propias políticas. RistoApp no recibe datos de ellos.</li></ul>' +
      '<h5>B. Quien envía un aviso</h5>' +
      '<p>Datos: motivo, texto opcional, anuncio señalado (código y nombre), fecha y hora, idioma. Te pedimos que no incluyas datos personales de otras personas en el texto. Finalidad: evaluar contenidos ilícitos o no veraces (Reglamento (UE) 2022/2065). Base: obligación legal e interés legítimo (art. 6.1.c y f). Conservación: 12 meses y después borrado automático.</p>' +
      '<h5>C. Propietarios que crean una cuenta</h5>' +
      '<p>Datos: email y contraseña (gestionada por Firebase de forma cifrada); fecha y hora de aceptación de esta información y de las condiciones de uso; datos publicados del negocio (nombre, dirección, ubicación, horarios, precios, carta o habitaciones, teléfono, WhatsApp, email de contacto, web, métodos de pago, descuento por reserva directa); CIN de los alojamientos; fecha y hora de la declaración de veracidad; resultado de la verificación del email y de la web oficial; estado del anuncio (visible u oculto) con la motivación; posibles reclamaciones y solicitudes de liberar un CIN (con el email de la cuenta, para poder responderte). Firebase Authentication registra la dirección IP y el agente de usuario por seguridad durante algunas semanas.</p>' +
      '<p>Finalidades y bases: crear la cuenta y publicar el anuncio (art. 6.1.b); controles antifraude y coherencia del CIN (art. 6.1.f y c); gestión de avisos y reclamaciones (art. 6.1.c).</p>' +
      '<p>Los datos del anuncio son públicos por decisión del propietario, incluido el CIN que la ley obliga a indicar en los anuncios. El email de acceso no es público.</p>' +
      '<p>Conservación: mientras la cuenta esté activa. Con «Eliminar mi cuenta» los datos se borran de inmediato de los sistemas activos, y de las copias de seguridad del proveedor en los plazos técnicos de Google (hasta unos 180 días). Las reclamaciones se conservan hasta 24 meses para la defensa en juicio.</p>' +
      '<p>La cuenta está reservada a mayores de edad que actúan en nombre de un negocio.</p>' +
      '<h5>D. Datos tomados de OpenStreetMap (art. 14 RGPD)</h5>' +
      '<p>Nombres, direcciones, teléfonos y webs de los negocios proceden de OpenStreetMap (base de datos pública, licencia ODbL) y se actualizan cada semana. Pueden incluir datos de personas físicas (p. ej., el titular de un B&amp;B). Base: interés legítimo en ofrecer un directorio informativo (art. 6.1.f). Puedes pedir la eliminación o corrección escribiendo a {email} o corrigiendo el dato en openstreetmap.org.</p>' +
      '<h4>3. Proveedores y transferencias fuera de la UE</h4><ul>' +
      '<li>Google Ireland Ltd / Google LLC (Firebase Authentication, Cloud Firestore) con los Firebase Data Processing and Security Terms. Firebase Authentication trata los datos en Estados Unidos: transferencia basada en la decisión de adecuación del Marco de Privacidad de Datos UE-EE. UU. (Google está certificada) y, subsidiariamente, en cláusulas contractuales tipo.</li>' +
      '<li>GitHub Inc. (alojamiento del sitio y controles automáticos), EE. UU.: Marco de Privacidad de Datos y cláusulas contractuales tipo.</li>' +
      '<li>OpenStreetMap Foundation (Reino Unido) y operadores de servidores Overpass en la UE: solo para las peticiones de tu navegador.</li></ul>' +
      '<p>Los datos no se venden ni se usan para publicidad.</p>' +
      '<h4>4. Cookies y almacenamiento del navegador</h4>' +
      '<p>RistoApp no usa cookies de perfilado ni estadísticas. Guarda en el navegador (localStorage y caché del service worker) solo información técnica: idioma elegido, copia de los datos de lugares para funcionar más rápido y sin conexión, CIN pendiente durante el registro, fecha del último email de verificación. Firebase guarda un dato técnico de sesión para mantener la sesión de los propietarios. Son herramientas técnicas: según las directrices de la autoridad italiana de protección de datos (10 de junio de 2021) no requieren consentimiento. Puedes borrarlas en los ajustes del navegador.</p>' +
      '<h4>5. Derechos</h4>' +
      '<p>Acceso, rectificación, supresión, limitación, portabilidad y oposición (arts. 15–22 RGPD) escribiendo a {email}. El propietario puede borrar por sí mismo su cuenta y sus anuncios desde su área. Puedes reclamar ante la autoridad italiana de protección de datos, Garante per la protezione dei dati personali (' + GARANTE + ').</p>' +
      '<h4>6. Moderación</h4>' +
      '<p>Los avisos los examina una persona: ningún anuncio se oculta automáticamente por los avisos. El titular de un anuncio oculto ve el motivo en su área y puede reclamar contra la decisión. Un control automático puede ocultar un anuncio de alojamiento si el CIN no corresponde al municipio del establecimiento; el titular ve el motivo y puede corregir los datos.</p>' +
      '<h4>7. Cambios</h4>' +
      '<p>Los cambios se indican en esta página con la fecha de actualización.</p>',

    'legal.terms.title': 'Condiciones de uso',
    'legal.terms.body':
      '<h4>Qué es RistoApp</h4>' +
      '<p>RistoApp es un directorio informativo gratuito de restaurantes, alojamientos y aparcamientos en Italia, gestionado por {name} (ver «Quién gestiona RistoApp»). Los datos proceden de los colaboradores de OpenStreetMap y de los propietarios que registran su negocio. RistoApp no es una agencia ni un intermediario en la reserva ni en el pago: no es parte de los contratos entre huéspedes y alojamientos y no gestiona reservas ni pagos.</p>' +
      '<h4>Quién puede registrarse</h4>' +
      '<p>Solo pueden crear una cuenta personas mayores de edad que actúan en nombre de un negocio: el titular o un gestor autorizado del alojamiento o del local.</p>' +
      '<h4>Qué se puede publicar y qué está prohibido</h4>' +
      '<p>Solo puedes publicar datos veraces sobre tu negocio. Está prohibido publicar datos falsos, usar el CIN de otro alojamiento, dar de alta establecimientos inexistentes, indicar precios o descuentos engañosos y publicar contenidos ilícitos o que vulneren derechos de terceros.</p>' +
      '<h4>Obligaciones del propietario</h4>' +
      '<p>Para los alojamientos la ley italiana exige un CIN (código identificativo nacional) válido, que RistoApp muestra en el anuncio. Te comprometes a mantener los datos veraces y actualizados. El descuento por reserva directa que declares debe ser real respecto a la tarifa que aplicas públicamente (en tu web o en los portales) para las mismas fechas y condiciones, y debes respetarlo con quien te contacte desde RistoApp.</p>' +
      '<h4>Verificación</h4>' +
      '<p>La marca <strong>✓ Verificado</strong> solo indica que el propietario ha demostrado gestionar la web oficial (código en la página de inicio o en el archivo .well-known de la web, o email del mismo dominio) y, en los alojamientos, que el CIN es coherente con el municipio. No es una garantía de calidad ni de la regularidad del establecimiento. Si el propietario cambia nombre, web, teléfono, WhatsApp, email, CIN o dirección, la marca se retira hasta que se repita la verificación.</p>' +
      '<h4>Avisos y moderación</h4>' +
      '<p>Cada ficha tiene el enlace «Avisar de un problema». Los avisos los examina una persona: ningún anuncio se oculta automáticamente por el número de avisos. Tras el examen un anuncio puede ocultarse; el propietario ve en su área el motivo y la motivación y puede reclamar contra la decisión. Un control automático puede ocultar un anuncio de alojamiento si el CIN no corresponde al municipio del establecimiento: el propietario ve el motivo y puede corregir los datos.</p>' +
      '<h4>Para los huéspedes</h4>' +
      '<p>Antes de pagar, comprueba el CIN en la web del Ministerio de Turismo italiano y que los contactos sean los oficiales del alojamiento. No pagues nunca por transferencia a desconocidos, con tarjetas regalo, recargas o criptomonedas. Desconfía de precios demasiado bajos y de peticiones urgentes de anticipo.</p>' +
      '<h4>Responsabilidad</h4>' +
      '<p>RistoApp es un directorio informativo. Los contenidos introducidos por los propietarios son responsabilidad suya; RistoApp los retira con rapidez cuando un aviso resulta fundado. Los datos de OpenStreetMap pueden estar incompletos o desactualizados.</p>' +
      '<h4>Servicio gratuito</h4>' +
      '<p>El servicio es gratuito. Cualquier cambio en el servicio o en estas condiciones se comunicará antes de aplicarse, en esta página y en el área de propietarios.</p>' +
      '<h4>Marcas de terceros</h4>' +
      '<p>Los nombres ' + BRANDS + ' son marcas de sus respectivos titulares. RistoApp no está afiliada ni patrocinada por ellos: los botones solo abren una búsqueda en sus webs.</p>' +
      '<h4>Ley aplicable</h4>' +
      '<p>Se aplica la ley italiana. Si eres consumidor, siguen siendo competentes los tribunales de tu lugar de residencia o domicilio.</p>' +
      '<h4>Contacto</h4>' +
      '<p>{email}, o el botón «Avisar» en la ficha correspondiente.</p>' +
      '<p class="terms-foot">Texto informativo, no sustituye el asesoramiento jurídico. Última actualización: {date}.</p>',

    'legal.ranking.title': 'Cómo ordenamos los resultados y el descuento',
    'legal.ranking.body':
      '<h4>Cómo ordenamos los resultados</h4>' +
      '<p>RistoApp es gratuito y nadie paga por aparecer antes. Después de los filtros y del orden que elijas (distancia, nombre, horarios), los resultados se agrupan así:</p>' +
      '<ol><li>locales y alojamientos registrados por su propietario y verificados (el propietario ha demostrado gestionar la web oficial);</li>' +
      '<li>registrados por su propietario y aún no verificados;</li>' +
      '<li>lugares tomados de OpenStreetMap.</li></ol>' +
      '<p>Dentro de cada grupo se aplica el orden elegido. Los anuncios ocultados tras una revisión no aparecen. «Verificado» solo significa que hemos comprobado el vínculo con la web oficial y la coherencia del CIN: no es una garantía de calidad ni de la regularidad del establecimiento.</p>' +
      '<p>En alojamientos solo mostramos establecimientos con CIN: los registrados por sus propietarios y los que tienen el CIN indicado en OpenStreetMap.</p>' +
      '<h4>El descuento «reservando directamente»</h4>' +
      '<p>Es una oferta del alojamiento, que es el único responsable. El porcentaje se entiende respecto a la tarifa que el alojamiento aplica públicamente (en su web o en los portales) para las mismas fechas y condiciones. RistoApp no participa en la reserva, no recibe pagos ni comisiones y no puede garantizar el descuento. Si un alojamiento no lo respeta, usa «Avisar de un problema».</p>',
  });

  // ================================================================ DE
  X('de', {
    'legal.todo': '[noch zu ergänzen]',
    'legal.about.title': 'Wer RistoApp betreibt',
    'legal.about.body':
      '<p>RistoApp ist ein kostenloses, nicht gewinnorientiertes Projekt, betrieben von {name}, Privatperson.</p>' +
      '<p>Umsatzsteuer-ID: keine (nicht gewerbliche Tätigkeit).</p>' +
      '<p>Kontakt, auch als zentrale Kontaktstelle für Nutzer und Behörden nach Art. 11 und 12 der Verordnung (EU) 2022/2065 (Digital Services Act): {email} — Sprachen: Italienisch, Englisch.</p>' +
      '<p>RistoApp ist ein Informationsverzeichnis: Es verkauft nichts, nimmt keine Zahlungen entgegen und ist nicht Partei der Verträge zwischen Nutzern und Betrieben.</p>' +
      '<p>Ortsdaten: © ' + OSM + ', Lizenz ' + ODBL + '. Gemeindeliste: auf Grundlage von ISTAT-Daten (CC BY 4.0).</p>' +
      '<p>Die Namen ' + BRANDS + ' sind Marken ihrer jeweiligen Inhaber. RistoApp ist mit ihnen weder verbunden noch wird es von ihnen gesponsert: Die Schaltflächen öffnen nur eine Suche auf deren Websites.</p>',

    'legal.privacy.title': 'Datenschutz und Cookies',
    'legal.privacy.body':
      '<p class="legal-date">Information nach Art. 13 und 14 DSGVO · Letzte Aktualisierung: {date}</p>' +
      '<h4>1. Verantwortlicher</h4>' +
      '<p>{name}, E-Mail {email}. Ein Datenschutzbeauftragter wurde nicht benannt, da dies nicht vorgeschrieben ist.</p>' +
      '<h4>2. Verarbeitete Daten, Zwecke und Rechtsgrundlagen</h4>' +
      '<h5>A. Alle Besucher</h5><ul>' +
      '<li><strong>Technische Nutzungsdaten</strong> (IP-Adresse, Browser, Datum und Uhrzeit), erhoben von den Anbietern, die die Website bereitstellen: GitHub Inc. (Hosting über GitHub Pages, USA) und Google (Datenbank Cloud Firestore, die Ihr Browser abfragt, um die Einträge der Inhaber anzuzeigen; die Firebase-Bibliotheken von gstatic.com werden nur geladen, wenn Sie den Inhaberbereich öffnen oder eine Meldung senden). Zweck: Betrieb und Sicherheit der Website. Grundlage: berechtigtes Interesse (Art. 6 Abs. 1 lit. f). Kein Profiling, keine Werbung. Die Schriftarten liegen direkt auf der Website (keine Anfragen an Google Fonts).</li>' +
      '<li><strong>Standort</strong> (freiwillig): nur, wenn Sie auf „Standort“ tippen und es im Browser erlauben. Entfernungen werden auf Ihrem Gerät berechnet. Nur wenn die lokalen Daten nicht ausreichen, können gerundete Koordinaten (etwa 100 m) und die IP-Adresse an OpenStreetMap-Dienste gesendet werden: Nominatim (OpenStreetMap Foundation, Vereinigtes Königreich, Land mit Angemessenheitsbeschluss der EU) und Overpass-Server in der EU. RistoApp speichert Ihren Standort nicht. Grundlage: Ihre Anfrage (Art. 6 Abs. 1 lit. b) / berechtigtes Interesse.</li>' +
      '<li><strong>Suchanfragen</strong>: bleiben auf Ihrem Gerät; sie können an die genannten OpenStreetMap-Dienste gesendet werden, wenn die lokalen Daten nicht ausreichen.</li>' +
      '<li><strong>Externe Links</strong>: Die Schaltflächen ' + BRANDS + ' und Google Maps öffnen die Websites dieser Dienste, für die deren eigene Datenschutzhinweise gelten. RistoApp erhält von ihnen keine Daten.</li></ul>' +
      '<h5>B. Personen, die eine Meldung senden</h5>' +
      '<p>Daten: Grund, freiwilliger Text, gemeldeter Eintrag (Code und Name), Datum und Uhrzeit, Sprache. Bitte geben Sie im Text keine personenbezogenen Daten anderer Personen an. Zweck: Prüfung rechtswidriger oder unwahrer Inhalte (Verordnung (EU) 2022/2065). Grundlage: rechtliche Verpflichtung und berechtigtes Interesse (Art. 6 Abs. 1 lit. c und f). Speicherdauer: 12 Monate, danach automatische Löschung.</p>' +
      '<h5>C. Inhaber, die ein Konto erstellen</h5>' +
      '<p>Daten: E-Mail und Passwort (von Firebase verschlüsselt verwaltet); Datum und Uhrzeit der Annahme dieser Information und der Nutzungsbedingungen; veröffentlichte Betriebsdaten (Name, Adresse, Lage, Zeiten, Preise, Speisekarte oder Zimmer, Telefon, WhatsApp, Kontakt-E-Mail, Website, Zahlungsarten, Rabatt bei Direktbuchung); CIN bei Unterkünften; Datum und Uhrzeit der Wahrheitserklärung; Ergebnis der Prüfung von E-Mail und offizieller Website; Status des Eintrags (sichtbar oder ausgeblendet) mit Begründung; etwaige Widersprüche und Anträge auf Freigabe eines CIN (mit der E-Mail des Kontos, damit wir antworten können). Firebase Authentication speichert IP-Adresse und User-Agent aus Sicherheitsgründen einige Wochen lang.</p>' +
      '<p>Zwecke und Grundlagen: Konto erstellen und Eintrag veröffentlichen (Art. 6 Abs. 1 lit. b); Betrugsprüfungen und Stimmigkeit des CIN (Art. 6 Abs. 1 lit. f und c); Bearbeitung von Meldungen und Widersprüchen (Art. 6 Abs. 1 lit. c).</p>' +
      '<p>Die Daten des Eintrags sind auf Wunsch des Inhabers öffentlich, einschließlich des CIN, der gesetzlich in Anzeigen anzugeben ist. Die Anmelde-E-Mail ist nicht öffentlich.</p>' +
      '<p>Speicherdauer: solange das Konto aktiv ist. Mit „Mein Konto löschen“ werden die Daten sofort aus den aktiven Systemen gelöscht und aus den Backups des Anbieters innerhalb der technischen Fristen von Google (bis zu etwa 180 Tage). Widersprüche werden zur Rechtsverteidigung bis zu 24 Monate aufbewahrt.</p>' +
      '<p>Das Konto ist volljährigen Personen vorbehalten, die für einen Betrieb handeln.</p>' +
      '<h5>D. Daten aus OpenStreetMap (Art. 14 DSGVO)</h5>' +
      '<p>Namen, Adressen, Telefonnummern und Websites der Betriebe stammen aus OpenStreetMap (öffentliche Datenbank, Lizenz ODbL) und werden wöchentlich aktualisiert. Sie können Daten natürlicher Personen enthalten (z. B. Inhaber eines B&amp;B). Grundlage: berechtigtes Interesse an einem Informationsverzeichnis (Art. 6 Abs. 1 lit. f). Sie können die Entfernung oder Berichtigung per E-Mail an {email} verlangen oder die Angabe auf openstreetmap.org korrigieren.</p>' +
      '<h4>3. Anbieter und Übermittlungen außerhalb der EU</h4><ul>' +
      '<li>Google Ireland Ltd / Google LLC (Firebase Authentication, Cloud Firestore) mit den Firebase Data Processing and Security Terms. Firebase Authentication verarbeitet Daten in den USA: Übermittlung auf Grundlage des Angemessenheitsbeschlusses zum EU-US Data Privacy Framework (Google ist zertifiziert) und hilfsweise von Standardvertragsklauseln.</li>' +
      '<li>GitHub Inc. (Hosting der Website und automatische Prüfungen), USA: Data Privacy Framework und Standardvertragsklauseln.</li>' +
      '<li>OpenStreetMap Foundation (Vereinigtes Königreich) und Betreiber der Overpass-Server in der EU: nur für Anfragen Ihres Browsers.</li></ul>' +
      '<p>Die Daten werden weder verkauft noch für Werbung genutzt.</p>' +
      '<h4>4. Cookies und Browserspeicher</h4>' +
      '<p>RistoApp verwendet keine Profiling- oder Statistik-Cookies. Im Browser (localStorage und Cache des Service Workers) werden nur technische Informationen gespeichert: gewählte Sprache, eine Kopie der Ortsdaten für mehr Tempo und Offline-Nutzung, ein ausstehender CIN während der Registrierung, das Datum der letzten Bestätigungs-E-Mail. Firebase speichert einen technischen Sitzungseintrag, damit Inhaber angemeldet bleiben. Es handelt sich um technische Mittel: Nach den Leitlinien der italienischen Datenschutzbehörde (10. Juni 2021) ist keine Einwilligung nötig. Sie können sie in den Browsereinstellungen löschen.</p>' +
      '<h4>5. Ihre Rechte</h4>' +
      '<p>Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch (Art. 15–22 DSGVO) per E-Mail an {email}. Inhaber können Konto und Einträge selbst in ihrem Bereich löschen. Beschwerde bei der italienischen Datenschutzbehörde, Garante per la protezione dei dati personali (' + GARANTE + ').</p>' +
      '<h4>6. Moderation</h4>' +
      '<p>Meldungen werden von einem Menschen geprüft: Kein Eintrag wird aufgrund von Meldungen automatisch ausgeblendet. Der Inhaber eines ausgeblendeten Eintrags sieht den Grund in seinem Bereich und kann der Entscheidung widersprechen. Eine automatische Prüfung kann einen Unterkunftseintrag ausblenden, wenn der CIN nicht zur Gemeinde der Unterkunft passt; der Inhaber sieht den Grund und kann die Daten korrigieren.</p>' +
      '<h4>7. Änderungen</h4>' +
      '<p>Änderungen werden auf dieser Seite mit dem Datum der Aktualisierung angegeben.</p>',

    'legal.terms.title': 'Nutzungsbedingungen',
    'legal.terms.body':
      '<h4>Was RistoApp ist</h4>' +
      '<p>RistoApp ist ein kostenloses Informationsverzeichnis für Restaurants, Unterkünfte und Parkplätze in Italien, betrieben von {name} (siehe „Wer RistoApp betreibt“). Die Daten stammen von OpenStreetMap-Mitwirkenden und von Inhabern, die ihren Betrieb eintragen. RistoApp ist weder Agentur noch Vermittler bei Buchung und Zahlung: Es ist nicht Partei der Verträge zwischen Gästen und Unterkünften und wickelt weder Buchungen noch Zahlungen ab.</p>' +
      '<h4>Wer sich registrieren kann</h4>' +
      '<p>Ein Konto dürfen nur volljährige Personen erstellen, die für einen Betrieb handeln: der Inhaber oder ein bevollmächtigter Betreiber der Unterkunft oder des Lokals.</p>' +
      '<h4>Was veröffentlicht werden darf und was verboten ist</h4>' +
      '<p>Sie dürfen nur wahre Angaben zu Ihrem Betrieb veröffentlichen. Verboten sind falsche Angaben, die Nutzung des CIN einer anderen Unterkunft, nicht existierende Unterkünfte, irreführende Preise oder Rabatte sowie rechtswidrige Inhalte oder Inhalte, die Rechte Dritter verletzen.</p>' +
      '<h4>Pflichten des Inhabers</h4>' +
      '<p>Für Unterkünfte verlangt das italienische Recht einen gültigen CIN (nationaler Identifikationscode), den RistoApp im Eintrag anzeigt. Sie verpflichten sich, Ihre Angaben wahr und aktuell zu halten. Der angegebene Rabatt bei Direktbuchung muss gegenüber dem Preis, den Sie öffentlich (auf Ihrer Website oder auf Portalen) für dieselben Daten und Bedingungen verlangen, tatsächlich bestehen und gegenüber Gästen, die Sie über RistoApp kontaktieren, eingehalten werden.</p>' +
      '<h4>Verifizierung</h4>' +
      '<p>Das Zeichen <strong>✓ Verifiziert</strong> bedeutet nur, dass der Inhaber nachgewiesen hat, die offizielle Website zu verwalten (Code auf der Startseite oder in der .well-known-Datei der Website, oder E-Mail derselben Domain), und bei Unterkünften, dass der CIN zur Gemeinde passt. Es ist keine Garantie für Qualität oder Rechtmäßigkeit der Unterkunft. Ändert der Inhaber Name, Website, Telefon, WhatsApp, E-Mail, CIN oder Adresse, wird das Zeichen entfernt, bis die Verifizierung wiederholt ist.</p>' +
      '<h4>Meldungen und Moderation</h4>' +
      '<p>Jeder Eintrag hat den Link „Problem melden“. Meldungen werden von einem Menschen geprüft: Kein Eintrag wird aufgrund der Anzahl der Meldungen automatisch ausgeblendet. Nach der Prüfung kann ein Eintrag ausgeblendet werden; der Inhaber sieht in seinem Bereich Grund und Begründung und kann widersprechen. Eine automatische Prüfung kann einen Unterkunftseintrag ausblenden, wenn der CIN nicht zur Gemeinde passt: Der Inhaber sieht den Grund und kann die Daten korrigieren.</p>' +
      '<h4>Für Gäste</h4>' +
      '<p>Prüfen Sie vor der Zahlung den CIN auf der Website des italienischen Tourismusministeriums und ob die Kontaktdaten die offiziellen der Unterkunft sind. Zahlen Sie nie per Überweisung an Unbekannte, mit Geschenkkarten, Aufladungen oder Kryptowährungen. Seien Sie misstrauisch bei zu niedrigen Preisen und dringenden Anzahlungsforderungen.</p>' +
      '<h4>Haftung</h4>' +
      '<p>RistoApp ist ein Informationsverzeichnis. Für die von Inhabern eingegebenen Inhalte sind diese selbst verantwortlich; RistoApp entfernt sie zügig, wenn sich eine Meldung als begründet erweist. OpenStreetMap-Daten können unvollständig oder veraltet sein.</p>' +
      '<h4>Kostenloser Dienst</h4>' +
      '<p>Der Dienst ist kostenlos. Änderungen am Dienst oder an diesen Bedingungen werden vor ihrem Inkrafttreten auf dieser Seite und im Inhaberbereich mitgeteilt.</p>' +
      '<h4>Marken Dritter</h4>' +
      '<p>Die Namen ' + BRANDS + ' sind Marken ihrer jeweiligen Inhaber. RistoApp ist mit ihnen weder verbunden noch wird es von ihnen gesponsert: Die Schaltflächen öffnen nur eine Suche auf deren Websites.</p>' +
      '<h4>Anwendbares Recht</h4>' +
      '<p>Es gilt italienisches Recht. Verbraucher behalten den Gerichtsstand ihres Wohnsitzes oder gewöhnlichen Aufenthalts.</p>' +
      '<h4>Kontakt</h4>' +
      '<p>{email} oder die Schaltfläche „Melden“ im betreffenden Eintrag.</p>' +
      '<p class="terms-foot">Informationstext, ersetzt keine Rechtsberatung. Letzte Aktualisierung: {date}.</p>',

    'legal.ranking.title': 'Wie wir Ergebnisse sortieren und der Rabatt',
    'legal.ranking.body':
      '<h4>Wie wir Ergebnisse sortieren</h4>' +
      '<p>RistoApp ist kostenlos, niemand zahlt dafür, weiter oben zu erscheinen. Nach den Filtern und der Sortierung, die Sie wählen (Entfernung, Name, Öffnungszeiten), werden die Ergebnisse so gruppiert:</p>' +
      '<ol><li>vom Inhaber eingetragene und verifizierte Lokale und Unterkünfte (der Inhaber hat nachgewiesen, die offizielle Website zu verwalten);</li>' +
      '<li>vom Inhaber eingetragene, noch nicht verifizierte;</li>' +
      '<li>Orte aus OpenStreetMap.</li></ol>' +
      '<p>Innerhalb jeder Gruppe gilt die gewählte Sortierung. Nach einer Prüfung ausgeblendete Einträge erscheinen nicht. „Verifiziert“ bedeutet nur, dass wir die Verbindung zur offiziellen Website und die Stimmigkeit des CIN geprüft haben: Es ist keine Garantie für Qualität oder Rechtmäßigkeit der Unterkunft.</p>' +
      '<p>Bei Unterkünften zeigen wir nur solche mit CIN: die von Inhabern eingetragenen und die, deren CIN in OpenStreetMap steht.</p>' +
      '<h4>Der Rabatt „bei Direktbuchung“</h4>' +
      '<p>Er ist ein Angebot der Unterkunft, die allein dafür verantwortlich ist. Der Prozentsatz bezieht sich auf den Preis, den die Unterkunft öffentlich (auf der eigenen Website oder auf Portalen) für dieselben Daten und Bedingungen verlangt. RistoApp ist an der Buchung nicht beteiligt, erhält weder Zahlungen noch Provisionen und kann den Rabatt nicht garantieren. Hält eine Unterkunft ihn nicht ein, nutzen Sie „Problem melden“.</p>',
  });

  // ================================================================ FR
  X('fr', {
    'legal.todo': '[à compléter]',
    'legal.about.title': 'Qui gère RistoApp',
    'legal.about.body':
      '<p>RistoApp est un projet gratuit et sans but lucratif géré par {name}, personne physique.</p>' +
      '<p>Numéro de TVA : aucun (activité non commerciale).</p>' +
      '<p>Contact, également comme point de contact unique pour les utilisateurs et les autorités au sens des articles 11 et 12 du règlement (UE) 2022/2065 (Digital Services Act) : {email} — langues : italien, anglais.</p>' +
      '<p>RistoApp est un annuaire d’information : il ne vend rien, n’encaisse aucun paiement et n’est pas partie aux contrats entre utilisateurs et établissements.</p>' +
      '<p>Données des lieux : © ' + OSM + ', licence ' + ODBL + '. Liste des communes : élaboration à partir de données ISTAT (CC BY 4.0).</p>' +
      '<p>Les noms ' + BRANDS + ' sont des marques de leurs titulaires respectifs. RistoApp n’est ni affilié à eux ni sponsorisé par eux : les boutons ouvrent seulement une recherche sur leurs sites.</p>',

    'legal.privacy.title': 'Confidentialité et cookies',
    'legal.privacy.body':
      '<p class="legal-date">Information au titre des articles 13 et 14 du RGPD · Dernière mise à jour : {date}</p>' +
      '<h4>1. Responsable du traitement</h4>' +
      '<p>{name}, e-mail {email}. Aucun délégué à la protection des données (DPO) n’a été désigné, car ce n’est pas obligatoire.</p>' +
      '<h4>2. Données traitées, finalités et bases juridiques</h4>' +
      '<h5>A. Tous les visiteurs</h5><ul>' +
      '<li><strong>Données techniques de navigation</strong> (adresse IP, navigateur, date et heure) collectées par les prestataires qui rendent le site disponible : GitHub Inc. (hébergement GitHub Pages, États-Unis) et Google (base de données Cloud Firestore, interrogée par votre navigateur pour afficher les annonces des propriétaires ; les bibliothèques Firebase de gstatic.com ne sont chargées que si vous ouvrez l’espace propriétaires ou envoyez un signalement). Finalité : fonctionnement et sécurité du site. Base : intérêt légitime (art. 6.1.f). Aucun profilage ni publicité. Les polices sont hébergées sur le site lui-même (aucune requête à Google Fonts).</li>' +
      '<li><strong>Position</strong> (facultative) : seulement si vous appuyez sur « Ma position » et l’autorisez dans le navigateur. Les distances sont calculées sur votre appareil. Seulement si les données locales ne suffisent pas, des coordonnées arrondies (environ 100 m) et l’adresse IP peuvent être envoyées aux services OpenStreetMap : Nominatim (OpenStreetMap Foundation, Royaume-Uni, pays bénéficiant d’une décision d’adéquation de l’UE) et serveurs Overpass dans l’UE. RistoApp ne conserve pas votre position. Base : votre demande (art. 6.1.b) / intérêt légitime.</li>' +
      '<li><strong>Recherches</strong> : restent sur votre appareil ; elles peuvent être envoyées aux services OpenStreetMap ci-dessus si les données locales ne suffisent pas.</li>' +
      '<li><strong>Liens externes</strong> : les boutons ' + BRANDS + ' et Google Maps ouvrent les sites de ces services, qui appliquent leurs propres politiques. RistoApp ne reçoit aucune donnée de leur part.</li></ul>' +
      '<h5>B. Personnes qui envoient un signalement</h5>' +
      '<p>Données : motif, texte facultatif, annonce signalée (code et nom), date et heure, langue. Merci de ne pas inclure de données personnelles d’autres personnes dans le texte. Finalité : évaluer des contenus illicites ou mensongers (règlement (UE) 2022/2065). Base : obligation légale et intérêt légitime (art. 6.1.c et f). Conservation : 12 mois, puis suppression automatique.</p>' +
      '<h5>C. Propriétaires qui créent un compte</h5>' +
      '<p>Données : e-mail et mot de passe (géré par Firebase sous forme chiffrée) ; date et heure d’acceptation de la présente information et des conditions d’utilisation ; données publiées de l’établissement (nom, adresse, position, horaires, prix, carte ou chambres, téléphone, WhatsApp, e-mail de contact, site, moyens de paiement, remise pour réservation directe) ; CIN pour les hébergements ; date et heure de la déclaration de véracité ; résultat de la vérification de l’e-mail et du site officiel ; statut de l’annonce (visible ou masquée) avec sa motivation ; éventuelles contestations et demandes de libération d’un CIN (avec l’e-mail du compte, pour pouvoir vous répondre). Firebase Authentication enregistre l’adresse IP et l’agent utilisateur à des fins de sécurité pendant quelques semaines.</p>' +
      '<p>Finalités et bases : créer le compte et publier l’annonce (art. 6.1.b) ; contrôles antifraude et cohérence du CIN (art. 6.1.f et c) ; gestion des signalements et des contestations (art. 6.1.c).</p>' +
      '<p>Les données de l’annonce sont publiques par choix du propriétaire, y compris le CIN que la loi impose d’indiquer dans les annonces. L’e-mail de connexion n’est pas public.</p>' +
      '<p>Conservation : tant que le compte est actif. Avec « Supprimer mon compte », les données sont effacées immédiatement des systèmes actifs, et des sauvegardes du prestataire dans les délais techniques de Google (jusqu’à environ 180 jours). Les contestations sont conservées jusqu’à 24 mois pour la défense en justice.</p>' +
      '<p>Le compte est réservé aux personnes majeures agissant pour une activité.</p>' +
      '<h5>D. Données issues d’OpenStreetMap (art. 14 RGPD)</h5>' +
      '<p>Noms, adresses, téléphones et sites des établissements proviennent d’OpenStreetMap (base de données publique, licence ODbL), mise à jour chaque semaine. Ils peuvent contenir des données de personnes physiques (par ex. le propriétaire d’une chambre d’hôtes). Base : intérêt légitime à proposer un annuaire d’information (art. 6.1.f). Vous pouvez demander la suppression ou la correction en écrivant à {email} ou en corrigeant la donnée sur openstreetmap.org.</p>' +
      '<h4>3. Prestataires et transferts hors de l’UE</h4><ul>' +
      '<li>Google Ireland Ltd / Google LLC (Firebase Authentication, Cloud Firestore) avec les Firebase Data Processing and Security Terms. Firebase Authentication traite les données aux États-Unis : transfert fondé sur la décision d’adéquation du cadre de protection des données UE-États-Unis (Google est certifiée) et, à titre subsidiaire, sur les clauses contractuelles types.</li>' +
      '<li>GitHub Inc. (hébergement du site et contrôles automatiques), États-Unis : Data Privacy Framework et clauses contractuelles types.</li>' +
      '<li>OpenStreetMap Foundation (Royaume-Uni) et exploitants des serveurs Overpass dans l’UE : uniquement pour les requêtes de votre navigateur.</li></ul>' +
      '<p>Les données ne sont ni vendues ni utilisées pour la publicité.</p>' +
      '<h4>4. Cookies et stockage du navigateur</h4>' +
      '<p>RistoApp n’utilise aucun cookie de profilage ni de statistiques. Il enregistre dans le navigateur (localStorage et cache du service worker) uniquement des informations techniques : langue choisie, copie des données des lieux pour fonctionner plus vite et hors ligne, CIN en attente pendant l’inscription, date du dernier e-mail de vérification. Firebase enregistre un élément technique de session pour garder les propriétaires connectés. Ce sont des outils techniques : selon les lignes directrices de l’autorité italienne de protection des données (10 juin 2021), aucun consentement n’est nécessaire. Vous pouvez les effacer dans les réglages du navigateur.</p>' +
      '<h4>5. Vos droits</h4>' +
      '<p>Accès, rectification, effacement, limitation, portabilité et opposition (articles 15 à 22 RGPD) en écrivant à {email}. Le propriétaire peut supprimer lui-même son compte et ses annonces depuis son espace. Réclamation auprès de l’autorité italienne de protection des données, Garante per la protezione dei dati personali (' + GARANTE + ').</p>' +
      '<h4>6. Modération</h4>' +
      '<p>Les signalements sont examinés par une personne : aucune annonce n’est masquée automatiquement en raison des signalements. Le propriétaire d’une annonce masquée voit le motif dans son espace et peut contester la décision. Un contrôle automatique peut masquer une annonce d’hébergement si le CIN ne correspond pas à la commune de l’établissement ; le propriétaire voit le motif et peut corriger les données.</p>' +
      '<h4>7. Modifications</h4>' +
      '<p>Les modifications sont indiquées sur cette page avec la date de mise à jour.</p>',

    'legal.terms.title': 'Conditions d’utilisation',
    'legal.terms.body':
      '<h4>Qu’est-ce que RistoApp</h4>' +
      '<p>RistoApp est un annuaire d’information gratuit sur les restaurants, hébergements et parkings en Italie, géré par {name} (voir « Qui gère RistoApp »). Les données proviennent des contributeurs d’OpenStreetMap et des propriétaires qui inscrivent leur établissement. RistoApp n’est ni une agence ni un intermédiaire dans la réservation et le paiement : il n’est pas partie aux contrats entre clients et établissements et ne gère ni réservations ni paiements.</p>' +
      '<h4>Qui peut s’inscrire</h4>' +
      '<p>Seules des personnes majeures agissant pour une activité peuvent créer un compte : le propriétaire ou un gérant autorisé de l’hébergement ou de l’établissement.</p>' +
      '<h4>Ce qui peut être publié et ce qui est interdit</h4>' +
      '<p>Vous ne pouvez publier que des données véridiques sur votre établissement. Il est interdit de publier de fausses données, d’utiliser le CIN d’un autre établissement, d’inscrire des établissements inexistants, d’indiquer des prix ou des remises trompeurs et de publier des contenus illicites ou portant atteinte aux droits d’autrui.</p>' +
      '<h4>Obligations du propriétaire</h4>' +
      '<p>Pour les hébergements, la loi italienne exige un CIN (code identifiant national) valide, que RistoApp affiche dans l’annonce. Vous vous engagez à garder vos données véridiques et à jour. La remise pour réservation directe que vous déclarez doit être réelle par rapport au tarif que vous pratiquez publiquement (sur votre site ou sur les portails) pour les mêmes dates et conditions, et doit être respectée envers les clients qui vous contactent via RistoApp.</p>' +
      '<h4>Vérification</h4>' +
      '<p>Le badge <strong>✓ Vérifié</strong> indique seulement que le propriétaire a prouvé qu’il gère le site officiel (code sur la page d’accueil ou dans le fichier .well-known du site, ou e-mail du même domaine) et, pour les hébergements, que le CIN est cohérent avec la commune. Ce n’est pas une garantie de qualité ni de conformité de l’établissement. Si le propriétaire modifie le nom, le site, le téléphone, WhatsApp, l’e-mail, le CIN ou l’adresse, le badge est retiré jusqu’à ce que la vérification soit refaite.</p>' +
      '<h4>Signalements et modération</h4>' +
      '<p>Chaque fiche comporte le lien « Signaler un problème ». Les signalements sont examinés par une personne : aucune annonce n’est masquée automatiquement en fonction du nombre de signalements. Après examen, une annonce peut être masquée ; le propriétaire voit dans son espace le motif et sa justification et peut contester la décision. Un contrôle automatique peut masquer une annonce d’hébergement si le CIN ne correspond pas à la commune : le propriétaire voit le motif et peut corriger les données.</p>' +
      '<h4>Pour les voyageurs</h4>' +
      '<p>Avant de payer, vérifiez le CIN sur le site du ministère italien du Tourisme et assurez-vous que les coordonnées sont celles de l’établissement. Ne payez jamais par virement à des inconnus, par cartes cadeaux, recharges ou cryptomonnaies. Méfiez-vous des prix trop bas et des demandes d’acompte urgentes.</p>' +
      '<h4>Responsabilité</h4>' +
      '<p>RistoApp est un annuaire d’information. Les contenus saisis par les propriétaires relèvent de leur responsabilité ; RistoApp les retire rapidement lorsqu’un signalement s’avère fondé. Les données OpenStreetMap peuvent être incomplètes ou obsolètes.</p>' +
      '<h4>Service gratuit</h4>' +
      '<p>Le service est gratuit. Toute modification du service ou des présentes conditions sera annoncée avant son application, sur cette page et dans l’espace propriétaires.</p>' +
      '<h4>Marques de tiers</h4>' +
      '<p>Les noms ' + BRANDS + ' sont des marques de leurs titulaires respectifs. RistoApp n’est ni affilié à eux ni sponsorisé par eux : les boutons ouvrent seulement une recherche sur leurs sites.</p>' +
      '<h4>Droit applicable</h4>' +
      '<p>Le droit italien s’applique. Si vous êtes consommateur, le tribunal de votre lieu de résidence ou de domicile reste compétent.</p>' +
      '<h4>Contact</h4>' +
      '<p>{email}, ou le bouton « Signaler » dans la fiche concernée.</p>' +
      '<p class="terms-foot">Texte informatif, qui ne remplace pas un conseil juridique. Dernière mise à jour : {date}.</p>',

    'legal.ranking.title': 'Comment nous classons les résultats et la remise',
    'legal.ranking.body':
      '<h4>Comment nous classons les résultats</h4>' +
      '<p>RistoApp est gratuit et personne ne paie pour apparaître en premier. Après les filtres et le tri que vous choisissez (distance, nom, horaires), les résultats sont regroupés ainsi :</p>' +
      '<ol><li>établissements et hébergements inscrits par leur propriétaire et vérifiés (le propriétaire a prouvé qu’il gère le site officiel) ;</li>' +
      '<li>inscrits par leur propriétaire mais pas encore vérifiés ;</li>' +
      '<li>lieux issus d’OpenStreetMap.</li></ol>' +
      '<p>À l’intérieur de chaque groupe, le tri choisi s’applique. Les annonces masquées après un examen n’apparaissent pas. « Vérifié » signifie seulement que nous avons contrôlé le lien avec le site officiel et la cohérence du CIN : ce n’est pas une garantie de qualité ni de conformité de l’établissement.</p>' +
      '<p>Pour les hébergements, nous n’affichons que ceux qui ont un CIN : ceux inscrits par leurs propriétaires et ceux dont le CIN figure sur OpenStreetMap.</p>' +
      '<h4>La remise « en réservant directement »</h4>' +
      '<p>C’est une offre de l’établissement, qui en est seul responsable. Le pourcentage s’entend par rapport au tarif que l’établissement pratique publiquement (sur son site ou sur les portails) pour les mêmes dates et conditions. RistoApp ne participe pas à la réservation, ne reçoit ni paiement ni commission et ne peut pas garantir la remise. Si un établissement ne la respecte pas, utilisez « Signaler un problème ».</p>',
  });

  // ================================================================ JA
  X('ja', {
    'legal.todo': '［未記入］',
    'legal.about.title': 'RistoApp の運営者',
    'legal.about.body':
      '<p>RistoApp は、{name}（個人）が運営する無料・非営利のプロジェクトです。</p>' +
      '<p>付加価値税番号：なし（非商業活動）。</p>' +
      '<p>連絡先（EU 規則 2022/2065「デジタルサービス法」第11条・第12条に基づく、利用者および当局向けの単一窓口を兼ねます）：{email}　対応言語：イタリア語、英語。</p>' +
      '<p>RistoApp は情報掲載ディレクトリです。販売は行わず、支払いを受け取らず、利用者と施設との間の契約の当事者にもなりません。</p>' +
      '<p>場所のデータ：© ' + OSM + '（' + ODBL + ' ライセンス）。市町村一覧：ISTAT のデータを加工（CC BY 4.0）。</p>' +
      '<p>' + BRANDS + ' の名称は各権利者の商標です。RistoApp はこれらの企業と提携しておらず、後援も受けていません。ボタンは各サイトでの検索を開くだけです。</p>',

    'legal.privacy.title': 'プライバシーと Cookie',
    'legal.privacy.body':
      '<p class="legal-date">GDPR 第13条・第14条に基づく通知・最終更新：{date}</p>' +
      '<h4>1. 管理者</h4>' +
      '<p>{name}、メール {email}。データ保護責任者（DPO）は義務ではないため、任命していません。</p>' +
      '<h4>2. 取り扱うデータ、目的、法的根拠</h4>' +
      '<h5>A. すべての訪問者</h5><ul>' +
      '<li><strong>技術的な閲覧データ</strong>（IP アドレス、ブラウザ、日時）。サイトを提供する事業者が収集します：GitHub Inc.（GitHub Pages によるホスティング、米国）および Google（Cloud Firestore データベース。事業者の掲載情報を表示するためにブラウザが問い合わせます。gstatic.com の Firebase ライブラリは、事業者エリアを開いたときや報告を送るときにだけ読み込まれます）。目的：サイトの運用と安全。根拠：正当な利益（第6条1項f）。プロファイリングや広告は行いません。フォントはサイト自体に置いています（Google Fonts への通信はありません）。</li>' +
      '<li><strong>位置情報</strong>（任意）：「現在地」を押し、ブラウザで許可した場合のみ。距離はお使いの端末で計算します。端末内のデータで足りない場合に限り、丸めた座標（約100 m）と IP アドレスが OpenStreetMap のサービスに送られることがあります：Nominatim（OpenStreetMap Foundation、英国＝EU の十分性認定国）および EU 域内の Overpass サーバー。RistoApp は位置情報を保存しません。根拠：ご本人の求め（第6条1項b）／正当な利益。</li>' +
      '<li><strong>検索内容</strong>：端末内にとどまります。端末内のデータで足りない場合、上記の OpenStreetMap のサービスに送られることがあります。</li>' +
      '<li><strong>外部リンク</strong>：' + BRANDS + '、Google マップの各ボタンはそれぞれのサイトを開き、そのサイトのプライバシーポリシーが適用されます。RistoApp はこれらからデータを受け取りません。</li></ul>' +
      '<h5>B. 報告を送る方</h5>' +
      '<p>データ：理由、任意の本文、報告対象の掲載（コードと名称）、日時、言語。本文に他人の個人情報を書かないでください。目的：違法または虚偽の内容の審査（EU 規則 2022/2065）。根拠：法的義務および正当な利益（第6条1項c・f）。保存期間：12か月、その後自動削除。</p>' +
      '<h5>C. アカウントを作成する事業者</h5>' +
      '<p>データ：メールアドレスとパスワード（Firebase が暗号化して管理）、本通知と利用規約に同意した日時、公開される事業情報（名称、住所、位置、営業時間、料金、メニューまたは客室、電話、WhatsApp、連絡用メール、ウェブサイト、支払い方法、直接予約割引）、宿泊施設の CIN、内容が真実である旨の申告日時、メールと公式サイトの認証結果、掲載の状態（表示／非表示）とその理由、異議申し立てや CIN 解放の申請（返信のためアカウントのメールアドレスを含む）。Firebase Authentication は安全のため IP アドレスとユーザーエージェントを数週間記録します。</p>' +
      '<p>目的と根拠：アカウント作成と掲載（第6条1項b）、不正防止と CIN の整合性確認（第6条1項f・c）、報告と異議申し立ての処理（第6条1項c）。</p>' +
      '<p>掲載情報は事業者の選択により公開されます。法律で掲載が義務づけられている CIN も含みます。ログイン用メールアドレスは公開されません。</p>' +
      '<p>保存期間：アカウントが有効な間。「アカウントを削除」を行うと、稼働中のシステムからは直ちに、事業者（Google）のバックアップからは Google の技術的な期間内（最大約180日）に削除されます。異議申し立ては法的防御のため最長24か月保存します。</p>' +
      '<p>アカウントは、事業のために行動する成人に限ります。</p>' +
      '<h5>D. OpenStreetMap から取得するデータ（GDPR 第14条）</h5>' +
      '<p>事業者の名称、住所、電話番号、ウェブサイトは OpenStreetMap（公開データベース、ODbL ライセンス）に由来し、毎週更新されます。個人に関する情報（例：B&amp;B のオーナー）を含む場合があります。根拠：情報ディレクトリを提供する正当な利益（第6条1項f）。削除・訂正は {email} への連絡、または openstreetmap.org での修正により求めることができます。</p>' +
      '<h4>3. 委託先と EU 域外への移転</h4><ul>' +
      '<li>Google Ireland Ltd / Google LLC（Firebase Authentication、Cloud Firestore）。Firebase Data Processing and Security Terms に基づきます。Firebase Authentication は米国でデータを処理します。移転の根拠は EU-米国データプライバシーフレームワークの十分性認定（Google は認証取得済み）、補完的に標準契約条項です。</li>' +
      '<li>GitHub Inc.（サイトのホスティングと自動チェック）、米国：データプライバシーフレームワークおよび標準契約条項。</li>' +
      '<li>OpenStreetMap Foundation（英国）および EU 域内の Overpass サーバー運営者：お使いのブラウザからの要求に限ります。</li></ul>' +
      '<p>データの販売や広告への利用は行いません。</p>' +
      '<h4>4. Cookie とブラウザ内の保存</h4>' +
      '<p>RistoApp はプロファイリング用・統計用の Cookie を使いません。ブラウザ（localStorage と Service Worker のキャッシュ）には技術的な情報だけを保存します：選択した言語、高速化とオフライン利用のための場所データの写し、登録中の CIN、最後に送った確認メールの日時。Firebase は事業者のログイン状態を保つための技術的なセッション情報を保存します。いずれも技術的な手段であり、イタリア個人データ保護庁のガイドライン（2021年6月10日）により同意は不要です。ブラウザの設定から削除できます。</p>' +
      '<h4>5. 権利</h4>' +
      '<p>アクセス、訂正、削除、処理の制限、データポータビリティ、異議（GDPR 第15〜22条）は {email} までご連絡ください。事業者は自分のエリアからアカウントと掲載をいつでも削除できます。イタリア個人データ保護庁（' + GARANTE + '）に苦情を申し立てることができます。</p>' +
      '<h4>6. モデレーション</h4>' +
      '<p>報告は人が審査します。報告によって掲載が自動的に非表示になることはありません。非表示になった掲載の事業者は、自分のエリアで理由を確認し、決定に異議を申し立てることができます。宿泊施設の CIN が施設の市町村と一致しない場合、自動チェックにより掲載が非表示になることがあります。事業者は理由を確認し、データを修正できます。</p>' +
      '<h4>7. 変更</h4>' +
      '<p>変更はこのページに更新日とともに記載します。</p>',

    'legal.terms.title': '利用規約',
    'legal.terms.body':
      '<h4>RistoApp とは</h4>' +
      '<p>RistoApp は、{name} が運営する、イタリアのレストラン・宿泊施設・駐車場の無料の情報ディレクトリです（「RistoApp の運営者」を参照）。データは OpenStreetMap の協力者と、施設を登録した事業者から提供されています。RistoApp は代理店ではなく、予約と支払いの仲介者でもありません。宿泊客と施設の間の契約の当事者ではなく、予約や支払いを扱いません。</p>' +
      '<h4>登録できる方</h4>' +
      '<p>アカウントを作成できるのは、事業のために行動する成人（施設や店舗の所有者または正式な運営者）に限ります。</p>' +
      '<h4>掲載できる内容と禁止事項</h4>' +
      '<p>掲載できるのは、自分の事業についての真実の情報だけです。虚偽の情報、他の施設の CIN の使用、存在しない施設の登録、誤解を招く料金や割引、違法な内容や他人の権利を侵害する内容の掲載は禁止です。</p>' +
      '<h4>事業者の義務</h4>' +
      '<p>宿泊施設には、イタリアの法律で有効な CIN（全国識別コード）が必要で、RistoApp は掲載に表示します。情報は真実かつ最新に保つ必要があります。申告する直接予約割引は、同じ日程・条件で公開している料金（自社サイトや予約サイト）と比べて実際の割引でなければならず、RistoApp 経由で連絡してきた方に必ず適用してください。</p>' +
      '<h4>認証</h4>' +
      '<p><strong>✓ 認証済み</strong>のマークは、事業者が公式サイトを管理していること（サイトのトップページまたは .well-known ファイルのコード、または同じドメインのメール）と、宿泊施設については CIN が市町村と整合していることを示すだけです。品質や施設の適法性を保証するものではありません。名称、サイト、電話、WhatsApp、メール、CIN、住所を変更すると、再認証までマークは外れます。</p>' +
      '<h4>報告とモデレーション</h4>' +
      '<p>各掲載に「問題を報告」リンクがあります。報告は人が審査します。報告の件数によって掲載が自動的に非表示になることはありません。審査の結果、掲載が非表示になる場合があります。事業者は自分のエリアで理由と説明を確認し、異議を申し立てることができます。宿泊施設の CIN が市町村と一致しない場合、自動チェックにより掲載が非表示になることがあります。事業者は理由を確認し、データを修正できます。</p>' +
      '<h4>宿泊客の方へ</h4>' +
      '<p>支払う前に、イタリア観光省のサイトで CIN を確認し、連絡先が施設の公式なものか確かめてください。見知らぬ相手への銀行振込、ギフトカード、チャージ、暗号資産では絶対に支払わないでください。安すぎる料金や、急ぎの前払い要求には注意してください。</p>' +
      '<h4>責任</h4>' +
      '<p>RistoApp は情報ディレクトリです。事業者が入力した内容の責任は事業者にあります。根拠のある報告を受けた場合、RistoApp は速やかに削除します。OpenStreetMap のデータは不完全または古い場合があります。</p>' +
      '<h4>無料のサービス</h4>' +
      '<p>本サービスは無料です。サービスや本規約を変更する場合は、適用前にこのページと事業者エリアでお知らせします。</p>' +
      '<h4>第三者の商標</h4>' +
      '<p>' + BRANDS + ' の名称は各権利者の商標です。RistoApp はこれらの企業と提携しておらず、後援も受けていません。ボタンは各サイトでの検索を開くだけです。</p>' +
      '<h4>準拠法</h4>' +
      '<p>イタリア法が適用されます。消費者の方は、居住地または住所地の裁判所で手続きをする権利を失いません。</p>' +
      '<h4>連絡先</h4>' +
      '<p>{email}、または該当する掲載の「報告」ボタン。</p>' +
      '<p class="terms-foot">この文章は情報提供のためのもので、法的助言に代わるものではありません。最終更新：{date}。</p>',

    'legal.ranking.title': '検索結果の並び順と割引について',
    'legal.ranking.body':
      '<h4>検索結果の並び順</h4>' +
      '<p>RistoApp は無料で、上位に表示されるために料金を払う人はいません。選んだ絞り込みと並べ替え（距離、名前、営業時間）の後、結果は次の順にグループ分けされます。</p>' +
      '<ol><li>事業者が登録し、認証された店舗・施設（事業者が公式サイトを管理していることを証明済み）</li>' +
      '<li>事業者が登録し、まだ認証されていないもの</li>' +
      '<li>OpenStreetMap から取得した場所</li></ol>' +
      '<p>各グループ内では選んだ並べ替えが適用されます。審査により非表示となった掲載は表示されません。「認証済み」は、公式サイトとのつながりと CIN の整合性を確認したことだけを意味し、品質や施設の適法性を保証するものではありません。</p>' +
      '<p>宿泊施設は CIN があるものだけを表示します：事業者が登録したものと、OpenStreetMap に CIN が記載されているもの。</p>' +
      '<h4>「直接予約」の割引</h4>' +
      '<p>割引は施設による提供で、責任は施設のみにあります。割合は、同じ日程・条件で施設が公開している料金（自社サイトや予約サイト）に対するものです。RistoApp は予約に関与せず、支払いや手数料を受け取らず、割引を保証できません。施設が割引を守らない場合は「問題を報告」を使ってください。</p>',
  });
})();
