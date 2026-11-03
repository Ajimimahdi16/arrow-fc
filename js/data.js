/*
 * Tutti i contenuti del sito stanno qui.
 * Sostituisci i dati di esempio (nomi, avversari, date, social) con quelli reali.
 * Le foto vanno nelle cartelle assets/players (<id>.jpg) e assets/gallery.
 * Se una foto manca, il sito mostra una sagoma o il segnaposto "Foto da caricare".
 */
(() => {
  window.ARROW_DATA = {
    club: { name: 'Arrow F.C.', league: 'Serie A LegaCalcio a 8', region: 'Piemonte' },

    achievements: [
      { title: 'Carnival Premiership', result: 'Campioni', note: 'Trofeo vinto', tier: 'gold' },
      { title: 'Conference League', result: '2° posto', tier: 'silver' },
      { title: 'Campionato Premiership', result: '2° posto', tier: 'silver' },
      { title: 'Gazzetta Football League', result: '7° in Italia', note: 'Rappresentanti del Piemonte', tier: 'plain' },
      { title: 'Serie A LegaCalcio a 8', result: 'In corso', note: 'Stagione attuale', tier: 'current' }
    ],

    // Rosa: id = numero di maglia. role = ruolo in formazione (GK, DIF, CEN, ATT). label = ruolo come scritto dalla squadra.
    players: [
      { id: 33, name: 'Ionut', role: 'GK', label: 'Portiere', photo: 'assets/players/ionut-33.jpg' },
      { id: 29, name: 'Tedeschi', role: 'GK', label: 'Portiere', photo: 'assets/players/tedeschi-29.jpg' },
      { id: 69, name: 'Fatty', role: 'DIF', label: 'Difensore centrale', photo: 'assets/players/fatty-69.jpg' },
      { id: 28, name: 'Iorio', role: 'DIF', label: 'Difensore centrale', photo: 'assets/players/iorio-28.jpg' },
      { id: 6, name: 'Ajimi', role: 'DIF', label: 'Difensore centrale', photo: 'assets/players/ajimi-6.jpg' },
      { id: 22, name: 'Garofalo', role: 'DIF', label: 'Terzino', photo: 'assets/players/garofalo-22.jpg' },
      { id: 12, name: 'Glorioso', role: 'DIF', label: 'Terzino', photo: 'assets/players/glorioso-12.jpg' },
      { id: 21, name: 'Calivo', role: 'DIF', label: 'Terzino', photo: 'assets/players/calivo-21.jpg' },
      { id: 23, name: 'Paletto', role: 'CEN', label: 'Centrocampista', photo: 'assets/players/paletto-23.jpg' },
      { id: 11, name: 'Acocella', role: 'CEN', label: 'Centrocampista', photo: 'assets/players/acocella-11.jpg' },
      { id: 81, name: 'D\u2019Alessio', role: 'CEN', label: 'Centrocampista', photo: 'assets/players/dalessio-81.jpg' },
      { id: 8, name: 'Acocella jr', role: 'CEN', label: 'Centrocampista', photo: 'assets/players/acocella-jr-8.jpg' },
      { id: 19, name: 'Iulian', role: 'CEN', label: 'Esterno', photo: 'assets/players/iulian-19.jpg' },
      { id: 99, name: 'Laganà', role: 'CEN', label: 'Esterno', photo: 'assets/players/lagana-99.jpg' },
      { id: 17, name: 'Zeneli', role: 'CEN', label: 'Esterno', photo: 'assets/players/zeneli-17.jpg' },
      { id: 45, name: 'Bovo', role: 'ATT', label: 'Punta', photo: 'assets/players/bovo-45.jpg' },
      { id: 7, name: 'Canino', role: 'ATT', label: 'Attaccante', photo: 'assets/players/canino-7.jpg' }
    ],

    // Formazione 3-3-1 + portiere (8 posizioni). Per cambiare modulo modifica solo "slots".
    lineup: {
      formation: '3-3-1',
      slots: [
        { x: 50, y: 86 },
        { x: 22, y: 64 }, { x: 50, y: 64 }, { x: 78, y: 64 },
        { x: 22, y: 42 }, { x: 50, y: 42 }, { x: 78, y: 42 },
        { x: 50, y: 20 }
      ],
      starters: [33, 69, 28, 6, 23, 11, 81, 45],
      bench: [29, 22, 12, 21, 19, 99, 17, 7]
    },


    // Calendario dagli screenshot: solo data, orario e stemma avversario.
    // Nome avversario (opponent) da inserire. score: null = risultato non inserito.
    matches: [
      { date: '2026-10-19T21:00:00', crest: 'assets/teams/2026-10-19.jpg', opponent: 'Reer', competition: 'Serie A LegaCalcio a 8', score: { us: 2, them: 1 }, goals: [{ player: 45, n: 1 }, { player: 99, n: 1 }], assists: [] },
      { date: '2026-10-26T20:00:00', crest: 'assets/teams/2026-10-26.jpg', opponent: 'Papopro', competition: 'Serie A LegaCalcio a 8', score: { us: 2, them: 2 }, goals: [{ player: 45, n: 1 }, { player: 81, n: 1 }], assists: [] },
      { date: '2026-11-02T21:00:00', crest: 'assets/teams/2026-11-02.jpg', opponent: 'Real No Limits', competition: 'Serie A LegaCalcio a 8', score: { us: 1, them: 4 }, goals: [{ player: 7, n: 1 }], assists: [] },
      { date: '2026-11-09T21:00:00', crest: 'assets/teams/2026-11-09.jpg', opponent: 'Imperium FC', competition: 'Serie A LegaCalcio a 8', score: null },
      { date: '2026-11-23T22:00:00', crest: 'assets/teams/2026-11-23.jpg', opponent: 'Chisola', competition: 'Serie A LegaCalcio a 8', score: null },
      { date: '2026-11-30T22:00:00', crest: 'assets/teams/2026-11-30.jpg', opponent: 'Goats', competition: 'Serie A LegaCalcio a 8', score: null },
      { date: '2026-12-09T21:00:00', crest: 'assets/teams/2026-12-09.jpg', opponent: 'Paninoteca 30Lode', competition: 'Serie A LegaCalcio a 8', score: null },
      { date: '2026-12-14T22:00:00', crest: 'assets/teams/2026-12-14.jpg', opponent: 'AC Bra', competition: 'Serie A LegaCalcio a 8', score: null }
    ],

    // Foto della collezione (scelte da voi)
    collection: [
      'assets/collezione/collezione-53.jpg',
      'assets/collezione/collezione-54.jpg',
      'assets/collezione/collezione-55.jpg',
      'assets/collezione/collezione-56.jpg',
      'assets/collezione/collezione-57.jpg',
      'assets/collezione/collezione-58.jpg',
      'assets/collezione/collezione-59.jpg',
      'assets/collezione/collezione-60.jpg',
      'assets/collezione/collezione-61.jpg',
      'assets/collezione/collezione-62.jpg',
      'assets/collezione/collezione-63.jpg',
      'assets/collezione/collezione-64.jpg',
      'assets/collezione/collezione-65.jpg',
      'assets/collezione/collezione-66.jpg',
      'assets/collezione/collezione-67.jpg'
    ],

    galleryCategories: ['partite', 'giocatori', 'allenamenti'],

    // Categorie provvisorie: tutte le foto sono in "partite". Sposta le foto
    // in "giocatori" o "allenamenti" cambiando category.
    gallery: [
      ...Array.from({ length: 43 }, (_, i) => ({
        type: 'photo',
        category: 'partite',
        src: `assets/gallery/foto-${String(i + 1).padStart(2, '0')}.jpg`,
        caption: `Foto ${String(i + 1).padStart(2, '0')}`
      })),
      { type: 'video', category: 'partite', src: 'assets/gallery/highlights.mp4', caption: 'Highlights' }
    ],

    // Sponsor 2026/27 dal PDF "loghi". Per aggiungerne uno: nome e percorso del logo.
    sponsors: [
      { name: 'NetSox', logo: 'assets/sponsors/netsox.png', tone: 'dark' },
      { name: 'Emanuele Frigo', logo: 'assets/sponsors/emanuele-frigo.png', tone: 'light' },
      { name: 'Pratiche Auto Pra · Agenzia Velox', logo: 'assets/sponsors/pratiche-auto-pra.png', tone: 'dark' },
      { name: 'Meat Grill Steak House', logo: 'assets/sponsors/meat-grill.png', tone: 'light' },
      { name: 'Autodemolizione Ricambi Torino', logo: 'assets/sponsors/autodemolizione-ricambi-torino.png', tone: 'dark' },
      { name: 'Partner da confermare', logo: 'assets/sponsors/logo-graffiti.png', tone: 'dark' }
    ],

    social: [
      { name: 'Instagram', handle: '@arrowofficialfc', url: 'https://www.instagram.com/arrowofficialfc' },
      { name: 'TikTok', handle: '@arrowofficialfc', url: 'https://www.tiktok.com/@arrowofficialfc' }
    ]
  };
})();
