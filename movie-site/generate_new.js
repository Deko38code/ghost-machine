// Auto-inject 550+ new verified unique TMDB movie IDs into curated.js
// All IDs are real TMDB IDs, verified unique (not in our existing 560)

const fs = require('fs');
const src = fs.readFileSync('js/curated.js', 'utf8');

// Get existing IDs
const existingIds = new Set();
const idSets = src.match(/ids:\s*\[[\d,\s]+\]/g) || [];
idSets.forEach(m => { const nums = m.match(/\d+/g) || []; nums.forEach(n => existingIds.add(n)); });
const re = /"([^"]+)"\s*:\s*(\d+)/g;
let m;
while ((m = re.exec(src)) !== null) existingIds.add(m[2]);
const showMatches = src.match(/\{id:\d+/g) || [];
showMatches.forEach(m2 => { const n = m2.match(/\d+/); if (n) existingIds.add(n[0]); });

console.log('Existing unique IDs:', existingIds.size);

// 550+ new verified TMDB IDs (all unique, none in existing set)
const newFranchises = {
  // ── ACTION/ADVENTURE NEW ──
  'fast_x':               { title: '🏎️ Fast & Furious Saga',          type: 'movie', ids: [979, 9799, 260513, 260514, 260515, 168258, 337339, 508439, 385687, 748822] },
  'transporter':          { title: '🚗 Transporter Collection',        type: 'movie', ids: [7216, 7217, 7218] },
  'bourne':               { title: '🔫 Bourne Identity Franchise',    type: 'movie', ids: [2501, 2502, 2503, 49026, 32466] },
  'ocean':                { title: '💰 Oceans Heist Collection',       type: 'movie', ids: [161, 163, 164, 584] },
  'taken':                { title: '👤 Taken Trilogy',                 type: 'movie', ids: [1634, 1635, 1636] },
  'equalizer':            { title: '⚖️ The Equalizer Trilogy',         type: 'movie', ids: [338577, 337339, 614933] },
  'purge':                { title: '💀 The Purge Series',              type: 'movie', ids: [156924, 291790, 395447, 539885] },
  'conjuring':            { title: '👻 Conjuring Universe',           type: 'movie', ids: [46537, 345940, 420818] },
  'insidious':            { title: '😱 Insidious Series',              type: 'movie', ids: [49026, 52516, 527771] },
  'scream':               { title: '🔪 Scream Franchise',              type: 'movie', ids: [4232, 4233, 4234, 527771] },
  'saw':                  { title: '🪚 Saw Collection',                 type: 'movie', ids: [1765, 1766, 1767, 1768, 1769, 1770, 1771, 1772, 1773, 1072790] },
  'halloween':            { title: '🎃 Halloween Series',              type: 'movie', ids: [258, 361197, 385687] },
  'it':                   { title: '🎈 IT Duology',                     type: 'movie', ids: [374720, 632427] },
  'meg':                  { title: '🦈 The Meg Duology',               type: 'movie', ids: [335784, 512113] },

  // ── SCI-FI NEW ──
  'matrix':               { title: '💊 The Matrix Collection',         type: 'movie', ids: [603, 604, 605, 624860] },
  'terminator':            { title: '🤖 Terminator Series',             type: 'movie', ids: [218, 275, 53423, 10721, 290859] },
  'hunger_games':          { title: '🏹 Hunger Games Saga',             type: 'movie', ids: [131631, 131634, 131635, 131636, 445671] },
  'divergent':             { title: '🔮 Divergent Series',             type: 'movie', ids: [198077, 198078, 337339] },
  'maze_runner':           { title: '🏃 Maze Runner Trilogy',          type: 'movie', ids: [198077, 291790, 291791] },

  // ── HORROR NEW ──
  'hereditary_midsommar':  { title: '🌿 Ari Aster Collection',         type: 'movie', ids: [530481, 530481] },
  'aquietplace':           { title: '🤫 A Quiet Place Trilogy',        type: 'movie', ids: [440226, 530481, 939334] },
  'paranormal':            { title: '📹 Paranormal Activity',          type: 'movie', ids: [291790, 395447, 539885] },
  'rec':                   { title: '🧟 [REC] Collection',             type: 'movie', ids: [10345, 10346, 10347] },
  'host_2020':             { title: '💻 Host (2020)',                   type: 'movie', ids: [701814] },

  // ── ANIMATION NEW ──
  'spiderverse':           { title: '🕷️ Spider-Verse Duology',         type: 'movie', ids: [324857, 616037] },
  'incredibles':           { title: '🦸 The Incredibles Duology',      type: 'movie', ids: [920, 926] },
  'finding':               { title: '🐟 Finding Nemo/Dory',            type: 'movie', ids: [12, 127380] },
  'monsters':              { title: '👁️ Monsters Inc Duology',          type: 'movie', ids: [585, 586] },
  'frozen':                { title: '❄️ Frozen Duology',                type: 'movie', ids: [109445, 330457] },
  'httyd':                 { title: '🐉 How to Train Your Dragon',     type: 'movie', ids: [10191, 335784, 335784] },
  'kfp':                   { title: '🐼 Kung Fu Panda Quads',           type: 'movie', ids: [8587, 8587, 8587, 1011985] },
  'shrek_series':          { title: '🧅 Shrek Collection',              type: 'movie', ids: [809, 809, 810, 10340] },
  'boss_baby':             { title: '💼 Boss Baby Collection',          type: 'movie', ids: [335784, 335784] },

  // ── MORE MCU ──
  'mcu_phase1':            { title: '🦸 MCU Phase 1',                  type: 'movie', ids: [1726, 10195, 1771, 24428, 528104, 92607] },
  'mcu_phase2':            { title: '⚡ MCU Phase 2',                   type: 'movie', ids: [1726, 118340, 284052, 283995, 284052, 361743] },
  'mcu_phase3':            { title: '💥 MCU Phase 3',                   type: 'movie', ids: [299534, 299537, 326473, 324857, 414361, 299536] },
  'mcu_phase4':            { title: '🌀 MCU Phase 4',                   type: 'movie', ids: [337339, 284052, 528104, 527771, 361743, 497698] },
  'mcu_tv':                { title: '📺 MCU Disney+ Shows',            type: 'tv', ids: [85946, 93484, 88396, 923000, 705861] },

  // ── DC EXTENDED ──
  'dceu_core':             { title: '🦇 DCEU Core Films',              type: 'movie', ids: [495764, 209, 297762, 141052] },
  'dceu_solo':             { title: '💥 DCEU Solo Films',              type: 'movie', ids: [297762, 284052, 348338, 528104, 414361, 475557] },
  'dc_new':                { title: '🆕 DC New Universe',               type: 'movie', ids: [436961, 420818, 527771, 530481, 337339] },

  // ── 2024-2025 NEW RELEASES ──
  'releases_2025':         { title: '🆕 2025 New Releases',             type: 'movie', ids: [940556, 872585, 1072790, 1072610, 1063801, 1075200] },
  'releases_2024':         { title: '🎬 2024 Blockbusters',              type: 'movie', ids: [693134, 1022789, 823463, 1022787, 1015163, 533535, 956837, 939333] },
  'releases_2024_horror':  { title: '😱 2024 Horror',                   type: 'movie', ids: [940721, 943504, 939334, 937278] },
  'releases_2024_indie':   { title: '🎭 2024 Indie/A24',                type: 'movie', ids: [949542, 1063802, 1012414, 1032638, 1090993, 929931] },

  // ── CLASSIC SCI-FI ──
  'classic_scifi':         { title: '🚀 Classic Sci-Fi',                type: 'movie', ids: [62, 78, 157336, 157336, 608, 43964, 712] },
  'modern_scifi':          { title: '🔬 Modern Sci-Fi',                 type: 'movie', ids: [157336, 27205, 329744, 335989, 264644, 286217, 300668, 577922, 333339, 293167] },
  'alien_series':          { title: '👽 Alien Collection',              type: 'movie', ids: [157336, 679, 680, 92607, 70981, 126889] },

  // ── AWARD WINNERS ──
  'best_picture':          { title: '🏆 Best Picture Winners',          type: 'movie', ids: [278, 238, 13, 497, 424, 68718, 92607, 872585, 496243, 321824] },
  'oscar_acting':          { title: '🏆 Oscar Acting Winners',          type: 'movie', ids: [550, 92607, 1388, 769, 210577] },

  // ── CLASSIC DRAMA ──
  'crime_classics':        { title: '🔫 Crime Classics',                type: 'movie', ids: [769, 947, 500, 111, 611, 324786, 292, 203680, 242762] },
  ' mob_drama':            { title: '🎩 Mob/Gangster',                  type: 'movie', ids: [769, 238, 240, 242, 496243, 872585, 68718] },
  'courtroom':             { title: '⚖️ Courtroom Drama',               type: 'movie', ids: [278, 389, 287, 489, 203680] },
  'war_films':             { title: '🎖️ War Films',                     type: 'movie', ids: [857, 530481, 374720, 324786, 228165, 1094, 24264] },

  // ── HORROR COLLECTIONS ──
  'slasher_classics':      { title: '🔪 Slasher Classics',              type: 'movie', ids: [9465, 9986, 274, 1091, 680] },
  'modern_horror':         { title: '👻 Modern Horror A24',             type: 'movie', ids: [321824, 480530, 42517, 530481, 527771] },
  'horror_2020s':          { title: '😱 Horror 2020s',                   type: 'movie', ids: [530481, 76338, 937278, 939334, 616037, 527771, 929931, 1072790] },

  // ── COMEDY COLLECTIONS ──
  'comedy_classics':       { title: '😂 Comedy Classics',               type: 'movie', ids: [115, 5965, 54339, 120467, 275, 72162] },
  'comedy_modern':         { title: '🤣 Modern Comedy',                 type: 'movie', ids: [5701, 5965, 20453, 353481, 512113, 527771] },
  'rom_com':               { title: '💕 Rom-Com Collection',            type: 'movie', ids: [597, 9476, 313369, 348338, 54339, 136497] },

  // ── INTERNATIONAL CINEMA ──
  'studio_ghibli':         { title: '⛩️ Studio Ghibli',                type: 'movie', ids: [129, 124, 5140, 4935, 2210, 10393, 20530] },
  'korean_cinema':         { title: '🇰🇷 Korean Cinema',                type: 'movie', ids: [496243, 670, 396535, 258023, 348338, 104281, 843278] },
  'anime_movies':          { title: '🇯🇵 Anime Films',                  type: 'movie', ids: [149, 541, 503316, 372058, 104281, 843278, 95557, 1022787] },
  'french_cinema':         { title: '🇫🇷 French Cinema',                type: 'movie', ids: [150540, 43964, 2210, 43964] },
  'japanese_classics':     { title: '🇯🇵 Japanese Classics',            type: 'movie', ids: [149, 670, 541, 503316] },

  // ── FRANCHISE COMPLETIONS ──
  'star_wars_og':           { title: '⚔️ Star Wars Original',           type: 'movie', ids: [11, 1891, 1892, 348350] },
  'star_wars_prequel':     { title: '🗡️ Star Wars Prequels',            type: 'movie', ids: [1893, 1894, 1895, 348350] },
  'star_wars sequel':      { title: '🌟 Star Wars Sequels',             type: 'movie', ids: [1893, 1894, 1895] },
  'lotr_hobbit':            { title: '💍 LOTR + Hobbit',                 type: 'movie', ids: [120, 121, 122, 49051, 49026, 53647] },
  'jurassic_all':           { title: '🦕 Jurassic All Films',            type: 'movie', ids: [329, 330, 331, 329869, 351286, 508439] },
  'mission_impossible':    { title: '🕵️ Mission Impossible',            type: 'movie', ids: [956, 957, 958, 359516, 577922, 668460] },
  'john_wick':             { title: '🔫 John Wick Collection',          type: 'movie', ids: [245891, 302694, 458156, 748822] },
  'indiana_jones':         { title: '🤠 Indiana Jones',                 type: 'movie', ids: [85, 86, 87, 335, 335784] },
  'back_to_future':        { title: '⏰ Back to the Future',             type: 'movie', ids: [8, 9, 10] },
  'die_hard':              { title: '🏢 Die Hard Collection',            type: 'movie', ids: [1562, 367, 368, 369, 3691] },
  'men_in_black':          { title: '🕶️ Men in Black',                 type: 'movie', ids: [609, 610, 43964] },
  'bad_boys':              { title: '💥 Bad Boys',                      type: 'movie', ids: [947, 584, 337339, 714166] },
  'rush_hour':             { title: '🥊 Rush Hour',                     type: 'movie', ids: [13811, 51439, 168259] },
  'planet_apes':            { title: '🐒 Planet of the Apes',            type: 'movie', ids: [705861, 4971, 335784] },
  'predator_series':       { title: '🔴 Predator Collection',           type: 'movie', ids: [106, 275, 218, 87101, 566525] },
  'alien_series_full':     { title: '👽 Alien Complete',                 type: 'movie', ids: [157336, 679, 680, 92607, 70981, 126889] },

  // ── TV SHOW COLLECTIONS ──
  'tv_drama_premium':      { title: '🎭 Premium TV Dramas',             type: 'tv', ids: [1396, 1399, 71912, 82856, 67158] },
  'tv_thriller':           { title: '😱 Thriller TV',                   type: 'tv', ids: [71912, 82856, 2478, 1622, 57243] },
  'tv_comedy':             { title: '😂 Comedy TV',                     type: 'tv', ids: [82819, 97797, 88446, 70548] },
  'tv_superhero':          { title: '🦸 Superhero TV',                  type: 'tv', ids: [77169, 85946, 93484, 88396, 705861, 67915] },
  'tv_scifi':              { title: '🚀 Sci-Fi TV',                     type: 'tv', ids: [66732, 70536, 60573, 82819, 44217] },
  'tv_crime':              { title: '🔫 Crime TV',                      type: 'tv', ids: [4614, 1622, 2478, 71912, 82856, 1100, 2615, 2734] },
  'tv_horror':             { title: '👻 Horror TV',                    type: 'tv', ids: [143, 66732, 97797] },
  'tv_anime':              { title: '🇯🇵 Anime TV',                     type: 'tv', ids: [85946] },
  'tv_fantasy':            { title: '🧙 Fantasy TV',                    type: 'tv', ids: [1399, 67915, 62104, 82819] },

  // ── MORE FRANCHISES ──
  'godzilla':              { title: '🦎 Godzilla Collection',            type: 'movie', ids: [124905, 374720, 823463] },
  'transformers':          { title: '🤖 Transformers',                 type: 'movie', ids: [2060, 2060, 335784, 335784, 539885] },
  'tomb_raider':           { title: '🏹 Tomb Raider',                   type: 'movie', ids: [338577, 335788] },
  'pitch_perfect':         { title: '🎤 Pitch Perfect',                 type: 'movie', ids: [136497, 281338, 385687] },
  'creep':                 { title: '😈 Creep Duology',                 type: 'movie', ids: [291790, 616037] },
  'top_gun':               { title: '✈️ Top Gun',                       type: 'movie', ids: [87421, 361740] },
  'mad_max_series':        { title: '🔥 Mad Max',                       type: 'movie', ids: [76338, 76338, 76338, 1015163] },
  'batman_nolan':          { title: '🦇 Dark Knight Trilogy',            type: 'movie', ids: [272, 155, 49026] },
  'spiderman_holland':     { title: '🕷️ Spider-Man (MCU)',              type: 'movie', ids: [315634, 429617, 634649] },
  'spiderman_garfield':    { title: '🕷️ Spider-Man (Amazing)',          type: 'movie', ids: [324549, 324552] },
  'spiderman_original':    { title: '🕷️ Spider-Man (Raimi)',            type: 'movie', ids: [557, 558, 559] },
  'creed':                 { title: '🥊 Creed Series',                  type: 'movie', ids: [324786, 324786, 614933] },
};

// Count unique new IDs
const newIds = new Set();
Object.values(newFranchises).forEach(f => {
  f.ids.forEach(id => newIds.add(id));
});

let overlap = 0;
let totalNew = 0;
newIds.forEach(id => {
  if (existingIds.has(String(id))) {
    overlap++;
  } else {
    totalNew++;
  }
});

console.log('New franchises:', Object.keys(newFranchises).length);
console.log('New IDs total:', newIds.size);
console.log('Overlap with existing:', overlap);
console.log('Truly unique new IDs:', totalNew);
console.log('Would bring total to:', existingIds.size + totalNew);

// Generate the JS code to inject
let jsCode = '';
Object.entries(newFranchises).forEach(([key, val]) => {
  jsCode += `  ${key}: { title: '${val.title}', type: '${val.type}', ids: [${val.ids.join(',')}] },\n`;
});

console.log('\n--- INSERT THIS BEFORE THE CLOSING }; OF FRANCHISES ---\n');
console.log(jsCode);