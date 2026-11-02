/* ============================================================
 *  RISTOAPP - Area titolari (ristoranti, B&B, agriturismi, hotel...)
 *  Login, registrazione e dashboard per gestire il proprio
 *  locale (menu con prezzi, orari, pagamenti, contatti).
 * ============================================================ */

(() => {
  const CFG = window.RISTOAPP_CONFIG;
  const Store = window.RistoStore;
  const $ = (s, r = document) => r.querySelector(s);
  const I18N = window.I18N;
  const t = (k, p) => I18N.t(k, p);
  const Trust = window.RistoTrust;
  // Codice da pubblicare sul sito ufficiale per la verifica automatica
  const verifyCode = id => 'ristoapp-verifica-' + id;
  // Sito accettato: http(s)://... oppure un dominio (https:// aggiunto da store.js)
  const okWebsite = u => !u || /^https?:\/\/[^\s"'<>]+$/i.test(u) || /^[a-z0-9.-]+\.[a-z]{2,}(\/[^\s"'<>]*)?$/i.test(u);

  // Giorni settimana (0 = domenica), tradotti al momento dell'uso
  const dayName = i => t('day.' + i);
  // Le tipologie sono salvate in Firestore in italiano: si traduce solo l'etichetta
  const FOOD_TYPES = ['Pizzeria','Trattoria','Osteria','Ristorante','Fast food','Bar','Caff\u00E8','Gelateria','Pub'];
  const LODGING_TYPES = ['B&B','Agriturismo','Affittacamere','Casa vacanze','Hotel','Ostello'];
  const isLodgingType = t => LODGING_TYPES.includes(t);
  let editingLodging = false;

  // Testi dell'editor che cambiano tra locale e alloggio (chiavi ed.food.* / ed.lodging.*)
  const TEXT_KEYS = ['hoursTitle', 'hoursHint', 'featTitle', 'featHint', 'featPh',
    'menuTitle', 'addBtn', 'menuHint', 'itemPh', 'unit'];
  const TEXT_FIXED = {
    food:    { hoursPh: '12:00-14:30, 19:30-23:00', pricePh: '9.50' },
    lodging: { hoursPh: '14:00-20:00',              pricePh: '80' },
  };
  function texts(kind) {
    const o = { ...TEXT_FIXED[kind] };
    TEXT_KEYS.forEach(k => { o[k] = t(`ed.${kind}.${k}`); });
    return o;
  }
  function applyTypeTexts(type) {
    editingLodging = isLodgingType(type);
    const t = texts(editingLodging ? 'lodging' : 'food');
    const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
    set('edHoursTitle', t.hoursTitle); set('edHoursHint', t.hoursHint);
    set('edFeatTitle', t.featTitle); set('edFeatHint', t.featHint);
    set('edMenuTitle', t.menuTitle); set('addDish', t.addBtn); set('edMenuHint', t.menuHint);
    set('edDeclText', escapeHtml(I18N.t(editingLodging ? 'ed.decl.lodging' : 'ed.decl.food')));
    // Sezioni solo per alloggi (CIN, prenotazione diretta): nascoste e
    // disattivate per i locali, cosi' non vengono validate ne' inviate
    document.querySelectorAll('[data-only="lodging"]').forEach(sec => {
      sec.style.display = editingLodging ? '' : 'none';
      sec.querySelectorAll('input').forEach(i => { i.disabled = !editingLodging; });
    });
    document.querySelectorAll('[name^="hours_"]').forEach(i => i.placeholder = t.hoursPh);
    const f = document.querySelector('[name="features"]'); if (f) f.placeholder = t.featPh;
    document.querySelectorAll('.menu-row [name="dish"]').forEach(i => i.placeholder = t.itemPh);
    document.querySelectorAll('.menu-row [name="price"]').forEach(i => i.placeholder = t.pricePh);
    document.querySelectorAll('.menu-row-cur').forEach(i => i.textContent = t.unit);
  }
  // key = valore salvato (non tradurre); etichetta da pay.<key>
  const PAYMENTS = [
    { key: 'contanti',  icon: '\uD83D\uDCB6' },
    { key: 'carta',     icon: '\uD83D\uDCB3' },
    { key: 'bancomat',  icon: '\uD83C\uDFE7' },
    { key: 'satispay',  icon: '\uD83D\uDCF1' },
    { key: 'buoni',     icon: '\uD83C\uDF7D\uFE0F' },
    { key: 'applepay',  icon: '\uD83C\uDF4F' },
    { key: 'googlepay', icon: 'G' },
  ];

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  const escapeAttr = escapeHtml;

  function ensurePanel() {
    let panel = $('#ownerPanel');
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = 'ownerPanel';
    panel.className = 'owner-panel';
    panel.innerHTML = `<div class="owner-panel-inner" id="ownerPanelInner"></div>`;
    document.body.appendChild(panel);
    return panel;
  }

  // Vista corrente, per ridisegnarla al cambio lingua
  let view = { name: null };

  function openPanel(mode) {
    ensurePanel().classList.add('is-open');
    document.body.style.overflow = 'hidden';
    if (mode === 'register' && !Store.currentUser()) renderAuthView('register');
    else renderRouter();
  }
  function closePanel() {
    const p = $('#ownerPanel'); if (p) p.classList.remove('is-open');
    view = { name: null };
    document.body.style.overflow = '';
  }

  // -------------- AUTH VIEW ---------------------------------
  // Registrazione a passi: scelta (locale / alloggio) -> [alloggio: CIN] -> account.
  // reg sopravvive al ridisegno per il cambio lingua.
  let reg = { step: 'choose', kind: null, cin: '', res: null };
  const closeBtnHtml = () => `<button class="modal-close" id="ownerCloseBtn" aria-label="${escapeAttr(t('modal.close'))}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>`;

  function howItWorksHtml() {
    return `<div class="how-box">
      <h3>${escapeHtml(t('how.title'))}</h3>
      <ol>
        <li>${t('how.step1')}</li>
        <li>${t('how.step2')}</li>
        <li>${t('how.step3')}</li>
      </ol>
      <p class="how-note">${escapeHtml(t('how.note'))}</p>
    </div>`;
  }

  function renderAuthView(mode = 'login') {
    const inner = $('#ownerPanelInner');
    const isLogin = mode === 'login';
    // conserva quanto gia' digitato se si ridisegna (cambio lingua)
    const prev = view.name === 'auth' && $('#authForm') ? new FormData($('#authForm')) : null;
    const prevCin = $('#regCin') ? $('#regCin').value : null;
    if (view.name !== 'auth') reg = { step: 'choose', kind: null, cin: '', res: null };
    view = { name: 'auth', mode };
    const step = isLogin ? 'login' : reg.step;

    let body = '';
    if (step === 'choose') {
      body = `<div class="auth-form">
        ${howItWorksHtml()}
        <h3 class="reg-q">${escapeHtml(t('reg.choose.title'))}</h3>
        <div class="reg-choices">
          <button type="button" class="reg-choice" data-kind="food">
            <span class="reg-ico" aria-hidden="true">🍽️</span>
            <span><strong>${escapeHtml(t('reg.choose.food'))}</strong><small>${escapeHtml(t('reg.choose.foodSub'))}</small></span>
          </button>
          <button type="button" class="reg-choice" data-kind="lodging">
            <span class="reg-ico" aria-hidden="true">🛏️</span>
            <span><strong>${escapeHtml(t('reg.choose.lodging'))}</strong><small>${escapeHtml(t('reg.choose.lodgingSub'))}</small></span>
          </button>
        </div>
        <p class="auth-switch">${escapeHtml(t('owner.haveAccount'))} <a href="#" id="switchAuth">${escapeHtml(t('owner.toLogin'))}</a></p>
      </div>`;
    } else if (step === 'cin') {
      body = `<form class="auth-form" id="cinForm" novalidate>
        <div class="reg-step">${escapeHtml(t('reg.cin.step'))}</div>
        <label class="form-field">
          <span>${escapeHtml(t('reg.cin.title'))}</span>
          <input id="regCin" name="cin" maxlength="24" autocapitalize="characters" autocomplete="off" spellcheck="false"
            placeholder="IT043013C2ABC12345" value="${escapeAttr(prevCin ?? reg.cin)}" />
        </label>
        <p class="editor-hint" style="margin:0">${t('ed.cin.hint')}</p>
        <div id="cinResult">${reg.res && !reg.res.ok ? Trust.cinResultHtml(reg.res) : ''}</div>
        <button type="submit" class="btn-primary btn-full" id="cinCheckBtn">${escapeHtml(t('reg.cin.check'))}</button>
        <p class="how-honest">${escapeHtml(t('how.cinHonest'))}</p>
        <p class="auth-switch"><a href="#" id="regBack">${escapeHtml(t('owner.back'))}</a></p>
      </form>`;
    } else {
      const lodgingOk = reg.kind === 'lodging' && reg.res && reg.res.ok;
      body = `<form class="auth-form" id="authForm">
        ${lodgingOk ? `<div class="reg-step">${escapeHtml(t('reg.form.step'))}</div>
          <div class="cin-summary"><code>${escapeHtml(reg.res.cin)}</code>${Trust.cinResultHtml(reg.res)}
            <a href="#" id="regChangeCin">${escapeHtml(t('reg.cin.change'))}</a></div>` : ''}
        ${!isLogin ? `
          <label class="form-field">
            <span>${escapeHtml(t('owner.field.name'))}</span>
            <input type="text" name="name" placeholder="${escapeAttr(t('owner.namePh'))}" autocomplete="name" />
          </label>` : ''}
        <label class="form-field">
          <span>${escapeHtml(t('owner.field.email'))}</span>
          <input type="email" name="email" required placeholder="${escapeAttr(t('owner.emailPh'))}" autocomplete="email" />
        </label>
        <label class="form-field">
          <span>${escapeHtml(t('owner.field.password'))} ${!isLogin ? `<em>${escapeHtml(t('owner.pwdMin'))}</em>` : ''}</span>
          <input type="password" name="password" required minlength="6" autocomplete="${isLogin ? 'current-password' : 'new-password'}" />
        </label>
        <button type="submit" class="btn-primary btn-full">
          ${escapeHtml(t(isLogin ? 'owner.login.btn' : 'owner.register.btn'))}
        </button>
        <p class="auth-switch">
          ${isLogin
            ? `${escapeHtml(t('owner.noAccount'))} <a href="#" id="switchAuth">${escapeHtml(t('owner.toRegister'))}</a>`
            : `<a href="#" id="regBack">${escapeHtml(t('owner.back'))}</a> · ${escapeHtml(t('owner.haveAccount'))} <a href="#" id="switchAuth">${escapeHtml(t('owner.toLogin'))}</a>`}
        </p>
        ${isLogin ? `<p class="auth-disclaimer">${t('owner.disclaimer')}</p>` : ''}
      </form>`;
    }

    inner.innerHTML = `
      <div class="owner-head">
        <div>
          <div class="owner-eyebrow">${escapeHtml(t('owner.eyebrow'))}</div>
          <h2 class="owner-title">${escapeHtml(t(isLogin ? 'owner.login.title' : 'owner.register.title'))}</h2>
          <p class="owner-sub">${escapeHtml(t(isLogin ? 'owner.login.sub' : 'owner.register.sub'))}</p>
        </div>
        ${closeBtnHtml()}
      </div>
      ${body}`;

    if (prev) ['name', 'email'].forEach(k => {
      const el = inner.querySelector(`[name="${k}"]`);
      if (el && prev.get(k)) el.value = prev.get(k);
    });
    $('#ownerCloseBtn').onclick = closePanel;
    const sw = $('#switchAuth');
    if (sw) sw.onclick = (e) => { e.preventDefault(); renderAuthView(isLogin ? 'register' : 'login'); };
    const back = $('#regBack');
    if (back) back.onclick = (e) => {
      e.preventDefault();
      reg.step = reg.step === 'form' && reg.kind === 'lodging' ? 'cin' : 'choose';
      if (reg.step === 'choose') reg.res = null;
      renderAuthView('register');
    };
    inner.querySelectorAll('[data-kind]').forEach(b => b.onclick = () => {
      reg.kind = b.dataset.kind;
      reg.step = reg.kind === 'lodging' ? 'cin' : 'form';
      reg.res = null;
      renderAuthView('register');
      const c = $('#regCin'); if (c) c.focus();
    });
    const change = $('#regChangeCin');
    if (change) change.onclick = (e) => { e.preventDefault(); reg.step = 'cin'; reg.res = null; renderAuthView('register'); };

    const cinForm = $('#cinForm');
    if (cinForm) {
      const input = $('#regCin');
      input.addEventListener('input', () => {
        const v = Trust.normCin(input.value);
        if (v !== input.value) input.value = v;
      });
      cinForm.onsubmit = async (e) => {
        e.preventDefault();
        const btn = $('#cinCheckBtn');
        reg.cin = Trust.normCin(input.value);
        btn.disabled = true; btn.textContent = t('reg.cin.checking');
        const res = await Trust.checkCin(reg.cin);
        if (view.name !== 'auth' || !$('#cinForm')) return;
        reg.res = res;
        if (res.ok) { reg.step = 'form'; renderAuthView('register'); return; }
        $('#cinResult').innerHTML = Trust.cinResultHtml(res);
        btn.disabled = false; btn.textContent = t('reg.cin.check');
      };
    }

    const authForm = $('#authForm');
    if (authForm) authForm.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        if (isLogin) await Store.login(fd.get('email'), fd.get('password'));
        else {
          const u = await Store.register(fd.get('email'), fd.get('password'), fd.get('name'));
          // CIN controllato: in attesa del primo annuncio di questo account
          if (reg.kind === 'lodging' && reg.res && reg.res.ok) {
            const c = reg.res.comune;
            Trust.setPendingCin({ cin: reg.res.cin, uid: u && u.uid, comune: c ? [c.name, c.prov] : null });
          }
          reg = { step: 'choose', kind: null, cin: '', res: null };
        }
        renderRouter();
        if (window.refreshPublicResults) window.refreshPublicResults();
      } catch (err) {
        alert(err.message);
      }
    };
  }

  // -------------- DASHBOARD ---------------------------------
  async function renderDashboard() {
    const inner = $('#ownerPanelInner');
    const u = Store.currentUser();
    if (!u) { renderAuthView('login'); return; }
    view = { name: 'dashboard' };

    inner.innerHTML = `<div class="owner-body" style="padding:40px 26px;text-align:center;color:var(--c-muted)">${escapeHtml(t('owner.loading'))}</div>`;
    let mine = [];
    try {
      mine = await Store.myRestaurants();
    } catch (e) {
      inner.innerHTML = `<div class="owner-body" style="padding:40px 26px;text-align:center;color:var(--c-accent)">${escapeHtml(t('owner.error', { msg: e.message }))}</div>`;
      return;
    }

    const emailBanner = u.emailVerified ? '' : `
      <div class="notice-box" id="emailBanner">
        <strong>\u2709\uFE0F ${escapeHtml(t('dash.email.title'))}</strong>
        <p>${escapeHtml(t('dash.email.text', { email: u.email }))}</p>
        <div class="notice-actions">
          <button type="button" class="chip" id="resendEmailBtn">${escapeHtml(t('dash.email.resend'))}</button>
          <button type="button" class="btn-primary" id="confirmedEmailBtn">${escapeHtml(t('dash.email.done'))}</button>
        </div>
        <p class="notice-msg" id="emailMsg" role="status"></p>
      </div>`;

    inner.innerHTML = `
      <div class="owner-head">
        <div>
          <div class="owner-eyebrow">${escapeHtml(t('owner.hello', { name: u.name || u.email.split('@')[0] }))}</div>
          <h2 class="owner-title">${escapeHtml(t('owner.dash.title'))}</h2>
          <p class="owner-sub">${escapeHtml(t('owner.dash.sub'))}</p>
        </div>
        <div style="display:flex;gap:8px;align-items:flex-start">
          <button class="chip" id="logoutBtn">${escapeHtml(t('owner.logout'))}</button>
          <button class="modal-close" id="ownerCloseBtn" aria-label="${escapeAttr(t('modal.close'))}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>
      <div class="owner-body">
        ${emailBanner}
        ${mine.length === 0
          ? `<div class="empty-box">
               <p><strong>${escapeHtml(t('owner.empty.title'))}</strong></p>
               <p>${t('owner.empty.text')}</p>
               <button class="btn-primary" id="addRestaurantBtn">${escapeHtml(t('owner.add'))}</button>
             </div>`
          : `<div class="my-list">
               ${mine.map(r => `
                 <div class="my-entry">
                 <div class="my-item">
                   <div style="min-width:0">
                     <div class="my-item-title">${escapeHtml(r.name)}</div>
                     <div class="my-item-meta">${escapeHtml(I18N.typeLabel(r.type || ''))} \u00B7 ${escapeHtml(r.address || '')} \u00B7 ${escapeHtml(t(isLodgingType(r.type) ? 'owner.rooms' : 'owner.dishes', { n: r.menu?.length || 0 }))}</div>
                   </div>
                   <div style="display:flex;gap:6px;flex-shrink:0">
                     <button class="chip" data-edit="${r.id}">${escapeHtml(t('owner.edit'))}</button>
                     <button class="chip chip-danger" data-delete="${r.id}">${escapeHtml(t('owner.delete'))}</button>
                   </div>
                 </div>
                 ${isLodgingType(r.type) ? verifyBlockHtml(r) : ''}
                 </div>`).join('')}
             </div>
             <button class="btn-primary btn-full" id="addRestaurantBtn" style="margin-top:16px">${escapeHtml(t('owner.addAnother'))}</button>`
        }
      </div>`;

    $('#ownerCloseBtn').onclick = closePanel;
    $('#logoutBtn').onclick = async () => {
      await Store.logout();
      renderRouter();
      if (window.refreshPublicResults) window.refreshPublicResults();
    };
    const addBtn = $('#addRestaurantBtn'); if (addBtn) addBtn.onclick = () => renderEditor(null);
    inner.querySelectorAll('[data-copy-code]').forEach(b => b.onclick = () => Trust.copyText(b.dataset.copyCode, 'dash.verify.copied'));
    const resend = $('#resendEmailBtn');
    if (resend) resend.onclick = async () => {
      const msg = $('#emailMsg');
      let last = 0;
      try { last = +localStorage.getItem('ristoapp-verify-sent') || 0; } catch {}
      if (Date.now() - last < 60000) { msg.textContent = t('dash.email.wait'); msg.classList.add('is-error'); return; }
      resend.disabled = true;
      try { await Store.resendVerification(); msg.textContent = t('dash.email.sent'); msg.classList.remove('is-error'); }
      catch (e) { msg.textContent = e.message; msg.classList.add('is-error'); }
      setTimeout(() => { resend.disabled = false; }, 60000);
    };
    const confirmed = $('#confirmedEmailBtn');
    if (confirmed) confirmed.onclick = async () => {
      const msg = $('#emailMsg');
      confirmed.disabled = true;
      try {
        const nu = await Store.reloadUser();
        if (nu && nu.emailVerified) { Trust.toast(t('dash.email.ok')); await renderDashboard(); return; }
        msg.textContent = t('dash.email.still'); msg.classList.add('is-error');
      } catch (e) { msg.textContent = e.message; msg.classList.add('is-error'); }
      confirmed.disabled = false;
    };
    inner.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => renderEditor(b.dataset.edit));
    inner.querySelectorAll('[data-delete]').forEach(b => b.onclick = async () => {
      if (confirm(t('owner.confirmDelete'))) {
        try {
          await Store.deleteRestaurant(b.dataset.delete);
          await renderDashboard();
          if (window.refreshPublicResults) window.refreshPublicResults();
        } catch (e) { alert(e.message); }
      }
    });
  }

  // Stato di verifica di un alloggio + istruzioni (metodi automatici)
  function verifyBlockHtml(r) {
    const code = verifyCode(r.id);
    const status = r.hidden === true
      ? `<span class="status-pill is-hidden">${escapeHtml(t('dash.hidden'))}</span>`
      : r.verified === true
        ? `<span class="status-pill is-ok">${escapeHtml(t('dash.verified'))}</span>`
        : `<span class="status-pill is-pending">${escapeHtml(t('dash.pending'))}</span>`;
    const cin = r.cin
      ? `<span class="my-cin">${escapeHtml(t('dash.cin', { cin: r.cin }))}</span>`
      : `<span class="my-cin is-missing">${escapeHtml(t('dash.noCin'))}</span>`;
    const hiddenWhy = r.hidden === true
      ? `<p class="editor-warn" style="margin:10px 0 0">${escapeHtml(t(r.hiddenReason === 'cin_mismatch' ? 'dash.hiddenCin' : 'dash.hiddenReports'))}</p>` : '';
    const how = r.verified === true ? hiddenWhy : hiddenWhy + `
      <details class="verify-how" open>
        <summary>${escapeHtml(t('dash.verify.title'))}</summary>
        <p>${escapeHtml(t('dash.verify.intro'))}</p>
        <div class="verify-code">
          <span>${escapeHtml(t('dash.verify.code'))}</span>
          <code>${escapeHtml(code)}</code>
          <button type="button" class="chip" data-copy-code="${escapeAttr(code)}">${escapeHtml(t('dash.verify.copy'))}</button>
        </div>
        <ol>
          <li>${t('dash.verify.a', { code: escapeHtml(code) })}</li>
          <li>${t('dash.verify.b')}</li>
        </ol>
        ${r.website ? '' : `<p class="editor-warn">${escapeHtml(t('dash.verify.noSite'))}</p>`}
        <p class="editor-hint" style="margin:0">${escapeHtml(t('dash.verify.why'))}</p>
      </details>`;
    return `<div class="verify-box"><div class="verify-status">${status}${cin}</div>${how}</div>`;
  }

  // -------------- EDITOR LOCALE -----------------------------
  // opts.draft: ridisegna l'editor (cambio lingua) senza perdere i dati inseriti
  async function renderEditor(restaurantId, opts = {}) {
    const inner = $('#ownerPanelInner');
    let existing = opts.draft ? (opts.existing || null) : null;
    if (restaurantId && !opts.draft) {
      inner.innerHTML = `<div class="owner-body" style="padding:40px 26px;text-align:center;color:var(--c-muted)">${escapeHtml(t('owner.loadingShort'))}</div>`;
      try { existing = await Store.getRestaurant(restaurantId); }
      catch (e) { alert(e.message); renderDashboard(); return; }
    }
    const u = Store.currentUser() || {};
    // CIN controllato alla registrazione (stesso account): precompilato e bloccato
    const pending = !existing && !opts.draft ? Trust.getPendingCin(u.uid) : null;
    // Stato del controllo CIN in questo editor: { ok, cin, comune, unchecked } | null
    let cinState = opts.cinState !== undefined ? opts.cinState
      : existing && existing.cin ? { ok: true, cin: existing.cin, comune: null, fromSaved: true }
      : pending ? { ok: true, cin: pending.cin, comune: null, fromPending: true }
      : null;
    view = { name: 'editor', existing, getCinState: () => cinState };
    const defaultCity = CFG.cities[0];
    const r = opts.draft || existing || {
      name: '', type: pending ? 'B&B' : 'Pizzeria',
      address: '', phone: '', website: '',
      lat: defaultCity.lat, lng: defaultCity.lng,
      hours: {0:[],1:[],2:[],3:[],4:[],5:[],6:[]},
      payments: ['contanti','carta'],
      features: [],
      menu: [],
      cin: pending ? pending.cin : '', directDiscount: '', whatsapp: '', contactEmail: '', declared: false,
    };
    // In modifica non si passa da locale ad alloggio (il CIN non si aggiunge dopo)
    const lockedKind = existing ? (isLodgingType(existing.type) ? 'lodging' : 'food') : null;
    const cinLocked = !!(existing && existing.cin);
    const cinReadonly = () => cinLocked || !!(cinState && cinState.ok);

    inner.innerHTML = `
      <div class="owner-head">
        <div>
          <div class="owner-eyebrow">${escapeHtml(t(existing ? 'ed.editEyebrow' : 'ed.newEyebrow'))}</div>
          <h2 class="owner-title">${existing ? escapeHtml(existing.name) : escapeHtml(t('ed.newTitle'))}</h2>
        </div>
        <div style="display:flex;gap:8px;align-items:flex-start">
          <button type="button" class="chip" id="backBtn">${escapeHtml(t('owner.back'))}</button>
          <button class="modal-close" id="ownerCloseBtn" aria-label="${escapeAttr(t('modal.close'))}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      <form class="editor-form" id="editorForm">
        <div class="editor-section editor-section--type">
            <label class="form-field">
              <span>${escapeHtml(t('ed.type'))}</span>
              <select name="type" required>
                ${lockedKind === 'lodging' ? '' : `<optgroup label="${escapeAttr(t('ed.groupFood'))}">
                  ${FOOD_TYPES.map(ty => `<option value="${escapeAttr(ty)}" ${r.type === ty ? 'selected' : ''}>${escapeHtml(I18N.typeLabel(ty))}</option>`).join('')}
                </optgroup>`}
                ${lockedKind === 'food' ? '' : `<optgroup label="${escapeAttr(t('ed.groupLodging'))}">
                  ${LODGING_TYPES.map(ty => `<option value="${escapeAttr(ty)}" ${r.type === ty ? 'selected' : ''}>${escapeHtml(I18N.typeLabel(ty))}</option>`).join('')}
                </optgroup>`}
              </select>
            </label>
        </div>

        <div class="editor-section" data-only="lodging">
          <h3>${escapeHtml(t('ed.cin.section'))}</h3>
          ${u.emailVerified ? '' : `<p class="editor-warn">${escapeHtml(t('ed.needVerifiedEmail'))}</p>`}
          <label class="form-field">
            <span>${escapeHtml(t('ed.cin.label'))}</span>
            <input name="cin" value="${escapeAttr(r.cin || '')}" maxlength="24" autocapitalize="characters" autocomplete="off" spellcheck="false"
              placeholder="IT043013C2ABC12345" ${cinReadonly() ? 'readonly class="is-readonly"' : ''} />
          </label>
          <div id="edCinResult"></div>
          ${cinLocked ? '' : `<div class="cin-actions">
            <button type="button" class="btn-primary" id="edCinCheck">${escapeHtml(t('reg.cin.check'))}</button>
            <a href="#" id="edCinChange">${escapeHtml(t('reg.cin.change'))}</a>
          </div>`}
          <p class="editor-hint" style="margin:8px 0 0">${cinLocked ? escapeHtml(t('ed.cin.locked')) : t('ed.cin.hint')}</p>
          <p class="editor-hint" style="margin:6px 0 0">${escapeHtml(t('how.cinHonest'))}</p>
          <p class="editor-warn" id="edCinGate" style="margin:10px 0 0">${escapeHtml(t('ed.cin.gate'))}</p>
        </div>

        <fieldset class="ed-rest" id="edRest">
        <div class="editor-section">
          <h3>${escapeHtml(t('ed.basic'))}</h3>
          <div class="grid-2">
            <label class="form-field grid-col-2">
              <span>${escapeHtml(t('ed.name'))}</span>
              <input name="name" required value="${escapeAttr(r.name)}" placeholder="${escapeAttr(t('owner.namePh'))}" />
            </label>
            <label class="form-field grid-col-2">
              <span>${escapeHtml(t('ed.address'))}</span>
              <input name="address" required value="${escapeAttr(r.address)}" placeholder="${escapeAttr(t('ed.addressPh'))}" />
            </label>
            <label class="form-field">
              <span>${escapeHtml(t('ed.phone'))}</span>
              <input name="phone" value="${escapeAttr(r.phone)}" placeholder="+39 333 1234567" />
            </label>
            <label class="form-field">
              <span>${escapeHtml(t('ed.website'))}</span>
              <input name="website" value="${escapeAttr(r.website || '')}" placeholder="https://..." />
            </label>
            <label class="form-field">
              <span>${escapeHtml(t('ed.lat'))}</span>
              <input name="lat" type="number" step="0.0001" required value="${r.lat}" />
            </label>
            <label class="form-field">
              <span>${escapeHtml(t('ed.lng'))}</span>
              <input name="lng" type="number" step="0.0001" required value="${r.lng}" />
            </label>
            <div class="grid-col-2"><button type="button" class="chip" id="useCentroid" hidden>${escapeHtml(t('ed.coords.centroid'))}</button></div>
            <p class="editor-hint grid-col-2">${t('ed.coordsHint')}</p>
          </div>
        </div>

        <div class="editor-section" data-only="lodging">
          <h3>${escapeHtml(t('ed.direct.title'))}</h3>
          <p class="editor-hint">${escapeHtml(t('ed.direct.hint'))}</p>
          <div class="grid-2">
            <label class="form-field grid-col-2">
              <span>${escapeHtml(t('ed.direct.discount'))}</span>
              <input name="directDiscount" type="number" min="0" max="30" step="1" inputmode="numeric" value="${escapeAttr(r.directDiscount ?? '')}" placeholder="10" class="input-short" />
            </label>
            <p class="editor-hint grid-col-2" style="margin:-6px 0 0">${escapeHtml(t('ed.direct.discountHint'))}</p>
            <label class="form-field">
              <span>${escapeHtml(t('ed.direct.whatsapp'))}</span>
              <input name="whatsapp" type="tel" value="${escapeAttr(r.whatsapp || '')}" placeholder="+39 333 1234567" />
            </label>
            <label class="form-field">
              <span>${escapeHtml(t('ed.direct.email'))}</span>
              <input name="contactEmail" type="email" value="${escapeAttr(r.contactEmail || '')}" placeholder="${escapeAttr(t('ed.direct.emailPh'))}" />
            </label>
          </div>
        </div>

        <div class="editor-section">
          <h3 id="edHoursTitle"></h3>
          <p class="editor-hint" id="edHoursHint"></p>
          <div class="hours-editor">
            ${[0, 1, 2, 3, 4, 5, 6].map(i => `
              <label class="form-field">
                <span>${escapeHtml(dayName(i))}</span>
                <input name="hours_${i}" value="${escapeAttr(((r.hours || {})[i] || []).join(', '))}" placeholder="12:00-14:30, 19:30-23:00" />
              </label>`).join('')}
          </div>
        </div>

        <div class="editor-section">
          <h3>${escapeHtml(t('ed.payments'))}</h3>
          <div class="chips-group">
            ${PAYMENTS.map(p => `
              <label class="chip-check">
                <input type="checkbox" name="payments" value="${p.key}" ${r.payments?.includes(p.key) ? 'checked' : ''} />
                <span>${p.icon} ${escapeHtml(t('pay.' + p.key))}</span>
              </label>`).join('')}
          </div>
        </div>

        <div class="editor-section">
          <h3 id="edFeatTitle"></h3>
          <p class="editor-hint" id="edFeatHint"></p>
          <label class="form-field">
            <input name="features" value="${escapeAttr((r.features||[]).join(', '))}" />
          </label>
        </div>

        <div class="editor-section">
          <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px">
            <h3 id="edMenuTitle"></h3>
            <button type="button" class="chip" id="addDish"></button>
          </div>
          <p class="editor-hint" id="edMenuHint"></p>
          <div class="menu-editor" id="menuEditor">
            ${(r.menu || []).map((m, i) => menuRowHtml(m, i)).join('')}
          </div>
        </div>

        <div class="editor-section decl-section">
          <h3>${escapeHtml(t('ed.decl.title'))}</h3>
          <label class="decl-check">
            <input type="checkbox" name="declared" ${r.declared ? 'checked' : ''} />
            <span id="edDeclText"></span>
          </label>
          <p class="editor-hint" style="margin:10px 0 0"><a href="#" data-terms>${escapeHtml(t('ed.decl.terms'))}</a></p>
        </div>

        <div class="editor-actions">
          <button type="submit" class="btn-primary btn-full">${escapeHtml(t(existing ? 'ed.save' : 'ed.publish'))}</button>
        </div>
        </fieldset>
      </form>`;

    const cinInput = $('[name="cin"]');
    const latIn = $('[name="lat"]'), lngIn = $('[name="lng"]');
    const isDefaultPos = () => {
      const la = parseFloat(latIn.value), ln = parseFloat(lngIn.value);
      return !isFinite(la) || !isFinite(ln) || (la === defaultCity.lat && ln === defaultCity.lng);
    };
    // Il resto del modulo si compila solo dopo il controllo del CIN (alloggi)
    function syncCinUi() {
      const lodging = isLodgingType($('[name="type"]').value);
      const gated = lodging && !(cinState && cinState.ok);
      $('#edRest').disabled = gated;
      $('#edCinGate').hidden = !gated;
      cinInput.readOnly = lodging && cinReadonly();
      cinInput.classList.toggle('is-readonly', cinInput.readOnly);
      const chk = $('#edCinCheck'), chg = $('#edCinChange');
      if (chk) chk.hidden = !!(cinState && cinState.ok);
      if (chg) chg.hidden = !(cinState && cinState.ok) || !!(cinState && cinState.fromPending);
      $('#edCinResult').innerHTML = cinState && !cinState.fromSaved ? Trust.cinResultHtml(cinState) : '';
      $('#useCentroid').hidden = !(lodging && cinState && cinState.ok && cinState.comune && isDefaultPos());
    }
    // Comune del CIN gia' controllato (salvato o in attesa): serve per la distanza
    if (cinState && cinState.ok && !cinState.comune && !cinState.unchecked) {
      const want = cinState;
      Trust.comuneForCin(want.cin).then(c => {
        if (cinState !== want) return;
        if (c) want.comune = c; else if (!want.fromSaved) { cinState = { ok: false, error: t('cin.err.comune') }; }
        if (view.name === 'editor' && $('#edRest')) syncCinUi();
      }).catch(() => { want.unchecked = !want.fromSaved; });
    }
    applyTypeTexts(r.type);
    syncCinUi();
    $('[name="type"]').addEventListener('change', e => { applyTypeTexts(e.target.value); syncCinUi(); });
    if (!cinLocked) cinInput.addEventListener('input', () => {
      const v = Trust.normCin(cinInput.value);
      if (v !== cinInput.value) cinInput.value = v;
    });
    const doCheck = async () => {
      const btn = $('#edCinCheck');
      btn.disabled = true; btn.textContent = t('reg.cin.checking');
      const res = await Trust.checkCin(cinInput.value);
      if (view.name !== 'editor' || !$('#edCinCheck')) return;
      btn.disabled = false; btn.textContent = t('reg.cin.check');
      cinState = res.ok ? res : { ...res };
      syncCinUi();
      if (!res.ok) cinState = null;            // errore mostrato, si riprova
      if (res.ok) { const n = $('[name="name"]'); if (n && !n.value) n.focus(); }
    };
    const chkBtn = $('#edCinCheck');
    if (chkBtn) chkBtn.onclick = doCheck;
    if (!cinLocked) cinInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !cinInput.readOnly) { e.preventDefault(); doCheck(); }
    });
    const chg = $('#edCinChange');
    if (chg) chg.onclick = (e) => { e.preventDefault(); cinState = null; syncCinUi(); cinInput.focus(); };
    [latIn, lngIn].forEach(i => i.addEventListener('input', () => syncCinUi()));
    $('#useCentroid').onclick = () => {
      const c = cinState && cinState.comune;
      if (!c || !isDefaultPos()) return;
      latIn.value = c.lat.toFixed(4); lngIn.value = c.lng.toFixed(4);
      Trust.toast(t('ed.coords.filled', { comune: c.name }));
      syncCinUi();
    };
    $('#ownerCloseBtn').onclick = closePanel;
    $('#backBtn').onclick = (e) => { e.preventDefault(); renderDashboard(); };
    $('#addDish').onclick = () => {
      const editor = $('#menuEditor');
      const idx = editor.querySelectorAll('.menu-row').length;
      editor.insertAdjacentHTML('beforeend', menuRowHtml({ dish: '', price: '' }, idx));
      attachMenuRowEvents();
      applyTypeTexts($('[name="type"]').value);
    };
    attachMenuRowEvents();

    $('#editorForm').onsubmit = async (e) => {
      e.preventDefault();
      const payload = readEditorForm(e.target, existing);
      const hours = payload.hours;
      for (const i in hours) {
        for (const range of hours[i]) {
          if (!/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(range)) {
            alert(t('ed.badHours', { day: dayName(i), range }));
            return;
          }
        }
      }
      // le righe incomplete servono solo a ridisegnare l'editor
      payload.menu = payload.menu.filter(m => m.dish && typeof m.price === 'number' && !isNaN(m.price));

      const err = validateTrust(payload, existing);
      if (err) { alert(err); return; }
      if (isLodgingType(payload.type)) {
        if (!(existing && existing.cin) && !(cinState && cinState.ok && cinState.cin === payload.cin)) {
          alert(t('ed.cin.gate')); return;
        }
        let comune = cinState && cinState.comune;
        if (!comune && !(cinState && cinState.unchecked)) {
          try {
            comune = await Trust.comuneForCin(payload.cin);
            if (!comune && !(cinState && cinState.fromSaved)) { alert(t('cin.err.comune')); return; }
          } catch { comune = null; }        // elenco non disponibile: controllo saltato
        }
        if (comune && !Trust.insideComune(comune, payload)) {
          alert(t('ed.coords.far', { comune: comune.name })); return;
        }
      }

      const btn = e.target.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = t('ed.saving'); }
      try {
        await Store.saveRestaurant(payload);
        const pend = Trust.getPendingCin(u.uid);
        if (pend && pend.cin === payload.cin) Trust.setPendingCin(null);
        if (window.refreshPublicResults) window.refreshPublicResults();
        await renderDashboard();
      } catch (err) {
        alert(err.message);
        if (btn) { btn.disabled = false; btn.textContent = t(existing ? 'ed.save' : 'ed.publish'); }
      }
    };
  }

  // Controlli: sito, CIN, sconto, contatti, email confermata, dichiarazione
  function validateTrust(p, existing) {
    if (!okWebsite(p.website)) return t('ed.badWebsite');
    if (isLodgingType(p.type)) {
      const u = Store.currentUser() || {};
      if (!u.emailVerified) return t('ed.needVerifiedEmail');
      if (!(existing && existing.cin)) {
        if (!p.cin) return t('ed.cin.required');
        if (!Trust.CIN_RE.test(p.cin)) return t('ed.cin.bad');
      }
      const d = p.directDiscount === '' ? 0 : Number(p.directDiscount);
      if (!Number.isInteger(d) || d < 0 || d > 30) return t('ed.badDiscount');
      p.directDiscount = d;
      if (p.whatsapp && !Trust.waDigits(p.whatsapp)) return t('ed.badWhatsapp');
      if (p.contactEmail && !Trust.validEmail(p.contactEmail)) return t('ed.badEmail');
      if (d > 0 && !p.phone && !p.whatsapp && !p.contactEmail) return t('ed.direct.needContact');
    }
    if (!p.declared) return t('ed.decl.required');
    return null;
  }

  // Legge il modulo dell'editor (stesso formato salvato in Firestore)
  function readEditorForm(form, existing) {
    const rest = form.querySelector('#edRest');
    const wasDisabled = rest && rest.disabled;
    if (wasDisabled) rest.disabled = false;
    const fd = new FormData(form);
    if (wasDisabled) rest.disabled = true;
    const hours = {};
    for (let i = 0; i < 7; i++) {
      const raw = (fd.get('hours_' + i) || '').trim();
      hours[i] = raw ? raw.split(',').map(s => s.trim()).filter(Boolean) : [];
    }
    const menu = [];
    form.querySelectorAll('#menuEditor .menu-row').forEach(row => {
      const dish = row.querySelector('[name="dish"]').value.trim();
      const rawPrice = row.querySelector('[name="price"]').value;
      const price = parseFloat(rawPrice);
      menu.push({ dish, price: isNaN(price) ? '' : price });
    });
    return {
      id: existing?.id,
      name: (fd.get('name') || '').trim(),
      type: fd.get('type'),
      address: (fd.get('address') || '').trim(),
      phone: (fd.get('phone') || '').trim(),
      website: (fd.get('website') || '').trim(),
      lat: parseFloat(fd.get('lat')),
      lng: parseFloat(fd.get('lng')),
      hours,
      payments: fd.getAll('payments'),
      features: (fd.get('features') || '').split(',').map(s => s.trim()).filter(Boolean),
      menu,
      // il CIN gia' salvato non cambia (campo in sola lettura)
      cin: existing?.cin || Trust.normCin(form.querySelector('[name="cin"]')?.value),
      directDiscount: String(form.querySelector('[name="directDiscount"]')?.value ?? '').trim(),
      whatsapp: (form.querySelector('[name="whatsapp"]')?.value || '').trim(),
      contactEmail: (form.querySelector('[name="contactEmail"]')?.value || '').trim(),
      declared: !!form.querySelector('[name="declared"]')?.checked,
    };
  }

  function menuRowHtml(m, i) {
    return `<div class="menu-row" data-i="${i}">
      <input type="text"   name="dish"  value="${escapeAttr(m.dish || '')}" placeholder="${escapeAttr(t('ed.food.itemPh'))}" />
      <span class="menu-row-cur">\u20AC</span>
      <input type="number" name="price" step="0.10" min="0" value="${m.price ?? ''}" placeholder="9.50" />
      <button type="button" class="menu-row-del" aria-label="${escapeAttr(t('owner.remove'))}">\u00D7</button>
    </div>`;
  }
  function attachMenuRowEvents() {
    document.querySelectorAll('.menu-row-del').forEach(btn => {
      btn.onclick = () => btn.closest('.menu-row').remove();
    });
  }

  function renderRouter() {
    const u = Store.currentUser();
    if (!u) renderAuthView('login');
    else renderDashboard();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('ownerBtn');
    if (btn) btn.onclick = () => openPanel('register');
    // Ogni bottone "Registrati gratis" (anche quelli creati dopo, nei risultati)
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-owner-register]')) { e.preventDefault(); openPanel('register'); }
    });
    // Link diretto: .../RISTOAPP/#registrati apre subito la registrazione
    const openFromHash = () => { if (/^#registra/i.test(location.hash)) openPanel('register'); };
    window.addEventListener('hashchange', openFromHash);
    Promise.resolve(Store.authReady).then(openFromHash);
    document.addEventListener('keydown', (e) => {
      const p = document.getElementById('ownerPanel');
      if (e.key === 'Escape' && p && p.classList.contains('is-open')) closePanel();
    });
  });

  // Cambio lingua: ridisegna la vista aperta, senza perdere i dati inseriti
  I18N.onChange(() => {
    const p = $('#ownerPanel');
    if (!p || !p.classList.contains('is-open')) return;
    if (view.name === 'editor' && $('#editorForm')) {
      const draft = readEditorForm($('#editorForm'), view.existing);
      renderEditor(view.existing?.id || null, { draft, existing: view.existing, cinState: view.getCinState ? view.getCinState() : null });
    } else if (view.name === 'auth') {
      renderAuthView(view.mode);
    } else {
      renderRouter();
    }
  });

  window.openOwnerPanel = openPanel;
})();
