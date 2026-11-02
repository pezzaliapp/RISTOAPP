#!/usr/bin/env node
/* ============================================================
 *  RistoApp - Verifica automatica dei titolari (GitHub Actions, ogni ora)
 *
 *  Per ogni annuncio di ALLOGGIO non verificato e non nascosto:
 *   (a) sito web: se la pagina contiene "ristoapp-verifica-<id>"
 *       -> verified = true, verifiedMethod = 'website'
 *   (b) dominio: email del titolare confermata e dello stesso dominio
 *       del sito (non caselle gratuite) -> verifiedMethod = 'domain'
 *  Annunci verificati: se il sito cambia, la verifica decade subito;
 *  quelli verificati col metodo 'website' si ricontrollano ogni giorno
 *  alle 03 UTC (codice sparito -> verified = false).
 *  Segnalazioni: conta i doc "reports" per annuncio -> reportsCount;
 *  nasconde (hidden = true) se non verificato e >= 3, o verificato e >= 6.
 *  CIN: nasconde (hiddenReason = 'cin_mismatch') gli alloggi il cui CIN
 *  indica un Comune inesistente o che distano piu' di 20 km (o del raggio
 *  del Comune) dal centro del Comune del CIN (data-static/istat-comuni.json);
 *  li rende di nuovo visibili quando il titolare corregge le coordinate.
 *
 *  Uso:  FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}' \
 *        VERIFY_DEPS_DIR=/tmp/deps node scripts/verify-owners.mjs
 *  Senza segreto: messaggio chiaro ed exit 0 (non fa mai fallire il job).
 * ============================================================ */

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const LODGING_TYPES = ['B&B', 'Agriturismo', 'Affittacamere', 'Casa vacanze', 'Hotel', 'Ostello'];
export const USER_AGENT = 'RistoAppVerifier/1.0 (+https://www.alessandropezzali.it/RISTOAPP/)';
const FETCH_TIMEOUT_MS = 15000;
const MAX_BYTES = 2 * 1024 * 1024;
const HIDE_UNVERIFIED = 3;
const HIDE_VERIFIED = 6;
const MAX_KM = 20;
export const ISTAT_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data-static', 'istat-comuni.json');

// Caselle email gratuite/generiche: non dimostrano il controllo di un dominio
const FREE_MAIL = [
  'gmail.com', 'googlemail.com', 'libero.it', 'icloud.com', 'me.com', 'mac.com',
  'alice.it', 'tim.it', 'tin.it', 'tiscali.it', 'virgilio.it', 'aruba.it', 'pec.it',
  'legalmail.it', 'arubapec.it', 'pec.aruba.it', 'postacert.it', 'email.it', 'inwind.it',
  'iol.it', 'fastwebnet.it', 'msn.com', 'aol.com', 'ymail.com', 'proton.me',
  'protonmail.com', 'pm.me', 'gmx.com', 'gmx.net', 'web.de', 'mail.com', 'zoho.com',
  'yandex.com', 'mail.ru', 'katamail.com', 'teletu.it', 'vodafone.it', 'poste.it',
];
const FREE_MAIL_FAMILIES = /^(hotmail|outlook|live|yahoo|gmx|yandex)\.[a-z.]{2,8}$/;

// Siti dove chiunque puo' scrivere (recensioni, commenti, annunci altrui):
// il codice trovato li' NON prova il controllo della struttura.
const UGC_SITES = [
  'facebook.com', 'fb.com', 'instagram.com', 'tiktok.com', 'youtube.com', 'x.com', 'twitter.com',
  'linktr.ee', 'booking.com', 'airbnb.com', 'airbnb.it', 'tripadvisor.com', 'tripadvisor.it',
  'expedia.com', 'expedia.it', 'hotels.com', 'agoda.com', 'vrbo.com', 'trivago.it', 'trivago.com',
  'google.com', 'goo.gl', 'g.page', 'maps.app.goo.gl', 'subito.it', 'kijiji.it', 'idealista.it',
  'immobiliare.it', 'casa.it', 'wa.me', 'whatsapp.com', 't.me', 'telegram.me',
];

// ---------------- helper puri (testati senza rete) ----------------

/** Nome host senza "www." (minuscolo), da URL o dominio; '' se non valido. */
export function siteDomain(urlOrHost) {
  let s = String(urlOrHost || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    const h = u.hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
    return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(h) ? h : '';
  } catch { return ''; }
}

/** Dominio di un indirizzo email (minuscolo), '' se non valido. */
export function emailDomain(email) {
  const m = /^[^\s@]+@([^\s@]+\.[a-z]{2,})$/i.exec(String(email || '').trim());
  return m ? m[1].toLowerCase().replace(/\.$/, '') : '';
}

/** true se il dominio e' una casella gratuita/generica (anche sottodomini). */
export function isFreeMail(domain) {
  const d = String(domain || '').toLowerCase();
  if (!d) return true;
  if (FREE_MAIL_FAMILIES.test(d)) return true;
  return FREE_MAIL.some(f => d === f || d.endsWith('.' + f));
}

/** true se il sito e' un portale/social dove scrivono anche altri. */
export function isUgcSite(domain) {
  const d = String(domain || '').toLowerCase();
  return UGC_SITES.some(f => d === f || d.endsWith('.' + f)) || /^google\.[a-z.]+$/.test(d);
}

export const verificationCode = id => 'ristoapp-verifica-' + id;

/** true se l'HTML contiene il codice esatto (non il prefisso di un altro id). */
export function htmlHasCode(html, id) {
  if (!html || !id) return false;
  const code = verificationCode(id).toLowerCase();
  const text = String(html).toLowerCase();
  let i = text.indexOf(code);
  while (i !== -1) {
    const next = text.charAt(i + code.length);
    if (!/[a-z0-9_-]/.test(next)) return true;
    i = text.indexOf(code, i + 1);
  }
  return false;
}

/** Il metodo "dominio" vale? email confermata, non gratuita, = dominio del sito. */
export function domainMatches(email, emailVerified, website) {
  if (!emailVerified) return false;
  const ed = emailDomain(email), sd = siteDomain(website);
  return !!ed && !!sd && !isFreeMail(ed) && !isUgcSite(sd) && ed === sd;
}

// ---------------- CIN -> Comune ----------------

/** Carica la tabella ISTAT (null se manca: il controllo viene saltato). */
export function loadIstat(file = ISTAT_FILE) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { console.log(`Tabella dei Comuni non disponibile (${e.message}): controllo CIN/Comune saltato.`); return null; }
}

/** Comune indicato dal CIN (caratteri 3-8), seguendo gli alias dei codici soppressi. */
export function comuneForCin(table, cin) {
  const code = String(cin || '').toUpperCase().replace(/\s+/g, '').slice(2, 8);
  let v = table && table[code];
  if (typeof v === 'string') v = table[v];
  return Array.isArray(v) ? { code, name: v[0], prov: v[1], lat: v[2], lng: v[3], radiusKm: v[4] || MAX_KM } : null;
}

export function distanceKm(a, b) {
  const R = 6371, r = x => x * Math.PI / 180;
  const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** true se CIN e posizione non tornano (Comune sconosciuto o troppo lontano). */
export function cinMismatch(table, r) {
  if (!table || !r || !r.cin) return false;
  const c = comuneForCin(table, r.cin);
  if (!c) return true;
  if (typeof r.lat !== 'number' || typeof r.lng !== 'number') return true;
  return distanceKm(c, r) > c.radiusKm;
}

/** Va nascosto in base alle segnalazioni? */
export function shouldHide(verified, reportsCount) {
  return verified ? reportsCount >= HIDE_VERIFIED : reportsCount >= HIDE_UNVERIFIED;
}

// ---------------- rete ----------------

/** Scarica al massimo 2 MB di una pagina (timeout 15 s, segue i redirect). */
export async function fetchPage(url) {
  let target = String(url || '').trim();
  if (!/^https?:\/\//i.test(target)) target = 'https://' + target;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(target, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5' },
    });
    if (!resp.ok || !resp.body) return '';
    const reader = resp.body.getReader();
    const chunks = [];
    let total = 0;
    while (total < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
    try { await reader.cancel(); } catch {}
    return Buffer.concat(chunks.map(c => Buffer.from(c))).subarray(0, MAX_BYTES).toString('utf8');
  } finally {
    clearTimeout(timer);
  }
}

async function websiteHasCode(website, id) {
  const sd = siteDomain(website);
  if (!sd || isUgcSite(sd)) return false;
  try { return htmlHasCode(await fetchPage(website), id); }
  catch (e) { console.log(`   sito non raggiungibile (${website}): ${e.name === 'AbortError' ? 'timeout' : e.message}`); return false; }
}

// ---------------- programma principale ----------------

function loadAdmin() {
  const base = process.env.VERIFY_DEPS_DIR
    ? path.join(path.resolve(process.env.VERIFY_DEPS_DIR), 'noop.js')
    : import.meta.url;
  return createRequire(base)('firebase-admin');
}

export async function main() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw || !raw.trim()) {
    console.log('FIREBASE_SERVICE_ACCOUNT non impostato: verifica automatica saltata.');
    console.log('Per attivarla segui SETUP-FIREBASE.md (sezione "Verifica automatica dei titolari").');
    return 0;
  }
  let credentials;
  try { credentials = JSON.parse(raw); }
  catch { console.log('FIREBASE_SERVICE_ACCOUNT non e\' un JSON valido: incolla l\'intero file della chiave. Verifica saltata.'); return 0; }

  const admin = loadAdmin();
  admin.initializeApp({ credential: admin.credential.cert(credentials) });
  const db = admin.firestore();
  const FieldValue = admin.firestore.FieldValue;
  const dailyRecheck = new Date().getUTCHours() === 3;
  const istat = loadIstat();

  // Segnalazioni raggruppate per annuncio (una sola lettura della collezione)
  const reports = new Map();
  const repSnap = await db.collection('reports').select('restaurant').get();
  repSnap.forEach(d => {
    const id = d.get('restaurant');
    if (typeof id === 'string') reports.set(id, (reports.get(id) || 0) + 1);
  });

  const userCache = new Map();
  async function ownerUser(uid) {
    if (!uid) return null;
    if (!userCache.has(uid)) {
      userCache.set(uid, await admin.auth().getUser(uid).catch(() => null));
    }
    return userCache.get(uid);
  }

  const sum = { listings: 0, lodging: 0, verifiedWebsite: 0, verifiedDomain: 0, unverified: 0,
                hidden: 0, hiddenCin: 0, shownAgain: 0, reportsUpdated: 0, errors: 0 };
  const snap = await db.collection('restaurants').get();
  for (const doc of snap.docs) {
    sum.listings++;
    try {
      const r = doc.data();
      const id = doc.id;
      const update = {};
      const lodging = LODGING_TYPES.includes(r.type);
      let verified = r.verified === true;
      const site = siteDomain(r.website);

      if (lodging && r.hidden !== true) {
        sum.lodging++;
        if (!verified) {
          if (r.website && await websiteHasCode(r.website, id)) {
            Object.assign(update, { verified: true, verifiedMethod: 'website' });
            sum.verifiedWebsite++;
          } else if (r.website) {
            const user = await ownerUser(r.owner);
            if (user && domainMatches(user.email, user.emailVerified, r.website)) {
              Object.assign(update, { verified: true, verifiedMethod: 'domain' });
              sum.verifiedDomain++;
            }
          }
          if (update.verified) {
            update.verifiedAt = FieldValue.serverTimestamp();
            update.verifiedFor = site;
            verified = true;
            console.log(`+ verificato (${update.verifiedMethod}): ${id} ${r.name}`);
          }
        } else {
          // sito cambiato dopo la verifica -> decade
          let lost = !!r.verifiedFor && r.verifiedFor !== site;
          if (!lost && dailyRecheck && r.verifiedMethod === 'website') {
            lost = !(await websiteHasCode(r.website, id));
          }
          if (lost) {
            Object.assign(update, { verified: false, verifiedMethod: FieldValue.delete(),
              verifiedAt: FieldValue.delete(), verifiedFor: FieldValue.delete() });
            verified = false;
            sum.unverified++;
            console.log(`- verifica revocata: ${id} ${r.name}`);
          }
        }
      }

      const count = reports.get(id) || 0;
      if ((r.reportsCount || 0) !== count) { update.reportsCount = count; sum.reportsUpdated++; }
      const byReports = shouldHide(verified, count);
      const badCin = lodging && istat && cinMismatch(istat, r);
      if (r.hidden !== true) {
        if (badCin) {
          Object.assign(update, { hidden: true, hiddenReason: 'cin_mismatch' });
          sum.hiddenCin++;
          console.log(`! nascosto: CIN ${r.cin} non corrisponde alla posizione: ${id} ${r.name}`);
        } else if (byReports) {
          Object.assign(update, { hidden: true, hiddenReason: 'reports' });
          sum.hidden++;
          console.log(`! nascosto per ${count} segnalazioni: ${id} ${r.name}`);
        }
      } else if (r.hiddenReason === 'cin_mismatch' && istat && !badCin) {
        // il titolare ha corretto le coordinate
        if (byReports) update.hiddenReason = 'reports';
        else { Object.assign(update, { hidden: false, hiddenReason: FieldValue.delete() }); sum.shownAgain++; }
        console.log(`+ CIN e posizione ora corrispondono: ${id} ${r.name}`);
      }

      if (Object.keys(update).length) await doc.ref.update(update);
    } catch (e) {
      sum.errors++;
      console.log(`x errore su ${doc.id}: ${e.message}`);
    }
  }
  console.log('Riepilogo:', JSON.stringify(sum));
  return 0;
}

// Eseguito direttamente (non quando importato dai test)
const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  main().then(code => process.exit(code || 0)).catch(e => {
    console.error('Verifica interrotta:', e);
    process.exit(1);
  });
}
