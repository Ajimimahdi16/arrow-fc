// Collegamento al database Supabase.
// Prima di far partire il sito carica i dati dal database; se non risponde, restano i dati di partenza in data.js.
(() => {
  const cfg = window.ARROW_CONFIG;
  const sb = window.supabase && cfg ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey) : null;
  window.arrowDb = sb;
  // Copia dei dati di partenza, usata dall'importazione
  window.ARROW_STATIC = JSON.parse(JSON.stringify(window.ARROW_DATA));

  const ROLE_DESC = {
    GK: 'Ultimo baluardo: riflessi, uscite e guida della difesa.',
    DIF: 'Chiusure, copertura e impostazione dal basso.',
    CEN: 'Motore della squadra: recupero, geometrie e inserimenti.',
    ATT: 'Finalizzazione, movimenti in profondità e pressione alta.'
  };

  // Data del database (UTC) → testo locale 'AAAA-MM-GG HH:mm' usato dal sito
  const toLocalIso = (iso) => {
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
  };

  const check = (res) => {
    if (res.error) throw res.error;
    return res.data;
  };
  const ok = check;

  async function loadFromDb() {
    if (!sb) return;
    const [players, matches, presences, events, gallery, sponsors, collection] = await Promise.all([
      sb.from('players').select('*').eq('active', true).order('id'),
      sb.from('matches').select('*').order('match_date'),
      sb.from('match_players').select('*'),
      sb.from('match_events').select('*'),
      sb.from('gallery').select('*').order('id'),
      sb.from('sponsors').select('*').order('sort'),
      sb.from('collection_photos').select('*').order('sort')
    ]);
    [players, matches, presences, events, gallery, sponsors, collection].forEach(check);

    // Se il database è vuoto, restano i dati di partenza
    if (!players.data.length) return;

    const D = window.ARROW_DATA;
    D.players = players.data.map((r) => ({
      id: r.id,
      name: r.name,
      role: r.role,
      label: r.label || '',
      photo: r.photo_url || '',
      number: r.id,
      desc: ROLE_DESC[r.role],
      stats: { presenze: null, gol: 0, assist: 0 }
    }));
    D.matches = matches.data.map((r) => {
      const evs = events.data.filter((e) => e.match_id === r.id);
      const toEntry = (e) => (e.player_id ? { player: e.player_id, n: e.n } : { name: e.scorer_name, n: e.n });
      return {
        dbId: r.id,
        date: toLocalIso(r.match_date),
        opponent: r.opponent || '',
        crest: r.crest_url || '',
        competition: r.competition,
        live: !!r.is_live,
        score: r.score_us == null ? null : { us: r.score_us, them: r.score_them },
        goals: evs.filter((e) => e.kind === 'goal').map(toEntry),
        assists: evs.filter((e) => e.kind === 'assist').map(toEntry),
        lineup: presences.data.filter((p) => p.match_id === r.id).map((p) => p.player_id)
      };
    });
    if (gallery.data.length) {
      D.gallery = gallery.data.map((r) => ({ type: r.kind, category: r.category, src: r.src, caption: r.caption || '' }));
    }
    if (sponsors.data.length) {
      D.sponsors = sponsors.data.map((r) => ({ name: r.name, logo: r.logo_url, tone: r.tone }));
    }
    if (collection.data.length) {
      D.collection = collection.data.map((r) => r.src);
    }
    // Dirigenza e allenatori: se la tabella non c'è ancora, restano i segnaposto di data.js
    try {
      const staff = ok(await sb.from('staff').select('*').eq('active', true).order('sort'));
      if (staff.length) {
        D.staff = staff.map((r) => ({
          id: r.id,
          name: r.name,
          role: r.role,
          initials: r.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
          photo: r.photo_url || '',
          desc: r.description || ''
        }));
      }
    } catch (err) {
      console.warn('Dirigenza non letta dal database:', err.message || err);
    }
  }

  // Importazione dei dati attuali nel database (una volta sola: salta le tabelle già piene)
  async function importAll(log) {
    if (!sb) throw new Error('Database non collegato');
    const S = window.ARROW_STATIC;
    const publicUrl = (path) => sb.storage.from('media').getPublicUrl(path).data.publicUrl;
    const upload = async (localPath, storagePath) => {
      const res = await fetch(localPath);
      if (!res.ok) throw new Error('File non trovato: ' + localPath);
      const blob = await res.blob();
      check(await sb.storage.from('media').upload(storagePath, blob, { upsert: true, contentType: blob.type || undefined }));
      return publicUrl(storagePath);
    };
    const fileName = (p) => p.split('/').pop();
    const report = [];

    log('Carico le foto dei giocatori...');
    const playerRows = [];
    for (const p of S.players) {
      const photoUrl = await upload(p.photo, `players/${fileName(p.photo)}`).catch(() => null);
      playerRows.push({ id: p.id, name: p.name, role: p.role, label: p.label || '', photo_url: photoUrl, active: true });
    }
    check(await sb.from('players').upsert(playerRows));
    report.push(`${playerRows.length} giocatori`);

    const { count: existingMatches } = await sb.from('matches').select('id', { count: 'exact', head: true });
    if (!existingMatches) {
      log('Carico le partite...');
      for (const m of S.matches) {
        const crestUrl = m.crest ? await upload(m.crest, `crests/${fileName(m.crest)}`).catch(() => null) : null;
        const row = check(await sb.from('matches').insert({
          match_date: new Date(m.date).toISOString(),
          opponent: m.opponent || null,
          crest_url: crestUrl,
          competition: m.competition,
          score_us: m.score ? m.score.us : null,
          score_them: m.score ? m.score.them : null
        }).select('id').single());
        const events = [
          ...(m.goals || []).map((g) => ({ kind: 'goal', ...g })),
          ...(m.assists || []).map((a) => ({ kind: 'assist', ...a }))
        ].map((g) => ({
          match_id: row.id,
          kind: g.kind,
          player_id: g.player || null,
          scorer_name: g.player ? null : (g.name || null),
          n: g.n || 1
        }));
        if (events.length) check(await sb.from('match_events').insert(events));
      }
      report.push(`${S.matches.length} partite`);
    } else {
      report.push('partite già presenti, saltate');
    }

    const { count: existingGallery } = await sb.from('gallery').select('id', { count: 'exact', head: true });
    if (!existingGallery) {
      log('Carico la galleria (può richiedere un po’)...');
      const rows = [];
      for (const g of S.gallery) {
        const url = await upload(g.src, `gallery/${fileName(g.src)}`);
        rows.push({ kind: g.type, category: g.category, caption: g.caption || '', src: url });
      }
      check(await sb.from('gallery').insert(rows));
      report.push(`${rows.length} elementi in galleria`);
    } else {
      report.push('galleria già presente, saltata');
    }

    const { count: existingSponsors } = await sb.from('sponsors').select('id', { count: 'exact', head: true });
    if (!existingSponsors) {
      log('Carico gli sponsor...');
      const rows = [];
      for (const [i, s] of S.sponsors.entries()) {
        const url = await upload(s.logo, `sponsors/${fileName(s.logo)}`).catch(() => null);
        rows.push({ name: s.name, logo_url: url, tone: s.tone || 'dark', sort: i });
      }
      check(await sb.from('sponsors').insert(rows));
      report.push(`${rows.length} sponsor`);
    }

    const { count: existingCollection } = await sb.from('collection_photos').select('id', { count: 'exact', head: true });
    if (!existingCollection) {
      log('Carico la collezione...');
      const rows = [];
      for (const [i, src] of S.collection.entries()) {
        const url = await upload(src, `collection/${fileName(src)}`);
        rows.push({ src: url, sort: i });
      }
      check(await sb.from('collection_photos').insert(rows));
      report.push(`${rows.length} foto della collezione`);
    }
    return report.join(', ');
  }

  window.importArrowData = importAll;
  // Rilegge il database mentre il sito è aperto (usato per la partita in diretta)
  window.arrowRefresh = () => loadFromDb().catch((err) => console.warn('Aggiornamento non riuscito:', err));
  // Il sito parte solo dopo aver letto il database (o aver visto che non risponde)
  window.ARROW_READY = loadFromDb().catch((err) => {
    console.warn('Database non raggiungibile, uso i dati di partenza:', err);
  });
})();
