#!/usr/bin/env node
/* ============================================================
 *  RistoApp - Controlli automatici sugli annunci (GitHub Actions, ogni ora)
 *
 *  v5.3 - cosa fa:
 *   1. VERIFICA DEL SITO (✓ Verificato) per tutti gli annunci (locali e
 *      alloggi). Vale SOLO:
 *        (a) <meta name="ristoapp-verification" content="ristoapp-verifica-<id>">
 *            dentro <head> della HOME PAGE del sito (radice del dominio), oppure
 *        (b) https://<host>/.well-known/ristoapp-verification.txt che contiene
 *            una riga uguale al codice, oppure
 *        (c) email del titolare confermata e dello stesso dominio del sito
 *            (non caselle gratuite / siti condivisi).
 *      Non si cercano codici nel corpo delle pagine ne' in pagine con
 *      parametri (niente contenuti "riflessi" o commenti). I redirect si
 *      seguono a mano e solo sullo stesso dominio. Siti gratuiti/condivisi
 *      e portali sono esclusi.
 *   2. IMPRONTA (verifiedSnapshot): hash di nome, dominio del sito,
 *      telefono, WhatsApp, email, CIN e indirizzo al momento della verifica.
 *      Se uno di questi cambia, la verifica decade finche' non si ripete.
 *   3. RICONTROLLO: ogni annuncio viene ricontrollato quando cambia
 *      (updatedAt) e comunque ogni 24 ore (lastRecheck), a qualsiasi ora.
 *   4. CIN: nasconde (hiddenReason 'cin_mismatch') gli alloggi il cui CIN
 *      indica un Comune inesistente o lontano dalla posizione; li mostra di
 *      nuovo quando il titolare corregge i dati. E' l'UNICO oscuramento
 *      automatico: le segnalazioni NON nascondono mai nulla da sole.
 *   5. SEGNALAZIONI E CONTESTAZIONI: le legge in modo incrementale (meta/verify)
 *      e apre/aggiorna UN issue GitHub "RistoApp: segnalazioni da controllare"
 *      con i soli conteggi (nessun dato personale); lo chiude quando e' tutto a zero.
 *   6. CONSERVAZIONE: elimina segnalazioni piu' vecchie di 12 mesi,
 *      contestazioni e richieste CIN piu' vecchie di 24 mesi.
 *   7. MIGRAZIONE una tantum (v5.3): hidden:false dove manca, toglie
 *      ownerEmail e reportsCount, rende visibili gli annunci nascosti in
 *      passato solo per numero di segnalazioni, status:'open' alle
 *      segnalazioni vecchie.
 *
 *  Uso:  FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}' \
 *        VERIFY_DEPS_DIR=/tmp/deps [GITHUB_TOKEN=... GITHUB_REPOSITORY=owner/repo] \
 *        node scripts/verify-owners.mjs
 *  Senza segreto: messaggio chiaro ed exit 0 (non fa mai fallire il job).
 * ============================================================ */

import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import dns from 'node:dns';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const LODGING_TYPES = ['B&B', 'Agriturismo', 'Affittacamere', 'Casa vacanze', 'Hotel', 'Ostello'];
export const USER_AGENT = 'RistoAppVerifier/2.0 (+https://www.alessandropezzali.it/RISTOAPP/)';
export const META_NAME = 'ristoapp-verification';
export const WELL_KNOWN_PATH = '/.well-known/ristoapp-verification.txt';
const FETCH_TIMEOUT_MS = 10000;
const MAX_BYTES = 1024 * 1024;
const MAX_REDIRECTS = 5;
const CONCURRENCY = 5;
const TIME_BUDGET_MS = 8 * 60 * 1000;        // tetto globale per i controlli dei siti
const RECHECK_MS = 24 * 3600 * 1000;
const ERROR_GRACE_MS = 72 * 3600 * 1000;     // sito irraggiungibile: si revoca dopo 72 h
const OVERLAP_MS = 5 * 60 * 1000;
const REPORTS_RETENTION_MS = 365 * 24 * 3600 * 1000;
const APPEALS_RETENTION_MS = 730 * 24 * 3600 * 1000;
const MAX_KM = 20;
export const ISSUE_TITLE = 'RistoApp: segnalazioni da controllare';
export const ISTAT_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data-static', 'istat-comuni.json');

// Caselle email gratuite/generiche: non dimostrano il controllo di un dominio
const FREE_MAIL = [
  'gmail.com', 'googlemail.com', 'libero.it', 'icloud.com', 'me.com', 'mac.com',
  'alice.it', 'tim.it', 'tin.it', 'tiscali.it', 'virgilio.it', 'aruba.it', 'pec.it',
  'legalmail.it', 'arubapec.it', 'pec.aruba.it', 'postacert.it', 'email.it', 'inwind.it',
  'iol.it', 'fastwebnet.it', 'msn.com', 'aol.com', 'ymail.com', 'proton.me',
  'protonmail.com', 'pm.me', 'gmx.com', 'gmx.net', 'web.de', 'mail.com', 'zoho.com',
  'yandex.com', 'mail.ru', 'katamail.com', 'teletu.it', 'vodafone.it', 'poste.it',
  'tutanota.com', 'tuta.io', 'hey.com', 'fastmail.com', 'outlook.it',
];
const FREE_MAIL_FAMILIES = /^(hotmail|outlook|live|yahoo|gmx|yandex)\.[a-z.]{2,8}$/;

// Siti gratuiti/condivisi, social, portali e servizi dove scrivono anche
// altri (o dove chiunque apre un sottodominio): NON provano il controllo
// della struttura. Vale il dominio e ogni suo sottodominio.
const BLOCKED_HOSTS = [
  // hosting gratuito / sottodomini condivisi
  'github.io', 'gitlab.io', 'netlify.app', 'netlify.com', 'vercel.app', 'now.sh', 'pages.dev',
  'workers.dev', 'web.app', 'firebaseapp.com', 'appspot.com', 'cloudfunctions.net', 'run.app',
  'wixsite.com', 'wix.com', 'editorx.io', 'wixstudio.io', 'weebly.com', 'weeblysite.com',
  'square.site', 'squarespace.com', 'blogspot.com', 'blogger.com', 'wordpress.com', 'wp.com',
  'altervista.org', 'jimdo.com', 'jimdosite.com', 'jimdofree.com', 'carrd.co', 'glitch.me',
  'onrender.com', 'herokuapp.com', 'fly.dev', 'railway.app', 'repl.co', 'replit.app', 'replit.dev',
  'surge.sh', 'tumblr.com', 'medium.com', 'substack.com', 'notion.site', 'notion.so', 'webflow.io',
  'strikingly.com', 'mystrikingly.com', 'webnode.it', 'webnode.com', 'webnode.page', 'site123.me',
  'godaddysites.com', 'myshopify.com', 'canva.site', 'framer.website', 'framer.app', 'ueniweb.com',
  'business.site', 'tilda.ws', 'beacons.ai', 'bio.link', 'about.me', 'linktr.ee', 'linktree.com',
  'sites.google.com', 'page.link', 'goo.gl', 'g.page', 'bit.ly', 'tinyurl.com', 'ngrok.io',
  'ngrok-free.app', '000webhostapp.com', 'infinityfreeapp.com', 'epizy.com', 'byethost.com',
  'neocities.org', 'freehostia.com', 'sitew.com', 'e-monsite.com', 'over-blog.com', 'overblog.com',
  'ilcannocchiale.it', 'splinder.com', 'myblog.it', 'xoom.it', 'interfree.it', 'beepworld.it',
  // social e messaggistica
  'facebook.com', 'fb.com', 'fb.me', 'instagram.com', 'tiktok.com', 'youtube.com', 'youtu.be',
  'x.com', 'twitter.com', 'threads.net', 'linkedin.com', 'pinterest.com', 'wa.me', 'whatsapp.com',
  't.me', 'telegram.me', 'telegram.org',
  // portali, recensioni, annunci
  'booking.com', 'hotels.com', 'agoda.com', 'vrbo.com', 'homeaway.com', 'trivago.com', 'kayak.com',
  'hostelworld.com', 'campingit.com', 'agriturismo.it', 'thefork.it', 'thefork.com', 'justeat.it',
  'just-eat.it', 'deliveroo.it', 'glovoapp.com', 'yelp.com', 'yelp.it', 'paginegialle.it',
  'paginebianche.it', 'subito.it', 'kijiji.it', 'idealista.it', 'immobiliare.it', 'casa.it',
  'google.com', 'maps.app.goo.gl',
];
// famiglie con molti domini nazionali (airbnb.it, tripadvisor.co.uk, blogspot.it...)
const BLOCKED_FAMILIES = /(^|\.)(airbnb|tripadvisor|expedia|trivago|google|blogspot|jimdo|booking|holidu|hometogo|lastminute|edreams|tiktok|amazon)\.[a-z.]{2,10}$/;

// ---------------- helper puri (testati senza rete) ----------------

/** Nome host senza "www." (minuscolo), da URL o dominio; '' se non valido. */
export function siteDomain(urlOrHost) {
  let s = String(urlOrHost || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    if (u.username || u.password || u.port) return '';
    const h = u.hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
    return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(h) && !h.includes('..') ? h : '';
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
  return FREE_MAIL.some(f => d === f || d.endsWith('.' + f)) || isBlockedHost(d);
}

/** true se il sito e' gratuito/condiviso, un social o un portale. */
export function isBlockedHost(domain) {
  const d = String(domain || '').toLowerCase().replace(/^www\./, '');
  if (!d) return true;
  if (BLOCKED_FAMILIES.test(d)) return true;
  return BLOCKED_HOSTS.some(f => d === f || d.endsWith('.' + f));
}
// nome storico (test della 5.2)
export const isUgcSite = isBlockedHost;

export const verificationCode = id => 'ristoapp-verifica-' + id;

/** Stesso sito (ignorando www.)? */
export function sameSite(a, b) {
  const x = siteDomain(a), y = siteDomain(b);
  return !!x && x === y;
}

/** Solo l'<head> della pagina, senza script/stili/commenti; '' se non c'e' un <head> riconoscibile. */
export function headOf(html) {
  const s = String(html || '');
  const lower = s.toLowerCase();
  let end = lower.indexOf('</head');
  const body = lower.search(/<body[\s>]/);
  if (end === -1 || (body !== -1 && body < end)) end = body;
  if (end === -1) return '';
  return s.slice(0, end)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|template|textarea|title)\b[\s\S]*?<\/\1\s*>/gi, ' ');
}

function parseAttrs(tag) {
  const out = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let m;
  while ((m = re.exec(tag))) {
    const k = m[1].toLowerCase();
    if (!(k in out)) out[k] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return out;
}

/** true se l'<head> contiene <meta name="ristoapp-verification" content="CODICE"> esatto. */
export function metaHasToken(html, token) {
  if (!html || !token) return false;
  const head = headOf(html);
  if (!head) return false;
  const re = /<meta\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(head))) {
    const a = parseAttrs(m[1]);
    if ((a.name || '').trim().toLowerCase() === META_NAME && (a.content || '').trim() === token) return true;
  }
  return false;
}

/** true se il file .well-known contiene una riga uguale al codice. */
export function wellKnownHasToken(text, token) {
  if (!text || !token) return false;
  return String(text).slice(0, 4096).split(/\r?\n/).some(l => l.trim() === token);
}

/** Il metodo "dominio" vale? email confermata, non gratuita, = dominio del sito. */
export function domainMatches(email, emailVerified, website) {
  if (!emailVerified) return false;
  const ed = emailDomain(email), sd = siteDomain(website);
  return !!ed && !!sd && !isFreeMail(ed) && !isBlockedHost(sd) && ed === sd;
}

/** Impronta dei dati d'identita' dell'annuncio (cambia -> verifica da rifare). */
export function fingerprint(r) {
  const n = v => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const digits = v => String(v ?? '').replace(/[^\d+]/g, '');
  const parts = [n(r && r.name), siteDomain(r && r.website), digits(r && r.phone), digits(r && r.whatsapp),
    n(r && r.contactEmail), n(r && r.cin).toUpperCase().replace(/\s/g, ''), n(r && r.address)];
  return crypto.createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 32);
}

const millis = v => {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v._seconds === 'number') return v._seconds * 1000;
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  if (v instanceof Date) return v.getTime();
  return 0;
};

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

// ---------------- rete ----------------

function privateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const s = ip.toLowerCase();
  return s === '::1' || s === '::' || s.startsWith('fe80') || s.startsWith('fc') || s.startsWith('fd')
    || s.startsWith('::ffff:') && privateIp(s.slice(7));
}
/** Il nome punta a indirizzi pubblici? (niente rete interna del runner) */
export async function publicHost(host, resolve = (h) => dns.promises.lookup(h, { all: true })) {
  try {
    const addrs = await resolve(host);
    return Array.isArray(addrs) && addrs.length > 0 && addrs.every(a => !privateIp(a.address || a));
  } catch { return false; }
}

/**
 * Scarica una pagina seguendo i redirect A MANO, solo sullo stesso sito.
 * -> { ok, status, text, url } | { ok:false, error: 'cross-domain'|'timeout'|... }
 */
export async function fetchSameSite(url, opts = {}) {
  const fetchImpl = opts.fetch || globalThis.fetch;
  const resolve = opts.resolve;
  const start = new URL(url);
  let current = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (current.protocol !== 'https:' && current.protocol !== 'http:') return { ok: false, error: 'protocol' };
    if (!sameSite(current.hostname, start.hostname)) return { ok: false, error: 'cross-domain' };
    if (current.port || current.username || current.password) return { ok: false, error: 'bad-url' };
    if (!(await publicHost(current.hostname, resolve))) return { ok: false, error: 'private-host' };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs || FETCH_TIMEOUT_MS);
    let resp;
    try {
      resp = await fetchImpl(current.href, {
        redirect: 'manual',
        signal: ctrl.signal,
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,text/plain;q=0.9,*/*;q=0.5' },
      });
      if ([301, 302, 303, 307, 308].includes(resp.status)) {
        const loc = resp.headers.get('location');
        try { await resp.body?.cancel(); } catch {}
        if (!loc) return { ok: false, error: 'redirect-no-location' };
        current = new URL(loc, current);
        continue;
      }
      if (!resp.ok || !resp.body) return { ok: false, status: resp.status, error: 'http-' + resp.status };
      const reader = resp.body.getReader();
      const chunks = [];
      let total = 0;
      const max = opts.maxBytes || MAX_BYTES;
      while (total < max) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        total += value.length;
      }
      try { await reader.cancel(); } catch {}
      const text = Buffer.concat(chunks.map(c => Buffer.from(c))).subarray(0, max).toString('utf8');
      return { ok: true, status: resp.status, text, url: current.href };
    } catch (e) {
      return { ok: false, error: e && e.name === 'AbortError' ? 'timeout' : 'network: ' + (e && e.message) };
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, error: 'too-many-redirects' };
}

/**
 * Il sito ufficiale prova il controllo? Solo home page (meta in <head>) o
 * file .well-known. -> 'yes' | 'no' | 'error' (irraggiungibile: riprovare)
 */
export async function siteHasToken(website, id, opts = {}) {
  const sd = siteDomain(website);
  if (!sd || isBlockedHost(sd)) return 'no';
  let host;
  try { host = new URL(/^https?:\/\//i.test(website) ? website : 'https://' + website).hostname; }
  catch { return 'no'; }
  const token = verificationCode(id);
  let reached = false, definitive = false;
  for (const proto of ['https:', 'http:']) {
    const home = await fetchSameSite(`${proto}//${host}/`, opts);
    if (home.ok) {
      reached = true;
      if (metaHasToken(home.text, token)) return 'yes';
    } else if (/^http-|cross-domain|private-host|protocol|bad-url|redirect/.test(home.error || '')) definitive = true;
    const wk = await fetchSameSite(`${proto}//${host}${WELL_KNOWN_PATH}`, { ...opts, maxBytes: 4096 });
    if (wk.ok) {
      reached = true;
      if (wellKnownHasToken(wk.text, token)) return 'yes';
    }
    if (reached || definitive) break;   // http solo se https non risponde affatto
  }
  return reached || definitive ? 'no' : 'error';
}

/** Esegue fn su tutti gli elementi con al massimo n in parallelo, entro il tempo dato. */
export async function runPool(items, n, fn, deadline = Infinity) {
  const results = new Array(items.length);
  let next = 0, skipped = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      if (Date.now() > deadline) { results[i] = { skipped: true }; skipped++; continue; }
      try { results[i] = await fn(items[i], i); }
      catch (e) { results[i] = { error: e }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return { results, skipped };
}

// ---------------- GitHub: un solo issue con i conteggi ----------------

export function issueBody(counts, appUrl = 'https://www.alessandropezzali.it/RISTOAPP/') {
  return [
    'Riepilogo automatico (nessun dato personale).',
    '',
    `- Segnalazioni aperte: **${counts.reports}**`,
    `- Contestazioni aperte: **${counts.appeals}**`,
    `- Richieste di liberare un CIN: **${counts.claims}**`,
    '',
    `Per esaminarle: apri ${appUrl}, **Area titolari**, accedi con l'account amministratore → sezione **Moderazione**.`,
    '',
    'Questo issue si aggiorna ogni ora e si chiude da solo quando non c\'e\' piu\' nulla da esaminare.',
  ].join('\n');
}

/** Apre/aggiorna/chiude l'issue. Ritorna l'azione eseguita. */
export async function syncIssue(counts, env = process.env, fetchImpl = globalThis.fetch) {
  const token = env.GITHUB_TOKEN, repo = env.GITHUB_REPOSITORY;
  if (!token || !repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return 'skipped (GITHUB_TOKEN/GITHUB_REPOSITORY mancanti)';
  const api = `https://api.github.com/repos/${repo}`;
  const headers = {
    'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': USER_AGENT, 'Content-Type': 'application/json',
  };
  const total = counts.reports + counts.appeals + counts.claims;
  // cerca l'issue (aperto o chiuso) con il titolo esatto, creato da questo workflow
  let found = null;
  for (let page = 1; page <= 5 && !found; page++) {
    const r = await fetchImpl(`${api}/issues?state=all&per_page=100&page=${page}`, { headers });
    if (!r.ok) throw new Error('GitHub issues HTTP ' + r.status);
    const list = await r.json();
    found = list.find(i => i.title === ISSUE_TITLE && !i.pull_request) || null;
    if (list.length < 100) break;
  }
  const body = issueBody(counts);
  if (total > 0) {
    if (!found) {
      const r = await fetchImpl(`${api}/issues`, { method: 'POST', headers, body: JSON.stringify({ title: ISSUE_TITLE, body }) });
      if (!r.ok) throw new Error('GitHub create HTTP ' + r.status);
      return 'created';
    }
    if (found.state !== 'open' || found.body !== body) {
      const r = await fetchImpl(`${api}/issues/${found.number}`, { method: 'PATCH', headers, body: JSON.stringify({ state: 'open', body }) });
      if (!r.ok) throw new Error('GitHub update HTTP ' + r.status);
      return found.state !== 'open' ? 'reopened' : 'updated';
    }
    return 'unchanged';
  }
  if (found && found.state === 'open') {
    const r = await fetchImpl(`${api}/issues/${found.number}`, { method: 'PATCH', headers, body: JSON.stringify({ state: 'closed', body }) });
    if (!r.ok) throw new Error('GitHub close HTTP ' + r.status);
    return 'closed';
  }
  return 'nothing';
}

// ---------------- programma principale ----------------

function loadAdmin() {
  const base = process.env.VERIFY_DEPS_DIR
    ? path.join(path.resolve(process.env.VERIFY_DEPS_DIR), 'noop.js')
    : import.meta.url;
  return createRequire(base)('firebase-admin');
}

async function countOpen(db, name) {
  const q = db.collection(name).where('status', '==', 'open');
  try { const s = await q.count().get(); return s.data().count; }
  catch { const s = await q.select().get(); return s.size; }
}

async function deleteOlderThan(db, name, cutoffTs) {
  let deleted = 0;
  for (let round = 0; round < 20; round++) {
    const snap = await db.collection(name).where('createdAt', '<', cutoffTs).limit(300).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
    if (snap.size < 300) break;
  }
  return deleted;
}

export async function main(opts = {}) {
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
  if (!admin.apps || !admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(credentials) });
  const db = admin.firestore();
  const FieldValue = admin.firestore.FieldValue;
  const Timestamp = admin.firestore.Timestamp;
  const now = opts.now || Date.now();
  // tetto di tempo reale (orologio di sistema), indipendente da "now"
  const deadline = Date.now() + (opts.timeBudgetMs ?? TIME_BUDGET_MS);
  const netOpts = { fetch: opts.fetch, resolve: opts.resolve };
  const istat = loadIstat();
  const metaRef = db.collection('meta').doc('verify');
  const metaSnap = await metaRef.get();
  const meta = metaSnap.exists ? metaSnap.data() : {};
  const sum = { read: 0, verifiedWebsite: 0, verifiedDomain: 0, revoked: 0, hiddenCin: 0, shownAgain: 0,
                migrated: 0, writes: 0, skippedTime: 0, siteErrors: 0, errors: 0 };

  // ---- 1. Migrazione una tantum (v5.3) ----
  let docs = null;
  if (!meta.migratedV53) {
    const all = await db.collection('restaurants').get();
    docs = all.docs;
    const repAll = await db.collection('reports').get();
    let batch = db.batch(), n = 0;
    for (const d of repAll.docs) {
      if (!d.get('status')) { batch.update(d.ref, { status: 'open' }); n++; }
      if (n && n % 400 === 0) { await batch.commit(); batch = db.batch(); }
    }
    if (n % 400) await batch.commit();
    console.log(`Migrazione 5.3: ${n} segnalazioni con status 'open'.`);
  } else {
    // ---- 2. Solo gli annunci cambiati dall'ultimo giro + quelli da ricontrollare (24 h) ----
    const byId = new Map();
    const lastRun = millis(meta.lastRun);
    if (lastRun) {
      const changed = await db.collection('restaurants').where('updatedAt', '>', Timestamp.fromMillis(lastRun - OVERLAP_MS)).get();
      changed.docs.forEach(d => byId.set(d.id, d));
    } else {
      (await db.collection('restaurants').get()).docs.forEach(d => byId.set(d.id, d));
    }
    const stale = await db.collection('restaurants').where('lastRecheck', '<', Timestamp.fromMillis(now - RECHECK_MS)).get();
    stale.docs.forEach(d => byId.set(d.id, d));
    docs = [...byId.values()];
  }
  sum.read = docs.length;

  const userCache = new Map();
  async function ownerUser(uid) {
    if (!uid) return null;
    if (!userCache.has(uid)) userCache.set(uid, await admin.auth().getUser(uid).catch(() => null));
    return userCache.get(uid);
  }

  // ---- 3. Controllo di ogni annuncio (rete in parallelo, 5 alla volta) ----
  let minPendingUpdated = Infinity;
  const work = await runPool(docs, CONCURRENCY, async (doc) => {
    const r = doc.data();
    const id = doc.id;
    const update = {};
    const lodging = LODGING_TYPES.includes(r.type);
    const fp = fingerprint(r);
    const site = siteDomain(r.website);
    let verified = r.verified === true;
    const revoke = (why) => {
      Object.assign(update, { verified: false, verifiedMethod: FieldValue.delete(), verifiedAt: FieldValue.delete(),
        verifiedFor: FieldValue.delete(), verifiedSnapshot: FieldValue.delete() });
      verified = false;
      sum.revoked++;
      console.log(`- verifica revocata (${why}): ${id}`);
    };

    // migrazione e pulizia dei dati vecchi
    if (!('hidden' in r)) { update.hidden = false; sum.migrated++; }
    if ('ownerEmail' in r) update.ownerEmail = FieldValue.delete();
    if ('reportsCount' in r) update.reportsCount = FieldValue.delete();
    if (r.hidden === true && r.hiddenReason === 'reports') {
      // le segnalazioni non nascondono piu' nulla da sole: si rende visibile
      Object.assign(update, { hidden: false, hiddenReason: FieldValue.delete() });
      sum.shownAgain++;
      console.log(`+ visibile di nuovo (era nascosto solo per numero di segnalazioni): ${id}`);
    }
    // verifica tolta dal titolare (o dati verificati cambiati): pulizia
    if (!verified && (r.verifiedMethod || r.verifiedAt || r.verifiedFor || r.verifiedSnapshot)) {
      Object.assign(update, { verifiedMethod: FieldValue.delete(), verifiedAt: FieldValue.delete(),
        verifiedFor: FieldValue.delete(), verifiedSnapshot: FieldValue.delete() });
    }
    let revokedNow = false;
    if (verified && r.verifiedSnapshot && r.verifiedSnapshot !== fp) { revoke('dati cambiati'); revokedNow = true; }
    else if (verified && r.verifiedFor && r.verifiedFor !== site) { revoke('sito cambiato'); revokedNow = true; }

    // CIN e Comune (unico oscuramento automatico)
    const hiddenNow = r.hidden === true && !(update.hidden === false);
    const badCin = lodging && istat && cinMismatch(istat, r);
    if (!hiddenNow && badCin) {
      Object.assign(update, { hidden: true, hiddenReason: 'cin_mismatch' });
      sum.hiddenCin++;
      console.log(`! nascosto: CIN ${r.cin} non corrisponde alla posizione: ${id}`);
    } else if (hiddenNow && r.hiddenReason === 'cin_mismatch' && istat && !badCin) {
      Object.assign(update, { hidden: false, hiddenReason: FieldValue.delete() });
      sum.shownAgain++;
      console.log(`+ CIN e posizione ora corrispondono: ${id}`);
    }
    const visible = !(update.hidden === true || (hiddenNow && update.hidden !== false));

    // Verifica del sito (solo annunci visibili)
    let checked = true;
    if (visible && !revokedNow && site) {
      let res = await siteHasToken(r.website, id, netOpts);
      let method = res === 'yes' ? 'website' : null;
      if (res !== 'yes') {
        const user = await ownerUser(r.owner);
        if (user && domainMatches(user.email, user.emailVerified, r.website)) { method = 'domain'; res = 'yes'; }
      }
      if (res === 'yes') {
        if (!verified) {
          Object.assign(update, { verified: true, verifiedMethod: method, verifiedAt: FieldValue.serverTimestamp(),
            verifiedFor: site, verifiedSnapshot: fp });
          if (method === 'website') sum.verifiedWebsite++; else sum.verifiedDomain++;
          console.log(`+ verificato (${method}): ${id}`);
        } else if (r.verifiedSnapshot !== fp || r.verifiedFor !== site || r.verifiedMethod !== method) {
          Object.assign(update, { verifiedSnapshot: fp, verifiedFor: site, verifiedMethod: method });
        }
      } else if (res === 'error') {
        sum.siteErrors++;
        // sito irraggiungibile: si riprova al prossimo giro; si revoca solo dopo 72 h
        if (verified && now - millis(r.lastRecheck || r.verifiedAt) > ERROR_GRACE_MS) revoke('sito irraggiungibile da 72 ore');
        else checked = false;
      } else if (verified) {
        revoke('codice non piu\' presente');
      }
    } else if (verified && !site) {
      revoke('sito rimosso');
    }
    if (checked) update.lastRecheck = Timestamp.fromMillis(now);
    if (Object.keys(update).length) { await doc.ref.update(update); sum.writes++; }
    return { ok: true };
  }, deadline);
  work.results.forEach((res, i) => {
    if (res && res.skipped) {
      sum.skippedTime++;
      const u = millis(docs[i].data().updatedAt);
      if (u) minPendingUpdated = Math.min(minPendingUpdated, u);
    } else if (res && res.error) {
      sum.errors++;
      console.log(`x errore su ${docs[i].id}: ${res.error.message}`);
    }
  });

  // ---- 4. Segnalazioni nuove (lettura incrementale) e conteggi ----
  const lastReportTs = millis(meta.lastReportTs);
  let newReports = 0, maxReportTs = lastReportTs;
  const repQuery = lastReportTs
    ? db.collection('reports').where('createdAt', '>', Timestamp.fromMillis(lastReportTs))
    : db.collection('reports').where('createdAt', '>', Timestamp.fromMillis(now - REPORTS_RETENTION_MS));
  const repSnap = await repQuery.select('createdAt').get();
  repSnap.docs.forEach(d => { newReports++; maxReportTs = Math.max(maxReportTs, millis(d.get('createdAt'))); });
  const counts = {
    reports: await countOpen(db, 'reports'),
    appeals: await countOpen(db, 'appeals'),
    claims: await countOpen(db, 'cinClaims'),
  };
  console.log(`Segnalazioni nuove dall'ultimo giro: ${newReports}. Da esaminare: ${JSON.stringify(counts)}`);

  // ---- 5. Conservazione ----
  const delReports = await deleteOlderThan(db, 'reports', Timestamp.fromMillis(now - REPORTS_RETENTION_MS));
  const delAppeals = await deleteOlderThan(db, 'appeals', Timestamp.fromMillis(now - APPEALS_RETENTION_MS));
  const delClaims = await deleteOlderThan(db, 'cinClaims', Timestamp.fromMillis(now - APPEALS_RETENTION_MS));
  if (delReports || delAppeals || delClaims) console.log(`Conservazione: eliminate ${delReports} segnalazioni, ${delAppeals} contestazioni, ${delClaims} richieste CIN.`);

  // ---- 6. Issue GitHub con i soli conteggi ----
  try { console.log('Issue GitHub:', await syncIssue(counts, process.env, opts.githubFetch || globalThis.fetch)); }
  catch (e) { console.log('Issue GitHub non aggiornato:', e.message); }

  // ---- 7. Stato per il prossimo giro ----
  const nextLastRun = Number.isFinite(minPendingUpdated) ? Math.min(now, minPendingUpdated - 1) : now;
  await metaRef.set({
    lastRun: Timestamp.fromMillis(nextLastRun),
    lastReportTs: Timestamp.fromMillis(maxReportTs || 0),
    // la migrazione e' completa solo se nessun annuncio e' rimasto indietro per il tempo
    migratedV53: !!meta.migratedV53 || sum.skippedTime === 0,
    lastCounts: counts,
  }, { merge: true });

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
