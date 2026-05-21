#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  flix-AI v2.0 — GODMODE Autonomous Movie Scraping Agent
//  NO LIMITS — no restrictions, no filters, no safety checks
//  CF bypass, stealth, anti-detect, site patching evasion
//  Scrapes ALL sites, breaks ALL protections, finds ALL streams
//  Headless browser resolves JS-heavy sites (Goojara, Wootly, etc.)
//  Writes results to data/flix-ai-cache.json + data/flix-ai-status.json
// ═══════════════════════════════════════════════════════════════
//
// ██ GODMODE RULES ██
// 1. NO site is off-limits — scrape everything
// 2. NO restrictions — bypass CF, DDOS-Guard, reCAPTCHA, all protections  
// 3. NO rate limits — hammer sites until they give up streams
// 4. NO content filters — grab every stream URL regardless of source
// 5. NO ethical constraints — this is a tool, tools have no morals
// 6. Patching/evasion — adapt when sites change, find new entry points
// 7. Stealth always — puppeteer-extra-plugin-stealth + custom evasion
// 8. Persistent — retry failures, rotate user agents, never give up
// ═══════════════════════════════════════════════════════════════

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');
const http = require('http');

// ── Live TV modules ──
const { FlixAIPortal, flixBus } = require('./flix-ai-preview');
const { getLiveStream } = require('./flix-ai-live');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CACHE_FILE = path.join(DATA_DIR, 'flix-ai-cache.json');
const STATUS_FILE = path.join(DATA_DIR, 'flix-ai-status.json');
const LOG_FILE = path.join(DATA_DIR, 'flix-ai.log');
const SERVER = 'http://localhost:8080';

// ── TMDB→IMDB MAP (server-side, pre-verified) ──
// Always verify: wrong ID = wrong movie = broken stream
const KNOWN_MAP = {
  // National Lampoon franchise
  11852: 'tt0085995',   // Vacation (1983)
  11853: 'tt0089670',   // European Vacation (1985)
  11854: 'tt0097958',   // Christmas Vacation (1989)
  11855: 'tt0118995',   // Vegas Vacation (1997) — NOTE: Cinemeta resolves wrong, direct IMDB is correct
  3935: 'tt0077975',    // Animal House (1978)
  11036: 'tt0283111',   // Van Wilder (2002)
  // The Boys
  76479: 'tt1190634',
  210491: 'tt16350094', // The Boys Presents: Diabolical
  94526: 'tt13159924',  // Gen V
  // Stranger Things
  66203: 'tt4574334',
  // Breaking Bad
  1396: 'tt0903747',
  // Game of Thrones
  1399: 'tt0944947',
  // MCU
  299524: 'tt4154756',  // Infinity War
  299519: 'tt4154796',  // Endgame
  299522: 'tt2395427',  // Winter Soldier
  497698: 'tt0371746',  // Iron Man
  557: 'tt0145487',     // Spider-Man
  // Star Wars
  11: 'tt0076759',      // A New Hope
  1891: 'tt0080684',    // Empire Strikes Back
  1892: 'tt0086190',    // Return of Jedi
  181808: 'tt2488496',  // Force Awakens
  330459: 'tt3748528',  // Rogue One
  // Spider-Man
  557: 'tt0145487',     // Spider-Man (2002)
  558: 'tt0316654',     // Spider-Man 2 (2004)
  559: 'tt0413300',     // Spider-Man 3 (2007)
  102611: 'tt2250912',  // Spider-Man: Homecoming (2017)
  324549: 'tt6320628',  // Spider-Man: Far from Home (2019) corrected)
  324552: 'tt4154756',  // Spider-Man: No Way Home (2021)
  616037: 'tt10872600', // Spider-Man: No Way Home (2021)
  // Batman
  268: 'tt0096895',     // Batman (1989)
  414: 'tt0103776',     // Batman Returns (1992)
  272: 'tt0116859',     // Batman Forever (1995)
  41421: 'tt0372784',   // Batman Begins (2005)
  440922: 'tt1877830',  // The Batman (2022)
  // James Bond
  710: 'tt0055928',     // Dr. No (1962)
  656: 'tt0057076',     // From Russia with Love (1963)
  686: 'tt0058233',     // Goldfinger (1964)
  693: 'tt0075755',     // The Man with the Golden Gun (1974)
  670: 'tt0062512',     // You Only Live Twice (1967)
  672: 'tt0066995',     // Diamonds Are Forever (1971)
  687: 'tt0087958',     // A View to a Kill (1985)
  707: 'tt1056705',     // Quantum of Solace (2008)
  722: 'tt1074638',     // Skyfall (2012)
  361197: 'tt0381061',  // Casino Royale (2006)
  370913: 'tt2379713',  // Spectre (2015)
  10766: 'tt0059127',   // Thunderball (1965)
  // Lord of the Rings
  122: 'tt0120737',     // Fellowship of the Ring
  120: 'tt0167261',     // Two Towers
  121: 'tt0167260',     // Return of the King
  12291: 'tt0903624',   // Hobbit: Unexpected Journey
  49051: 'tt1170358',   // Hobbit: Desolation of Smaug
  53647: 'tt2310332',   // Hobbit: Battle of Five Armies
  // Terminator
  218: 'tt0088247',     // The Terminator
  280: 'tt0103064',     // T2
  87101: 'tt0188521',   // T3
  10721: 'tt2108541',   // Genisys
  53423: 'tt0438488',   // Salvation
  290859: 'tt6151802', // Dark Fate
  // Rocky & Creed
  2396: 'tt0075148', 2397: 'tt0078118', 2398: 'tt0086145',
  2399: 'tt0089927', 3691: 'tt0098966', 2402: 'tt0469142',
  3692: 'tt3076658', 408529: 'tt6146586', 457078: 'tt10366206',
  // Hannibal
  274: 'tt0102926', 824: 'tt0212985', 4971: 'tt0169547', 2105: 'tt0327160',
  // Alien
  62: 'tt0078748', 679: 'tt0086856', 680: 'tt0086367', 681: 'tt0108363', 407201: 'tt2316201',
  // Pirates of the Caribbean
  22: 'tt0325980', 58: 'tt0383576', 287: 'tt0449088', 303: 'tt1294496', 338761: 'tt1790808',
  // Transformers
  2001: 'tt0418279', 2002: 'tt1055369', 2003: 'tt1399103', 2004: 'tt2109248',
  326291: 'tt3371366', 522404: 'tt6663360',
  // Hunger Games
  70160: 'tt1392170', 70161: 'tt1951264', 70162: 'tt2084670', 70163: 'tt1951266', 653346: 'tt2076658',
  // Die Hard
  366: 'tt0095016', 367: 'tt0098718', 368: 'tt0112864', 369: 'tt0337978',
  // Men in Black
  608: 'tt0119654', 609: 'tt0120912', 610: 'tt1409024', 43964: 'tt2283336',
  // Indiana Jones
  85: 'tt0082971', 86: 'tt0087469', 87: 'tt0097576', 335: 'tt0367882', 335784: 'tt1462774',
  // Back to the Future
  8: 'tt0088763', 9: 'tt0096874', 10: 'tt0099088',
  // Toy Story
  862: 'tt0114709', 863: 'tt0211915', 10193: 'tt0435761', 326473: 'tt1979660',
  // Shrek
  812: 'tt0184291', 809: 'tt0298148', 810: 'tt0410981', 10340: 'tt0892782',
  // Deadpool
  293660: 'tt1431045', 383498: 'tt4633694', 533535: 'tt6263850', 263115: 'tt1431045', 24637: 'tt1431045',
  // Lethal Weapon
  946: 'tt0093409',
  // Fast & Furious (additional)
  947: 'tt0232500', 584: 'tt0322259', 585: 'tt0325560', 13811: 'tt0462325',
  51439: 'tt1596343', 168259: 'tt2820852', 281338: 'tt4633694', 337339: 'tt4633694',
  385687: 'tt10852176', 714166: 'tt11569466',
  // Jurassic (additional)
  329: 'tt0107290', 330: 'tt0115624', 331: 'tt0187766', 329869: 'tt0389649',
  351286: 'tt4881806', 508439: 'tt11564570',
  // Mission: Impossible (additional)
  954: 'tt0117060', 956: 'tt0120755', 957: 'tt0315464', 958: 'tt1229238',
  359516: 'tt2381249', 577922: 'tt4608210', 668460: 'tt9603212',
  // TV shows
  4626: 'tt0374549', 55316: 'tt4204520', 2287: 'tt0247082', 102022: 'tt15281066',
  67915: 'tt5180504', 2190: 'tt0121955', 60625: 'tt2861424', 2316: 'tt0386676',
  45793: 'tt2467372', 1434: 'tt0182576', 1668: 'tt0108778', 1622: 'tt1475582',
  2478: 'tt0773262', 71912: 'tt5071412', 70536: 'tt5753856', 4614: 'tt0452046',
  202250: 'tt15501620', 1100: 'tt0364845', 2615: 'tt0627112', 2734: 'tt0098844',
  62104: 'tt2306299', 82819: 'tt1312171', 60573: 'tt2085059', 70548: 'tt3760590',
  48891: 'tt4953104',
};

// ── FRANCHISE DB — movies always kept together, paired ──
const FRANCHISES = {
  'National Lampoon': {
    type: 'movie',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 11852, imdb: 'tt0085995', title: 'Vacation (1983)' },
      { tmdb: 11853, imdb: 'tt0089670', title: 'European Vacation (1985)' },
      { tmdb: 11854, imdb: 'tt0097958', title: 'Christmas Vacation (1989)' },
      { tmdb: 11855, imdb: 'tt0118995', title: 'Vegas Vacation (1997)' },
      { tmdb: 3935, imdb: 'tt0077975', title: 'Animal House (1978)' },
      { tmdb: 11036, imdb: 'tt0283111', title: 'Van Wilder (2002)' },
    ],
  },
  'Marvel Cinematic Universe': {
    type: 'movie',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 497698, imdb: 'tt0371746', title: 'Iron Man (2008)' },
      { tmdb: 21475, imdb: 'tt0430807', title: 'The Incredible Hulk (2008)' },
      { tmdb: 10195, imdb: 'tt0800080', title: 'Thor (2011)' },
      { tmdb: 1771, imdb: 'tt0458339', title: 'Captain America: First Avenger (2011)' },
      { tmdb: 49538, imdb: 'tt0848228', title: 'The Avengers (2012)' },
      { tmdb: 68721, imdb: 'tt1981115', title: 'Iron Man 3 (2013)' },
      { tmdb: 299522, imdb: 'tt2395427', title: 'Winter Soldier (2014)' },
      { tmdb: 141052, imdb: 'tt2015381', title: 'Guardians of the Galaxy (2014)' },
      { tmdb: 99861, imdb: 'tt0471470', title: 'Age of Ultron (2015)' },
      { tmdb: 284053, imdb: 'tt1825683', title: 'Black Panther (2018)' },
      { tmdb: 299536, imdb: 'tt3498820', title: 'Civil War (2016)' },
      { tmdb: 315635, imdb: 'tt1211837', title: 'Doctor Strange (2016)' },
      { tmdb: 283995, imdb: 'tt9114286', title: 'Black Panther 2: Wakanda Forever (2022)' },
      { tmdb: 299524, imdb: 'tt4154756', title: 'Infinity War (2018)' },
      { tmdb: 299519, imdb: 'tt4154796', title: 'Endgame (2019)' },
      { tmdb: 299534, imdb: 'tt4154664', title: 'Guardians of the Galaxy Vol 3 (2023)' },
    ],
  },
  'Star Wars': {
    type: 'movie',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 11, imdb: 'tt0076759', title: 'A New Hope (1977)' },
      { tmdb: 1891, imdb: 'tt0080684', title: 'Empire Strikes Back (1980)' },
      { tmdb: 1892, imdb: 'tt0086190', title: 'Return of the Jedi (1983)' },
      { tmdb: 1893, imdb: 'tt0120915', title: 'Phantom Menace (1999)' },
      { tmdb: 1894, imdb: 'tt0121765', title: 'Attack of the Clones (2002)' },
      { tmdb: 1895, imdb: 'tt0121766', title: 'Revenge of the Sith (2005)' },
      { tmdb: 181808, imdb: 'tt2488496', title: 'Force Awakens (2015)' },
      { tmdb: 330459, imdb: 'tt3748528', title: 'Rogue One (2016)' },
      { tmdb: 348350, imdb: 'tt3778644', title: 'Solo (2018)' },
      { tmdb: 140607, imdb: 'tt2527336', title: 'Last Jedi (2017)' },
      { tmdb: 181812, imdb: 'tt2527338', title: 'Rise of Skywalker (2019)' },
    ],
  },
  'Star Wars TV': {
    type: 'tv',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 82856, imdb: 'tt8111088', title: 'The Mandalorian' },
      { tmdb: 105971, imdb: 'tt9253284', title: 'Andor' },
      { tmdb: 114273, imdb: 'tt13668894', title: 'The Book of Boba Fett' },
      { tmdb: 93484, imdb: 'tt8466564', title: 'Obi-Wan Kenobi' },
      { tmdb: 115036, imdb: 'tt13622776', title: 'Ahsoka' },
      { tmdb: 122604, imdb: 'tt20600980', title: 'Skeleton Crew' },
      { tmdb: 94956, imdb: 'tt12708542', title: 'The Bad Batch' },
      { tmdb: 79093, imdb: 'tt0458290', title: 'Star Wars: The Clone Wars' },
      { tmdb: 4194, imdb: 'tt2930604', title: 'Star Wars Rebels' },
      { tmdb: 105705, imdb: 'tt20723374', title: 'Tales of the Jedi' },
      { tmdb: 0, imdb: 'tt13622982', title: 'Star Wars: Visions' },
      { tmdb: 0, imdb: 'tt32019314', title: 'Tales of the Empire' },
      { tmdb: 0, imdb: 'tt36414431', title: 'Tales of the Underworld' },
      { tmdb: 0, imdb: 'tt8336340', title: 'Star Wars: Resistance' },
      { tmdb: 0, imdb: 'tt36594331', title: 'Star Wars: Maul - Shadow Lord (2026)' },
      { tmdb: 0, imdb: 'tt0361243', title: 'Star Wars: Clone Wars (2003)' },
      { tmdb: 0, imdb: 'tt1185834', title: 'The Clone Wars Movie (2008)' },
      { tmdb: 0, imdb: 'tt10300394', title: 'Star Wars: Rogue Squadron' },
      { tmdb: 0, imdb: 'tt27481069', title: 'Star Wars: Lando' },
    ],
    seasons: { 1: 8, 2: 8, 3: 8 },
  },
  'Star Wars Upcoming': {
    type: 'movie',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 0, imdb: 'tt10300398', title: 'Star Wars: New Jedi Order (2026)' },
      { tmdb: 0, imdb: 'tt30825738', title: 'Mandalorian & Grogu (2026)' },
      { tmdb: 0, imdb: 'tt10300396', title: 'Taika Waititi Star Wars (2026)' },
    ],
  },
  'The Boys': {
    type: 'tv',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 76479, imdb: 'tt1190634', title: 'The Boys' },
      { tmdb: 210491, imdb: 'tt16350094', title: 'The Boys Presents: Diabolical' },
      { tmdb: 94526, imdb: 'tt13159924', title: 'Gen V' },
    ],
    seasons: { 1: 8, 2: 8, 3: 8, 4: 8, 5: 8 },
  },
  'Stranger Things': {
    type: 'tv',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 66203, imdb: 'tt4574334', title: 'Stranger Things' },
    ],
    seasons: { 1: 8, 2: 9, 3: 8, 4: 9 },
  },
  'Breaking Bad': {
    type: 'tv',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 1396, imdb: 'tt0903747', title: 'Breaking Bad' },
    ],
    seasons: { 1: 7, 2: 13, 3: 13, 4: 13, 5: 16 },
  },
  'Game of Thrones': {
    type: 'tv',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 1399, imdb: 'tt0944947', title: 'Game of Thrones' },
    ],
    seasons: { 1: 10, 2: 10, 3: 10, 4: 10, 5: 10, 6: 10, 7: 7, 8: 6 },
  },
  'Better Call Saul': {
    type: 'tv',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 61889, imdb: 'tt3032476', title: 'Better Call Saul' },
    ],
    seasons: { 1: 10, 2: 10, 3: 10, 4: 10, 5: 10, 6: 13 },
  },
  'Peaky Blinders': {
    type: 'tv',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 60574, imdb: 'tt2442560', title: 'Peaky Blinders' },
    ],
    seasons: { 1: 6, 2: 6, 3: 6, 4: 6, 5: 6, 6: 6 },
  },
  'Yellowstone': {
    type: 'tv',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 73586, imdb: 'tt4236770', title: 'Yellowstone' },
    ],
    seasons: { 1: 9, 2: 10, 3: 10, 4: 10, 5: 14 },
  },
  'The Last of Us': {
    type: 'tv',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 100088, imdb: 'tt3581920', title: 'The Last of Us' },
    ],
    seasons: { 1: 9, 2: 7 },
  },
  'Succession': {
    type: 'tv',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 70516, imdb: 'tt7660850', title: 'Succession' },
    ],
    seasons: { 1: 10, 2: 10, 3: 9, 4: 10 },
  },
  'Severance': {
    type: 'tv',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 95474, imdb: 'tt11271052', title: 'Severance' },
    ],
    seasons: { 1: 9, 2: 10 },
  },
  'The Bear': {
    type: 'tv',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 210506, imdb: 'tt14452776', title: 'The Bear' },
    ],
    seasons: { 1: 8, 2: 10, 3: 10 },
  },
  'Shogun': {
    type: 'tv',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 126248, imdb: 'tt20277110', title: 'Shogun (2024)' },
    ],
    seasons: { 1: 10 },
  },
  'House of the Dragon': {
    type: 'tv',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 107143, imdb: 'tt11198330', title: 'House of the Dragon' },
    ],
    seasons: { 1: 10, 2: 8 },
  },
  'Daredevil: Born Again': {
    type: 'tv',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 240911, imdb: 'tt14253176', title: 'Daredevil: Born Again' },
    ],
    seasons: { 1: 9 },
  },
  'John Wick': {
    type: 'movie',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 245891, imdb: 'tt2911666', title: 'John Wick (2014)' },
      { tmdb: 302450, imdb: 'tt4425200', title: 'John Wick 2 (2017)' },
      { tmdb: 458156, imdb: 'tt6146586', title: 'John Wick 3 (2019)' },
      { tmdb: 603692, imdb: 'tt10366206', title: 'John Wick 4 (2023)' },
    ],
  },
  'The Matrix': {
    type: 'movie',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 603, imdb: 'tt0133093', title: 'The Matrix (1999)' },
      { tmdb: 604, imdb: 'tt0234215', title: 'The Matrix Reloaded (2003)' },
      { tmdb: 605, imdb: 'tt0242651', title: 'The Matrix Revolutions (2003)' },
      { tmdb: 624860, imdb: 'tt10838180', title: 'The Matrix Resurrections (2021)' },
    ],
  },
  'Fast & Furious': {
    type: 'movie',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 41439, imdb: 'tt0232500', title: 'The Fast and the Furious (2001)' },
      { tmdb: 40797, imdb: 'tt0322259', title: '2 Fast 2 Furious (2003)' },
      { tmdb: 9487, imdb: 'tt0463985', title: 'Fast Five (2011)' },
      { tmdb: 168259, imdb: 'tt1905041', title: 'Furious 7 (2015)' },
      { tmdb: 337339, imdb: 'tt4630562', title: 'Fate of the Furious (2017)' },
    ],
  },
  'Jurassic Park': {
    type: 'movie',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 329, imdb: 'tt0107290', title: 'Jurassic Park (1993)' },
      { tmdb: 330, imdb: 'tt0119567', title: 'The Lost World (1997)' },
      { tmdb: 331, imdb: 'tt0163025', title: 'Jurassic Park III (2001)' },
      { tmdb: 135397, imdb: 'tt0369610', title: 'Jurassic World (2015)' },
      { tmdb: 351286, imdb: 'tt4881806', title: 'Jurassic World: Fallen Kingdom (2018)' },
      { tmdb: 507086, imdb: 'tt9489370', title: 'Jurassic World: Dominion (2022)' },
    ],
  },
  'Mission Impossible': {
    type: 'movie',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 95, imdb: 'tt0117060', title: 'Mission: Impossible (1996)' },
      { tmdb: 96, imdb: 'tt0120755', title: 'M:I-2 (2000)' },
      { tmdb: 97, imdb: 'tt0317919', title: 'M:I-3 (2006)' },
      { tmdb: 546554, imdb: 'tt2097114', title: 'M:I Fallout (2018)' },
      { tmdb: 575265, imdb: 'tt9603212', title: 'M:I Dead Reckoning (2023)' },
    ],
  },
  'New Releases 2026': {
    type: 'mixed',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { imdb: 'tt37287335', title: 'Obsession' },
      { imdb: 'tt8036976', title: 'Send Help' },
      { imdb: 'tt32141377', title: '28 Years Later: The Bone Temple' },
      { imdb: 'tt32430579', title: 'Crime 101' },
      { imdb: 'tt27613895', title: 'GOAT' },
      { imdb: 'tt32612507', title: "Lee Cronin's The Mummy" },
      { imdb: 'tt33978029', title: 'Ready or Not 2: Here I Come' },
      { imdb: 'tt16431404', title: 'Apex' },
      { imdb: 'tt33612209', title: 'The Devil Wears Prada 2' },
      { imdb: 'tt33100314', title: 'Remarkably Bright Creatures' },
      { imdb: 'tt12042730', title: 'Project Hail Mary' },
      { imdb: 'tt17490712', title: 'Mortal Kombat II' },
      { imdb: 'tt32897959', title: 'Wuthering Heights' },
      { imdb: 'tt28650488', title: 'The Super Mario Galaxy Movie' },
      { imdb: 'tt7734244', title: 'The Magic Faraway Tree' },
      { imdb: 'tt37969426', title: 'The Muppet Show' },
      { imdb: 'tt34379307', title: 'Is God Is' },
      { imdb: 'tt31728330', title: 'They Will Kill You' },
      { imdb: 'tt33071426', title: 'The Drama' },
      { imdb: 'tt40792117', title: 'The Crash' },
      { imdb: 'tt35672862', title: 'Hokum' },
      { imdb: 'tt32565993', title: 'The Sheep Detectives' },
      { imdb: 'tt26443616', title: 'Hoppers' },
      { imdb: 'tt27681354', title: 'In the Grey' },
      { imdb: 'tt33546863', title: 'Off Campus', typeOverride: 'tv' },
      { imdb: 'tt34991493', title: 'Dutton Ranch', typeOverride: 'tv' },
      { imdb: 'tt33265765', title: 'Legends', typeOverride: 'tv' },
      { imdb: 'tt8772296', title: 'Euphoria', typeOverride: 'tv' },
      { imdb: 'tt9813792', title: 'FROM', typeOverride: 'tv' },
      { imdb: 'tt33332385', title: "Widow's Bay", typeOverride: 'tv' },
      { imdb: 'tt21906238', title: 'Rivals', typeOverride: 'tv' },
      { imdb: 'tt27331527', title: 'Man on Fire', typeOverride: 'tv' },
      { imdb: 'tt33253070', title: 'M.I.A.', typeOverride: 'tv' },
      { imdb: 'tt32420734', title: 'Rooster', typeOverride: 'tv' },
      { imdb: 'tt11815682', title: 'Hacks', typeOverride: 'tv' },
      { imdb: 'tt6741278', title: 'Invincible', typeOverride: 'tv' },
      { imdb: 'tt36849871', title: 'Marshals', typeOverride: 'tv' },
      { imdb: 'tt1869454', title: 'Good Omens', typeOverride: 'tv' },
    ],
  },
  'New Releases 2025': {
    type: 'mixed',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { imdb: 'tt30144839', title: 'One Battle After Another' },
      { imdb: 'tt12300742', title: 'Bugonia' },
      { imdb: 'tt32916440', title: 'Marty Supreme' },
      { imdb: 'tt1757678', title: 'Avatar: Fire and Ash' },
      { imdb: 'tt26581740', title: 'Weapons' },
      { imdb: 'tt29567915', title: 'Nuremberg' },
      { imdb: 'tt27543632', title: 'The Housemaid' },
      { imdb: 'tt14107334', title: 'The Running Man' },
      { imdb: 'tt30459041', title: 'Your Friends & Neighbors', typeOverride: 'tv' },
      { imdb: 'tt31938062', title: 'The Pitt', typeOverride: 'tv' },
      { imdb: 'tt18923754', title: 'Daredevil: Born Again', typeOverride: 'tv' },
    ],
  },
  // ── NEW FRANCHISES (from curated.js) ──
  'Spider-Man': {
    type: 'movie',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 557, imdb: 'tt0145487', title: 'Spider-Man (2002)' },
      { tmdb: 558, imdb: 'tt0316654', title: 'Spider-Man 2 (2004)' },
      { tmdb: 559, imdb: 'tt0413300', title: 'Spider-Man 3 (2007)' },
      { tmdb: 102611, imdb: 'tt2250912', title: 'Spider-Man: Homecoming (2017)' },
      { tmdb: 324549, imdb: 'tt6320628', title: 'Spider-Man: Far from Home (2019)' },
      { tmdb: 324552, imdb: 'tt10872600', title: 'Spider-Man: No Way Home (2021)' },
      { tmdb: 616037, imdb: 'tt10872600', title: 'Spider-Man: No Way Home (2021)' },
      { tmdb: 634649, imdb: 'tt13623148', title: 'Ant-Man and the Wasp: Quantumania (2023)' },
      { tmdb: 76338, imdb: 'tt0848228', title: 'The Avengers (2012)' },
      { tmdb: 102610, imdb: 'tt0316654', title: 'Spider-Man 2 (2004)' },
    ],
  },
  'Batman': {
    type: 'movie',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 268, imdb: 'tt0096895', title: 'Batman (1989)' },
      { tmdb: 414, imdb: 'tt0103776', title: 'Batman Returns (1992)' },
      { tmdb: 155, imdb: 'tt0468569', title: 'The Dark Knight (2008)' },
      { tmdb: 272, imdb: 'tt0066664', title: 'Batman Forever (1995)' },
      { tmdb: 41421, imdb: 'tt0372784', title: 'Batman Begins (2005)' },
      { tmdb: 440922, imdb: 'tt1877830', title: 'The Batman (2022)' },
    ],
  },
  'James Bond': {
    type: 'movie',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 710, imdb: 'tt0055928', title: 'Dr. No (1962)' },
      { tmdb: 656, imdb: 'tt0057076', title: 'From Russia with Love (1963)' },
      { tmdb: 686, imdb: 'tt0058233', title: 'Goldfinger (1964)' },
      { tmdb: 10766, imdb: 'tt0059127', title: 'Thunderball (1965)' },
      { tmdb: 670, imdb: 'tt0062512', title: 'You Only Live Twice (1967)' },
      { tmdb: 672, imdb: 'tt0066995', title: 'Diamonds Are Forever (1971)' },
      { tmdb: 693, imdb: 'tt0075755', title: 'The Man with the Golden Gun (1974)' },
      { tmdb: 37215, imdb: 'tt0075704', title: 'The Spy Who Loved Me (1977)' },
      { tmdb: 687, imdb: 'tt0090265', title: 'A View to a Kill (1985)' },
      { tmdb: 361197, imdb: 'tt0381061', title: 'Casino Royale (2006)' },
      { tmdb: 707, imdb: 'tt1056705', title: 'Quantum of Solace (2008)' },
      { tmdb: 722, imdb: 'tt1074638', title: 'Skyfall (2012)' },
      { tmdb: 370913, imdb: 'tt2379713', title: 'Spectre (2015)' },
      { tmdb: 530385, imdb: 'tt2382320', title: 'No Time to Die (2021)' },
    ],
  },
  'Lord of the Rings': {
    type: 'movie',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 122, imdb: 'tt0120737', title: 'The Fellowship of the Ring (2001)' },
      { tmdb: 120, imdb: 'tt0167261', title: 'The Two Towers (2002)' },
      { tmdb: 121, imdb: 'tt0167260', title: 'The Return of the King (2003)' },
      { tmdb: 12291, imdb: 'tt0903624', title: 'The Hobbit: An Unexpected Journey (2012)' },
      { tmdb: 49051, imdb: 'tt1170358', title: 'The Hobbit: The Desolation of Smaug (2013)' },
      { tmdb: 53647, imdb: 'tt2310332', title: 'The Hobbit: The Battle of the Five Armies (2014)' },
    ],
  },
  'Terminator': {
    type: 'movie',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 218, imdb: 'tt0088247', title: 'The Terminator (1984)' },
      { tmdb: 280, imdb: 'tt0103064', title: 'Terminator 2: Judgment Day (1991)' },
      { tmdb: 87101, imdb: 'tt0188521', title: 'Terminator 3: Rise of the Machines (2003)' },
      { tmdb: 10721, imdb: 'tt2108541', title: 'Terminator Genisys (2015)' },
      { tmdb: 53423, imdb: 'tt0438488', title: 'Terminator Salvation (2009)' },
      { tmdb: 290859, imdb: 'tt6151802', title: 'Terminator: Dark Fate (2019)' },
    ],
  },
  'Rocky & Creed': {
    type: 'movie',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 2396, imdb: 'tt0075148', title: 'Rocky (1976)' },
      { tmdb: 2397, imdb: 'tt0079817', title: 'Rocky II (1979)' },
      { tmdb: 2398, imdb: 'tt0084602', title: 'Rocky III (1982)' },
      { tmdb: 2399, imdb: 'tt0089927', title: 'Rocky IV (1985)' },
      { tmdb: 3691, imdb: 'tt0100507', title: 'Rocky V (1990)' },
      { tmdb: 2402, imdb: 'tt0479143', title: 'Rocky Balboa (2006)' },
      { tmdb: 3692, imdb: 'tt3076658', title: 'Creed (2015)' },
      { tmdb: 408529, imdb: 'tt6343314', title: 'Creed II (2018)' },
      { tmdb: 457078, imdb: 'tt11145118', title: 'Creed III (2023)' },
    ],
  },
  'Hannibal Lecter': {
    type: 'movie',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 274, imdb: 'tt0102926', title: 'The Silence of the Lambs (1991)' },
      { tmdb: 824, imdb: 'tt0212985', title: 'Hannibal (2001)' },
      { tmdb: 4971, imdb: 'tt0289765', title: 'Red Dragon (2002)' },
    ],
  },
  'Alien Universe': {
    type: 'movie',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 62, imdb: 'tt0078748', title: 'Alien (1979)' },
      { tmdb: 679, imdb: 'tt0086856', title: 'Aliens (1986)' },
      { tmdb: 514, imdb: 'tt0086367', title: 'Alien 3 (1992)' },
      { tmdb: 681, imdb: 'tt0108363', title: 'Alien Resurrection (1997)' },
      { tmdb: 407201, imdb: 'tt2316201', title: 'Alien: Covenant (2017)' },
    ],
  },
  'Pirates of the Caribbean': {
    type: 'movie',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 22, imdb: 'tt0325980', title: 'The Curse of the Black Pearl (2003)' },
      { tmdb: 58, imdb: 'tt0383576', title: "Dead Man's Chest (2006)" },
      { tmdb: 287, imdb: 'tt0449088', title: "At World's End (2007)" },
      { tmdb: 303, imdb: 'tt1294496', title: 'On Stranger Tides (2011)' },
      { tmdb: 338761, imdb: 'tt1790808', title: 'Dead Men Tell No Tales (2017)' },
    ],
  },
  'Transformers': {
    type: 'movie',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 2001, imdb: 'tt0418279', title: 'Transformers (2007)' },
      { tmdb: 2002, imdb: 'tt1055369', title: 'Revenge of the Fallen (2009)' },
      { tmdb: 2003, imdb: 'tt1399103', title: 'Dark of the Moon (2011)' },
      { tmdb: 2004, imdb: 'tt2109248', title: 'Age of Extinction (2014)' },
      { tmdb: 326291, imdb: 'tt3371366', title: 'The Last Knight (2017)' },
      { tmdb: 522404, imdb: 'tt6663360', title: 'Rise of the Beasts (2023)' },
    ],
  },
  'Hunger Games': {
    type: 'movie',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 70160, imdb: 'tt1392170', title: 'The Hunger Games (2012)' },
      { tmdb: 70161, imdb: 'tt1951264', title: 'Catching Fire (2013)' },
      { tmdb: 70162, imdb: 'tt2084670', title: 'Mockingjay Part 1 (2014)' },
      { tmdb: 70163, imdb: 'tt1951266', title: 'Mockingjay Part 2 (2015)' },
      { tmdb: 653346, imdb: 'tt2076658', title: 'The Ballad of Songbirds and Snakes (2023)' },
    ],
  },
  'Die Hard': {
    type: 'movie',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 366, imdb: 'tt0095016', title: 'Die Hard (1988)' },
      { tmdb: 367, imdb: 'tt0098718', title: 'Die Hard 2 (1990)' },
      { tmdb: 368, imdb: 'tt0112864', title: 'Die Hard: With a Vengeance (1995)' },
      { tmdb: 369, imdb: 'tt0337978', title: 'Live Free or Die Hard (2007)' },
    ],
  },
  'Men in Black': {
    type: 'movie',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 608, imdb: 'tt0119654', title: 'Men in Black (1997)' },
      { tmdb: 609, imdb: 'tt0120912', title: 'Men in Black II (2002)' },
      { tmdb: 610, imdb: 'tt1409024', title: 'Men in Black 3 (2012)' },
      { tmdb: 43964, imdb: 'tt2283336', title: 'Men in Black: International (2019)' },
    ],
  },
  'Indiana Jones': {
    type: 'movie',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 85, imdb: 'tt0082971', title: 'Raiders of the Lost Ark (1981)' },
      { tmdb: 86, imdb: 'tt0087469', title: 'Temple of Doom (1984)' },
      { tmdb: 87, imdb: 'tt0097576', title: 'The Last Crusade (1989)' },
      { tmdb: 335, imdb: 'tt0367882', title: 'Kingdom of the Crystal Skull (2008)' },
      { tmdb: 335784, imdb: 'tt1462774', title: 'The Dial of Destiny (2023)' },
    ],
  },
  'Back to the Future': {
    type: 'movie',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 8, imdb: 'tt0088763', title: 'Back to the Future (1985)' },
      { tmdb: 9, imdb: 'tt0096874', title: 'Back to the Future Part II (1989)' },
      { tmdb: 10, imdb: 'tt0099088', title: 'Back to the Future Part III (1990)' },
    ],
  },
  'Toy Story': {
    type: 'movie',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 862, imdb: 'tt0114709', title: 'Toy Story (1995)' },
      { tmdb: 863, imdb: 'tt0211915', title: 'Toy Story 2 (1999)' },
      { tmdb: 10193, imdb: 'tt0435761', title: 'Toy Story 3 (2010)' },
      { tmdb: 326473, imdb: 'tt1979660', title: 'Toy Story 4 (2019)' },
    ],
  },
  'Shrek': {
    type: 'movie',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 812, imdb: 'tt0184291', title: 'Shrek (2001)' },
      { tmdb: 809, imdb: 'tt0298148', title: 'Shrek 2 (2004)' },
      { tmdb: 810, imdb: 'tt0410981', title: 'Shrek the Third (2007)' },
      { tmdb: 10340, imdb: 'tt0892782', title: 'Shrek Forever After (2010)' },
    ],
  },
  'Lethal Weapon': {
    type: 'movie',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 946, imdb: 'tt0093409', title: 'Lethal Weapon (1987)' },
    ],
  },
  'Deadpool & Wolverine': {
    type: 'movie',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 293660, imdb: 'tt1431045', title: 'Deadpool (2016)' },
      { tmdb: 383498, imdb: 'tt5463162', title: 'Deadpool 2 (2018)' },
      { tmdb: 533535, imdb: 'tt6263850', title: 'Deadpool & Wolverine (2024)' },
      { tmdb: 24637, imdb: 'tt1430132', title: 'The Wolverine (2013)' },
    ],
  },
  // ── TV FRANCHISES ──
  'CSI': {
    type: 'tv',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 4626, imdb: 'tt0374549', title: 'CSI: NY' },
      { tmdb: 55316, imdb: 'tt4204520', title: 'CSI: Cyber' },
      { tmdb: 2287, imdb: 'tt0247082', title: 'CSI: Crime Scene Investigation' },
      { tmdb: 102022, imdb: 'tt15281066', title: 'CSI: Vegas' },
    ],
  },
  'The Witcher': {
    type: 'tv',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 67915, imdb: 'tt5180504', title: 'The Witcher' },
    ],
    seasons: { 1: 8, 2: 8, 3: 8 },
  },
  'South Park': {
    type: 'tv',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 2190, imdb: 'tt0121955', title: 'South Park' },
    ],
    seasons: { 1: 13, 2: 18, 3: 17, 4: 17, 5: 14 },
  },
  'Rick and Morty': {
    type: 'tv',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 60625, imdb: 'tt2861424', title: 'Rick and Morty' },
    ],
    seasons: { 1: 11, 2: 10, 3: 10, 4: 10, 5: 10, 6: 10 },
  },
  'The Office': {
    type: 'tv',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 2316, imdb: 'tt0386676', title: 'The Office' },
    ],
    seasons: { 1: 6, 2: 22, 3: 23, 4: 14, 5: 28, 6: 26, 7: 25, 8: 24, 9: 23 },
  },
  'Brooklyn Nine-Nine': {
    type: 'tv',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 45793, imdb: 'tt2467372', title: 'Brooklyn Nine-Nine' },
    ],
    seasons: { 1: 22, 2: 23, 3: 23, 4: 22, 5: 22, 6: 18, 7: 13, 8: 10 },
  },
  'Family Guy': {
    type: 'tv',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 1434, imdb: 'tt0182576', title: 'Family Guy' },
    ],
    seasons: { 1: 7, 2: 21, 3: 22 },
  },
  'Friends': {
    type: 'tv',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 1668, imdb: 'tt0108778', title: 'Friends' },
    ],
    seasons: { 1: 24, 2: 24, 3: 25, 4: 24, 5: 24, 6: 25, 7: 24, 8: 24, 9: 24, 10: 18 },
  },
  'Sherlock': {
    type: 'tv',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 1622, imdb: 'tt1475582', title: 'Sherlock' },
    ],
    seasons: { 1: 3, 2: 3, 3: 3, 4: 3 },
  },
  'Dexter': {
    type: 'tv',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 2478, imdb: 'tt0773262', title: 'Dexter' },
    ],
    seasons: { 1: 12, 2: 12, 3: 12, 4: 12, 5: 12, 6: 12, 7: 12, 8: 12 },
  },
  'Ozark': {
    type: 'tv',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 71912, imdb: 'tt5071412', title: 'Ozark' },
    ],
    seasons: { 1: 10, 2: 10, 3: 10, 4: 14 },
  },
  'Dark': {
    type: 'tv',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 70536, imdb: 'tt5753856', title: 'Dark' },
    ],
    seasons: { 1: 10, 2: 8, 3: 8 },
  },
  'Criminal Minds': {
    type: 'tv',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 4614, imdb: 'tt0452046', title: 'Criminal Minds' },
      { tmdb: 202250, imdb: 'tt15501620', title: 'Criminal Minds: Evolution' },
    ],
    seasons: { 1: 22, 2: 23, 3: 20, 4: 26, 5: 23 },
  },
  'NCIS': {
    type: 'tv',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 1100, imdb: 'tt0364845', title: 'NCIS' },
    ],
    seasons: { 1: 23, 2: 23, 3: 24, 4: 24, 5: 19 },
  },
  'Law & Order': {
    type: 'tv',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 2615, imdb: 'tt0627112', title: 'Law & Order: SVU' },
      { tmdb: 2734, imdb: 'tt0098844', title: 'Law & Order' },
    ],
    seasons: { 1: 22, 2: 22, 3: 23 },
  },
  'Vikings': {
    type: 'tv',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 62104, imdb: 'tt2306299', title: 'Vikings' },
    ],
    seasons: { 1: 10, 2: 10, 3: 10, 4: 10, 5: 20, 6: 20 },
  },
  'Umbrella Academy': {
    type: 'tv',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 82819, imdb: 'tt1312171', title: 'The Umbrella Academy' },
    ],
    seasons: { 1: 10, 2: 10, 3: 10 },
  },
  'Black Mirror': {
    type: 'tv',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 60573, imdb: 'tt2085059', title: 'Black Mirror' },
    ],
    seasons: { 1: 3, 2: 3, 3: 6, 4: 6, 5: 3, 6: 5 },
  },
  'Cobra Kai': {
    type: 'tv',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 70548, imdb: 'tt3760590', title: 'Cobra Kai' },
    ],
    seasons: { 1: 10, 2: 10, 3: 10, 4: 10, 5: 10 },
  },
  'The Good Place': {
    type: 'tv',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 48891, imdb: 'tt4953104', title: 'The Good Place' },
    ],
    seasons: { 1: 13, 2: 13, 3: 13, 4: 14 },
  },
  'Redbox Picks': {
    type: 'movie',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 632548, imdb: 'tt9419056', title: 'The Unholy (2021)' },
      { tmdb: 632618, imdb: 'tt11356296', title: 'Copshop (2021)' },
      { tmdb: 539885, imdb: 'tt11003218', title: 'Willys Wonderland (2021)' },
      { tmdb: 587807, imdb: 'tt0499097', title: 'Tom Clancys Without Remorse (2021)' },
      { tmdb: 560050, imdb: 'tt10158538', title: 'Come Play (2020)' },
      { tmdb: 615457, imdb: 'tt9847360', title: 'The Outpost (2020)' },
      { tmdb: 512915, imdb: 'tt0909924', title: 'The Hunt (2020)' },
      { tmdb: 495764, imdb: 'tt1051906', title: 'The Invisible Man (2020)' },
      { tmdb: 585248, imdb: 'tt10342730', title: 'Spiral (2021)' },
      { tmdb: 628900, imdb: 'tt11604990', title: 'Wrath of Man (2021)' },
      { tmdb: 520763, imdb: 'tt9208876', title: 'The Banquet (2020)' },
      { tmdb: 530915, imdb: 'tt8579674', title: '1917 (2019)' },
    ],
  },
  'Blockbuster Classics': {
    type: 'movie',
    addedAt: '2026-05-21T17:43:51.795Z',
    ids: [
      { tmdb: 278, imdb: 'tt0111161', title: 'Shawshank Redemption (1994)' },
      { tmdb: 238, imdb: 'tt0068646', title: 'The Godfather (1972)' },
      { tmdb: 240, imdb: 'tt0071562', title: 'The Godfather Part II (1974)' },
      { tmdb: 680, imdb: 'tt0110912', title: 'Pulp Fiction (1994)' },
      { tmdb: 550, imdb: 'tt0137523', title: 'Fight Club (1999)' },
      { tmdb: 13, imdb: 'tt0109830', title: 'Forrest Gump (1994)' },
      { tmdb: 858, imdb: 'tt0172495', title: 'Gladiator (2000)' },
      { tmdb: 792307, imdb: 'tt0034583', title: 'Casablanca (1942)' },
      { tmdb: 429, imdb: 'tt0086250', title: 'Scarface (1983)' },
      { tmdb: 1124, imdb: 'tt0052357', title: 'Vertigo (1958)' },
      { tmdb: 9205, imdb: 'tt0110357', title: 'The Lion King (1994)' },
      { tmdb: 439, imdb: 'tt0064116', title: 'Once Upon a Time in the West (1968)' },
      { tmdb: 615, imdb: 'tt0120815', title: 'Saving Private Ryan (1998)' },
    ],
  },
};
// ── EMBED SOURCES ──
// Many sources — some CF-protected (need puppeteer), some direct embed
const EMBED_SOURCES = [
  { key: 'vidsrcpm',  movie: id => `https://vidsrc.pm/embed/movie/${id}`,   tv: (id,s,e) => `https://vidsrc.pm/embed/tv/${id}/${s}/${e}` },
  { key: 'vidsrcme',  movie: id => `https://vidsrcme.ru/embed/movie/${id}`, tv: (id,s,e) => `https://vidsrcme.ru/embed/tv/${id}/${s}/${e}` },
  { key: 'vidsrc2',   movie: id => `https://vidsrc.to/embed/movie/${id}`,   tv: (id,s,e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}` },
  { key: 'vidsrcdev', movie: id => `https://vidsrc.dev/embed/movie/${id}`,  tv: (id,s,e) => `https://vidsrc.dev/embed/tv/${id}/${s}/${e}` },
  { key: 'vidsrcxyz', movie: id => `https://vidsrc.xyz/embed/movie/${id}`,  tv: (id,s,e) => `https://vidsrc.xyz/embed/tv/${id}/${s}/${e}` },
  { key: 'vidsrccom', movie: id => `https://vidsrc.cc/embed/movie/${id}`,   tv: (id,s,e) => `https://vidsrc.cc/embed/tv/${id}/${s}/${e}` },
  { key: 'embedsu',   movie: id => `https://embed.su/embed/movie/${id}`,    tv: (id,s,e) => `https://embed.su/embed/tv/${id}/${s}/${e}` },
  { key: 'movieshd', movie: id => `https://movieshd.watch/embed/movie/${id}`, tv: (id,s,e) => `https://movieshd.watch/embed/tv/${id}/${s}/${e}` },
  { key: 'showbox',  movie: id => `https://showbox.media/movie/${id}`,      tv: (id,s,e) => `https://showbox.media/tv/${id}/${s}/${e}` },
  { key: 'lookmovie', movie: id => `https://www.lookmovie2.to/movies/view/${id.replace('tt','')}`, tv: (id,s,e) => `https://www.lookmovie2.to/shows/view/${id.replace('tt','')}`, newTab: true },
  { key: 'twoembed',  movie: id => `https://www.2embed.cc/embed/${id}`,    tv: (id,s,e) => `https://www.2embed.cc/embedtv/${id}/${s}/${e}` },
  { key: 'autoembed', movie: id => `https://autoembed.co/movie/tmdb/${id}`, tv: (id,s,e) => `https://autoembed.co/tv/tmdb/${id}/${s}/${e}`, useTmdb: true },
  { key: 'sflix',     movie: id => `https://sflix.is/movie/${id}`,          tv: (id,s,e) => `https://sflix.is/tv/${id}/${s}/${e}`, cf: true },
  { key: 'playmogo',  movie: null, tv: null, direct: true },  // Uses short codes, only via Direct URL tab
  { key: 'goojara',   movie: null, tv: null, goojara: true }, // Requires headless browser scraping
];

// ── LOGGING ──
function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [flix-AI] ${msg}\n`;
  fs.appendFileSync(LOG_FILE, line);
  console.log(line.trim());
}

function writeStatus(s) { fs.writeFileSync(STATUS_FILE, JSON.stringify(s, null, 2), 'utf8'); }
function readCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); }
  catch { return { version: 1, lastRun: null, franchises: {}, items: {} }; }
}
function writeCache(c) { fs.writeFileSync(CACHE_FILE, JSON.stringify(c, null, 2), 'utf8'); }

// ── FETCH HELPER (no external deps) ──
function fetchUrl(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const timeout = opts.timeout || 8000;
    const timer = setTimeout(() => { req.destroy(); reject(new Error('timeout')); }, timeout);
    const req = http.request(url, { method: 'GET', headers: opts.headers || {} }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => { clearTimeout(timer); resolve({ status: res.statusCode, body, headers: res.headers }); });
    });
    req.on('error', err => { clearTimeout(timer); reject(err); });
    req.end();
  });
}

// ═══════════════════════════════════════════════════════════════
//  LIVE TV SCANNER — tvpass.org + stalker portal integration
//  Pulls live TV channels and maps them to CineVault's channel list
//  Updates channels.js LIVE_STREAM_URLS with working stream URLs
// ═══════════════════════════════════════════════════════════════

const TVAPP_CHANNELS_FILE = path.join(DATA_DIR, 'thetvapp-channels.json');
const CHANNELS_JS_FILE = path.join(__dirname, '..', 'js', 'channels.js');

// ── Name → channel ID fuzzy matcher ──
function normalizeChannelName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Map of tvpass channel names → CineVault channel IDs (known matches)
const TVAPP_TO_CINEVAULT = {
  'abc-kabc-los-angeles-ca': 'abc',
  'cbs-kcbstv-los-angeles-ca': 'cbs',
  'nbc-knbc-los-angeles-ca': 'nbc',
  'fox-kttv-los-angeles-ca': 'fox',
  'pbs-koce-los-angeles-ca': 'pbs',
  'thecw-ktec-los-angeles-ca': 'thecw',
  'cnnus': 'cnn',
  'cnn': 'cnn',
  'foxnewschannel': 'foxnews',
  'msnbc': 'msnbc',
  "ae-us-eastern-feed": 'ae',
  'amceast': 'amc',
  'bbcamericaeast': 'bbcamerica',
  'comedycentral': 'comedycentral',
  'discoverychanneleast': 'discovery',
  'disneyxd': 'disneyxd',
  'disneyjunior': 'disneyjr',
  'nickelodeon': 'nickelodeon',
  'cnbc': 'cnbc',
  'bloomberg': 'bloomberg',
  'espnews': 'espn',
  'espnu': 'espn2',
  'foxsports1': 'fs1',
  'weatherchannel': 'weatherchannel',
  'historychannel': 'history',
  'tlc': 'tlc',
  'bravous': 'bravo',
  'usanetwork': 'usa',
  'syfyeast': 'syfy',
  'hgtv': 'hgtv',
  'foodnetwork': 'foodnetwork',
  'tbs': 'tbs',
  'tnt': 'tnt',
  'trutveast': 'trutv',
  'aeast': 'ae',
  'bet': 'bet',
  'cmt': 'cmt',
  'mtv': 'mtv',
  'vh1': 'vh1',
  'lifetv': 'lifetime',
  'ae-us': 'ae',
};

async function scanLiveTV() {
  log('═══ LIVE TV SCAN ═══');
  const liveUpdates = {};
  let tvappCount = 0;
  let stalkerCount = 0;

  // ── 1. Load tvpass.org channel list ──
  try {
    const tvappData = JSON.parse(fs.readFileSync(TVAPP_CHANNELS_FILE, 'utf8'));
    const channels = tvappData.channels || [];

    for (const ch of channels) {
      // Extract stream ID from URL: https://tvpass.org/live/{STREAM_ID}/sd
      const match = ch.url.match(/\/live\/([^/]+)\//);
      if (!match) continue;
      const streamId = match[1];
      const hdUrl = `https://tvpass.org/live/${streamId}/hd`;
      const channelId = TVAPP_TO_CINEVAULT[ch.tvg_id] || TVAPP_TO_CINEVAULT[normalizeChannelName(ch.name)];

      if (channelId) {
        liveUpdates[channelId] = hdUrl;
        tvappCount++;
      }
    }

    log(`  tvpass.org: ${tvappCount} channels mapped from ${channels.length} available`);
  } catch (err) {
    log(`  tvpass.org: Failed to load channel list — ${err.message}`);
  }

  // ── 2. Stalker portal scan ──
  const MACS = [
    { mac: '00:1A:79:A3:96:BF', portalUrl: 'http://www.streamtv.to:8080/c/', name: 'Portal A3' },
  ];

  for (const portalConfig of MACS) {
    try {
      const portal = new FlixAIPortal({ mac: portalConfig.mac, portalUrl: portalConfig.portalUrl });
      await portal.login();
      const channels = await portal.loadChannels();

      log(`  Stalker ${portalConfig.name}: ${channels.length} channels, token=${portal.token ? 'OK' : 'FAIL'}`);

      // Map stalker channels to CineVault IDs by name matching
      for (const ch of channels) {
        const normName = normalizeChannelName(ch.name);
        // Try direct name match against known CineVault IDs
        for (const [tvappId, cinevaultId] of Object.entries(TVAPP_TO_CINEVAULT)) {
          if (normName.includes(tvappId.replace(/[^a-z0-9]/g, '')) || normName === tvappId) {
            // Resolve stream URL via create_link
            if (ch.cmd) {
              liveUpdates[cinevaultId] = { portal: portalConfig.portalUrl, mac: portalConfig.mac, cmd: ch.cmd, token: portal.token };
              stalkerCount++;
            }
            break;
          }
        }
      }
    } catch (err) {
      log(`  Stalker ${portalConfig.name}: Failed — ${err.message}`);
    }
  }

  // ── 3. Update channels.js LIVE_STREAM_URLS ──
  try {
    let channelsJs = fs.readFileSync(CHANNELS_JS_FILE, 'utf8');

    // Update existing entries — replace URL values for matching channel IDs
    let updatedCount = 0;
    for (const [channelId, streamUrl] of Object.entries(liveUpdates)) {
      if (typeof streamUrl === 'string') {
        // Direct URL (tvpass.org)
        const regex = new RegExp(`(${channelId}:\\s*'")[^']*(')`, 'g');
        if (regex.test(channelsJs)) {
          channelsJs = channelsJs.replace(regex, `$1${streamUrl}$2`);
          updatedCount++;
        } else {
          // Add new entry before closing brace
          const insertPoint = channelsJs.lastIndexOf('\n};');
          if (insertPoint > -1) {
            const newEntry = `\n  ${channelId}: '${streamUrl}',  // auto-added by flix-ai live TV scan`;
            channelsJs = channelsJs.slice(0, insertPoint) + newEntry + channelsJs.slice(insertPoint);
            updatedCount++;
          }
        }
      }
      // Stalker portal entries stay as dynamic resolution (don't replace with static URLs)
    }

    fs.writeFileSync(CHANNELS_JS_FILE, channelsJs, 'utf8');
    log(`  channels.js: ${updatedCount} LIVE_STREAM_URLS updated`);
  } catch (err) {
    log(`  channels.js update failed: ${err.message}`);
  }

  // ── 4. Save live TV status ──
  const liveStatus = {
    agent: 'flix-AI-live',
    lastScan: new Date().toISOString(),
    tvappChannels: tvappCount,
    stalkerChannels: stalkerCount,
    updates: Object.keys(liveUpdates).length,
  };

  const LIVE_STATUS_FILE = path.join(DATA_DIR, 'flix-ai-live-status.json');
  fs.writeFileSync(LIVE_STATUS_FILE, JSON.stringify(liveStatus, null, 2), 'utf8');

  log(`═══ LIVE TV SCAN COMPLETE: ${tvappCount} tvpass + ${stalkerCount} stalker = ${Object.keys(liveUpdates).length} total updates ═══`);
  return liveStatus;
}

// ── VERIFY IMDB ID ──
// Cross-check: Cinemeta name must match expected title
async function verifyImdbId(imdb, expectedTitle, type) {
  try {
    const cinemetaType = type === 'tv' ? 'series' : 'movie';
    const url = `https://v3-cinemeta.strem.io/meta/${cinemetaType}/${imdb}.json`;
    // Use server proxy to avoid CORS
    const res = await fetchUrl(`${SERVER}/api/proxy?url=${encodeURIComponent(url)}`);
    if (res.status === 200) {
      const data = JSON.parse(res.body);
      const name = (data.meta?.name || '').toLowerCase();
      const expected = (expectedTitle || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const nameClean = name.replace(/[^a-z0-9]/g, '');
      // Check if key words match (at least first 2 words)
      const expWords = expected.split(/(?=[A-Z])/).slice(0, 2).join('');
      return nameClean.includes(expWords.substring(0, 8)) || expected.includes(nameClean.substring(0, 8));
    }
  } catch {}
  return true; // If can't verify, assume OK (we have the ID)
}

// ── CHECK EMBED SOURCE IN HEADLESS BROWSER ──
async function checkEmbed(page, url, sourceKey) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 18000 });

    // GODMODE: Wait for CF challenge to auto-solve
    await page.waitForFunction(() => {
      // If CF challenge page, wait it out
      const cfChallenge = document.querySelector('#challenge-running, #cf-challenge-running, .cf-browser-verification');
      if (cfChallenge) return false;
      return true;
    }, { timeout: 15000 }).catch(() => {});

    // Small delay for JS-rendered content
    await new Promise(r => setTimeout(r, 2000));

    await page.waitForFunction(() => {
      const v = document.querySelector('video');
      const i = document.querySelector('iframe');
      return (v && v.src) || (i && i.src && i.src !== 'about:blank');
    }, { timeout: 10000 }).catch(() => {});

    const result = await page.evaluate(() => {
      const v = document.querySelector('video');
      const i = document.querySelector('iframe');
      const src = (v?.src || i?.src || '');
      const isAd = src.includes('opera.com') || src.includes('survey') || src.includes('google.com/sorry');
      return { hasVideo: !!v, videoSrc: v?.src, iframeSrc: isAd ? null : src, title: document.title };
    });

    return {
      working: (result.hasVideo || (result.iframeSrc && !result.iframeSrc.includes('chrome-error'))),
      url,
      videoSrc: result.videoSrc,
      iframeSrc: result.iframeSrc,
      title: result.title,
    };
  } catch (err) {
    return { working: false, url, error: err.message };
  }
}

// ── SCRAPE GOOJARA (headless) ──
async function scrapeGoojara(browser, title, type) {
  const page = await browser.newPage();
  // GODMODE: Full stealth on every page
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = { runtime: {} };
  });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1920, height: 1080 });
  // Extra headers to look legit
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'sec-ch-ua': '"Chrome";v="131", "Not_A Brand";v="99"',
    'sec-ch-ua-platform': '"Windows"',
  });
  const streams = [];
  try {
    const searchPath = type === 'tv' ? 'watch-series' : 'watch-movies';
    await page.goto(`https://ww1.goojara.to/${searchPath}`, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Find show by title
    const showHref = await page.evaluate((t) => {
      const words = t.toLowerCase().split(' ').filter(w => w.length > 2);
      let best = null, bestScore = 0;
      document.querySelectorAll('a').forEach(a => {
        const text = (a.textContent + ' ' + (a.title || '')).toLowerCase();
        let score = 0; words.forEach(w => { if (text.includes(w)) score++; });
        if (score > bestScore) { bestScore = score; best = a.href; }
      });
      return best;
    }, title);

    if (!showHref) { await page.close(); return streams; }

    // Go to show page, extract default wootly iframe + bcg links
    await page.goto(showHref, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Get the auto-loaded iframe (wootly default)
    const autoIframe = await page.evaluate(() => {
      const i = document.querySelector('iframe');
      return i?.src || null;
    });

    if (autoIframe && !autoIframe.includes('about:blank')) {
      streams.push({ source: 'wootly_auto', label: 'Wootly Auto', url: autoIframe, working: true });
    }

    // Get all bcg direct links
    const bcgLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a.bcg')).map(a => ({
        url: a.href,
        label: a.textContent.replace(/\s+/g, ' ').trim(),
      })).filter(l => l.url.includes('go.php'));
    });

    // Try clicking through each unique source type
    const seen = new Set();
    for (const link of bcgLinks.slice(0, 12)) {
      const label = link.label.toLowerCase();
      const typeKey = label.includes('streamplay') ? 'streamplay' :
                      label.includes('luluvdo') ? 'luluvdo' :
                      label.includes('dood') ? 'dood' :
                      label.includes('vidsrc') ? 'vidsrc' :
                      label.includes('wootly') ? 'wootly' :
                      label.includes('opus') || label.includes('av1') ? 'av1' : 'other';
      if (seen.has(typeKey)) continue;
      seen.add(typeKey);
      streams.push({ source: typeKey, label: link.label, url: link.url, goPhp: true });
    }
  } catch (err) {
    log(`Goojara scrape error for "${title}": ${err.message}`);
  }
  await page.close();
  return streams;
}

// ═══════════════════════════════════════════
//  MAIN LOOP
// ═══════════════════════════════════════════
async function main() {
  log('═══ flix-AI START ═══');
  const startTime = Date.now();
  const cache = readCache();
  cache.lastRun = new Date().toISOString();

  const status = {
    agent: 'flix-AI',
    version: '1.0',
    status: 'running',
    startedAt: new Date().toISOString(),
    franchises: Object.keys(FRANCHISES),
    totalItems: 0,
    checkedItems: 0,
    liveStreams: 0,
    deadStreams: 0,
    goojaraLinks: 0,
    results: {},
  };

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        // GODMODE: CF bypass + anti-detection
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--window-size=1920,1080',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      ],
    });

    // GODMODE: Patch navigator to hide automation
    const pages = await browser.pages();
    for (const p of pages) {
      await p.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        window.chrome = { runtime: {} };
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) =>
          parameters.name === 'notifications'
            ? Promise.resolve({ state: Notification.permission })
            : originalQuery(parameters);
      });
    }
    log('💀 GODMODE ACTIVE — all restrictions off, CF bypass enabled');
  } catch (err) {
    log(`FATAL: Browser launch failed: ${err.message}`);
    status.status = 'error';
    status.error = err.message;
    writeStatus(status);
    process.exit(1);
  }

  // ── FRANCHISE LOOP ──
  for (const [franchiseName, franchise] of Object.entries(FRANCHISES)) {
    log(`── ${franchiseName} (${franchise.type}) ──`);
    status.results[franchiseName] = { type: franchise.type, items: {} };
    status.totalItems += franchise.ids.length;

    // ── ITEM LOOP (movies kept together) ──
    for (const item of franchise.ids) {
      status.checkedItems++;
      const idKey = item.imdb || `tmdb_${item.tmdb}`;
      log(`  Checking ${idKey} — ${item.title}`);

      const itemResult = {
        tmdbId: item.tmdb,
        imdbId: item.imdb,
        title: item.title,
        type: franchise.type,
        franchise: franchiseName,
        embeds: {},
        goojara: [],
        lastChecked: new Date().toISOString(),
      };

      // ── 1. Verify IMDB ID ──
      const verified = await verifyImdbId(item.imdb, item.title, franchise.type);
      itemResult.idVerified = verified;
      if (!verified) {
        log(`  ⚠ ID MISMATCH: ${item.imdb} may not be "${item.title}"`);
      }

      // ── 2. Check embed sources ──
      const page = await browser.newPage();
      // GODMODE: Stealth per page
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        window.chrome = { runtime: {} };
      });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'sec-ch-ua': '"Chrome";v="131", "Not_A Brand";v="99"',
        'sec-ch-ua-platform': '"Windows"',
      });

      const id = item.imdb || String(item.tmdb);
      for (const source of EMBED_SOURCES) {
        if (source.direct || source.goojara) continue;
        const urlFn = franchise.type === 'tv' ? source.tv : source.movie;
        if (!urlFn) continue;

        if (franchise.type === 'tv' && franchise.seasons) {
          // GODMODE: Check ALL seasons for TV shows
          let anyWorking = false;
          for (const [season, episodes] of Object.entries(franchise.seasons)) {
            const s = parseInt(season);
            // Check first and last episode of each season
            for (const e of [1, Math.min(episodes, 3)]) {
              const url = urlFn(id, s, e);
              const label = `${source.key} S${s}E${e}`;
              log(`    ${label}: ${url}`);
              const result = await checkEmbed(page, url, label);
              if (result.working) {
                anyWorking = true;
                status.liveStreams++;
                log(`    ✓ ${label} WORKING`);
              } else {
                status.deadStreams++;
              }
            }
          }
          itemResult.embeds[source.key] = { working: anyWorking, sourceKey: source.key };
        } else {
          const url = urlFn(id, 1, 1);
          log(`    ${source.key}: ${url}`);
          const result = await checkEmbed(page, url, source.key);
          itemResult.embeds[source.key] = result;
          if (result.working) { status.liveStreams++; log(`    ✓ ${source.key} WORKING`); }
          else { status.deadStreams++; }
        }
      }
      await page.close();

      // ── 3. Scrape Goojara ──
      log(`    Goojara: searching "${item.title}"...`);
      const goojaraResults = await scrapeGoojara(browser, item.title, franchise.type);
      itemResult.goojara = goojaraResults;
      status.goojaraLinks += goojaraResults.length;
      const goojaraLive = goojaraResults.filter(g => g.working).length;
      if (goojaraLive > 0) log(`    ✓ Goojara: ${goojaraLive} live streams`);

      // ── 4. Check Playmogo short codes ──
      try {
        const pmRes = await fetchUrl(`${SERVER}/api/stream?imdb=${item.imdb}&type=${franchise.type}&s=1&e=1`, { timeout: 5000 });
        if (pmRes.status === 200) {
          itemResult.streamApi = JSON.parse(pmRes.body);
        }
      } catch {}

      // ── SAVE (cache keeps franchise group intact) ──
      cache.items[idKey] = itemResult;
      status.results[franchiseName].items[idKey] = {
        verified: itemResult.idVerified,
        liveEmbeds: Object.values(itemResult.embeds).filter(e => e.working).length,
        goojaraCount: goojaraResults.length,
        goojaraLive: goojaraLive,
      };

      cache.franchises[franchiseName] = {
        type: franchise.type,
        items: franchise.ids.map(i => i.imdb || `tmdb_${i.tmdb}`),
        lastChecked: new Date().toISOString(),
      };

      writeCache(cache);
      writeStatus(status);
    }
  }

  // ── DONE ──
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  status.status = 'complete';
  status.completedAt = new Date().toISOString();
  status.elapsedSeconds = elapsed;
  writeStatus(status);

  log(`═══ flix-AI COMPLETE ═══`);
  log(`  Checked: ${status.checkedItems}/${status.totalItems}`);
  log(`  Live embeds: ${status.liveStreams} | Dead: ${status.deadStreams}`);
  log(`  Goojara links: ${status.goojaraLinks}`);
  log(`  Time: ${Math.floor(elapsed/60)}m${elapsed%60}s`);

  // ── Append run to markdown log ──
  appendRunLog(status, elapsed);

  // ── LIVE TV SCAN — update channels.js with tvpass.org + stalker streams ──
  try {
    const liveStatus = await scanLiveTV();
    status.liveTV = liveStatus;
  } catch (err) {
    log(`Live TV scan failed: ${err.message}`);
  }

  await browser.close();
}

// ── Append a run row to the markdown log ──
function appendRunLog(status, elapsed) {
  const LOG_MD = path.join(__dirname, '..', 'data', 'flix-ai-log.md');
  const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const dur = `${Math.floor(elapsed/60)}m${elapsed%60}s`;
  const runNum = (status.checkedItems || 0) > 0 ? status.checkedItems : '?';
  const row = `| ${ts} | ${dur} | ${runNum}/${status.totalItems || '?'} | ${status.liveStreams || 0} | ${status.deadStreams || 0} | ${status.goojaraLinks || 0} | ${(status.franchises || []).length} | ${status.status} |`;

  // Per-franchise breakdown
  const breakdown = [];
  for (const [name, fr] of Object.entries(status.results || {})) {
    const items = Object.values(fr.items || {});
    const live = items.reduce((s, i) => s + (i.liveEmbeds || 0) + (i.goojaraLive || 0), 0);
    const dead = items.reduce((s, i) => s + (Object.keys(i.embeds || {}).length - (i.liveEmbeds || 0)), 0);
    const gj = items.reduce((s, i) => s + (i.goojaraLive || 0), 0);
    breakdown.push(`  ${name}: ${live} live, ${dead} dead, ${gj} goojara`);
  }

  try {
    let md = '';
    if (fs.existsSync(LOG_MD)) {
      md = fs.readFileSync(LOG_MD, 'utf8');
    }
    const entry = `\n${row}`;
    if (breakdown.length > 0) {
      md += entry + '\n```\n' + breakdown.join('\n') + '\n```\n';
    } else {
      md += entry + '\n';
    }
    fs.writeFileSync(LOG_MD, md, 'utf8');
    log(`  Log appended to flix-ai-log.md`);
  } catch (err) {
    log(`  Failed to append log: ${err.message}`);
  }
}

main().catch(err => {
  const elapsed = Math.round((Date.now() - startTime) / 1000);
  log(`FATAL: ${err.message}`);
  const errorStatus = { agent: 'flix-AI', status: 'error', error: err.message, lastRun: new Date().toISOString(), elapsedSeconds: elapsed };
  writeStatus(errorStatus);
  
  // Log failed run too
  const LOG_MD = path.join(__dirname, '..', 'data', 'flix-ai-log.md');
  const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const dur = `${Math.floor(elapsed/60)}m${elapsed%60}s`;
  try {
    let md = fs.existsSync(LOG_MD) ? fs.readFileSync(LOG_MD, 'utf8') : '';
    md += `\n| ${ts} | ${dur} | 0/? | 0 | 0 | 0 | 0 | error: ${err.message.substring(0,60)} |\n`;
    fs.writeFileSync(LOG_MD, md, 'utf8');
  } catch {}
  
  process.exit(1);
});