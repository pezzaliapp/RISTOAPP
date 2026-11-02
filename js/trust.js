/* ============================================================
 *  RISTOAPP - Fiducia e sicurezza
 *  - Prenotazione diretta con sconto (solo alloggi verificati)
 *  - CIN con link al sito del Ministero del Turismo
 *  - Box "Per la tua sicurezza" negli alloggi
 *  - Segnalazioni (anche senza login)
 *  - Finestra "Avvertenze e condizioni d'uso"
 *
 *  Usa un "foglio" sovrapposto (#sheetBackdrop) che sta sopra sia al
 *  dettaglio sia al pannello titolari.
 * ============================================================ */

(() => {
  const I18N = window.I18N;
  const t = (k, p) => I18N.t(k, p);
  const MINISTRY_URL = 'https://bdsr.ministeroturismo.gov.it/';
  const CIN_RE = /^IT\d{6}[A-Z0-9]{2}[A-Z0-9]{1,8}$/;
  const REASONS = ['fake', 'not_owner', 'payment', 'wrong_data', 'other'];

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
  const telHref = p => 'tel:' + String(p || '').replace(/[^\d+]/g, '');
  const validEmail = e => /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(String(e || ''));

  // Sconto mostrabile: solo alloggi registrati, VERIFICATI, sconto > 0
  function discountOf(r, isLodging) {
    if (!r || !r.userGenerated || !isLodging || r.verified !== true) return 0;
    const n = r.directDiscount;
    return Number.isInteger(n) && n > 0 && n <= 30 ? n : 0;
  }
  function cinOf(r) {
    const c = normCin(r && (r.cin || (r.rawTags && r.rawTags['ref:cin'])));
    return c && c.length <= 24 ? c : '';
  }

  // ---------- frammenti HTML ----------
  function discountBtnHtml(r, n) {
    return `<button type="button" class="disc-btn" data-discount="${esc(r.id)}">
      <span class="disc-main">${esc(t('disc.btn', { n }))}</span>
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
    c.querySelector('[data-sheet-close]').onclick = closeSheet;
  }
  function closeSheet() {
    const bd = document.getElementById('sheetBackdrop');
    if (bd) bd.classList.remove('is-open');
    current = null;
  }
  const sheetOpen = () => !!current;
  function sheetTitle(kind) {
    return kind === 'discount' ? t('disc.sheetTitle')
      : kind === 'report' ? t('rep.title')
      : t('terms.title');
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
    if (/^https?:\/\//i.test(r.website || '')) opts.push(`<a class="disc-opt" href="${esc(r.website)}" target="_blank" rel="noopener">🌐 ${esc(t('disc.website'))}<small>${esc(r.website.replace(/^https?:\/\//i, '').replace(/\/$/, ''))}</small></a>`);

    openSheet(`
      <p class="sheet-sub">${t('disc.sheetSub', { name: '<strong>' + esc(r.name) + '</strong>', n })}</p>
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
        await store.report({
          restaurant: String(id),
          reason: REASONS.includes(fd.get('reason')) ? fd.get('reason') : 'other',
          text: String(fd.get('text') || '').slice(0, 500),
        });
        current = { kind: 'reportDone', args: [] };
        document.querySelector('#sheetContent .sheet-body').innerHTML =
          `<p class="report-thanks">✔️ ${esc(t('rep.thanks'))}</p>
           <button type="button" class="btn-primary btn-full" data-sheet-close>${esc(t('modal.close'))}</button>`;
        document.querySelector('#sheetContent .sheet-body [data-sheet-close]').onclick = closeSheet;
      } catch (err) {
        msgEl.textContent = err && err.message ? err.message : t('rep.error');
        msgEl.classList.add('is-error');
        btn.disabled = false; btn.textContent = t('rep.send');
      }
    };
  }

  // ---------- avvertenze ----------
  function openTerms() {
    openSheet(`<div class="terms">${t('terms.body')}</div>`, 'terms', []);
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
    const terms = e.target.closest('[data-terms]');
    if (terms) { e.preventDefault(); openTerms(); }
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
    else if (kind === 'terms') openTerms();
  });

  window.RistoTrust = {
    MINISTRY_URL, CIN_RE, normCin, waDigits, validEmail, discountOf, cinOf,
    discountBtnHtml, cinHtml, safetyHtml, reportLinkHtml,
    openDiscount, openReport, openTerms, closeSheet, copyText, toast,
  };
})();
