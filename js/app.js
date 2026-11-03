window.ARROW_READY.then(() => {
  'use strict';

  const D = window.ARROW_DATA;
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const pad = (n) => String(n).padStart(2, '0');
  const val = (v) => (v === null || v === undefined ? '—' : v);
  const byId = (id) => D.players.find((p) => p.id === id);

  const ROLE = { GK: 'Portiere', DIF: 'Difensore', CEN: 'Centrocampista', ATT: 'Attaccante' };
  const SWAP_MS = 6000;      // ogni quanto titolari e panchina si alternano
  const ROTATE_MS = 1500;    // ogni quanto cambia la scheda in evidenza
  const LIGHT_STEP_MS = 8;   // velocità di accensione dei puntini del pacchetto
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Markup riutilizzabile ----------
  const photoHTML = (p) =>
    `<div class="photo"><span class="num">${esc(p.number)}</span><img src="${esc(p.photo)}" alt="${esc(p.name)}" loading="lazy" onerror="this.remove()"></div>`;

  const miniCardHTML = (p) =>
    `<div class="mcard">${photoHTML(p)}<div class="mmeta"><span class="mname">${esc(p.name)}</span><span class="mrole">${p.role}</span></div></div>`;

  // ---------- Nav e header ----------
  const navBtn = $('#navToggle');
  const nav = $('#nav');
  navBtn.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    navBtn.setAttribute('aria-expanded', String(open));
  });
  nav.addEventListener('click', (e) => {
    if (e.target.tagName !== 'A') return;
    nav.classList.remove('open');
    navBtn.setAttribute('aria-expanded', 'false');
  });
  window.addEventListener('scroll', () => $('#header').classList.toggle('scrolled', window.scrollY > 10), { passive: true });

  // ---------- Statistiche calcolate dalle partite ----------
  function applyStats() {
    const total = (key, id) => D.matches.reduce((t, m) => t + (m[key] || [])
      .filter((x) => x.player === id).reduce((s, x) => s + x.n, 0), 0);
    D.players.forEach((p) => {
      p.number = p.id;
      const presenze = D.matches.filter((m) => (m.lineup || []).includes(p.id)).length;
      p.stats = { presenze, gol: total('goals', p.id), assist: total('assists', p.id) };
    });
  }

  // ---------- Palmarès ----------
  function renderTrophies() {
    $('#trophies').innerHTML = D.achievements.map((a) => `
      <article class="trophy ${esc(a.tier)}">
        <h3>${esc(a.title)}</h3>
        <p class="trophy-result">${esc(a.result)}</p>
        ${a.note ? `<small>${esc(a.note)}</small>` : ''}
      </article>`).join('');
  }

  // ---------- Countdown alla prossima partita ----------
  function startCountdown() {
    const box = $('#countdown');
    const next = D.matches
      .filter((m) => !m.score && new Date(m.date) > Date.now())
      .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
    if (!next) {
      box.innerHTML = '<span class="cd-live">Calendario in aggiornamento</span>';
      return;
    }
    const target = new Date(next.date);
    let timer;
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        box.innerHTML = '<span class="cd-live">In campo adesso</span>';
        clearInterval(timer);
        return;
      }
      const parts = [
        [Math.floor(diff / 864e5), 'giorni'],
        [Math.floor(diff / 36e5) % 24, 'ore'],
        [Math.floor(diff / 6e4) % 60, 'min'],
        [Math.floor(diff / 1e3) % 60, 'sec']
      ];
      box.innerHTML = `<span class="cd-label">Prossima partita${next.opponent ? ` vs ${esc(next.opponent)}` : ''}</span>
        <div class="cd-nums">${parts.map(([v, l]) => `<span><b>${pad(v)}</b><small>${l}</small></span>`).join('')}</div>`;
    };
    tick();
    timer = setInterval(tick, 1000);
  }

  // ---------- Rosa ----------
  let rosterFilter = 'ALL';

  function renderRosterFilters() {
    const roles = ['ALL', 'GK', 'DIF', 'CEN', 'ATT'];
    $('#rosterFilters').innerHTML = roles.map((r) =>
      `<button type="button" class="chip${r === rosterFilter ? ' on' : ''}" data-role="${r}">${r === 'ALL' ? 'Tutti' : ROLE[r]}</button>`
    ).join('');
  }

  function renderRoster() {
    const list = D.players.filter((p) => rosterFilter === 'ALL' || p.role === rosterFilter);
    $('#roster').innerHTML = list.map((p) => `
      <button type="button" class="pcard" data-id="${p.id}">
        ${photoHTML(p)}
        <div class="pmeta">
          <span class="chip-sm">${(p.label || ROLE[p.role])}</span>
          <h3>${esc(p.name)}</h3>
          <dl class="pstats">
            <div><dt>Pres.</dt><dd>${val(p.stats.presenze)}</dd></div>
            <div><dt>Gol</dt><dd>${val(p.stats.gol)}</dd></div>
            <div><dt>Assist</dt><dd>${val(p.stats.assist)}</dd></div>
          </dl>
        </div>
      </button>`).join('');
  }

  $('#rosterFilters').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-role]');
    if (!btn) return;
    rosterFilter = btn.dataset.role;
    renderRosterFilters();
    renderRoster();
  });

  // Scheda completa del giocatore (rosa, formazione)
  const modal = $('#modal');
  function openPlayer(p) {
    modal.innerHTML = `
      <div class="modal-body">
        <button class="lb-btn modal-close" type="button" aria-label="Chiudi">×</button>
        <div>${photoHTML(p)}</div>
        <div>
          <span class="chip-sm">${(p.label || ROLE[p.role])} · #${esc(p.number)}</span>
          <h3>${esc(p.name)}</h3>
          <p>${esc(p.desc)}</p>
          <dl class="pstats">
            <div><dt>Pres.</dt><dd>${val(p.stats.presenze)}</dd></div>
            <div><dt>Gol</dt><dd>${val(p.stats.gol)}</dd></div>
            <div><dt>Assist</dt><dd>${val(p.stats.assist)}</dd></div>
          </dl>
        </div>
      </div>`;
    modal.showModal();
  }
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.closest('.modal-close')) modal.close();
  });

  $('#roster').addEventListener('click', (e) => {
    const card = e.target.closest('.pcard');
    if (card) openPlayer(byId(Number(card.dataset.id)));
  });

  // ---------- Formazione ----------
  const L = D.lineup;
  // Rotazione della formazione: ogni gruppo ha 1 portiere, 3 difensori, 3 centrocampisti e 1 attaccante.
  // I giocatori di ogni ruolo girano in ordine, così dopo 14 gruppi hanno giocato tutti.
  const poolOf = (role) => D.players.filter((p) => p.role === role).map((p) => p.id);
  const pools = { GK: poolOf('GK'), DIF: poolOf('DIF'), CEN: poolOf('CEN'), ATT: poolOf('ATT') };
  const pick = (pool, from, n) => Array.from({ length: n }, (_, j) => pool[(from + j) % pool.length]);
  const squads = Array.from({ length: 14 }, (_, t) => [
    ...pick(pools.GK, t, 1), ...pick(pools.DIF, 3 * t, 3), ...pick(pools.CEN, 3 * t, 3), ...pick(pools.ATT, t, 1)
  ]);
  let squadIdx = 0;
  let spotIdx = 0;
  let paused = false;
  let spotPlayer = null;

  function buildSlots() {
    $('#slots').innerHTML = L.slots.map((s, i) =>
      `<button type="button" class="slot" data-i="${i}" style="left:${s.x}%;top:${s.y}%" aria-label="Scheda giocatore"></button>`
    ).join('');
    fillSlots(false);
  }

  function fillSlots(animate) {
    const squad = squads[squadIdx];
    $$('.slot').forEach((btn, i) => {
      const p = byId(squad[i]);
      btn.dataset.id = p.id;
      btn.innerHTML = miniCardHTML(p);
      if (animate) {
        btn.classList.remove('swap');
        void btn.offsetWidth; // riavvia l'animazione
        btn.style.animationDelay = `${i * 60}ms`;
        btn.classList.add('swap');
      }
    });
    $('#squadLabel').textContent = squadIdx === 0 ? 'Titolari' : `Gruppo ${squadIdx + 1}`;
  }

  function showSpot(animate) {
    const squad = squads[squadIdx];
    spotPlayer = byId(squad[spotIdx]);
    const box = $('#spotlight');
    box.innerHTML = `
      <div class="spot-card">${photoHTML(spotPlayer)}</div>
      <div class="spot-info">
        <span class="chip-sm">${(spotPlayer.label || ROLE[spotPlayer.role])}</span>
        <h3>${esc(spotPlayer.name)}</h3>
        <p>${esc(spotPlayer.desc)}</p>
        <div class="spot-dots">${squad.map((_, i) => `<i class="${i === spotIdx ? 'on' : ''}"></i>`).join('')}</div>
      </div>`;
    if (animate) {
      box.classList.remove('fade');
      void box.offsetWidth;
      box.classList.add('fade');
    }
  }

  function rotateSpot() {
    spotIdx = (spotIdx + 1) % squads[squadIdx].length;
    showSpot(true);
  }

  function swapSquad() {
    squadIdx = (squadIdx + 1) % squads.length;
    spotIdx = 0;
    fillSlots(true);
    showSpot(true);
  }

  $('#slots').addEventListener('click', (e) => {
    const btn = e.target.closest('.slot');
    if (btn) openPlayer(byId(Number(btn.dataset.id)));
  });
  $('#spotlight').addEventListener('click', (e) => {
    if (e.target.closest('.spot-card') && spotPlayer) openPlayer(spotPlayer);
  });

  const pauseBtn = $('#pauseBtn');
  pauseBtn.addEventListener('click', () => {
    paused = !paused;
    pauseBtn.textContent = paused ? 'Riprendi' : 'Pausa';
  });
  $('#swapBtn').addEventListener('click', swapSquad);

  // ---------- Striscia giocatori sotto la formazione ----------
  function renderMarquee() {
    // Lista duplicata: con translateX(-50%) il loop è senza salti
    $('#marquee').innerHTML = [...D.players, ...D.players]
      .map((p) => `<div class="mq">${miniCardHTML(p)}</div>`).join('');
  }

  // ---------- Apri pacchetto: animazione e giocatore, senza salvarlo in collezione ----------
  let packBusy = false;

  function buildPackPitch() {
    $('#packPitch').innerHTML = Array.from({ length: 96 }, () => '<i></i>').join('');
  }

  function renderClosedPack() {
    $('#packSlot').innerHTML = `
      <button class="pack" type="button" aria-label="Apri il pacchetto">
        <span class="pack-logo"><img src="assets/logo.jpg" alt=""></span>
        <span class="pack-label">ARROW PACK</span>
      </button>`;
  }

  const ROLE_DESC = {
    GK: 'Ultimo baluardo: riflessi, uscite e guida della difesa.',
    DIF: 'Chiusure, copertura e impostazione dal basso.',
    CEN: 'Motore della squadra: recupero, geometrie e inserimenti.',
    ATT: 'Finalizzazione, movimenti in profondità e pressione alta.'
  };
  const confettiHTML = () => Array.from({ length: 46 }, (_, i) => {
    const c = ['#f7e7a1', '#d4af37', '#ffffff', '#8b9096'][i % 4];
    return `<i style="left:${(Math.random() * 100).toFixed(1)}%;background:${c};animation-delay:${(Math.random() * 0.6).toFixed(2)}s"></i>`;
  }).join('');

  function openPack() {
    if (packBusy) return;
    packBusy = true;
    document.querySelectorAll('.confetti').forEach((n) => n.remove());
    renderClosedPack();
    const packBtn = $('#packSlot .pack');
    const dots = $$('#packPitch i');
    const lightDelay = reduceMotion ? 0 : LIGHT_STEP_MS;
    const spinMs = reduceMotion ? 0 : 1800;
    const winner = D.players[Math.floor(Math.random() * D.players.length)];

    packBtn.classList.add(reduceMotion ? 'glow' : 'spin');
    dots.forEach((d, i) => setTimeout(() => d.classList.add('on'), i * lightDelay));

    setTimeout(() => {
      packBtn.classList.add('glow');
      $('#packSlot').innerHTML = `
        <div class="fifa-card">
          <div class="fc-body">
            <div class="photo fc-photo">
              <span class="num">${esc(winner.number)}</span>
              <img src="${esc(winner.photo)}" alt="${esc(winner.name)}" onerror="this.remove()">
            </div>
            <div class="fc-info">
              <span class="fc-role">${esc(winner.label || ROLE[winner.role])}</span>
              <h4 class="fc-name">${esc(winner.name)}</h4>
              <p class="fc-desc">${esc(ROLE_DESC[winner.role])}</p>
            </div>
          </div>
        </div>`;
      $('.pack-stage').insertAdjacentHTML('beforeend', `<div class="confetti">${confettiHTML()}</div>`);
      packBusy = false;
      setTimeout(() => dots.forEach((d) => d.classList.remove('on')), 2500);
    }, spinMs + 300);
  }

  $('#packSlot').addEventListener('click', (e) => {
    if (e.target.closest('.pack')) openPack();
  });
  $('#openPackBtn').addEventListener('click', openPack);

  // La collezione mostra le foto scelte, non i giocatori aperti nei pacchetti
  function renderCollection() {
    $('#collection').innerHTML = D.collection.map((src, i) => `
      <figure class="coll-photo">
        <img src="${esc(src)}" alt="Foto della collezione ${i + 1}" loading="lazy" onerror="this.closest('.coll-photo').remove()">
      </figure>`).join('');
  }

  // ---------- Calendario ----------
  function renderMatches() {
    const now = Date.now();
    const sorted = [...D.matches].sort((a, b) => new Date(a.date) - new Date(b.date));
    const nextMatch = sorted.find((m) => !m.score && new Date(m.date) > now);

    $('#matches').innerHTML = sorted.map((m) => {
      const d = new Date(m.date);
      const crest = m.crest ? `<img class="crest" src="${esc(m.crest)}" alt="" onerror="this.remove()">` : '';
      const opponent = m.opponent ? esc(m.opponent) : '<em class="mtbd">Avversario da confermare</em>';
      const scorers = (m.goals || []).map((g) => {
        const p = g.player ? byId(g.player) : null;
        const name = p ? p.name : g.name;
        const number = p ? p.number : g.number;
        return `${esc(name)}${number ? ` (${number})` : ''}`;
      }).join(', ');
      let res = '';
      if (m.score) {
        const { us, them } = m.score;
        const outcome = us > them ? 'win' : us < them ? 'loss' : 'draw';
        const label = { win: 'Vittoria', loss: 'Sconfitta', draw: 'Pareggio' }[outcome];
        res = `<span class="score">${esc(us)} – ${esc(them)}</span><span class="outcome ${outcome}">${label}</span>`;
      } else if (d < now) res = '<span class="badge">Risultato da inserire</span>';
      return `
        <li class="match${m === nextMatch ? ' next' : ''}">
          <div class="mdate">
            <b>${esc(d.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' }))}</b>
            <span>${esc(d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }))}</span>
          </div>
          <div class="mteams">
            <span class="mcomp">${esc(m.competition)}</span>
            <div class="mrow"><span class="mname">${esc(D.club.name)}</span><span class="mvs">vs</span>${crest}<span class="mname">${opponent}</span></div>
            ${scorers ? `<small class="mscorers">Gol: ${scorers}</small>` : ''}
          </div>
          <div class="mres">${res}</div>
        </li>`;
    }).join('');
  }

  // ---------- Galleria ----------
  let galleryFilter = 'all';
  let lbList = [];
  let lbIdx = 0;
  const lightbox = $('#lightbox');

  function renderGalleryFilters() {
    const cats = ['all', ...D.galleryCategories];
    const label = (c) => (c === 'all' ? 'Tutto' : c[0].toUpperCase() + c.slice(1));
    $('#galleryFilters').innerHTML = cats.map((c) =>
      `<button type="button" class="chip${c === galleryFilter ? ' on' : ''}" data-cat="${c}">${label(c)}</button>`
    ).join('');
  }

  function renderGallery() {
    const items = D.gallery.filter((g) => galleryFilter === 'all' || g.category === galleryFilter);
    lbList = items.filter((g) => g.type === 'photo');
    let photoIdx = 0;
    $('#gallery').innerHTML = items.map((g) => {
      if (g.type === 'video') {
        return `<figure class="tile">
          <video src="${esc(g.src)}" controls preload="none" onerror="this.closest('.tile').classList.add('missing')"></video>
          <figcaption>${esc(g.caption)}</figcaption>
        </figure>`;
      }
      const idx = photoIdx++;
      return `<figure class="tile">
        <button class="tile-btn" type="button" data-lb="${idx}" aria-label="Apri ${esc(g.caption)}">
          <img src="${esc(g.src)}" alt="${esc(g.caption)}" loading="lazy" onerror="this.closest('.tile').classList.add('missing')">
        </button>
        <figcaption>${esc(g.caption)}</figcaption>
      </figure>`;
    }).join('');
  }

  $('#galleryFilters').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    galleryFilter = btn.dataset.cat;
    renderGalleryFilters();
    renderGallery();
  });

  function showLightbox(i) {
    const n = lbList.length;
    lbIdx = (i + n) % n;
    $('#lbImg').src = lbList[lbIdx].src;
    $('#lbImg').alt = lbList[lbIdx].caption;
    $('#lbCap').textContent = `${lbList[lbIdx].caption} · ${lbIdx + 1}/${n}`;
  }

  $('#gallery').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-lb]');
    if (!btn) return;
    showLightbox(Number(btn.dataset.lb));
    lightbox.showModal();
  });
  $('.lb-prev').addEventListener('click', () => showLightbox(lbIdx - 1));
  $('.lb-next').addEventListener('click', () => showLightbox(lbIdx + 1));
  $('.lb-close').addEventListener('click', () => lightbox.close());
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) lightbox.close(); });
  lightbox.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') showLightbox(lbIdx - 1);
    if (e.key === 'ArrowRight') showLightbox(lbIdx + 1);
  });

  // ---------- Sponsor ----------
  function renderSponsors() {
    $('#sponsorGrid').innerHTML = D.sponsors.map((s) => `
      <figure class="sponsor">
        <div class="sponsor-logo ${esc(s.tone)}"><img src="${esc(s.logo)}" alt="${esc(s.name)}" loading="lazy" onerror="this.closest('.sponsor').remove()"></div>
        <figcaption>${esc(s.name)}</figcaption>
      </figure>`).join('');
  }

  // ---------- Social ----------
  function renderSocial() {
    $('#socialCards').innerHTML = D.social.map((s) => `
      <a class="social-card" href="${esc(s.url)}" target="_blank" rel="noopener">
        <small>${esc(s.name)}</small>
        <b>${esc(s.handle)}</b>
        <span class="muted">Segui Arrow F.C. →</span>
      </a>`).join('');
  }

  // ---------- Avvio ----------
  renderTrophies();
  renderRosterFilters();
  applyStats();
  renderRoster();
  buildSlots();
  showSpot(false);
  renderMarquee();
  buildPackPitch();
  renderClosedPack();
  renderCollection();
  renderMatches();
  renderGalleryFilters();
  renderGallery();
  renderSponsors();
  renderSocial();
  startCountdown();

  if (!reduceMotion) {
    setInterval(() => { if (!paused) rotateSpot(); }, ROTATE_MS);
    setInterval(() => { if (!paused) swapSquad(); }, SWAP_MS);
  }
});
