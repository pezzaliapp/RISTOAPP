/* ============================================================
 *  RISTOAPP - Area ristoratori
 *  Login, registrazione e dashboard per gestire il proprio
 *  locale (menu con prezzi, orari, pagamenti, contatti).
 * ============================================================ */

(() => {
  const CFG = window.RISTOAPP_CONFIG;
  const Store = window.RistoStore;
  const $ = (s, r = document) => r.querySelector(s);

  // Giorni settimana
  const DAYS = ['Domenica','Luned\u00EC','Marted\u00EC','Mercoled\u00EC','Gioved\u00EC','Venerd\u00EC','Sabato'];
  const TYPES = ['Pizzeria','Trattoria','Osteria','Ristorante','Fast food','Bar','Caff\u00E8','Gelateria','Pub'];
  const PAYMENTS = [
    { key: 'contanti',  label: 'Contanti',   icon: '\uD83D\uDCB6' },
    { key: 'carta',     label: 'Carta di credito', icon: '\uD83D\uDCB3' },
    { key: 'bancomat',  label: 'Bancomat',   icon: '\uD83C\uDFE7' },
    { key: 'satispay',  label: 'Satispay',   icon: '\uD83D\uDCF1' },
    { key: 'buoni',     label: 'Buoni pasto',icon: '\uD83C\uDF7D\uFE0F' },
    { key: 'applepay',  label: 'Apple Pay',  icon: '\uF8FF' },
    { key: 'googlepay', label: 'Google Pay', icon: 'G' },
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

  function openPanel()  { ensurePanel().classList.add('is-open'); document.body.style.overflow = 'hidden'; renderRouter(); }
  function closePanel() {
    const p = $('#ownerPanel'); if (p) p.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  // -------------- AUTH VIEW ---------------------------------
  function renderAuthView(mode = 'login') {
    const inner = $('#ownerPanelInner');
    const isLogin = mode === 'login';
    inner.innerHTML = `
      <div class="owner-head">
        <div>
          <div class="owner-eyebrow">Area ristoratori</div>
          <h2 class="owner-title">${isLogin ? 'Accedi al tuo pannello' : 'Registra la tua attivit\u00E0'}</h2>
          <p class="owner-sub">${isLogin
            ? 'Entra per gestire menu, prezzi e orari del tuo locale.'
            : '<strong>Gratis per sempre.</strong> Nessuna commissione, nessun abbonamento. I tuoi piatti saranno visibili nella ricerca di RistoApp.'}</p>
        </div>
        <button class="modal-close" id="ownerCloseBtn" aria-label="Chiudi">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <form class="auth-form" id="authForm">
        ${!isLogin ? `
          <label class="form-field">
            <span>Nome / Ragione sociale</span>
            <input type="text" name="name" placeholder="Es. Pizzeria Da Mario" autocomplete="name" />
          </label>` : ''}
        <label class="form-field">
          <span>Email</span>
          <input type="email" name="email" required placeholder="email@ristoratore.it" autocomplete="email" />
        </label>
        <label class="form-field">
          <span>Password ${!isLogin ? '<em>(min 6 caratteri)</em>' : ''}</span>
          <input type="password" name="password" required minlength="6" autocomplete="${isLogin ? 'current-password' : 'new-password'}" />
        </label>
        <button type="submit" class="btn-primary btn-full">
          ${isLogin ? 'Accedi' : 'Registrati gratuitamente'}
        </button>
        <p class="auth-switch">
          ${isLogin
            ? `Non hai un account? <a href="#" id="switchAuth">Registrati</a>`
            : `Hai gi\u00E0 un account? <a href="#" id="switchAuth">Accedi</a>`}
        </p>
        <p class="auth-disclaimer">
          <strong>Backend condiviso attivo.</strong> Una volta registrato il tuo locale
          con menu e prezzi, sar\u00E0 visibile a tutti gli utenti di RistoApp in Italia.
          La password \u00E8 gestita in modo sicuro da Firebase Authentication.
        </p>
      </form>`;

    $('#ownerCloseBtn').onclick = closePanel;
    $('#switchAuth').onclick = (e) => { e.preventDefault(); renderAuthView(isLogin ? 'register' : 'login'); };
    $('#authForm').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        if (isLogin) await Store.login(fd.get('email'), fd.get('password'));
        else         await Store.register(fd.get('email'), fd.get('password'), fd.get('name'));
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

    inner.innerHTML = `<div class="owner-body" style="padding:40px 26px;text-align:center;color:var(--c-muted)">Caricamento in corso...</div>`;
    let mine = [];
    try {
      mine = await Store.myRestaurants();
    } catch (e) {
      inner.innerHTML = `<div class="owner-body" style="padding:40px 26px;text-align:center;color:var(--c-accent)">Errore: ${escapeHtml(e.message)}</div>`;
      return;
    }

    inner.innerHTML = `
      <div class="owner-head">
        <div>
          <div class="owner-eyebrow">Ciao ${escapeHtml(u.name || u.email.split('@')[0])}</div>
          <h2 class="owner-title">La tua attivit\u00E0</h2>
          <p class="owner-sub">Gestisci menu, orari e prezzi. Le modifiche sono visibili nella ricerca.</p>
        </div>
        <div style="display:flex;gap:8px;align-items:flex-start">
          <button class="chip" id="logoutBtn">Esci</button>
          <button class="modal-close" id="ownerCloseBtn" aria-label="Chiudi">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>
      <div class="owner-body">
        ${mine.length === 0
          ? `<div class="empty-box">
               <p><strong>Non hai ancora nessun locale.</strong></p>
               <p>Aggiungi la tua attivit\u00E0 per farla apparire nelle ricerche con il menu e i prezzi che scegli tu.</p>
               <button class="btn-primary" id="addRestaurantBtn">+ Aggiungi il tuo locale</button>
             </div>`
          : `<div class="my-list">
               ${mine.map(r => `
                 <div class="my-item">
                   <div style="min-width:0">
                     <div class="my-item-title">${escapeHtml(r.name)}</div>
                     <div class="my-item-meta">${escapeHtml(r.type || '')} \u00B7 ${escapeHtml(r.address || '')} \u00B7 ${r.menu?.length || 0} piatti</div>
                   </div>
                   <div style="display:flex;gap:6px;flex-shrink:0">
                     <button class="chip" data-edit="${r.id}">Modifica</button>
                     <button class="chip chip-danger" data-delete="${r.id}">Elimina</button>
                   </div>
                 </div>`).join('')}
             </div>
             <button class="btn-primary btn-full" id="addRestaurantBtn" style="margin-top:16px">+ Aggiungi un altro locale</button>`
        }
      </div>`;

    $('#ownerCloseBtn').onclick = closePanel;
    $('#logoutBtn').onclick = async () => {
      await Store.logout();
      renderRouter();
      if (window.refreshPublicResults) window.refreshPublicResults();
    };
    const addBtn = $('#addRestaurantBtn'); if (addBtn) addBtn.onclick = () => renderEditor(null);
    inner.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => renderEditor(b.dataset.edit));
    inner.querySelectorAll('[data-delete]').forEach(b => b.onclick = async () => {
      if (confirm('Sei sicuro? Questa operazione non \u00E8 reversibile.')) {
        try {
          await Store.deleteRestaurant(b.dataset.delete);
          await renderDashboard();
          if (window.refreshPublicResults) window.refreshPublicResults();
        } catch (e) { alert(e.message); }
      }
    });
  }

  // -------------- EDITOR LOCALE -----------------------------
  async function renderEditor(restaurantId) {
    const inner = $('#ownerPanelInner');
    let existing = null;
    if (restaurantId) {
      inner.innerHTML = `<div class="owner-body" style="padding:40px 26px;text-align:center;color:var(--c-muted)">Caricamento...</div>`;
      try { existing = await Store.getRestaurant(restaurantId); }
      catch (e) { alert(e.message); renderDashboard(); return; }
    }
    const defaultCity = CFG.cities[0];
    const r = existing || {
      name: '', type: 'Pizzeria',
      address: '', phone: '', website: '',
      lat: defaultCity.lat, lng: defaultCity.lng,
      hours: {0:[],1:[],2:[],3:[],4:[],5:[],6:[]},
      payments: ['contanti','carta'],
      features: [],
      menu: [],
    };

    inner.innerHTML = `
      <div class="owner-head">
        <div>
          <div class="owner-eyebrow">${existing ? 'Modifica locale' : 'Nuovo locale'}</div>
          <h2 class="owner-title">${existing ? escapeHtml(existing.name) : 'Aggiungi la tua attivit\u00E0'}</h2>
        </div>
        <div style="display:flex;gap:8px;align-items:flex-start">
          <button type="button" class="chip" id="backBtn">\u2190 Indietro</button>
          <button class="modal-close" id="ownerCloseBtn" aria-label="Chiudi">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      <form class="editor-form" id="editorForm">
        <div class="editor-section">
          <h3>Informazioni di base</h3>
          <div class="grid-2">
            <label class="form-field">
              <span>Nome del locale *</span>
              <input name="name" required value="${escapeAttr(r.name)}" placeholder="Es. Pizzeria Da Mario" />
            </label>
            <label class="form-field">
              <span>Tipologia *</span>
              <select name="type" required>
                ${TYPES.map(t => `<option ${r.type === t ? 'selected' : ''}>${t}</option>`).join('')}
              </select>
            </label>
            <label class="form-field grid-col-2">
              <span>Indirizzo completo *</span>
              <input name="address" required value="${escapeAttr(r.address)}" placeholder="Via Roma 10, Civitanova Marche" />
            </label>
            <label class="form-field">
              <span>Telefono</span>
              <input name="phone" value="${escapeAttr(r.phone)}" placeholder="+39 333 1234567" />
            </label>
            <label class="form-field">
              <span>Sito web</span>
              <input name="website" value="${escapeAttr(r.website || '')}" placeholder="https://..." />
            </label>
            <label class="form-field">
              <span>Latitudine *</span>
              <input name="lat" type="number" step="0.0001" required value="${r.lat}" />
            </label>
            <label class="form-field">
              <span>Longitudine *</span>
              <input name="lng" type="number" step="0.0001" required value="${r.lng}" />
            </label>
            <p class="editor-hint grid-col-2">
              \uD83D\uDCA1 <strong>Trova le coordinate</strong>: apri Google Maps sul tuo locale, clicca col tasto destro sul segnaposto e <em>copia le coordinate</em> (es. 43.3065, 13.7231). La prima \u00E8 la latitudine, la seconda la longitudine.
            </p>
          </div>
        </div>

        <div class="editor-section">
          <h3>Orari settimanali</h3>
          <p class="editor-hint">Formato <code>HH:MM-HH:MM</code>. Per pi\u00F9 turni separa con virgola. Lascia vuoto se chiuso.</p>
          <div class="hours-editor">
            ${DAYS.map((name, i) => `
              <label class="form-field">
                <span>${name}</span>
                <input name="hours_${i}" value="${(r.hours[i]||[]).join(', ')}" placeholder="12:00-14:30, 19:30-23:00" />
              </label>`).join('')}
          </div>
        </div>

        <div class="editor-section">
          <h3>Pagamenti accettati</h3>
          <div class="chips-group">
            ${PAYMENTS.map(p => `
              <label class="chip-check">
                <input type="checkbox" name="payments" value="${p.key}" ${r.payments?.includes(p.key) ? 'checked' : ''} />
                <span>${p.icon} ${p.label}</span>
              </label>`).join('')}
          </div>
        </div>

        <div class="editor-section">
          <h3>Caratteristiche del locale</h3>
          <p class="editor-hint">Elenco separato da virgola (es. <em>forno a legna, terrazza, asporto, domicilio, gluten-free, accessibile</em>).</p>
          <label class="form-field">
            <input name="features" value="${escapeAttr((r.features||[]).join(', '))}" placeholder="forno a legna, terrazza, asporto" />
          </label>
        </div>

        <div class="editor-section">
          <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px">
            <h3>Menu e prezzi</h3>
            <button type="button" class="chip" id="addDish">+ Aggiungi piatto</button>
          </div>
          <p class="editor-hint">\u00C8 la parte pi\u00F9 importante: <strong>i piatti con prezzo</strong> sono quelli che rendono il tuo locale trovabile nelle ricerche come "pizza margherita", "cappelletti", ecc.</p>
          <div class="menu-editor" id="menuEditor">
            ${(r.menu || []).map((m, i) => menuRowHtml(m, i)).join('')}
          </div>
        </div>

        <div class="editor-actions">
          <button type="submit" class="btn-primary btn-full">${existing ? 'Salva modifiche' : 'Pubblica il locale'}</button>
        </div>
      </form>`;

    $('#ownerCloseBtn').onclick = closePanel;
    $('#backBtn').onclick = (e) => { e.preventDefault(); renderDashboard(); };
    $('#addDish').onclick = () => {
      const editor = $('#menuEditor');
      const idx = editor.querySelectorAll('.menu-row').length;
      editor.insertAdjacentHTML('beforeend', menuRowHtml({ dish: '', price: '' }, idx));
      attachMenuRowEvents();
    };
    attachMenuRowEvents();

    $('#editorForm').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const hours = {};
      for (let i = 0; i < 7; i++) {
        const raw = (fd.get('hours_' + i) || '').trim();
        hours[i] = raw ? raw.split(',').map(s => s.trim()).filter(Boolean) : [];
      }
      for (const i in hours) {
        for (const range of hours[i]) {
          if (!/^\d{2}:\d{2}-\d{2}:\d{2}$/.test(range)) {
            alert(`Orario non valido per ${DAYS[i]}: "${range}". Usa il formato HH:MM-HH:MM.`);
            return;
          }
        }
      }

      const menu = [];
      document.querySelectorAll('#menuEditor .menu-row').forEach(row => {
        const dish = row.querySelector('[name="dish"]').value.trim();
        const price = parseFloat(row.querySelector('[name="price"]').value);
        if (dish && !isNaN(price)) menu.push({ dish, price });
      });

      const payload = {
        id: existing?.id,
        name: fd.get('name').trim(),
        type: fd.get('type'),
        address: fd.get('address').trim(),
        phone: fd.get('phone').trim(),
        website: fd.get('website').trim(),
        lat: parseFloat(fd.get('lat')),
        lng: parseFloat(fd.get('lng')),
        hours,
        payments: fd.getAll('payments'),
        features: (fd.get('features') || '').split(',').map(s => s.trim()).filter(Boolean),
        menu,
      };

      const btn = e.target.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = 'Salvataggio in corso...'; }
      try {
        await Store.saveRestaurant(payload);
        if (window.refreshPublicResults) window.refreshPublicResults();
        await renderDashboard();
      } catch (err) {
        alert(err.message);
        if (btn) { btn.disabled = false; btn.textContent = existing ? 'Salva modifiche' : 'Pubblica il locale'; }
      }
    };
  }

  function menuRowHtml(m, i) {
    return `<div class="menu-row" data-i="${i}">
      <input type="text"   name="dish"  value="${escapeAttr(m.dish || '')}" placeholder="Nome piatto" />
      <span class="menu-row-cur">\u20AC</span>
      <input type="number" name="price" step="0.10" min="0" value="${m.price ?? ''}" placeholder="9.50" />
      <button type="button" class="menu-row-del" aria-label="Rimuovi">\u00D7</button>
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
    if (btn) btn.onclick = openPanel;
    document.addEventListener('keydown', (e) => {
      const p = document.getElementById('ownerPanel');
      if (e.key === 'Escape' && p && p.classList.contains('is-open')) closePanel();
    });
  });

  window.openOwnerPanel = openPanel;
})();
