/* ============================================================
 *  RISTOAPP - Fiducia e sicurezza
 *  - Prenotazione diretta con sconto (solo alloggi verificati)
 *  - CIN con link al sito del Ministero del Turismo
 *  - Box "Per la tua sicurezza" negli alloggi
 *  - Segnalazioni (anche senza login) con codice di riferimento
 *  - Testi legali: Chi gestisce RistoApp, Privacy e cookie,
 *    Condizioni d'uso, Come ordiniamo i risultati e lo sconto
 *  - Rivendicazione di un CIN usato da altri
 *
 *  Usa un "foglio" sovrapposto (#sheetBackdrop) che sta sopra sia al
 *  dettaglio sia al pannello titolari.
 * ============================================================ */

(() => {
  const I18N = window.I18N;
  const t = (k, p) => I18N.t(k, p);
  const MINISTRY_URL = 'https://bdsr.ministeroturismo.gov.it/';
  const CIN_RE = /^IT\d{6}[A-Z0-9]{2}[A-Z0-9]{1,8}$/;
  const REASONS = ['fake', 'not_owner', 'payment', 'discount', 'wrong_data', 'other'];
  const CFG = window.RISTOAPP_CONFIG || {};
  const LEGAL = ['about', 'privacy', 'terms', 'ranking'];

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const normCin = s => String(s || '').toUpperCase().replace(/\s+/g, '');

  // ---------- helper puri ----------
  // Numero per wa.me: solo cifre con prefisso internazionale
  function waDigits(phone) {
    let d = String(phone || '').trim();
    const plus = d.startsWith('+');
    d = d.replace(/\D/g, '');
    if (!plus && d.startsWith('00')) d = d.slice(2);
    else if (!plus && /^3\d{8,9}$/.test(d)) d = '39' + d;      // cellulare italiano
    else if (!plus && /^0\d{5,10}$/.test(d)) d = '39' + d;     // fisso italiano
    return d.length >= 8 && d.length <= 15 ? d : '';
  }
  // tel: sicuro: solo cifre e "+" (nessun carattere puo' uscire dall'attributo)
  const telHref = p => 'tel:' + String(p ?? '').replace(/[^\d+]/g, '');
  // href esterno sicuro: solo http(s), altrimenti ''
  function safeHttp(u) {
    try {
      const url = new URL(String(u || '').trim());
      return (url.protocol === 'https:' || url.protocol === 'http:') ? url.href : '';
    } catch { return ''; }
  }
  const validEmail = e => /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(String(e || ''));

  // Sconto mostrabile: solo alloggi registrati, VERIFICATI, sconto > 0
  function discountOf(r, isLodging) {
    if (!r || !r.userGenerated || !isLodging || r.verified !== true) return 0;
    const n = r.directDiscount;
    return Number.isInteger(n) && n > 0 && n <= 30 ? n : 0;
  }
  // CIN valido dell'annuncio (titolare) o del luogo OSM (tag "cin"/ref:cin), altrimenti ''
  function cinOf(r) {
    if (!r) return '';
    const raw = (typeof r.cin === 'string' && r.cin) || (r.rawTags && typeof r.rawTags['ref:cin'] === 'string' && r.rawTags['ref:cin']) || '';
    const c = normCin(raw);
    return CIN_RE.test(c) ? c : '';
  }

  // ---------- CIN: Comune ISTAT (caratteri 3-8) ----------
  // data-static/istat-comuni.json: codice -> [nome, sigla, lat, lng, raggioKm?]
  // oppure codice -> "codice attuale" (Comuni soppressi/ricodificati).
  // Caricato solo nell'area titolari, alla prima necessita'.
  const ISTAT_URL = './data-static/istat-comuni.json?v=5.2.0';
  const MAX_KM = 20;
  let istatPromise = null;
  function loadIstat() {
    if (!istatPromise) {
      istatPromise = fetch(ISTAT_URL)
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .catch(e => { istatPromise = null; throw e; });
    }
    return istatPromise;
  }
  function comuneFrom(table, code) {
    let v = table[code];
    if (typeof v === 'string') v = table[v];
    if (!Array.isArray(v)) return null;
    return { code, name: v[0], prov: v[1], lat: v[2], lng: v[3], radiusKm: v[4] || MAX_KM };
  }
  // -> comune | null (codice inesistente) ; rifiuta se la tabella non si carica
  async function comuneForCin(cin) {
    const table = await loadIstat();
    return comuneFrom(table, normCin(cin).slice(2, 8));
  }
  function distanceKm(a, b) {
    const R = 6371, r = x => x * Math.PI / 180;
    const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  const insideComune = (comune, pos) => distanceKm(comune, pos) <= comune.radiusKm;

  // Controllo completo: formato -> unicita' (Firestore) -> Comune.
  // Risultato: { ok:true, cin, comune|null, unchecked } oppure { ok:false, error }
  async function checkCin(raw) {
    const cin = normCin(raw);
    if (!cin) return { ok: false, error: t('ed.cin.required') };
    if (!CIN_RE.test(cin)) return { ok: false, error: t('ed.cin.bad') };
    const store = window.RistoStore;
    try {
      if (!store || typeof store.cinStatus !== 'function') throw new Error(t('cin.err.network'));
      const st = await store.cinStatus(cin);
      if (st.taken) return { ok: false, error: t(st.mine ? 'ed.cin.yours' : 'cin.err.taken'), taken: !st.mine, cin };
    } catch (e) {
      return { ok: false, error: e && e.message ? e.message : t('cin.err.network') };
    }
    let comune = null;
    try { comune = await comuneForCin(cin); }
    catch (e) { console.warn('Elenco Comuni non disponibile:', e); return { ok: true, cin, comune: null, unchecked: true }; }
    if (!comune) return { ok: false, error: t('cin.err.comune') };
    return { ok: true, cin, comune, unchecked: false };
  }
  function cinResultHtml(res, opts = {}) {
    if (!res) return '';
    if (!res.ok) return `<p class="cin-result is-error" role="alert">${esc(res.error)}</p>` +
      (res.taken ? `<p class="cin-claim-line"><button type="button" class="link-btn" ${opts.register ? 'data-reg-claim' : 'data-cin-claim'}="${esc(res.cin)}">${esc(t(opts.register ? 'claim.linkRegister' : 'claim.link'))}</button></p>` : '');
    return res.comune
      ? `<p class="cin-result is-ok" role="status">\u2714\uFE0F ${esc(t('cin.ok', { comune: res.comune.name, prov: res.comune.prov }))}</p>`
      : `<p class="cin-result is-warn" role="status">${esc(t('cin.okUnchecked'))}</p>`;
  }

  // CIN controllato prima di creare l'account: resta in attesa del primo annuncio
  const PENDING_KEY = 'ristoapp-pending-cin';
  function setPendingCin(data) {
    try { if (data) localStorage.setItem(PENDING_KEY, JSON.stringify(data)); else localStorage.removeItem(PENDING_KEY); } catch {}
  }
  function getPendingCin(uid) {
    try {
      const p = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null');
      if (!p || !CIN_RE.test(p.cin || '')) return null;
      if (uid && p.uid && p.uid !== uid) return null;   // di un altro account
      return p;
    } catch { return null; }
  }

  // ---------- frammenti HTML ----------
  function discountBtnHtml(r, n) {
    return `<button type="button" class="disc-btn" data-discount="${esc(r.id)}">
      <span class="disc-main">${esc(t('disc.btn', { n, name: r.name }))}</span>
      <span class="disc-note">${esc(t('disc.note'))}</span>
    </button>`;
  }

  function cinHtml(cin) {
    if (!cin) return '';
    return `<div class="modal-section cin-box">
      <h4>${esc(t('cin.title'))}</h4>
      <p class="cin-line"><strong>${esc(t('cin.label'))}</strong> <code class="cin-code">${esc(cin)}</code>
        <a href="${MINISTRY_URL}" target="_blank" rel="noopener" class="cin-link">${esc(t('cin.verify'))} ↗</a></p>
      <p class="cin-tip">${esc(t('cin.tip'))}</p>
    </div>`;
  }

  function safetyHtml(id, name) {
    return `<div class="safety-box" role="note">
      <div class="safety-title">⚠️ ${esc(t('safety.title'))}</div>
      <p>${esc(t('safety.text'))}</p>
      <button type="button" class="link-btn" data-report="${esc(id)}" data-report-name="${esc(name)}">${esc(t('safety.report'))}</button>
    </div>`;
  }

  function reportLinkHtml(id, name) {
    return `<button type="button" class="link-btn report-link" data-report="${esc(id)}" data-report-name="${esc(name)}">⚑ ${esc(t('rep.link'))}</button>`;
  }

  // ---------- foglio sovrapposto ----------
  let current = null;   // { kind, args } per ridisegnare al cambio lingua
  function ensureSheet() {
    let bd = document.getElementById('sheetBackdrop');
    if (bd) return bd;
    bd = document.createElement('div');
    bd.id = 'sheetBackdrop';
    bd.className = 'sheet-backdrop';
    bd.setAttribute('role', 'dialog');
    bd.setAttribute('aria-modal', 'true');
    bd.innerHTML = '<div class="sheet" id="sheetContent"></div>';
    bd.addEventListener('click', e => { if (e.target === bd) closeSheet(); });
    document.body.appendChild(bd);
    return bd;
  }
  function openSheet(html, kind, args) {
    const bd = ensureSheet();
    current = { kind, args };
    document.getElementById('sheetContent').innerHTML = `
      <div class="sheet-head">
        <h3>${esc(sheetTitle(kind, args))}</h3>
        <button type="button" class="modal-close" data-sheet-close aria-label="${esc(t('modal.close'))}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="sheet-body">${html}</div>`;
    bd.classList.add('is-open');
    const c = document.getElementById('sheetContent');
    c.scrollTop = 0;
    const closeBtn = c.querySelector('[data-sheet-close]');
    closeBtn.onclick = closeSheet;
    if (!bd.contains(document.activeElement)) lastFocus = document.activeElement;
    try { closeBtn.focus({ preventScroll: true }); } catch {}
  }
  let lastFocus = null;
  function closeSheet() {
    const bd = document.getElementById('sheetBackdrop');
    if (bd) bd.classList.remove('is-open');
    current = null;
    if (lastFocus && document.contains(lastFocus)) { try { lastFocus.focus({ preventScroll: true }); } catch {} }
    lastFocus = null;
    try { window.dispatchEvent(new Event('ristoapp:ui-idle')); } catch {}
  }
  const sheetOpen = () => !!current;
  function sheetTitle(kind) {
    if (LEGAL.includes(kind)) return t('legal.' + kind + '.title');
    return kind === 'discount' ? t('disc.sheetTitle')
      : kind === 'report' || kind === 'reportDone' ? t('rep.title')
      : kind === 'cinClaim' ? t('claim.title')
      : t('legal.terms.title');
  }

  // ---------- prenotazione diretta ----------
  function openDiscount(r) {
    const n = Number.isInteger(r?.directDiscount) ? r.directDiscount : 0;
    if (!r || !n) return;
    const msg = t('disc.msg', { n });
    const subject = t('disc.subject', { n });
    const opts = [];
    if (r.phone) opts.push(`<a class="disc-opt" href="${esc(telHref(r.phone))}">☎ ${esc(t('disc.call'))}<small>${esc(r.phone)}</small></a>`);
    const wa = waDigits(r.whatsapp);
    if (wa) opts.push(`<a class="disc-opt disc-opt--wa" href="https://wa.me/${wa}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">💬 ${esc(t('disc.whatsapp'))}<small>+${esc(wa)}</small></a>`);
    if (validEmail(r.contactEmail)) {
      const mail = `mailto:${encodeURIComponent(r.contactEmail).replace('%40', '@')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(msg)}`;
      opts.push(`<a class="disc-opt" href="${esc(mail)}">✉️ ${esc(t('disc.email'))}<small>${esc(r.contactEmail)}</small></a>`);
    }
    const site = safeHttp(r.website);
    if (site) opts.push(`<a class="disc-opt" href="${esc(site)}" target="_blank" rel="noopener">🌐 ${esc(t('disc.website'))}<small>${esc(site.replace(/^https?:\/\//i, '').replace(/\/$/, ''))}</small></a>`);

    openSheet(`
      <p class="sheet-sub">${t('disc.sheetSub', { name: '<strong>' + esc(r.name) + '</strong>', n })}</p>
      <p class="sheet-note">${esc(t('disc.terms'))} <a href="#" data-legal="ranking">${esc(t('legal.ranking.title'))}</a></p>
      <div class="disc-opts">${opts.join('') || `<p>${esc(t('disc.noContacts'))}</p>`}</div>
      <label class="form-field disc-msg">
        <span>${esc(t('disc.msgLabel'))}</span>
        <textarea readonly rows="3" id="discMsg">${esc(msg)}</textarea>
      </label>
      <button type="button" class="chip" id="discCopy">${esc(t('disc.copy'))}</button>
    `, 'discount', [r]);
    document.getElementById('discCopy').onclick = () => copyText(msg, 'disc.copied');
  }

  // ---------- segnalazioni ----------
  function openReport(id, name) {
    openSheet(`
      <p class="sheet-sub">${t('rep.sub', { name: esc(name || id) })}</p>
      <form id="reportForm" class="report-form">
        <label class="form-field">
          <span>${esc(t('rep.reason'))}</span>
          <select name="reason" required>
            ${REASONS.map(k => `<option value="${k}">${esc(t('rep.r.' + k))}</option>`).join('')}
          </select>
        </label>
        <label class="form-field">
          <span>${esc(t('rep.text'))}</span>
          <textarea name="text" rows="4" maxlength="500" placeholder="${esc(t('rep.textPh'))}"></textarea>
        </label>
        <p class="report-msg" id="reportMsg" role="status"></p>
        <button type="submit" class="btn-primary btn-full">${esc(t('rep.send'))}</button>
      </form>`, 'report', [id, name]);
    const form = document.getElementById('reportForm');
    form.onsubmit = async e => {
      e.preventDefault();
      const fd = new FormData(form);
      const btn = form.querySelector('button[type="submit"]');
      const msgEl = document.getElementById('reportMsg');
      msgEl.textContent = ''; msgEl.classList.remove('is-error');
      const store = window.RistoStore;
      if (!store || typeof store.report !== 'function') {
        msgEl.textContent = t('rep.offline'); msgEl.classList.add('is-error');
        return;
      }
      btn.disabled = true; btn.textContent = t('rep.sending');
      try {
        const ref = await store.report({
          restaurant: String(id),
          name: String(name || ''),
          reason: REASONS.includes(fd.get('reason')) ? fd.get('reason') : 'other',
          text: String(fd.get('text') || '').slice(0, 500),
        });
        current = { kind: 'reportDone', args: [ref] };
        renderReportDone(ref);
      } catch (err) {
        msgEl.textContent = err && err.message ? err.message : t('rep.error');
        msgEl.classList.add('is-error');
        btn.disabled = false; btn.textContent = t('rep.send');
      }
    };
  }

  function renderReportDone(ref) {
    const body = document.querySelector('#sheetContent .sheet-body');
    if (!body) return;
    body.innerHTML =
      `<p class="report-thanks">✔️ ${esc(t('rep.thanks'))}</p>
       <p class="report-ref">${esc(t('rep.ref'))} <code id="reportRef">${esc(ref || '')}</code></p>
       <p class="sheet-note">${esc(t('rep.refNote'))}</p>
       <button type="button" class="btn-primary btn-full" data-sheet-close>${esc(t('modal.close'))}</button>`;
    body.querySelector('[data-sheet-close]').onclick = closeSheet;
  }

  // ---------- testi legali ----------
  const isTodo = v => !v || typeof v !== 'string' || !v.trim() || /\{\{[^}]*\}\}/.test(v);
  function operatorHtml() {
    const op = CFG.operator || {};
    const todo = `<span class="legal-todo">${esc(t('legal.todo'))}</span>`;
    const email = isTodo(op.email) ? todo
      : (validEmail(op.email) ? `<a href="mailto:${esc(op.email)}">${esc(op.email)}</a>` : esc(op.email));
    let date = '';
    try {
      const u = CFG.legalUpdated || { year: 2026, month: 11 };
      date = new Intl.DateTimeFormat(I18N.locale(), { month: 'long', year: 'numeric' })
        .format(new Date(Date.UTC(u.year, u.month - 1, 15)));
    } catch { date = '11/2026'; }
    return {
      name: isTodo(op.name) ? todo : esc(op.name),
      city: isTodo(op.city) ? todo : esc(op.city),
      email, date: esc(date),
    };
  }
  function openLegal(kind) {
    if (!LEGAL.includes(kind)) kind = 'terms';
    openSheet(`<div class="terms legal-text">${t('legal.' + kind + '.body', operatorHtml())}</div>
      <p class="legal-nav">${LEGAL.filter(k => k !== kind).map(k =>
        `<a href="#" data-legal="${k}">${esc(t('legal.' + k + '.title'))}</a>`).join(' · ')}</p>`, kind, [kind]);
  }
  const openTerms = () => openLegal('terms');

  // ---------- CIN gia' usato da altri: rivendicazione ----------
  function openCinClaim(cin) {
    const store = window.RistoStore;
    const u = store && store.currentUser && store.currentUser();
    const needLogin = !u;
    const needVerify = u && !u.emailVerified;
    openSheet(`
      <p class="sheet-sub">${esc(t('claim.sub'))}</p>
      ${needLogin ? `<p class="report-msg is-error">${esc(t('claim.needLogin'))}</p>` : ''}
      ${needVerify ? `<p class="report-msg is-error">${esc(t('claim.needVerified'))}</p>` : ''}
      <form id="claimForm" class="report-form">
        <label class="form-field">
          <span>${esc(t('ed.cin.label'))}</span>
          <input name="cin" maxlength="24" autocapitalize="characters" autocomplete="off" spellcheck="false" value="${esc(normCin(cin))}" placeholder="IT043013C2ABC12345" />
        </label>
        <label class="form-field">
          <span>${esc(t('claim.text'))}</span>
          <textarea name="text" rows="5" maxlength="1000" placeholder="${esc(t('claim.textPh'))}"></textarea>
        </label>
        <p class="sheet-note">${esc(t('claim.privacy'))}</p>
        <p class="report-msg" id="claimMsg" role="status"></p>
        <button type="submit" class="btn-primary btn-full" ${needLogin || needVerify ? 'disabled' : ''}>${esc(t('claim.send'))}</button>
      </form>`, 'cinClaim', [cin]);
    const form = document.getElementById('claimForm');
    form.onsubmit = async e => {
      e.preventDefault();
      const fd = new FormData(form);
      const msg = document.getElementById('claimMsg');
      const btn = form.querySelector('button[type="submit"]');
      msg.textContent = ''; msg.classList.remove('is-error');
      btn.disabled = true;
      try {
        const ref = await store.createCinClaim(fd.get('cin'), fd.get('text'));
        try { localStorage.removeItem('ristoapp-pending-claim'); } catch {}
        current = { kind: 'claimDone', args: [] };
        const body = document.querySelector('#sheetContent .sheet-body');
        body.innerHTML = `<p class="report-thanks">✔️ ${esc(t('claim.thanks'))}</p>
          <p class="report-ref">${esc(t('rep.ref'))} <code>${esc(ref)}</code></p>
          <button type="button" class="btn-primary btn-full" data-sheet-close>${esc(t('modal.close'))}</button>`;
        body.querySelector('[data-sheet-close]').onclick = closeSheet;
      } catch (err) {
        msg.textContent = err && err.message ? err.message : t('rep.error');
        msg.classList.add('is-error');
        btn.disabled = false;
      }
    };
  }

  // ---------- utilita' ----------
  function toast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-visible');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('is-visible'), 2400);
  }
  async function copyText(text, okKey) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch {}
      ta.remove();
    }
    toast(t(okKey));
  }

  // Clic ovunque: segnala / avvertenze (anche nel pannello titolari)
  document.addEventListener('click', e => {
    const rep = e.target.closest('[data-report]');
    if (rep) { e.preventDefault(); openReport(rep.dataset.report, rep.dataset.reportName || ''); return; }
    const legal = e.target.closest('[data-legal]');
    if (legal) { e.preventDefault(); openLegal(legal.dataset.legal); return; }
    const terms = e.target.closest('[data-terms]');
    if (terms) { e.preventDefault(); openTerms(); return; }
    const claim = e.target.closest('[data-cin-claim]');
    if (claim) { e.preventDefault(); openCinClaim(claim.dataset.cinClaim || ''); }
  });
  // Esc chiude prima il foglio (e non il dettaglio sotto)
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && sheetOpen()) { closeSheet(); e.stopImmediatePropagation(); }
  }, true);
  // Cambio lingua: ridisegna il foglio aperto (non il messaggio di grazie)
  I18N.onChange(() => {
    if (!current) return;
    const { kind, args } = current;
    if (kind === 'discount') openDiscount(...args);
    else if (kind === 'report') openReport(...args);
    else if (kind === 'reportDone') { document.querySelector('#sheetContent .sheet-head h3').textContent = sheetTitle(kind); renderReportDone(args[0]); }
    else if (LEGAL.includes(kind)) openLegal(kind);
    else if (kind === 'cinClaim') openCinClaim(...args);
  });

  window.RistoTrust = {
    MINISTRY_URL, CIN_RE, normCin, waDigits, validEmail, discountOf, cinOf, telHref, safeHttp, esc,
    loadIstat, comuneForCin, distanceKm, insideComune, checkCin, cinResultHtml,
    setPendingCin, getPendingCin,
    discountBtnHtml, cinHtml, safetyHtml, reportLinkHtml,
    openDiscount, openReport, openTerms, openLegal, openCinClaim, closeSheet, copyText, toast,
    sheetOpen,
  };
})();
