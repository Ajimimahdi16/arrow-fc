// Pannello admin: accesso con email e password, e salvataggio nel database Supabase.
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const ROLE = { GK: 'Portiere', DIF: 'Difensore', CEN: 'Centrocampista', ATT: 'Attaccante' };
  const DONE = 'Salvato. Ricarica il sito per vedere le modifiche.';

  const adminDialog = $('#adminDialog');
  const db = () => window.arrowDb;
  const ok = (res) => {
    if (res.error) throw res.error;
    return res.data;
  };
  const safeName = (n) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-');
  const uploadFile = async (file, path) => {
    ok(await db().storage.from('media').upload(path, file, { upsert: true, contentType: file.type || undefined }));
    return db().storage.from('media').getPublicUrl(path).data.publicUrl;
  };
  const dateParts = (iso) => {
    if (!iso) return { date: '', time: '21:00' };
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    return { date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, time: `${p(d.getHours())}:${p(d.getMinutes())}` };
  };

  const body = (inner) => `<div class="modal-body"><button class="lb-btn modal-close" type="button" aria-label="Chiudi">×</button>${inner}</div>`;
  const back = `<div class="admin-top"><button class="btn" type="button" data-admin="hub">Indietro</button></div>`;
  const foot = (text = '') => `<div class="admin-foot"><p class="admin-note" data-admin-msg>${text}</p><button class="btn btn-solid" type="button" data-admin-save>Salva</button></div>`;

  const playersList = async () => ok(await db().from('players').select('*').order('id'));

  // ---------- Accesso ----------
  async function isLoggedIn() {
    if (!db()) return false;
    const { data } = await db().auth.getSession();
    return Boolean(data.session);
  }

  const VIEWS = {
    hub: async () => body(`
        <h3>Pannello admin</h3>
        <div class="admin-choices">
          <button class="btn" type="button" data-admin="matches">Partite</button>
          <button class="btn" type="button" data-admin="players">Giocatori</button>
          <button class="btn" type="button" data-admin="gallery">Galleria</button>
          <button class="btn" type="button" data-admin="staff">Dirigenza</button>
          <button class="btn" type="button" data-admin="sponsors">Sponsor</button>
          <button class="btn" type="button" data-admin="stats">Statistiche</button>
          <button class="btn" type="button" data-admin="import">Importa dati</button>
        </div>
        <div class="admin-foot"><span></span><button class="btn" type="button" data-admin-logout>Esci</button></div>`),

    login: async () => body(`
        <h3>Accesso admin</h3>
        <p class="admin-note">Accedi con l'email e la password che hai impostato.</p>
        <form class="admin-form" data-login-form>
          <label class="admin-full">Email<input type="email" name="email" autocomplete="username" required></label>
          <label class="admin-full">Password<input type="password" name="password" autocomplete="current-password" required></label>
          <p class="admin-full admin-error" data-login-error hidden></p>
          <button class="btn btn-solid admin-full" type="submit">Accedi</button>
        </form>`),

    password: async () => body(`
        <h3>Imposta la password</h3>
        <p class="admin-note">Scegli una password per accedere al pannello admin (almeno 8 caratteri).</p>
        <form class="admin-form" data-password-form>
          <label class="admin-full">Nuova password<input type="password" name="password" minlength="8" autocomplete="new-password" required></label>
          <p class="admin-full admin-error" data-login-error hidden></p>
          <button class="btn btn-solid admin-full" type="submit">Salva password</button>
        </form>`),

    // ---------- Partite ----------
    matches: async () => {
      const rows = ok(await db().from('matches').select('*').order('match_date'));
      const list = rows.map((r) => {
        const d = new Date(r.match_date);
        const result = r.score_us == null ? 'Da giocare' : `${r.score_us}–${r.score_them}`;
        return `<button class="admin-match-row" type="button" data-edit-match="${r.id}">
            <span class="admin-match-date">${esc(d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' }))}</span>
            <span class="admin-match-opp">${esc(r.opponent || 'Avversario da confermare')}</span>
            <span class="outcome">${esc(result)}</span>
          </button>`;
      }).join('');
      return body(`${back}<h3>Partite</h3>
        <p class="admin-note">Scegli una partita per inserire risultato, marcatori, assist e presenze.</p>
        <div class="admin-match-list">${list}</div>
        <div class="admin-foot"><span></span><button class="btn btn-solid" type="button" data-admin="match-new">+ Nuova partita</button></div>`);
    },

    'match-new': async () => matchForm(null),
    'match-edit': async (id) => matchForm(id),

    // ---------- Giocatori ----------
    players: async () => {
      const list = (await playersList()).map((p) => `
        <button class="admin-match-row" type="button" data-edit-player="${p.id}">
          <span class="admin-match-date">${p.id}</span>
          <span class="admin-match-opp">${esc(p.name)}</span>
          <span class="outcome">${esc(p.label || ROLE[p.role])}</span>
        </button>`).join('');
      return body(`${back}<h3>Giocatori</h3>
        <div class="admin-match-list">${list}</div>
        <div class="admin-foot"><span></span><button class="btn btn-solid" type="button" data-admin="player-new">+ Nuovo giocatore</button></div>`);
    },

    'player-new': async () => playerForm(null),
    'player-edit': async (id) => playerForm(id),

    // ---------- Galleria ----------
    gallery: async () => {
      const matches = ok(await db().from('matches').select('id, match_date, opponent').order('match_date'));
      const opts = matches.map((m) => `<option value="${m.id}">${esc(new Date(m.match_date).toLocaleDateString('it-IT'))} · ${esc(m.opponent || 'Partita')}</option>`).join('');
      return body(`${back}<h3>Carica foto e video</h3>
        <form class="admin-form" data-form="gallery">
          <label>Categoria
            <select name="category">
              <option value="partite">Partite</option>
              <option value="giocatori">Giocatori</option>
              <option value="allenamenti">Allenamenti</option>
              <option value="collezione">Collezione (pacchetti)</option>
            </select>
          </label>
          <label>Partita (facoltativa)<select name="match"><option value="">Nessuna</option>${opts}</select></label>
          <label class="admin-full">Didascalia<input type="text" name="caption" placeholder="Es. gol di Bovo"></label>
          <div class="admin-drop admin-full">Scegli foto e video<input type="file" name="files" accept="image/*,video/*" multiple></div>
        </form>
        ${foot()}`);
    },

    // ---------- Sponsor ----------
    sponsors: async () => {
      const list = ok(await db().from('sponsors').select('*').order('sort'));
      const rows = list.map((s) => `<div class="admin-stats-row"><span>${esc(s.name)}</span></div>`).join('');
      return body(`${back}<h3>Sponsor</h3>
        <div class="admin-stats">${rows}</div>
        <form class="admin-form" data-form="sponsor">
          <label class="admin-full">Nome<input type="text" name="name" required></label>
          <label>Sfondo<select name="tone"><option value="dark">Scuro</option><option value="light">Chiaro</option></select></label>
          <label class="admin-full">Logo<input type="file" name="logo" accept="image/*" required></label>
        </form>
        ${foot()}`);
    },

    // ---------- Dirigenza e allenatori ----------
    staff: async () => {
      const rows = ok(await db().from('staff').select('*').order('sort'));
      const list = rows.map((s) => `<button class="admin-match-row" type="button" data-edit-staff="${s.id}">
          <span class="admin-match-date">${esc(s.role)}</span>
          <span class="admin-match-opp">${esc(s.name)}</span>
          <span class="outcome">${s.active ? 'Visibile' : 'Nascosto'}</span>
        </button>`).join('');
      return body(`${back}<h3>Dirigenza e allenatori</h3>
        <p class="admin-note">Le schede cambiano da sole nella pagina della formazione.</p>
        <div class="admin-match-list">${list || '<p class="admin-note">Nessuna persona inserita.</p>'}</div>
        <div class="admin-foot"><span></span><button class="btn btn-solid" type="button" data-admin="staff-new">+ Nuova persona</button></div>`);
    },

    'staff-new': async () => staffForm(null),
    'staff-edit': async (id) => staffForm(id),

    // ---------- Statistiche (calcolate dal database) ----------
    stats: async () => {
      const [players, events, presences] = await Promise.all([
        playersList(),
        db().from('match_events').select('*').then(ok),
        db().from('match_players').select('*').then(ok)
      ]);
      const rows = players.map((p) => {
        const gol = events.filter((e) => e.player_id === p.id && e.kind === 'goal').reduce((s, e) => s + e.n, 0);
        const assist = events.filter((e) => e.player_id === p.id && e.kind === 'assist').reduce((s, e) => s + e.n, 0);
        const pres = presences.filter((x) => x.player_id === p.id).length;
        return `<div class="admin-stats-row"><span>${p.id}. ${esc(p.name)}</span><span>${pres}</span><span>${gol}</span><span>${assist}</span></div>`;
      }).join('');
      return body(`${back}<h3>Statistiche giocatori</h3>
        <p class="admin-note">Si calcolano da sole dalle partite: gol, assist e presenze.</p>
        <div class="admin-stats">
          <div class="admin-stats-head"><span>Giocatore</span><span>Pres.</span><span>Gol</span><span>Assist</span></div>
          ${rows}
        </div>`);
    },

    // ---------- Importazione ----------
    import: async () => body(`${back}<h3>Importa i dati attuali</h3>
        <p class="admin-note">Copia nel database rosa, partite, galleria, sponsor e collezione, e carica le foto. Le tabelle già piene vengono saltate.</p>
        <div class="admin-foot">
          <p class="admin-note" data-admin-msg></p>
          <button class="btn btn-solid" type="button" data-admin-import>Avvia importazione</button>
        </div>`)
  };

  function scorerRows(kind, list, players) {
    const rows = [...list, {}, {}];
    return rows.map((r) => `<div class="admin-row3 admin-full">
        <select name="${kind}_player"><option value="">Altro (scrivi il nome)</option>${players.map((p) => `<option value="${p.id}" ${r.player_id === p.id ? 'selected' : ''}>${esc(p.name)} (${p.id})</option>`).join('')}</select>
        <input type="text" name="${kind}_name" value="${esc(r.scorer_name || '')}" placeholder="Nome">
        <input type="number" min="0" name="${kind}_n" value="${r.n ?? ''}" placeholder="N.">
      </div>`).join('');
  }

  async function matchForm(id) {
    const players = await playersList();
    const match = id ? ok(await db().from('matches').select('*').eq('id', id).single()) : null;
    const events = id ? ok(await db().from('match_events').select('*').eq('match_id', id)) : [];
    const presenceRows = id ? ok(await db().from('match_players').select('player_id').eq('match_id', id)) : [];
    const present = presenceRows.map((r) => r.player_id);
    const parts = dateParts(match?.match_date);
    const goals = events.filter((e) => e.kind === 'goal');
    const assists = events.filter((e) => e.kind === 'assist');
    return body(`${back}<h3>${match ? esc(match.opponent || 'Partita') : 'Nuova partita'}</h3>
      <form class="admin-form" data-form="match" data-id="${id || ''}">
        <label>Data<input type="date" name="date" value="${parts.date}" required></label>
        <label>Ora<input type="time" name="time" value="${parts.time}"></label>
        <label class="admin-full">Avversario<input type="text" name="opponent" value="${esc(match?.opponent || '')}" placeholder="Nome della squadra"></label>
        <label class="admin-full">Stemma avversario<input type="file" name="crest" accept="image/*"></label>
        <label class="admin-full">Risultato
          <span class="admin-score"><input type="number" min="0" name="us" value="${match?.score_us ?? ''}" placeholder="Noi"> – <input type="number" min="0" name="them" value="${match?.score_them ?? ''}" placeholder="Loro"></span>
        </label>
        <p class="admin-full admin-sub">Marcatori</p>
        ${scorerRows('goal', goals, players)}
        <p class="admin-full admin-sub">Assist</p>
        ${scorerRows('assist', assists, players)}
        <p class="admin-full admin-sub">Presenze</p>
        <div class="admin-presence admin-full">${players.map((p) => `<label class="admin-check"><input type="checkbox" name="present" value="${p.id}" ${present.includes(p.id) ? 'checked' : ''}> ${p.id}. ${esc(p.name)}</label>`).join('')}</div>
      </form>
      ${foot()}`);
  }

  async function playerForm(id) {
    const p = id ? ok(await db().from('players').select('*').eq('id', id).single()) : null;
    return body(`${back}<h3>${p ? esc(p.name) : 'Nuovo giocatore'}</h3>
      <form class="admin-form" data-form="player" data-id="${id || ''}">
        <label>Numero di maglia<input type="number" min="1" max="99" name="number" value="${p?.id ?? ''}" ${p ? 'readonly' : ''} required></label>
        <label>Nome<input type="text" name="name" value="${esc(p?.name || '')}" required></label>
        <label>Ruolo
          <select name="role">
            ${Object.entries(ROLE).map(([k, v]) => `<option value="${k}" ${p?.role === k ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </label>
        <label>Come lo chiamiamo<input type="text" name="label" value="${esc(p?.label || '')}" placeholder="Es. Terzino, Esterno"></label>
        <label class="admin-full">Foto<input type="file" name="photo" accept="image/*"></label>
      </form>
      ${foot()}`);
  }

  async function staffForm(id) {
    const s = id ? ok(await db().from('staff').select('*').eq('id', id).single()) : null;
    return body(`${back}<h3>${s ? esc(s.name) : 'Nuova persona'}</h3>
      <form class="admin-form" data-form="staff" data-id="${id || ''}">
        <label class="admin-full">Nome e cognome<input type="text" name="name" value="${esc(s?.name || '')}" required></label>
        <label>Ruolo<input type="text" name="role" value="${esc(s?.role || '')}" placeholder="Es. Allenatore, Dirigente" required></label>
        <label>Ordine nella scheda<input type="number" name="sort" value="${s?.sort ?? 0}" min="0"></label>
        <label class="admin-full">Presentazione<input type="text" name="description" value="${esc(s?.description || '')}" placeholder="Una frase su di lui"></label>
        <label class="admin-full">Foto<input type="file" name="photo" accept="image/*"></label>
        <label class="admin-full">Visibile sul sito
          <select name="active"><option value="true" ${s?.active !== false ? 'selected' : ''}>Sì</option><option value="false" ${s?.active === false ? 'selected' : ''}>No</option></select>
        </label>
      </form>
      ${foot()}`);
  }

  // ---------- Salvataggi ----------
  function collectScorers(f, kind, matchId) {
    const players = f.getAll(`${kind}_player`);
    const names = f.getAll(`${kind}_name`);
    const ns = f.getAll(`${kind}_n`);
    const out = [];
    players.forEach((pid, i) => {
      const name = (names[i] || '').trim();
      if (!pid && !name) return;
      out.push({
        match_id: matchId,
        kind,
        player_id: pid ? Number(pid) : null,
        scorer_name: pid ? null : name,
        n: Number(ns[i]) || 1
      });
    });
    return out;
  }

  async function saveMatch(form, id) {
    const f = new FormData(form);
    const date = f.get('date');
    if (!date) throw new Error('Inserisci la data');
    const row = {
      match_date: new Date(`${date}T${f.get('time') || '21:00'}:00`).toISOString(),
      opponent: (f.get('opponent') || '').trim() || null,
      competition: 'Serie A LegaCalcio a 8',
      score_us: f.get('us') === '' ? null : Number(f.get('us')),
      score_them: f.get('them') === '' ? null : Number(f.get('them'))
    };
    const crest = f.get('crest');
    if (crest && crest.size) row.crest_url = await uploadFile(crest, `crests/${Date.now()}-${safeName(crest.name)}`);

    let matchId = id ? Number(id) : null;
    if (matchId) {
      ok(await db().from('matches').update(row).eq('id', matchId));
    } else {
      matchId = ok(await db().from('matches').insert(row).select('id').single()).id;
    }
    ok(await db().from('match_events').delete().eq('match_id', matchId));
    ok(await db().from('match_players').delete().eq('match_id', matchId));
    const events = [...collectScorers(f, 'goal', matchId), ...collectScorers(f, 'assist', matchId)];
    if (events.length) ok(await db().from('match_events').insert(events));
    const present = f.getAll('present').map((pid) => ({ match_id: matchId, player_id: Number(pid) }));
    if (present.length) ok(await db().from('match_players').insert(present));
  }

  async function savePlayer(form, id) {
    const f = new FormData(form);
    const number = Number(id || f.get('number'));
    if (!number) throw new Error('Inserisci il numero di maglia');
    const row = {
      id: number,
      name: (f.get('name') || '').trim(),
      role: f.get('role'),
      label: (f.get('label') || '').trim(),
      active: true
    };
    if (!row.name) throw new Error('Inserisci il nome');
    const photo = f.get('photo');
    if (photo && photo.size) row.photo_url = await uploadFile(photo, `players/${number}.jpg`);
    ok(await db().from('players').upsert(row));
  }

  async function saveGallery(form) {
    const f = new FormData(form);
    const files = f.getAll('files').filter((x) => x && x.size);
    if (!files.length) throw new Error('Scegli almeno un file');
    const category = f.get('category');
    const caption = (f.get('caption') || '').trim();
    const matchId = f.get('match') ? Number(f.get('match')) : null;
    for (const file of files) {
      const url = await uploadFile(file, `gallery/${Date.now()}-${safeName(file.name)}`);
      if (category === 'collezione') {
        ok(await db().from('collection_photos').insert({ src: url, sort: Date.now() % 100000 }));
      } else {
        ok(await db().from('gallery').insert({
          kind: file.type.startsWith('video') ? 'video' : 'photo',
          category,
          caption,
          src: url,
          match_id: matchId
        }));
      }
    }
  }

  async function saveSponsor(form) {
    const f = new FormData(form);
    const logo = f.get('logo');
    if (!logo || !logo.size) throw new Error('Scegli il logo');
    const url = await uploadFile(logo, `sponsors/${Date.now()}-${safeName(logo.name)}`);
    ok(await db().from('sponsors').insert({
      name: (f.get('name') || '').trim(),
      tone: f.get('tone') || 'dark',
      logo_url: url,
      sort: Date.now() % 100000
    }));
  }

  async function saveStaff(form, id) {
    const f = new FormData(form);
    const name = (f.get('name') || '').trim();
    const role = (f.get('role') || '').trim();
    if (!name || !role) throw new Error('Inserisci nome e ruolo');
    const row = {
      name,
      role,
      description: (f.get('description') || '').trim() || null,
      sort: Number(f.get('sort')) || 0,
      active: f.get('active') !== 'false'
    };
    const photo = f.get('photo');
    if (photo && photo.size) row.photo_url = await uploadFile(photo, `staff/${Date.now()}-${safeName(photo.name)}`);
    if (id) {
      ok(await db().from('staff').update(row).eq('id', Number(id)));
    } else {
      ok(await db().from('staff').insert(row));
    }
  }

  async function runSave(form) {
    const kind = form.dataset.form;
    const id = form.dataset.id;
    if (kind === 'match') return saveMatch(form, id);
    if (kind === 'player') return savePlayer(form, id);
    if (kind === 'gallery') return saveGallery(form);
    if (kind === 'sponsor') return saveSponsor(form);
    if (kind === 'staff') return saveStaff(form, id);
    throw new Error('Modulo non riconosciuto');
  }

  // ---------- Apertura e gestione ----------
  async function showAdmin(view, arg) {
    if (!(await isLoggedIn())) view = 'login';
    try {
      adminDialog.innerHTML = await VIEWS[view](arg);
    } catch (err) {
      adminDialog.innerHTML = body(`${back}<h3>Errore</h3><p class="admin-note">${esc(err.message || err)}</p>`);
    }
    if (!adminDialog.open) adminDialog.showModal();
  }

  const entry = $('#adminEntry');
  if (entry) entry.addEventListener('click', () => showAdmin('hub'));
  document.addEventListener('click', (e) => {
    const open = e.target.closest('[data-open-admin]');
    if (open) showAdmin(open.dataset.openAdmin);
  });

  adminDialog.addEventListener('click', async (e) => {
    if (e.target === adminDialog || e.target.closest('.modal-close')) return adminDialog.close();

    const edit = e.target.closest('[data-edit-match]');
    if (edit) return showAdmin('match-edit', edit.dataset.editMatch);
    const editStaff = e.target.closest('[data-edit-staff]');
    if (editStaff) return showAdmin('staff-edit', editStaff.dataset.editStaff);
    const editPlayer = e.target.closest('[data-edit-player]');
    if (editPlayer) return showAdmin('player-edit', editPlayer.dataset.editPlayer);

    const view = e.target.closest('[data-admin]');
    if (view) return showAdmin(view.dataset.admin);

    if (e.target.closest('[data-admin-logout]')) {
      if (db()) await db().auth.signOut();
      return showAdmin('login');
    }

    if (e.target.closest('[data-admin-import]')) {
      const msg = $('[data-admin-msg]', adminDialog);
      const btn = e.target.closest('[data-admin-import]');
      btn.disabled = true;
      try {
        const result = await window.importArrowData((t) => { msg.textContent = t; });
        msg.textContent = 'Importazione completata: ' + result + '.';
      } catch (err) {
        msg.textContent = 'Errore: ' + (err.message || err);
      }
      btn.disabled = false;
      return;
    }

    if (e.target.closest('[data-admin-save]')) {
      const form = $('form[data-form]', adminDialog);
      const msg = $('[data-admin-msg]', adminDialog);
      const btn = e.target.closest('[data-admin-save]');
      if (!form) return;
      btn.disabled = true;
      msg.textContent = 'Salvataggio in corso...';
      try {
        await runSave(form);
        msg.textContent = DONE;
      } catch (err) {
        msg.textContent = 'Errore: ' + (err.message || err);
      }
      btn.disabled = false;
    }
  });

  adminDialog.addEventListener('submit', async (e) => {
    if (e.target.matches('[data-login-form]')) {
      e.preventDefault();
      const err = e.target.querySelector('[data-login-error]');
      const { error } = await db().auth.signInWithPassword({ email: e.target.email.value.trim(), password: e.target.password.value });
      if (error) { err.textContent = 'Email o password non corrette.'; err.hidden = false; return; }
      return showAdmin('hub');
    }
    if (e.target.matches('[data-password-form]')) {
      e.preventDefault();
      const err = e.target.querySelector('[data-login-error]');
      const { error } = await db().auth.updateUser({ password: e.target.password.value });
      if (error) { err.textContent = 'Password non salvata: ' + error.message; err.hidden = false; return; }
      history.replaceState(null, '', location.pathname + location.search);
      return showAdmin('hub');
    }
  });

  if (new URLSearchParams(location.search).has('admin')) document.body.classList.add('admin-preview');
  // Arrivo da un invito o da un reset password: l'amministratore sceglie la password
  if (db() && /type=(invite|recovery)/.test(location.hash)) {
    document.body.classList.add('admin-preview');
    db().auth.getSession().then(() => showAdmin('password'));
  }
})();
