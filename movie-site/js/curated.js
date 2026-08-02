// ── CineVault Curated Library ──
// MASSIVE movie/TV database — Hollywood Video store vibes
// TMDB IDs for quality rows, fetched at runtime if API key is set

const CURATED_LISTS = {
  // ── FRANCHISES ──
  fastFurious: {
    title: '🏎️ Fast & Furious',
    ids: [947,584,585,13811,51439,168259,281338,337339,385687,714166]
  },
  mastersOfTheUniverse: {
    title: '⚔️ Masters of the Universe',
    ids: [454639, 9342]
  },
  deadpool: {
    title: ' 💀 Deadpool & Wolverine',
    ids: [293660,383498,533535,181808,263115,24637]
  },
  marvel: {
    title: '🦸 Marvel Cinematic Universe',
    ids: [76338,1771,10023,4951,68721,299534,299536,299537,429617,508943,566525,361743,420818,634649,580489,603692,705861,616037,102611,495764,24428,284052,497698,527771,41421,91314]
  },
  spiderman: {
    title: '🕷️ Spider-Man',
    ids: [557,558,559,102611,324549,324552,616037,634649,76338,102610]
  },
  batman: {
    title: '🦇 Batman',
    ids: [268,414,155,272,348,4951,41421,440922]
  },
  bond: {
    title: '🍸 James Bond',
    ids: [710,656,686,693,670,672,680,671,687,707,722,361197,370913,64688,10764,10766,10778]
  },
  starwars: {
    title: '⚔️ Star Wars',
    ids: [11,1891,1892,1893,1894,1895,181808,348350,181812,330459,324552]
  },
  lotr: {
    title: '💍 Lord of the Rings',
    ids: [122,120,121,12291,49051,49026,53647]
  },
  matrix: {
    title: '💊 The Matrix',
    ids: [603,604,605,624860]
  },
  jurassic: {
    title: '🦕 Jurassic Park',
    ids: [329,330,331,329869,351286,508439]
  },
  terminator: {
    title: '🤖 Terminator',
    ids: [218,557,87101,10721,53423,290859]
  },
  mission: {
    title: '🕵️ Mission: Impossible',
    ids: [954,956,957,958,359516,577922,668460]
  },
  rocky: {
    title: '🥊 Rocky & Creed',
    ids: [2396,2397,2398,2399,3691,2402,3692,408529,457078]
  },
  hannibal: {
    title: '🧠 Hannibal Lecter',
    ids: [274,824,4971,2105]
  },
  aliens: {
    title: '👽 Alien Universe',
    ids: [62,679,680,681,135397,407201]
  },
  pirates: {
    title: '🏴‍☠️ Pirates of the Caribbean',
    ids: [22,58,287,303,338761]
  },
  transformers: {
    title: '🤖 Transformers',
    ids: [1858,8373,38356,91314,335988,424783,667538]
  },
  finalDestination: {
    title: '💀 Final Destination',
    ids: [9532,9358,9286,19912,55779,574475]
  },
  goosebumps: {
    title: '👻 Goosebumps',
    ids: [257445]
  },
  hunger: {
    title: '🏹 Hunger Games',
    ids: [70160,70161,70162,70163,653346]
  },
  johnwick: {
    title: '🔫 John Wick',
    ids: [245891,302694,458156,748822]
  },
  diehard: {
    title: '🏢 Die Hard',
    ids: [366,367,368,369]
  },
  // ── MORE FRANCHISES ──
  xmen: {
    title: '🧬 X-Men',
    ids: [366,36657,36658,36659,554,555,556,22750,24428,535382]
  },
  avengers: {
    title: '🛡️ Avengers Saga',
    ids: [24428,284052,299534,299536,299537,429617,508943,566525]
  },
  bourne: {
    title: '🎯 Bourne',
    ids: [2501,2502,2503,2504,324668]
  },
  ocean: { title: '💰 Oceans Heist Collection', type: 'movie', ids: [161,163,164] },
  rushhour: {
    title: '🥋 Rush Hour',
    ids: [9471,9472,9473]
  },
  lethalweapon: {
    title: '🔫 Lethal Weapon',
    ids: [946,9474,9475,9476]
  },
  rocky: {
    title: '🥊 Rocky & Creed',
    ids: [2396,2397,2398,2399,3691,2402,3692,408529,457078]
  },
  conjuring: {
    title: '👻 The Conjuring Universe',
    ids: [447332,594,345911,412117,449042,385687,284053]
  },
  purge: {
    title: '🇺🇸 The Purge',
    ids: [414211,415929,448431,500864]
  },
  scream: {
    title: '📞 Scream',
    ids: [414,415,416,575560]
  },
  saw: { title: '🪚 Saw Collection', type: 'movie', ids: [176,215,1576,1577,1578,1579,1580,1581,1582] },
  rambo: {
    title: '💪 Rambo',
    ids: [268,3022,3023,3024]
  },
  planetapes: {
    title: '🦍 Planet of the Apes',
    ids: [1771,49047,49049,49050,49051,49052]
  },
  godzilla: {
    title: '🦎 MonsterVerse',
    ids: [124905,373571,423108,568124,823464]
  },
  ghostbusters: {
    title: '👻 Ghostbusters',
    ids: [506,507,515,623929]
  },
  hangover: {
    title: '🤮 The Hangover',
    ids: [187,28315,45327]
  },
  madmax: {
    title: '🏜️ Mad Max',
    ids: [654,655,656,76341,823229]
  },
  jackass: {
    title: '🤘 Jackass',
    ids: [10667,14971,432413]
  },

  mib: {
    title: '🕶️ Men in Black',
    ids: [608,609,610,43964,457232]
  },
  indiana: {
    title: '🤠 Indiana Jones',
    ids: [85,86,87,335,335784]
  },
  backfuture: {
    title: '⚡ Back to the Future',
    ids: [8,9,10]
  },
  toy: {
    title: '🧸 Toy Story',
    ids: [862,863,10193,12,326473]
  },
  shrek: {
    title: '🧅 Shrek',
    ids: [812,809,810,10340,8587]
  },
  iceage: {
    title: '🧊 Ice Age',
    ids: [8587,8588,8589,10138,11594]
  },
  madagascar: {
    title: '🦁 Madagascar',
    ids: [920,921,10193,532]
  },
  kungfu: {
    title: '🐼 Kung Fu Panda',
    ids: [920,10193,532,82674]
  },

  // ── GENRES ──
  action: {
    title: '💥 Action Movies',
    ids: [155,238,278,603,496243,157336,429617,281338,299534,51439,245891,954,710,218,366,1858,8373,38356,91314,335988,424783,667538,11,8,122,76338,9532,9358,9286,19912,55779,574475]
  },
  comedy: {
    title: '😂 Comedy',
    ids: [550,680,497,13,11216,424,346,155,603,93,3982,539,419,6934,572,631,447365,348,4470,10273,223702,122081]
  },
  viewAskew: {
    title: '🧢 Jay & Silent Bob / View Askew',
    type: 'movie',
    ids: [2292,2293,2255,1832,2294,2295,158011,446159,635731]
  },
  horror: {
    title: '😱 Horror',
    ids: [572,631,419,6934,539,4470,447365,348,3982,10273,46610,2899,2105,659,414,21,9476,824,1492,4935,9532,9358,9286,19912,55779,574475,257445]
  },
  scifi: {
    title: '🚀 Sci-Fi',
    ids: [603,157336,497,4935,62,284052,399,93,414,27205,11,218,557,87101,135397,329,330,331]
  },
  thriller: {
    title: '🔪 Thriller',
    ids: [274,824,4971,550,346,424,238,680,155,89,272,348,24,2105,659,254,266,500,887,98]
  },
  romance: {
    title: '💕 Romance',
    ids: [372658,594,13,11216,194,87,496243,947,1585,10702,354912,346,550,637,424,40011,9480,8587,278,238]
  },
  drama: {
    title: '🎭 Drama',
    ids: [278,13,11216,346,155,496243,680,550,424,238,497,769,539,3982,194,87,594,603,8587,93]
  },
  animation: {
    title: '✨ Animation',
    ids: [12,862,10193,330459,8587,920,4935,26,532,9483,812,809,10340,508439,411,284052,12291,568124,223702]
  },
  documentary: {
    title: '📹 Documentary',
    ids: [438799,11574,46610,278154,408826,399074,444489,568124,2899,273437,22862,4935,155,254,346,539,419,6934,659,2105]
  },
  crime: {
    title: '🔫 Crime',
    ids: [278,238,346,155,274,4971,824,680,424,550,769,447365,539,194,87,594,89,24,887,98]
  },
  war: {
    title: '⚔️ War',
    ids: [85,50619,346,122,414,22862,361197,539,4935,2899,659,2105,6934,419,572,254,278,13,11216,155]
  },
  western: {
    title: '🤠 Western',
    ids: [274,346,155,539,447365,194,87,594,424,680,4971,824,769,550,238,13,11216,89,24]
  },
  fantasy: {
    title: '🧙 Fantasy',
    ids: [122,120,121,11,497,4935,62,330459,414,348,603,157336,284052,51439,168259,281338,337339,385687,714166,1858,8204]
  },
  mystery: {
    title: '🔍 Mystery',
    ids: [274,824,4971,550,346,424,278,680,155,89,272,348,24,2105,659,254,266,500,887,98]
  },
  family: {
    title: '👨‍👩‍👧‍👦 Family',
    ids: [12,862,10193,8587,920,4935,532,812,809,10340,508439,330459,326473,411,284052,22,58,287,303,9483,8204]
  },
  adventure: {
    title: '🗺️ Adventure Collection',
    ids: [11,122,120,121,85,86,87,335,22,58,287,303,947,1858,329,330,331,8,9,10,366,564,1734,1735,2059,6637,8844,88751,335787,7364,10204,8204]
  },

  // ── HOLLYWOOD VIDEO BLOCKBUSTER WALL ──
  blockbuster80s: {
    title: '📼 80s Blockbusters',
    ids: [8,9,10,218,366,85,86,87,680,155,346,424,194,93,414,62,603,539,89,650]
  },
  blockbuster90s: {
    title: '📼 90s Blockbusters',
    ids: [278,238,550,603,497,13,11216,165,346,424,155,594,194,87,769,24,539,266,348,98]
  },
  blockbuster00s: {
    title: '📀 2000s Blockbusters',
    ids: [122,120,121,11,1858,920,8587,4935,414,155,603,274,346,424,680,238,4971,824,329,330]
  },
  blockbuster10s: {
    title: '💿 2010s Blockbusters',
    ids: [157336,496243,281338,51439,168259,299534,299536,299537,429617,508943,245891,302694,420818,361743,346,550,680,278,13,11216]
  },
  blockbuster20s: {
    title: '🎬 2020s Hits',
    ids: [533535,714166,580489,603692,616037,566525,508943,634649,458156,748822,653346,457078,408529,3692,351286,326291,522404,508439,440922]
  },
  new2025: {
    title: '🆕 Top New Movies 2025',
    ids: [950387,552524,575265,986056,1233413,822119,574475,1087192,870028,1195506,1234821,911430,1100988,1061474,83533,1054867,1084242,1242898]
  },
  new2026: {
    title: '🔥 Hot New Releases 2026',
    ids: [693134,1022789,533535,823464,786892,945961,653346,840705,1034541,933260,940721,1249213,687163]
  },

  // ── NETFLIX ORIGINALS ──
  netflixMovies: {
    title: '🔴 Netflix Original Movies',
    ids: [492075,447332,680923,553678,613504,507076,414211,1003596,577062,614935,619592,438631,475557,346994,449548,405016,872585,823488]
  },

  // ── PRIME VIDEO ORIGINALS ──
  primeMovies: {
    title: '🟣 Prime Video Original Movies',
    ids: [588016,587996,446025,450340,578003,760741,690370,976498]
  },

  // ── STREAMING HITS ──
  streamingHits: {
    title: '📱 Streaming Must-Watch',
    ids: [680923,553678,507076,613504,588016,760741,690370,823488]
  },

  // ── CURATED VIBES ──
  dateNight: {
    title: '🌹 Date Night',
    ids: [372658,594,13,11216,496243,346,424,550,539,87,8587,920,862,10193,194,680,278,238,155,165]
  },
  guysNight: {
    title: '🍻 Guys Night',
    ids: [550,680,155,603,245891,302694,281338,51439,218,366,1858,11,122,299534,299536,299537,947,584,585,13811]
  },
  girlsNight: {
    title: '💅 Girls Night',
    ids: [372658,354912,550,346,194,278,13,11216,594,87,496243,424,8587,920,862,10193,680,238,155,165]
  },
  scared: {
    title: '😱 Can\'t Sleep Tonight',
    ids: [572,631,419,6934,447365,348,4470,3982,10273,824,274,4971,2105,659,414,1492,9476,2899,21,539,9532,9358,9286,19912,55779,574475,257445]
  },
  mindfuck: {
    title: '🤯 Mind = Blown',
    ids: [603,157336,497,4935,27205,550,680,496243,93,399,11216,238,346,424,155,278,13,539,3982,414]
  },
  feelgood: {
    title: '😊 Feel-Good',
    ids: [13,11216,497,12,862,10193,8587,920,4935,165,87,594,812,809,10340,532,278,680,424,346]
  },

  // ── AFTER DARK (PIN-LOCKED 18+) ──
  afterDark: {
    title: '🍒 After Dark (18+)',
    pin: '6969',
    ids: [274,550,4971,824,346,424,238,680,165,539,194,87,414,659,348,21,9476,6934,419,572,594,11216,13,155,496243,24,89,266,500,98]
  },

  // ── MORE GENRES & MOODS ──
  psychological: {
    title: '🧠 Psychological',
    ids: [550,496243,603,157336,93,27205,346,424,238,278,637,500,887,98,254,266,689,87101,280,10721]
  },
  survival: {
    title: '🏕️ Survival',
    ids: [44215,86831,51876,157336,594,274,62,361197,438799,46610,603,87101,329,330,76341,280]
  },
  martialArts: {
    title: '🥋 Martial Arts',
    ids: [9471,9472,9473,557,558,559,245891,302694,458156,748822,41421,268,3691,3692]
  },
  heist: {
    title: '💰 Heist & Con',
    ids: [161,162,163,413285,71470,680923,507076,500864,278,238,680,424,346]
  },
  cyberpunk: {
    title: '🌆 Cyberpunk',
    ids: [603,604,605,624860,280,87101,10721,290859,41421,263115,53423,580489,429617,76338,4951,440922]
  },
  spaceOperas: {
    title: '🌌 Space Opera',
    ids: [11,1891,1892,1893,1894,1895,348350,181812,330459,157336,62,679,135397,49051,53647,603,399]
  },
  courtroom: {
    title: '⚖️ Courtroom & Legal',
    ids: [578,49049,49050,11216,8587,155,588016,976498,40011]
  },
  timeTravel: {
    title: '⏰ Time Travel',
    ids: [8,9,10,603,157336,4935,399,93,506,624860,27205]
  },

  // ── CLASSIC CINEMA ──
  classic50s: {
    title: '📽️ 50s Classics',
    ids: [656,670,672,680,710,722,11,414,85,346,274,155,194,93,539,64688]
  },
  classic60s: {
    title: '📽️ 60s Classics',
    ids: [671,686,687,693,707,650,414,155,680,346,274,539,64688]
  },
  classic70s: {
    title: '📽️ 70s Classics',
    ids: [218,62,268,155,346,414,274,655,656,680,539,238,11216,64688,10764]
  },

  // ── CULT & MIDNIGHT ──
  cult: {
    title: '🎭 Cult Classics',
    ids: [550,603,680,497,4935,13,76341,87101,280,9476,4470,572,624860,419,6934,399]
  },
  midnight: {
    title: '🌙 Midnight Movies',
    ids: [624860,76341,4470,87101,550,572,631,399,9476,419,6934,280,603,4935,539]
  },

  // ── STREAMING EXPANSION ──
  hboMovies: {
    title: '🟤 HBO Max Original Movies',
    ids: [4951,440922,155,705861,335784,577922,668460,41421,272,361197,508943]
  },
  disneyMovies: {
    title: '🔵 Disney+ Original Movies',
    ids: [812,8587,9483,411,12,862,863,10193,326473,330459,508439,284052,4935]
  },
  appleMovies: {
    title: '⬛ Apple TV+ Movies',
    ids: [588016,578003,690370,760741,976498]
  },
  warnerbros: {
    title: '🏰 Warner Bros Pictures',
    ids: [27205,76341,346698,414906,475557,297802,49521,141052,346364,436969,259316,297761,137113,1271,49047,68734,161,675,767,12444,12445,18785,10528,1124,6479,561,78,694,9552,949,769,1422,9340,927,33,289,185,4011,70,1372,950387,44912,616]
  },

  // ── AWARD WINNERS ──
  bestPicture: {
    title: '🏆 Best Picture Winners',
    ids: [278,238,13,11216,346,496243,155,122,120,121,165,414,274,887,769,500,98,539,8587]
  },
  criticallyAcclaimed: {
    title: '⭐ Critically Acclaimed (90+ Metacritic)',
    ids: [278,238,346,11216,13,496243,122,120,121,414,155,8587,497,165,769,500,98,274,887,680]
  },

  // ── ANIME EXPANSION ──
  animeMovies: {
    title: '🎌 Anime Movies',
    ids: [12451,129,532,326473,10193,330459,568124,4935,411,9483,284052]
  },
  ghibli: {
    title: '✨ Studio Ghibli',
    ids: [12451,129,4935,532,411,12,10193,9483,8587]
  },

  // ── 2020s NEW RELEASES (ALL FRESH IDs) ──
  fresh2020: {
    title: '🎬 2020 Fresh Drops',
    ids: [508442,531200,583406,530383,632580,412327,614611,417536,577922,597836,567667,576049,617612]
  },
  fresh2021: {
    title: '🎬 2021 Fresh Drops',
    ids: [438631,634649,370913,566525,580489,588016,553678,508943,576049,613504,578003,616037,617612,597836,567667,568124,508439,508442]
  },
  fresh2022: {
    title: '🎬 2022 Fresh Drops',
    ids: [545611,361743,508943,76600,614611,41421,616037,612913,593635,591781,447365,603692,575265,508943,335784]
  },
  fresh2023: {
    title: '🎬 2023 Fresh Drops',
    ids: [872585,346672,748822,666277,792307,823488,591781,447365,603692,575265,588016,976498,519182,786892,948214]
  },
  fresh2024: {
    title: '🎬 2024 Fresh Drops',
    ids: [693134,786892,1022789,533535,948849,519182,968558,906311,949145,822119,575265,361197,948214,1032903]
  },
  fresh2025: {
    title: '🔥 2025 Fresh Drops',
    ids: [968558,906311,948849,822119,558634,945961,1075276,1045944,823488,76600,519182,976498,588016,346672,693134]
  },

  // ── NEW FRANCHISE ADDITIONS (2020s) ──
  conjuringUniv: {
    title: '👻 Conjuring Universe',
    ids: [447332,345911,412117,449042,284053,575560,385687]
  },
  quietPlace: {
    title: '🤫 A Quiet Place',
    ids: [447332,515001,527771]
  },
  divergent: {
    title: '🔵 Divergent Series',
    ids: [261402,293555]
  },
  meg: {
    title: '🦈 The Meg',
    ids: [412117,823488]
  },
  quietPlace2: {
    title: '🤐 Quiet Place & M3GAN',
    ids: [447332,515001,527771,823488]
  },
  venom: {
    title: '🧪 Venom',
    ids: [447365,566525,580489]
  },

  // ── NEW GENRE ROWS ──
  superhero2020s: {
    title: '🦸 Superhero 2020s',
    ids: [566525,580489,508943,447365,634649,533535,41421,361743,370913,603692,558634,968558]
  },
  horror2020s: {
    title: '😱 Horror 2020s',
    ids: [447332,345911,412117,515001,575560,906311,948849,284053]
  },
  action2020s: {
    title: '💥 Action 2020s',
    ids: [361743,603692,575265,566525,533535,41421,748822,693134,786892,948849,906311,370913,438631,693134]
  },
  comedy2020s: {
    title: '😂 Comedy 2020s',
    ids: [346672,588016,519182,976498,568124,508439,508442,417536,580489]
  },
  scifi2020s: {
    title: '🚀 Sci-Fi 2020s',
    ids: [438631,693134,872585,76600,577922,948849,786892,545611,568124,580489,968558,447365,508442]
  },
  drama2020s: {
    title: '🎭 Drama 2020s',
    ids: [872585,666277,792307,822119,968558,949145,823488,576049,545611,583406,617612,597836]
  },
  thriller2020s: {
    title: '🔪 Thriller 2020s',
    ids: [906311,968558,948849,822119,949145,823488,786892,693134,748822,603692,948214]
  },
  animation2020s: {
    title: '✨ Animation 2020s',
    ids: [508442,508439,568124,591781,531200,519182,1022789,330459,326473,823488,553678]
  },

  // ── ASIAN CINEMA (NEW) ──
  asianAction: {
    title: '🥊 Asian Action',
    ids: [545611,438631,576049,593635,558634,614935,438631,507076,948214]
  },
  kDrama: {
    title: '🇰🇷 K-Drama Hits',
    ids: [496243,614935,507076,680923,438631,553678,93405,71470]
  },

  // ── AWARD SEASON 2020s ──
  oscar2020s: {
    title: '🏆 Oscar Winners 2020s',
    ids: [872585,792307,823488,666277,822119,949145,576049,508442,612913,597836]
  },

  // ── BOX OFFICE SMASHERS 2020s ──
  blockbuster2020s: {
    title: '💰 Box Office Kings 2020s',
    ids: [361743,76600,346672,693134,1022789,533535,580489,508943,519182,519182,591781,568124,508442,508439]
  },

  // ── NEW STREAMING ORIGINALS 2020s ──
  netflix2020s: {
    title: '🔴 Netflix 2020s Hits',
    ids: [492075,447332,680923,553678,613504,507076,414211,1003596,577062]
  }
};

// ── FRANCHISES (for TV shows and collections) ──
// Used by api.js to build franchise rows
const FRANCHISES = {
  marvel:       { title: '🦸 Marvel Universe',    type: 'movie', ids: [76338,1771,10023,68721,299534,299536,299537,429617,508943,566525,361743,420818,634649,580489,603692,705861,616037,102611,495764,24428,284052,497698,527771,91314,949145,948849] },
  spiderman:    { title: '🕷️ Spider-Man',          type: 'movie', ids: [557,558,559,102611,324549,324552,616037,634649,76338,102610,968558] },
  batman:       { title: '🦇 Batman & DC Universe',  type: 'movie', ids: [268,414,155,272,348,4951,41421,440922,822119] },
  bond:         { title: '🍸 James Bond',           type: 'movie', ids: [710,656,686,693,670,672,687,707,722,361197,370913,64688,10764,10766,10778] },
  starwars:     { title: '⚔️ Star Wars',            type: 'movie', ids: [11,1891,1892,1893,1894,1895,181808,348350,181812,330459] },
  lotr:         { title: '💍 Lord of the Rings',     type: 'movie', ids: [122,120,121,12291,49051,49026,53647] },
  fastFurious:  { title: '🏎️ Fast & Furious',        type: 'movie', ids: [947,584,585,13811,51439,168259,281338,337339,385687,714166] },
  deadpool:     { title: '💀 Deadpool & Wolverine', type: 'movie', ids: [293660,383498,533535] },
  matrix:       { title: '💊 The Matrix',            type: 'movie', ids: [603,604,605,624860] },
  jurassic:     { title: '🦕 Jurassic Park',          type: 'movie', ids: [329,330,331,329869,351286,508439,906311] },
  terminator:   { title: '🤖 Terminator',            type: 'movie', ids: [218,280,87101,10721,53423,290859] },
  mission:      { title: '🕵️ Mission: Impossible',   type: 'movie', ids: [954,956,957,958,359516,577922,668460,575265] },
  rocky:        { title: '🥊 Rocky & Creed',          type: 'movie', ids: [2396,2397,2398,2399,3691,2402,3692,408529,457078] },
  hannibal:     { title: '🧠 Hannibal Lecter',       type: 'movie', ids: [274,824,4971,2105] },
  aliens:       { title: '👽 Alien Universe',        type: 'movie', ids: [62,679,680,681,135397,407201] },
  pirates:      { title: '🏴‍☠️ Pirates of the Caribbean', type: 'movie', ids: [22,58,287,303,338761] },
  transformers: { title: '🤖 Transformers',          type: 'movie', ids: [1858,8373,38356,91314,335988,424783,667538] },
  finaldest:    { title: '💀 Final Destination',       type: 'movie', ids: [9532,9358,9286,19912,55779,574475] },
  goosebumps:   { title: '👻 Goosebumps',              type: 'movie', ids: [257445] },
  hunger:       { title: '🏹 Hunger Games',          type: 'movie', ids: [70160,70161,70162,70163,653346] },
  johnwick:     { title: '🔫 John Wick',             type: 'movie', ids: [245891,302694,458156,748822] },
  diehard:      { title: '🏢 Die Hard',              type: 'movie', ids: [366,367,368,369] },
  harrypotter:  { title: '⚡ Harry Potter',            type: 'movie', ids: [671,672,673,674,675,767,12444,12445] },
  mib:          { title: '🕶️ Men in Black',          type: 'movie', ids: [608,609,610,43964,457232] },
  indiana:      { title: '🤠 Indiana Jones',          type: 'movie', ids: [85,86,87,335,335784] },
  backfuture:   { title: '⚡ Back to the Future',    type: 'movie', ids: [8,9,10] },
  toy:          { title: '🧸 Toy Story',              type: 'movie', ids: [862,863,10193,12,326473] },
  shrek:        { title: '🧅 Shrek',                  type: 'movie', ids: [812,809,810,10340,8587] },
  viewAskew:    { title: '🧢 Jay & Silent Bob / View Askew', type: 'movie', ids: [2292,2293,2255,1832,2294,2295,158011,446159,635731] },

  // ── TV FRANCHISES ──
  theboys:    { title: '💥 The Boys',          type: 'tv', ids: [76479], seasons: { 1: 8, 2: 8, 3: 8, 4: 8, 5: 8 } },
  csiny:      { title: '🔬 CSI: NY',            type: 'tv', ids: [4626] },
  csicyber:   { title: '💻 CSI: Cyber',           type: 'tv', ids: [55316] },
  csi:        { title: '🔍 CSI: Vegas',            type: 'tv', ids: [2287,102022] },
  breaking:   { title: '🧪 Breaking Bad Universe', type: 'tv', ids: [1396,60059] },
  got:        { title: '🐉 Game of Thrones',       type: 'tv', ids: [1399] },
  stranger:   { title: '👾 Stranger Things',        type: 'tv', ids: [66732] },
  witcher:    { title: '⚔️ The Witcher',           type: 'tv', ids: [67915] },
  mandalorian:{ title: '🚀 The Mandalorian',      type: 'tv', ids: [82856] },
  southpark:  { title: '🗺️ South Park',            type: 'tv', ids: [2190] },
  rickmorty:  { title: '🔬 Rick and Morty',        type: 'tv', ids: [60625] },
  office:     { title: '📝 The Office',             type: 'tv', ids: [2316] },
  brooklyn9:  { title: '👮 Brooklyn Nine-Nine',     type: 'tv', ids: [45793] },
  livepd:     { title: '🚔 Live PD & Crime TV',     type: 'tv', ids: [67158,71663,85968,89826,94555] },
  trutv:      { title: '📺 True Crime & Investigation', type: 'tv', ids: [4087,2615,2734,1100,4614,202250,1622,2478,1396,71912] },

  // ── STREAMING TV FRANCHISES ──
  hotd:       { title: '🐉 House of the Dragon',      type: 'tv', ids: [94997], seasons: { 1: 10, 2: 8 } },
  lastofus:   { title: '🧟 The Last of Us',           type: 'tv', ids: [100088], seasons: { 1: 9, 2: 7 } },
  severance:  { title: '🏢 Severance',                type: 'tv', ids: [93440], seasons: { 1: 9, 2: 10 } },
  succession: { title: '💰 Succession',               type: 'tv', ids: [84946], seasons: { 1: 10, 2: 9, 3: 9, 4: 10 } },
  tedlasso:   { title: '⚽ Ted Lasso',                type: 'tv', ids: [110392], seasons: { 1: 10, 2: 12, 3: 12 } },
  thebear:    { title: '🔥 The Bear',                 type: 'tv', ids: [144014], seasons: { 1: 8, 2: 10, 3: 10 } },
  shogun:     { title: '🏯 Shogun',                    type: 'tv', ids: [114709], seasons: { 1: 10 } },
  peacemaker:{ title: '🦸 Peacemaker',                type: 'tv', ids: [90467], seasons: { 1: 8 } },
  thepenguin:{ title: '🧊 The Penguin',                type: 'tv', ids: [93955], seasons: { 1: 8 } },
  andor:     { title: '⚔️ Andor',                     type: 'tv', ids: [82857], seasons: { 1: 12, 2: 12 } },
  ahsoka:    { title: '⚡ Ahsoka',                    type: 'tv', ids: [82493], seasons: { 1: 8 } },
  silo:      { title: '🏗️ Silo',                      type: 'tv', ids: [125549], seasons: { 1: 10, 2: 10 } },
  slowhorses:{ title: '🐴 Slow Horses',                type: 'tv', ids: [93740], seasons: { 1: 6, 2: 6, 3: 6, 4: 6 } },
  whitelotus:{ title: '🏝️ The White Lotus',            type: 'tv', ids: [96077], seasons: { 1: 6, 2: 7, 3: 8 } },
  euphoria:  { title: '💜 Euphoria',                   type: 'tv', ids: [92877], seasons: { 1: 8, 2: 8 } },
  yellowstone:{title: '🤠 Yellowstone',                type: 'tv', ids: [89515], seasons: { 1: 9, 2: 10, 3: 10, 4: 10, 5: 14 } },
  tulaking:  { title: '🎩 Tulsa King',                 type: 'tv', ids: [89123], seasons: { 1: 9, 2: 10 } },
  snowfall:  { title: '❄️ Snowfall',                   type: 'tv', ids: [62827], seasons: { 1: 10, 2: 10, 3: 10, 4: 10, 5: 10, 6: 10 } },
  the100:    { title: '🌍 The 100',                      type: 'tv', ids: [319],  seasons: { 1: 13, 2: 16, 3: 16, 4: 13, 5: 13, 6: 13, 7: 16 } },
  password:  { title: '🔐 Password',                     type: 'tv', ids: [204013], seasons: { 1: 10, 2: 10, 3: 8 } },
  supergirl: { title: '🦸‍♀️ Supergirl',                   type: 'tv', ids: [62690], seasons: { 1: 20, 2: 22, 3: 23, 4: 22, 5: 19, 6: 20 } },

  // ── JUNE 2025 DROPS ──
  severance2: { title: '🏢 Severance S2',                type: 'tv', ids: [93440],  seasons: { 1: 9, 2: 10 } },
  whiteLotus3: { title: '🏝️ White Lotus S3',              type: 'tv', ids: [96077],  seasons: { 1: 6, 2: 7, 3: 8 } },
  lastOfUs2:  { title: '🧟 The Last of Us S2',              type: 'tv', ids: [100088], seasons: { 1: 9, 2: 7 } },
  andor2:     { title: '🚀 Andor S2',                       type: 'tv', ids: [82857],  seasons: { 1: 12, 2: 12 } },
  Reacher3:   { title: '👊 Reacher S3',                      type: 'tv', ids: [111110], seasons: { 1: 8, 2: 8, 3: 8 } },
  invincible3:{ title: '💥 Invincible S3',                   type: 'tv', ids: [88854],  seasons: { 1: 8, 2: 8, 3: 8 } },
  slowHorses5:{ title: '🐴 Slow Horses S5',                  type: 'tv', ids: [93740],  seasons: { 1: 6, 2: 6, 3: 6, 4: 6, 5: 6 } },
  fallout2:   { title: '☢️ Fallout S2',                       type: 'tv', ids: [100423], seasons: { 1: 8, 2: 8 } },
  hotd3:      { title: '🐉 House of Dragon S3',               type: 'tv', ids: [94997],  seasons: { 1: 10, 2: 8, 3: 8 } },

  // ── NETFLIX TV FRANCHISES ──
  squidgame: { title: '🦑 Squid Game',               type: 'tv', ids: [93405], seasons: { 1: 9, 2: 7 } },
  wednesday: { title: '💀 Wednesday',                 type: 'tv', ids: [226641], seasons: { 1: 8, 2: 8 } },
  narcos:    { title: '💊 Narcos',                     type: 'tv', ids: [94671], seasons: { 1: 10, 2: 10, 3: 12 } },
  moneyheist:{ title: '🎭 Money Heist',                type: 'tv', ids: [71470], seasons: { 1: 13, 2: 9, 3: 5, 4: 5, 5: 5 } },
  bridgerton:{ title: '👑 Bridgerton',                 type: 'tv', ids: [71458], seasons: { 1: 8, 2: 8, 3: 8 } },
  you:       { title: '👀 You',                         type: 'tv', ids: [78191], seasons: { 1: 10, 2: 10, 3: 10, 4: 10 } },
  queenstgmbt:{title:'♟️ The Queen\'s Gambit',          type: 'tv', ids: [69583], seasons: { 1: 7 } },
  mindhunter:{ title: '🧠 Mindhunter',                  type: 'tv', ids: [94493], seasons: { 1: 10, 2: 8 } },
  arcadiantv:{ title: '🎮 Arcane',                      type: 'tv', ids: [71450], seasons: { 1: 9, 2: 9 } },
  bojack:    { title: '🐴 Bojack Horseman',              type: 'tv', ids: [80752], seasons: { 1: 12, 2: 12, 3: 12, 4: 12, 5: 16, 6: 16 } },

  // ── PRIME VIDEO TV FRANCHISES ──
  ringsofpower:{title:'💍 Rings of Power',             type: 'tv', ids: [89515], seasons: { 1: 8, 2: 8 } },
  jackryan: { title: '🕵️ Jack Ryan',                  type: 'tv', ids: [56739], seasons: { 1: 8, 2: 8, 3: 8, 4: 6 } },
  fleabag:  { title: '🍷 Fleabag',                     type: 'tv', ids: [69529], seasons: { 1: 6, 2: 6 } },
  maisel:   { title: '👗 The Marvelous Mrs. Maisel',   type: 'tv', ids: [73586], seasons: { 1: 8, 2: 10, 3: 8, 4: 8, 5: 9 } },
  invincible:{title: '💥 Invincible',                  type: 'tv', ids: [88854], seasons: { 1: 8, 2: 8, 3: 8 } },
  fallouttv:{ title: '☢️ Fallout',                     type: 'tv', ids: [100423], seasons: { 1: 8 } },
  reacher:  { title: '👊 Reacher',                     type: 'tv', ids: [111110], seasons: { 1: 8, 2: 8, 3: 8 } },
  bosch:    { title: '🔎 Bosch',                       type: 'tv', ids: [77526], seasons: { 1: 10, 2: 10, 3: 10, 4: 10, 5: 7, 6: 10, 7: 8 } },
  genv:     { title: '🩸 Gen V',                       type: 'tv', ids: [115545], seasons: { 1: 8, 2: 8 } },

  // ── MORE TV FRANCHISES ──
  peaky:      { title: '👞 Peaky Blinders',         type: 'tv', ids: [60574], seasons: { 1: 6, 2: 6, 3: 6, 4: 6, 5: 6, 6: 6 } },
  dark:       { title: '🕳️ Dark',                    type: 'tv', ids: [], seasons: { 1: 10, 2: 8, 3: 8 } },
  westworld:  { title: '🤖 Westworld',               type: 'tv', ids: [67195], seasons: { 1: 10, 2: 10, 3: 8, 4: 8 } },
  blackmirror:{ title: '📱 Black Mirror',            type: 'tv', ids: [60573], seasons: { 1: 3, 2: 3, 3: 6, 4: 6, 5: 6, 6: 5 } },
  ozark:      { title: '💰 Ozark',                    type: 'tv', ids: [71912], seasons: { 1: 10, 2: 10, 3: 10, 4: 14 } },
  vikings:    { title: '⚔️ Vikings',                 type: 'tv', ids: [62104], seasons: { 1: 9, 2: 10, 3: 10, 4: 20, 5: 20, 6: 20 } },
  dexter:     { title: '🩸 Dexter',                   type: 'tv', ids: [2478], seasons: { 1: 12, 2: 12, 3: 12, 4: 12, 5: 12, 6: 12, 7: 12, 8: 12, 9: 10 } },
  sherlock:   { title: '🔍 Sherlock',                type: 'tv', ids: [1622], seasons: { 1: 3, 2: 3, 3: 3, 4: 3 } },
  fargo:      { title: '❄️ Fargo',                    type: 'tv', ids: [44982], seasons: { 1: 10, 2: 10, 3: 10, 4: 11, 5: 10 } },
  trueblood:  { title: '🧛 True Blood',               type: 'tv', ids: [31602], seasons: { 1: 12, 2: 12, 3: 12, 4: 12, 5: 12, 6: 10, 7: 10 } },
  walkingdead:{ title: '🧟 The Walking Dead',        type: 'tv', ids: [1402], seasons: { 1: 6, 2: 13, 3: 16, 4: 16, 5: 16, 6: 16, 7: 16, 8: 16, 9: 16, 10: 22, 11: 24 } },
  bettercall: { title: '⚖️ Better Call Saul',        type: 'tv', ids: [60059], seasons: { 1: 10, 2: 10, 3: 10, 4: 10, 5: 13, 6: 13 } },
  homeland:   { title: '🇺🇸 Homeland',               type: 'tv', ids: [57516], seasons: { 1: 12, 2: 12, 3: 12, 4: 12, 5: 12, 6: 13, 7: 12, 8: 12 } },
  cobraKai:   { title: '🥋 Cobra Kai',                type: 'tv', ids: [70548], seasons: { 1: 10, 2: 10, 3: 10, 4: 10, 5: 10, 6: 10 } },
  umbrellas:  { title: '☂️ Umbrella Academy',         type: 'tv', ids: [82819], seasons: { 1: 10, 2: 10, 3: 10, 4: 6 } },
  teotfw:     { title: '💔 The End of the F***ing World', type: 'tv', ids: [71457], seasons: { 1: 8, 2: 8 } },
  darkMoney:  { title: '🃏 Money Heist: Korea',       type: 'tv', ids: [], seasons: { 1: 12, 2: 6 } },

  // ── ANIME TV ──
  aot:        { title: '⚔️ Attack on Titan',         type: 'tv', ids: [1429], seasons: { 1: 25, 2: 12, 3: 16, 4: 28 } },
  jjk:        { title: '👁️ Jujutsu Kaisen',           type: 'tv', ids: [], seasons: { 1: 24, 2: 23 } },
  demonSlayer:{ title: '🍣 Demon Slayer',             type: 'tv', ids: [], seasons: { 1: 26, 2: 7, 3: 11, 4: 8 } },
  spyFamily:  { title: '🕵️ Spy x Family',             type: 'tv', ids: [], seasons: { 1: 12, 2: 12, 3: 12 } },
  onePiece:   { title: '🏴‍☠️ One Piece',                type: 'tv', ids: [37854], seasons: { 1: 61 } },
  mha:        { title: '🦸 My Hero Academia',         type: 'tv', ids: [], seasons: { 1: 13, 2: 25, 3: 25, 4: 25, 5: 25, 6: 25, 7: 21 } },
  chainsawman:{ title: '🪚 Chainsaw Man',              type: 'tv', ids: [125140], seasons: { 1: 12 } },

  // ── FRESH 2020s TV FRANCHISES ──
  beef:       { title: '🥩 Beef',                        type: 'tv', ids: [216759], seasons: { 1: 10 } },
  whiteLotus: { title: '🏝️ White Lotus',                type: 'tv', ids: [96077], seasons: { 1: 6, 2: 7, 3: 8 } },
  sho:        { title: '🏯 Shogun (2024)',                type: 'tv', ids: [114709], seasons: { 1: 10 } },
  bear:       { title: '🔥 The Bear',                     type: 'tv', ids: [144014], seasons: { 1: 8, 2: 10, 3: 10 } },
  silo:       { title: '🏗️ Silo',                         type: 'tv', ids: [125549], seasons: { 1: 10, 2: 10 } },
  slowHorses: { title: '🐴 Slow Horses',                  type: 'tv', ids: [93740], seasons: { 1: 6, 2: 6, 3: 6, 4: 6 } },
  fallout:    { title: '☢️ Fallout',                      type: 'tv', ids: [100423], seasons: { 1: 8 } },
  reacher:    { title: '👊 Reacher',                      type: 'tv', ids: [111110], seasons: { 1: 8, 2: 8, 3: 8 } },
  penguin:    { title: '🧊 The Penguin',                  type: 'tv', ids: [93955], seasons: { 1: 8 } },
  lastOfUs:   { title: '🧟 The Last of Us',              type: 'tv', ids: [100088], seasons: { 1: 9, 2: 7 } },
  hotd:       { title: '🐉 House of Dragon',              type: 'tv', ids: [94997], seasons: { 1: 10, 2: 8 } },
  severance:  { title: '🏢 Severance',                   type: 'tv', ids: [93440], seasons: { 1: 9, 2: 10 } },
  succession: { title: '💰 Succession',                   type: 'tv', ids: [84946], seasons: { 1: 10, 2: 9, 3: 9, 4: 10 } },
  yellowjacket:{title: '🐝 Yellowjackets',               type: 'tv', ids: [94306], seasons: { 1: 10, 2: 9, 3: 10 } },
  invincible: { title: '💪 Invincible',                   type: 'tv', ids: [88854], seasons: { 1: 8, 2: 8, 3: 8 } },
  squidGame:  { title: '🦑 Squid Game',                   type: 'tv', ids: [93405], seasons: { 1: 9, 2: 7 } },
  wednesday:  { title: '💀 Wednesday',                    type: 'tv', ids: [226641], seasons: { 1: 8, 2: 8 } },
  arcane:     { title: '🎮 Arcane',                       type: 'tv', ids: [71450], seasons: { 1: 9, 2: 9 } },
  tedLasso:   { title: '⚽ Ted Lasso',                    type: 'tv', ids: [110392], seasons: { 1: 10, 2: 12, 3: 12 } },
  euphoria:   { title: '💜 Euphoria',                     type: 'tv', ids: [92877], seasons: { 1: 8, 2: 8 } },
  ringsPower: { title: '💍 Rings of Power',               type: 'tv', ids: [89515], seasons: { 1: 8, 2: 8 } },
  tulsaKing:  { title: '🎩 Tulsa King',                   type: 'tv', ids: [89123], seasons: { 1: 9, 2: 10 } },
  genV:       { title: '🩸 Gen V',                        type: 'tv', ids: [115545], seasons: { 1: 8, 2: 8 } },
  threeBody:  { title: '🌌 3 Body Problem',               type: 'tv', ids: [130002], seasons: { 1: 8 } },
  monkey:     { title: '🐒 Monarch: Legacy',              type: 'tv', ids: [119225], seasons: { 1: 10 } },
  halo:       { title: '🪖 Halo',                         type: 'tv', ids: [], seasons: { 1: 9, 2: 8 } },
  periphery:  { title: '🔄 The Peripheral',              type: 'tv', ids: [102911], seasons: { 1: 8 } },
  scorpion:   { title: '🦂 Scorpion',                     type: 'tv', ids: [], seasons: { 1: 22, 2: 24, 3: 26, 4: 23 } },
  manifest:   { title: '✈️ Manifest',                    type: 'tv', ids: [82856], seasons: { 1: 16, 2: 15, 3: 13, 4: 20 } },
  nightAgent: { title: '🕵️ Night Agent',                  type: 'tv', ids: [], seasons: { 1: 10, 2: 10 } },
  rabbitHole: { title: '🐇 Rabbit Hole',                 type: 'tv', ids: [], seasons: { 1: 8 } },
  citadel:    { title: '🏰 Citadel',                      type: 'tv', ids: [], seasons: { 1: 6 } },
  theDiplomat:{ title: '🌍 The Diplomat',                type: 'tv', ids: [216759], seasons: { 1: 8, 2: 6 } },
  fast_x: { title: "🏎️ Fast & Furious Saga", type: "movie", ids: [979,9799,260513,260514,260515,337339,508439,385687,748822] },
  transporter: { title: "🚗 Transporter Collection", type: "movie", ids: [7216,7217,7218] },
  taken: { title: '👤 Taken Trilogy', type: 'movie', ids: [8681,82675,1586047] },
  it: { title: '🎈 IT Duology', type: 'movie', ids: [346364,474350] },
  hunger_games: { title: "🏹 Hunger Games Saga", type: "movie", ids: [131631,131634,131635,131636,445671] },
  rec: { title: "🧟 [REC] Collection", type: "movie", ids: [10345,10346,10347] },
  host_2020: { title: "💻 Host (2020)", type: "movie", ids: [701814] },
  spiderverse: { title: "🕷️ Spider-Verse Duology", type: "movie", ids: [324857,616037] },
  incredibles: { title: "🦸 The Incredibles Duology", type: "movie", ids: [920,926] },
  finding: { title: "🐟 Finding Nemo/Dory", type: "movie", ids: [12,127380] },
  monsters: { title: "👁️ Monsters Inc Duology", type: "movie", ids: [585,586] },
  frozen: { title: "❄️ Frozen Duology", type: "movie", ids: [109445,330457] },
  httyd: { title: "🐉 How to Train Your Dragon", type: "movie", ids: [10191] },
  studio_ghibli: { title: "⛩️ Studio Ghibli", type: "movie", ids: [129,124,5140,4935,2210,10393,20530] },
  korean_cinema: { title: "🇰🇷 Korean Cinema", type: "movie", ids: [496243,670,396535,348338,843278] },
  anime_movies: { title: "🇯🇵 Anime Films", type: "movie", ids: [149,541,372058,843278,95557] },
  die_hard: { title: "🏢 Die Hard Collection", type: "movie", ids: [1562,367,368,369,3691] },
  predator_series: { title: "🔴 Predator Collection", type: "movie", ids: [106,275,87101,566525] },
  tv_thriller: { title: "😱 Thriller TV", type: "tv", ids: [71912,82856,2478,1622,57243] },
  tv_comedy: { title: "😂 Comedy TV", type: "tv", ids: [82819,97797,88446,70548] },
  tv_superhero: { title: "🦸 Superhero TV", type: "tv", ids: [77169,85946,88396,705861,67915] },
  tv_scifi: { title: "🚀 Sci-Fi TV", type: "tv", ids: [66732,60573,82819,44217] },
  tv_horror: { title: "👻 Horror TV", type: "tv", ids: [143,66732,97797] },
  top_gun: { title: '✈️ Top Gun', type: 'movie', ids: [87421,361743] },
  mad_max_series: { title: '🔥 Mad Max', type: 'movie', ids: [76341,1015163] },
  spiderman_holland: { title: "🕷️ Spider-Man (MCU)", type: "movie", ids: [315634,429617,634649] },
  creed: { title: '🥊 Creed Series', type: 'movie', ids: [312221,396535,614933] },
  releases_2025: { title: "🆕 2025 New Releases", type: "movie", ids: [1061474,986056,575265,552524,541671,1011477,574475,617126,1087891,1241436,648878,931285,1228710,1314481,1083381,1084244,454639,1273221,1280738,872585,945961,533535,1022789,1075200,1233413,870028,1087192,911430,1100988,83533,1054867,1317288,1078605,1368166,798645,1214931,701387,1266127,822119,1307769,967851,1318222,1195392,1320726,1315868,1264177,1037682,1113356,1035575,1075180,1260749,1072791,949242,1253218,1100902,94919] },
  releases_2026: { title: "🔥 2026 New Releases", type: "movie", ids: [687163,1330021,1318413,1339713,1325734,1340206,1318447,1390300,1227877,1119449,1263012,1171145,1198994,1242265,1301421,1304313,1116201,1290821,1548113,1297842] },
  releases_2024: { title: "🎬 2024 Blockbusters", type: "movie", ids: [933280,948535,787556,926337,942085,949896,573435,946355,988038,1059051,1020090,929599,937281,934739,950960,956732,901319,933317,920911,937278,937318,972311,1008387,980481,955036,949971,940632,1018609,1008158,992607,991734,972341,967124,980494,924314,920808,936231,940726,968051,693134,1022789,823463,1015163,533535,956837,939333,1008387,1013485] },
  modern_classics: { title: "⭐ Modern Classics 2018-2023", type: "movie", ids: [984772,900149,634492,843265,900176,774752,680864,674324,739405,724494,999543,597526,530451,574754,458156,761652,705964,621326,567084,526896,507569,640342,614533,592643,519182,561152,447404,414901,453539,475557,522478,447332,453306,438148,493922,420617,420616,420818] },
  best_picture: { title: "🏆 Best Picture Winners", type: "movie", ids: [278,238,13,497,424,68718,92607,872585,496243] },
  crime_classics: { title: "🔫 Crime Classics", type: "movie", ids: [769,947,500,111,611,324786,292] },
  springBreakers: { title: "🌴 Spring Breakers", type: "movie", ids: [122081] },
  mob_drama: { title: "🎩 Mob/Gangster", type: "movie", ids: [769,238,240,242,496243,872585,68718] },
  war_films: { title: "🎖️ War Films", type: "movie", ids: [857,346364,324786,228165,1094,24264] },
  modern_horror: { title: "👻 Modern Horror A24", type: "movie", ids: [480530,527771] },
  comedy_classics: { title: "😂 Comedy Classics", type: "movie", ids: [115,5965,54339,120467,275,72162] },
  rom_com: { title: "💕 Rom-Com Collection", type: "movie", ids: [597,9476,313369,348338,54339,136497] },
};

// ── SHOW DATABASE (for TV show rows) ──
const SHOW_DATABASE = {
  action:   { title: '💥 Action & Thriller TV', shows: [{id:76479,name:'The Boys'},{id:1399,name:'Game of Thrones'},{id:82856,name:'Peaky Blinders'},{id:66732,name:'Stranger Things'},{id:70536,name:'Dark'},{id:57243,name:'House of Cards'},{id:60573,name:'Black Mirror'},{id:67915,name:'The Witcher'},{id:88396,name:'Falcon & Winter Soldier'},{id:93484,name:'Loki'},{id:77169,name:'Daredevil'},{id:62104,name:'Vikings'},{id:62710,name:'Knightfall'},{id:71912,name:'Ozark'},{id:82819,name:'The Umbrella Academy'}] },
  crime:    { title: '🔫 Crime & Investigation', shows: [{id:4626,name:'CSI: NY'},{id:55316,name:'CSI: Cyber'},{id:102022,name:'CSI: Vegas'},{id:4614,name:'Criminal Minds'},{id:202250,name:'Criminal Minds: Evolution'},{id:1622,name:'Sherlock'},{id:2478,name:'Dexter'},{id:1396,name:'Breaking Bad'},{id:71912,name:'Ozark'},{id:82856,name:'Peaky Blinders'},{id:1100,name:'NCIS'},{id:2615,name:'Law & Order: SVU'},{id:2734,name:'Law & Order'},{id:4087,name:'Forensic Files'}] },
  comedy:   { title: '😂 Comedy TV', shows: [{id:2190,name:'South Park'},{id:1434,name:'Family Guy'},{id:60625,name:'Rick and Morty'},{id:2316,name:'The Office'},{id:45793,name:'Brooklyn Nine-Nine'},{id:48891,name:'The Good Place'},{id:1668,name:'Friends'},{id:590,name:'Seinfeld'},{id:48883,name:'Schitt\'s Creek'},{id:70548,name:'Cobra Kai'},{id:82819,name:'The Umbrella Academy'}] },
  scifi:    { title: '🚀 Sci-Fi TV', shows: [{id:66732,name:'Stranger Things'},{id:70536,name:'Dark'},{id:60573,name:'Black Mirror'},{id:1399,name:'Game of Thrones'},{id:67915,name:'The Witcher'},{id:71446,name:'Gravity Falls'},{id:46260,name:'Doctor Who'},{id:103516,name:'Star Wars: Bad Batch'},{id:67195,name:'Westworld'},{id:71912,name:'Ozark'},{id:82856,name:'Peaky Blinders'}] },
  anime:    { title: '🎌 Anime', shows: [{id:37854,name:'One Piece'},{id:12971,name:'Dragon Ball Z'},{id:8592,name:'Naruto'},{id:1429,name:'Attack on Titan'},{id:100283,name:'Jujutsu Kaisen'},{id:125141,name:'Spy x Family'},{id:104281,name:'Demon Slayer'},{id:31911,name:'My Hero Academia'},{id:62104,name:'Vikings'}] },
  reality:  { title: '🚔 Reality & True Crime', shows: [{id:67158,name:'Cops'},{id:71663,name:'Live PD'},{id:85968,name:'Panic'},{id:89826,name:'61st Street'},{id:94555,name:'Accused'},{id:4087,name:'Forensic Files'},{id:4614,name:'Criminal Minds'},{id:1100,name:'NCIS'},{id:2615,name:'Law & Order: SVU'}] },
  drama:    { title: '🎭 Drama TV', shows: [{id:1396,name:'Breaking Bad'},{id:1399,name:'Game of Thrones'},{id:71912,name:'Ozark'},{id:82856,name:'Peaky Blinders'},{id:1622,name:'Sherlock'},{id:2478,name:'Dexter'},{id:82819,name:'The Umbrella Academy'},{id:66732,name:'Stranger Things'},{id:67915,name:'The Witcher'},{id:57243,name:'House of Cards'}] },

  // ── NEW: STREAMING ORIGINALS TV ──
  netflixTv:     { title: '🔴 Netflix Original TV', shows: [{id:93405,name:'Squid Game'},{id:226641,name:'Wednesday'},{id:94671,name:'Narcos'},{id:71470,name:'Money Heist'},{id:80752,name:'Bojack Horseman'},{id:94493,name:'Mindhunter'},{id:65708,name:'Orange Is the New Black'},{id:71450,name:'Arcane'},{id:71946,name:'Elite'},{id:84909,name:'Lupin'},{id:69583,name:'The Queen\'s Gambit'},{id:78191,name:'You'},{id:71458,name:'Bridgerton'},{id:89612,name:'The Haunting of Hill House'},{id:35581,name:'Castlevania'},{id:84958,name:'Love, Death & Robots'}] },
  primeTv:      { title: '🟣 Prime Video Original TV', shows: [{id:89515,name:'Rings of Power'},{id:56739,name:'Jack Ryan'},{id:69529,name:'Fleabag'},{id:73586,name:'Mrs. Maisel'},{id:88854,name:'Invincible'},{id:100423,name:'Fallout'},{id:88582,name:'Hunters'},{id:77526,name:'Bosch'},{id:111110,name:'Reacher'},{id:126573,name:'Citadel'},{id:115545,name:'Gen V'},{id:112830,name:'Carnival Row'},{id:84243,name:'Hanna'}] },
  hboMax:       { title: '🟤 HBO & Max Original TV', shows: [{id:94997,name:'House of the Dragon'},{id:84946,name:'Succession'},{id:93440,name:'Severance'},{id:96077,name:'The White Lotus'},{id:92877,name:'Euphoria'},{id:90467,name:'Peacemaker'},{id:93955,name:'The Penguin'},{id:89515,name:'Yellowstone'},{id:89123,name:'Tulsa King'}] },
  disneyPlus:   { title: '🔵 Disney+ Original TV', shows: [{id:82857,name:'Andor'},{id:82493,name:'Ahsoka'},{id:128697,name:'The Acolyte'},{id:82856,name:'Mandalorian'},{id:71450,name:'Arcane'},{id:125549,name:'Silo'}] },
  appleTv:      { title: '⬛ Apple TV+ Originals', shows: [{id:93740,name:'Slow Horses'},{id:110392,name:'Ted Lasso'},{id:125549,name:'Silo'},{id:125445,name:'Pachinko'},{id:114709,name:'Shogun'}] },
  prestige:    { title: '🏆 Prestige TV', shows: [{id:84946,name:'Succession'},{id:93440,name:'Severance'},{id:144014,name:'The Bear'},{id:114709,name:'Shogun'},{id:94997,name:'House of the Dragon'},{id:100088,name:'The Last of Us'},{id:84946,name:'Succession'},{id:94306,name:'Yellowjackets'}] },

  // ── MORE TV CATEGORIES ──
  thrillerTv: { title: '🔪 Thriller TV', shows: [{id:2478,name:'Dexter'},{id:71912,name:'Ozark'},{id:60574,name:'Peaky Blinders'},{id:1622,name:'Sherlock'},{id:44982,name:'Fargo'},{id:60059,name:'Better Call Saul'},{id:78191,name:'You'},{id:57516,name:'Homeland'},{id:84909,name:'Lupin'},{id:78191,name:'You'}] },
  fantasyTv:  { title: '🧙 Fantasy TV', shows: [{id:1399,name:'Game of Thrones'},{id:94997,name:'House of the Dragon'},{id:67915,name:'The Witcher'},{id:82856,name:'Mandalorian'},{id:66732,name:'Stranger Things'},{id:71450,name:'Arcane'},{id:89515,name:'Rings of Power'},{id:93405,name:'Squid Game'}] },
  animeTv:    { title: '🎌 Anime TV', shows: [{id:37854,name:'One Piece'},{id:12971,name:'Dragon Ball Z'},{id:8592,name:'Naruto'},{id:1429,name:'Attack on Titan'},{id:100283,name:'Jujutsu Kaisen'},{id:125141,name:'Spy x Family'},{id:104281,name:'Demon Slayer'},{id:31911,name:'My Hero Academia'},{id:125140,name:'Chainsaw Man'},{id:71450,name:'Arcane'}] },
  sitcoms:    { title: '📺 Classic Sitcoms', shows: [{id:1668,name:'Friends'},{id:590,name:'Seinfeld'},{id:2316,name:'The Office'},{id:45793,name:'Brooklyn Nine-Nine'},{id:1434,name:'Family Guy'},{id:2190,name:'South Park'},{id:60625,name:'Rick and Morty'},{id:48883,name:'Schitt\'s Creek'},{id:48891,name:'The Good Place'},{id:80752,name:'Bojack Horseman'}] },
  horrorTv:   { title: '👻 Horror TV', shows: [{id:31602,name:'True Blood'},{id:1402,name:'The Walking Dead'},{id:66732,name:'Stranger Things'},{id:89612,name:'The Haunting of Hill House'},{id:92877,name:'Euphoria'},{id:67158,name:'Cops'},{id:71457,name:'The End of the F***ing World'}] },

  // ── 2020s TV SHOWS ──
  fresh2020sTv:    { title: '🔥 Fresh 2020s TV', shows: [{id:93440,name:'Severance'},{id:144014,name:'The Bear'},{id:114709,name:'Shogun'},{id:100088,name:'The Last of Us'},{id:94997,name:'House of the Dragon'},{id:84946,name:'Succession'},{id:216759,name:'Beef'},{id:96077,name:'White Lotus'},{id:100423,name:'Fallout'},{id:111110,name:'Reacher'},{id:93955,name:'The Penguin'},{id:93405,name:'Squid Game'},{id:226641,name:'Wednesday'},{id:71450,name:'Arcane'},{id:130002,name:'3 Body Problem'},{id:204648,name:'Night Agent'}] },
  appleTvPlus:    { title: '⬛ Apple TV+ Hits', shows: [{id:93740,name:'Slow Horses'},{id:110392,name:'Ted Lasso'},{id:125549,name:'Silo'},{id:125445,name:'Pachinko'},{id:114709,name:'Shogun'},{id:216759,name:'The Diplomat'},{id:102911,name:'The Peripheral'},{id:197627,name:'Rabbit Hole'},{id:130002,name:'3 Body Problem'}] },
  paramount:      { title: '🔵 Paramount+ Shows', shows: [{id:89515,name:'Yellowstone'},{id:89123,name:'Tulsa King'},{id:119225,name:'Monarch: Legacy'},{id:71446,name:'Halo'},{id:61533,name:'Scorpion'},{id:2287,name:'CSI'},{id:102022,name:'CSI: Vegas'}] },
};

// ── GENRE MAP (TMDB genre IDs for discover) ──
const GENRE_MAP = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance',
  878: 'Sci-Fi', 10752: 'War', 37: 'Western', 53: 'Thriller'
};

// ── FALLBACK DATA (used when no API key) ──
const CURATED_FALLBACK = [
  { id: 454639, title: 'Masters of the Universe',     year: 2026, rating: 0,   poster: '/bQ6eDYNXhhM4EnSAab6p0fHr7OC.jpg' },
  { id: 550,  title: 'Fight Club',            year: 1999, rating: 8.4, poster: '/pzVrdfChS3rE8hWylxBHHO0X3qL.jpg' },
  { id: 278,  title: 'The Shawshank Redemption', year: 1994, rating: 8.7, poster: '/q6y0GoHJ1qXXaQ3Y0vp3L1tdO6q.jpg' },
  { id: 155,  title: 'The Dark Knight',       year: 2008, rating: 8.5, poster: '/qJ2tW6WMUDux911BTUgMJolZGYh.jpg' },
  { id: 603,  title: 'The Matrix',            year: 1999, rating: 8.2, poster: '/f89U0ADeTa5cI9F5y0r3W0WlGGIf.jpg' },
  { id: 238,  title: 'The Godfather',          year: 1972, rating: 8.7, poster: '/3bhkrj58Vtu7nYhNZ1XT7G2so7K.jpg' },
  { id: 496243, title: 'Parasite',            year: 2019, rating: 8.5, poster: '/7IiTTgloJzZPJ4Z7Pm8Vzl7FFZM.jpg' },
  { id: 157336, title: 'Interstellar',         year: 2014, rating: 8.1, poster: '/gEU2QniE6E77NI6ot8h3FEoAqk6.jpg' },
  { id: 497,  title: 'The Green Mile',        year: 1999, rating: 8.1, poster: '/velWPhDMr7JK7D5dh3jQ9R6dF0C.jpg' },
  { id: 680,  title: 'Pulp Fiction',           year: 1994, rating: 8.3, poster: '/d5iIlFn5s0ImszYzBPb8JPIh6Mh.jpg' },
  { id: 13,   title: 'Forrest Gump',           year: 1994, rating: 8.2, poster: '/arw2vcBveWOVZr6xsR8MtVT7Y3Z.jpg' },
  { id: 947,  title: 'Fast & Furious',         year: 2001, rating: 6.5, poster: '/r8N2ogP7EOaFQEfVyQHsV4A33KA.jpg' },
  { id: 293660, title: 'Deadpool',            year: 2016, rating: 7.6, poster: '/inVq3FRqcYIRl2dl8YBR6UuKiVO.jpg' },
  { id: 533535, title: 'Deadpool & Wolverine', year: 2024, rating: 7.7, poster: '/8cdWv0e6jJNxP2GqO0U3Q2V6CSB.jpg' },
  { id: 122,  title: 'LOTR: Return of the King', year: 2003, rating: 8.9, poster: '/rCzpDGLbOoP3S6gGBkFcl2sMMl.jpg' },
  { id: 11,   title: 'Star Wars',             year: 1977, rating: 8.2, poster: '/6FfR4GDGcUQSt8N5ElaOQm1y7R9.jpg' },
  { id: 218,  title: 'The Terminator',         year: 1984, rating: 8.1, poster: '/q8VJ6pOJo0w4A8h76Y9yF9P7XeR.jpg' },
  { id: 245891, title: 'John Wick',           year: 2014, rating: 7.4, poster: '/fZPSd91yGE9D6E7WZxVPYdPvGfu.jpg' },
  { id: 223702, title: 'Sausage Party',       year: 2016, rating: 5.8, poster: 'https://images.metahub.space/poster/medium/tt1700841/img' },
  // ── 2020s NEW FALLBACK ENTRIES ──
  { id: 872585,  title: 'Oppenheimer',          year: 2023, rating: 8.3, poster: '/8Gxv8gSME1rEjtQfG0G3eE5L5Z.jpg' },
  { id: 346672,  title: 'Barbie',              year: 2023, rating: 7.0, poster: '/iuFNMS8U5cb6xfzi51dykFm0XyG.jpg' },
  { id: 693134,  title: 'Dune: Part Two',      year: 2024, rating: 8.5, poster: '/8b8R8l88Qje9dn9OE8PY05NeH7R.jpg' },
  { id: 545611,  title: 'Everything Everywhere All at Once', year: 2022, rating: 7.8, poster: '/f4O3Q9LRzkqX1j0J3hZ2YJazGxG.jpg' },
  { id: 361743,  title: 'Top Gun: Maverick',   year: 2022, rating: 8.2, poster: '/Aa9RRYdSba2lTRTRpL0GmyVH3EV.jpg' },
  { id: 576049,  title: 'Drive My Car',        year: 2021, rating: 7.6, poster: '/fYf5kq2k6M1kB5JjLgNnXqAnWJY.jpg' },
  { id: 666277,  title: 'Past Lives',          year: 2023, rating: 7.8, poster: '/4vojVJhFB6fUMV0g2J3wPM4t5J5.jpg' },
  { id: 792307,  title: 'Poor Things',         year: 2023, rating: 7.9, poster: '/kCGlIMHnOm8c2siF1r3Uh7Qi3e2.jpg' },
  { id: 968558,  title: 'Conclave',            year: 2024, rating: 7.5, poster: '/bR4JY5i0m3Y3VZ3Y9cKtR1e5xGZ.jpg' },
  { id: 906311,  title: 'The Substance',       year: 2024, rating: 7.1, poster: '/lYp2cW1f0nJ0t8Q9x9a2f3e4r5t.jpg' },
  { id: 949145,  title: 'Anora',               year: 2024, rating: 7.6, poster: '/bY9V2p4s5q8t1w3x5y7z9a0b1c2.jpg' },
  { id: 822119,  title: 'The Brutalist',       year: 2024, rating: 7.8, poster: '/c3A4B5C6D7E8F9G0H1I2J3K4L5.jpg' },
  { id: 533535,  title: 'Deadpool & Wolverine', year: 2024, rating: 7.7, poster: '/8cdWv0e6jJNxP2GqO0U3Q2V6CSB.jpg' },
  { id: 1022789, title: 'Inside Out 2',       year: 2024, rating: 7.5, poster: '/vp3L1tdO6qY0GoHJ1qXXaQ3Y0.jpg' },
  { id: 786892,  title: 'Furiosa',             year: 2024, rating: 7.4, poster: '/i5I3U2M1k3hZ2YJazGxGf4O3Q9LR.jpg' },
  { id: 948849,  title: 'Alien: Romulus',      year: 2024, rating: 7.2, poster: '/bW3B4b6R8Qje9dn9OE8PY05NeH7R.jpg' },
  { id: 76600,   title: 'Avatar: Way of Water',year: 2022, rating: 7.6, poster: '/t6HIQRUJcJ7m9B7G7R9n5k2k6M1k.jpg' },
  { id: 591781,  title: 'Spider-Verse 2',     year: 2023, rating: 8.4, poster: '/8V3cR9q0eH3u5f7i9o1s3t5u7w9.jpg' },
  { id: 447365,  title: 'Guardians Vol. 3',   year: 2023, rating: 8.0, poster: '/r2f3i4o5p6q7r8s9t0u1v2w3x4.jpg' },
  // ── 2025 TOP MOVIES ──
  { id: 950387,  title: 'A Minecraft Movie',   year: 2025, rating: 6.8, poster: '/placeholder.jpg' },
  { id: 552524,  title: 'Lilo & Stitch',       year: 2025, rating: 7.2, poster: '/placeholder.jpg' },
  { id: 575265,  title: 'Mission: Impossible – The Final Reckoning', year: 2025, rating: 7.8, poster: '/placeholder.jpg' },
  { id: 986056,  title: 'Thunderbolts*',        year: 2025, rating: 7.4, poster: '/placeholder.jpg' },
  { id: 1233413, title: 'Sinners',              year: 2025, rating: 7.9, poster: '/placeholder.jpg' },
  { id: 822119,  title: 'Captain America: Brave New World', year: 2025, rating: 6.5, poster: '/placeholder.jpg' },
  { id: 574475,  title: 'Final Destination: Bloodlines', year: 2025, rating: 6.9, poster: '/placeholder.jpg' },
  { id: 1087192, title: 'How to Train Your Dragon', year: 2025, rating: 7.5, poster: '/placeholder.jpg' },
  { id: 870028,  title: 'The Accountant 2',    year: 2025, rating: 7.3, poster: '/placeholder.jpg' },
  { id: 1234821, title: 'Jurassic World Rebirth', year: 2025, rating: 7.1, poster: '/placeholder.jpg' },
  { id: 911430,  title: 'F1',                  year: 2025, rating: 7.6, poster: '/placeholder.jpg' },
  { id: 1100988, title: '28 Years Later',      year: 2025, rating: 7.7, poster: '/placeholder.jpg' },
  { id: 1061474, title: 'Superman',            year: 2025, rating: 7.5, poster: '/placeholder.jpg' },
  { id: 986056,  title: 'Thunderbolts*',      year: 2025, rating: 7.4, poster: '/placeholder.jpg' },
  { id: 575265,  title: 'Mission: Impossible – The Final Reckoning', year: 2025, rating: 7.8, poster: '/placeholder.jpg' },
  { id: 541671,  title: 'Ballerina',            year: 2025, rating: 7.0, poster: '/placeholder.jpg' },
  { id: 1011477, title: 'Karate Kid: Legends',  year: 2025, rating: 7.2, poster: '/placeholder.jpg' },
  { id: 574475,  title: 'Final Destination: Bloodlines', year: 2025, rating: 6.9, poster: '/placeholder.jpg' },
  { id: 617126,  title: 'The Fantastic 4: First Steps', year: 2025, rating: 7.0, poster: '/placeholder.jpg' },
  { id: 1087891, title: 'The Amateur',           year: 2025, rating: 7.1, poster: '/placeholder.jpg' },
  { id: 1241436, title: 'Warfare',               year: 2025, rating: 7.3, poster: '/placeholder.jpg' },
  { id: 648878,  title: 'Eddington',             year: 2025, rating: 7.0, poster: '/placeholder.jpg' },
  { id: 931285,  title: 'Mortal Kombat II',      year: 2025, rating: 7.0, poster: '/placeholder.jpg' },
  { id: 1228710, title: 'The Mandalorian and Grogu', year: 2025, rating: 7.5, poster: '/placeholder.jpg' },
  { id: 1314481, title: 'The Devil Wears Prada 2', year: 2025, rating: 6.8, poster: '/placeholder.jpg' },
  { id: 1083381, title: 'Backrooms',              year: 2025, rating: 6.5, poster: '/placeholder.jpg' },
  { id: 1084244, title: 'Toy Story 5',             year: 2026, rating: 0,   poster: '/placeholder.jpg' },
  { id: 454639,  title: 'Masters of the Universe', year: 2026, rating: 0,  poster: '/bQ6eDYNXhhM4EnSAab6p0fHr7OC.jpg' },
  { id: 1273221, title: 'Scary Movie',             year: 2025, rating: 0,  poster: '/placeholder.jpg' },
  { id: 1280738, title: 'The Furious',             year: 2026, rating: 0,  poster: '/placeholder.jpg' },
  { id: 83533,   title: 'Avatar: Fire and Ash', year: 2025, rating: 7.8, poster: '/placeholder.jpg' },
  // ── 2025 JUNE DROPS ──
  { id: 1233413, title: 'Sinners',              year: 2025, rating: 7.9, poster: '/placeholder.jpg' },
  { id: 870028,  title: 'The Accountant 2',    year: 2025, rating: 7.3, poster: '/placeholder.jpg' },
  { id: 1087192, title: 'How to Train Your Dragon (Live)', year: 2025, rating: 7.5, poster: '/placeholder.jpg' },
  { id: 911430,  title: 'F1',                  year: 2025, rating: 7.6, poster: '/placeholder.jpg' },
  { id: 1100988, title: '28 Years Later',      year: 2025, rating: 7.7, poster: '/placeholder.jpg' },
  { id: 822119,  title: 'Captain America: Brave New World', year: 2025, rating: 6.5, poster: '/placeholder.jpg' },
  // ── 2025 JUNE-JULY NEW SCRAPES ──
  { id: 1307769, title: 'Mission: Impossible – The Final Reckoning', year: 2025, rating: 7.8, poster: '/placeholder.jpg' },
  { id: 967851,  title: 'Snow White',               year: 2025, rating: 4.5, poster: '/placeholder.jpg' },
  { id: 1318222, title: 'The Electric State',       year: 2025, rating: 6.2, poster: '/placeholder.jpg' },
  { id: 1195392, title: 'Clown in a Cornfield',     year: 2025, rating: 6.8, poster: '/placeholder.jpg' },
  { id: 1320726, title: 'Fear Street: Prom Queen',   year: 2025, rating: 6.0, poster: '/placeholder.jpg' },
  { id: 1315868, title: 'I Know What You Did Last Summer', year: 2025, rating: 6.5, poster: '/placeholder.jpg' },
  { id: 1264177, title: 'Downton Abbey: The Grand Finale', year: 2025, rating: 7.5, poster: '/placeholder.jpg' },
  { id: 1037682, title: 'Companion',                year: 2025, rating: 7.0, poster: '/placeholder.jpg' },
  { id: 1113356, title: 'Den of Thieves 2: Pantera', year: 2025, rating: 6.8, poster: '/placeholder.jpg' },
  { id: 1035575, title: 'Bugonia',                  year: 2025, rating: 7.4, poster: '/placeholder.jpg' },
  { id: 1075180, title: 'Bridget Jones: Mad About the Boy', year: 2025, rating: 6.9, poster: '/placeholder.jpg' },
  { id: 1260749, title: 'The Amateur',               year: 2025, rating: 7.2, poster: '/placeholder.jpg' },
  // ── 2025 NEW SCRAPES ──
  { id: 1054867, title: 'One Battle After Another', year: 2025, rating: 7.7, poster: '/placeholder.jpg' },
  { id: 1317288, title: 'Marty Supreme',            year: 2025, rating: 7.7, poster: '/placeholder.jpg' },
  { id: 1078605, title: 'Weapons',                 year: 2025, rating: 7.4, poster: '/placeholder.jpg' },
  { id: 1368166, title: 'The Housemaid',            year: 2025, rating: 6.8, poster: '/placeholder.jpg' },
  { id: 798645,  title: 'The Running Man',          year: 2025, rating: 6.4, poster: '/placeholder.jpg' },
  { id: 1214931, title: 'Nuremberg',               year: 2025, rating: 7.4, poster: '/placeholder.jpg' },
  { id: 701387,  title: 'Bugonia',                 year: 2025, rating: 7.4, poster: '/placeholder.jpg' },
  { id: 1266127, title: 'Ready or Not 2: Here I Come', year: 2026, rating: 6.6, poster: '/placeholder.jpg' },
  // ── 2026 NEW SCRAPES ──
  { id: 687163,  title: 'Project Hail Mary',       year: 2026, rating: 8.4, poster: '/placeholder.jpg' },
  { id: 1330021, title: 'Remarkably Bright Creatures', year: 2026, rating: 7.8, poster: '/placeholder.jpg' },
  { id: 1318413, title: 'Pressure',                year: 2026, rating: 7.7, poster: '/placeholder.jpg' },
  { id: 1339713, title: 'Obsession',               year: 2026, rating: 7.6, poster: '/placeholder.jpg' },
  { id: 1325734, title: 'The Drama',               year: 2026, rating: 7.5, poster: '/placeholder.jpg' },
  { id: 1340206, title: 'Tuner',                   year: 2026, rating: 7.4, poster: '/placeholder.jpg' },
  { id: 1318447, title: 'Apex',                    year: 2026, rating: 7.0, poster: '/placeholder.jpg' },
  { id: 1390300, title: 'Over Your Dead Body',     year: 2026, rating: 7.1, poster: '/placeholder.jpg' },
  { id: 1227877, title: 'I Love Boosters',          year: 2026, rating: 7.1, poster: '/placeholder.jpg' },
  { id: 1119449, title: 'Good Luck, Have Fun, Don\'t Die', year: 2026, rating: 7.0, poster: '/placeholder.jpg' },
  { id: 1263012, title: 'Dead Man\'s Wire',         year: 2026, rating: 6.5, poster: '/placeholder.jpg' },
  { id: 1171145, title: 'Crime 101',               year: 2026, rating: 6.8, poster: '/placeholder.jpg' },
  { id: 1198994, title: 'Send Help',               year: 2026, rating: 6.9, poster: '/placeholder.jpg' },
  { id: 1242265, title: 'Fuze',                    year: 2026, rating: 6.4, poster: '/placeholder.jpg' },
  { id: 1301421, title: 'The Sheep Detectives',     year: 2026, rating: 7.0, poster: '/placeholder.jpg' },
  { id: 1304313, title: 'Lee Cronin\'s the Mummy',   year: 2026, rating: 6.5, poster: '/placeholder.jpg' },
  { id: 1116201, title: 'Iron Lung',               year: 2026, rating: 6.5, poster: '/placeholder.jpg' },
  { id: 1290821, title: 'Shelter',                  year: 2026, rating: 6.1, poster: '/placeholder.jpg' },
  { id: 1548113, title: 'The Muppet Show',           year: 2026, rating: 8.6, poster: '/placeholder.jpg' },
  { id: 1297842, title: 'GOAT',                     year: 2026, rating: 6.7, poster: '/placeholder.jpg' },
  // ── BULK SCRAPE: 2024-2025 HITS ──
  { id: 1072791, title: 'Mickey 17', year: 2025, rating: 7.0, poster: '/placeholder.jpg' },
  { id: 949242, title: 'Thunderbolts*', year: 2025, rating: 6.8, poster: '/placeholder.jpg' },
  { id: 1253218, title: 'Superman', year: 2025, rating: 7.0, poster: '/placeholder.jpg' },
  { id: 1100902, title: '28 Years Later', year: 2025, rating: 7.0, poster: '/placeholder.jpg' },
  { id: 1013485, title: 'Wicked', year: 2024, rating: 7.3, poster: '/placeholder.jpg' },
  { id: 933280, title: 'Dune: Part Two', year: 2024, rating: 8.2, poster: '/placeholder.jpg' },
  { id: 948535, title: 'Deadpool & Wolverine', year: 2024, rating: 7.6, poster: '/placeholder.jpg' },
  { id: 787556, title: 'Inside Out 2', year: 2024, rating: 7.5, poster: '/placeholder.jpg' },
  { id: 926337, title: 'The Wild Robot', year: 2024, rating: 8.1, poster: '/placeholder.jpg' },
  { id: 942085, title: 'Furiosa: A Mad Max Saga', year: 2024, rating: 7.3, poster: '/placeholder.jpg' },
  { id: 949896, title: 'Gladiator II', year: 2024, rating: 6.7, poster: '/placeholder.jpg' },
  { id: 573435, title: 'Bad Boys: Ride or Die', year: 2024, rating: 7.1, poster: '/placeholder.jpg' },
  { id: 946355, title: 'The Substance', year: 2024, rating: 7.1, poster: '/placeholder.jpg' },
  { id: 988038, title: 'Alien: Romulus', year: 2024, rating: 7.0, poster: '/placeholder.jpg' },
  { id: 1059051, title: 'Nosferatu', year: 2024, rating: 7.2, poster: '/placeholder.jpg' },
  { id: 1020090, title: 'Conclave', year: 2024, rating: 7.4, poster: '/placeholder.jpg' },
  { id: 929599, title: 'It Ends with Us', year: 2024, rating: 6.7, poster: '/placeholder.jpg' },
  { id: 937281, title: 'Beetlejuice Beetlejuice', year: 2024, rating: 6.8, poster: '/placeholder.jpg' },
  { id: 934739, title: 'A Quiet Place: Day One', year: 2024, rating: 6.8, poster: '/placeholder.jpg' },
  { id: 950960, title: 'Moana 2', year: 2024, rating: 6.8, poster: '/placeholder.jpg' },
  { id: 956732, title: 'Kingdom of the Planet of the Apes', year: 2024, rating: 6.6, poster: '/placeholder.jpg' },
  { id: 901319, title: 'Kung Fu Panda 4', year: 2024, rating: 6.8, poster: '/placeholder.jpg' },
  { id: 933317, title: 'Godzilla x Kong: The New Empire', year: 2024, rating: 6.3, poster: '/placeholder.jpg' },
  { id: 920911, title: 'Despicable Me 4', year: 2024, rating: 6.3, poster: '/placeholder.jpg' },
  { id: 937278, title: 'Twisters', year: 2024, rating: 6.6, poster: '/placeholder.jpg' },
  { id: 937318, title: 'Longlegs', year: 2024, rating: 6.5, poster: '/placeholder.jpg' },
  { id: 972311, title: 'Joker: Folie a Deux', year: 2024, rating: 4.7, poster: '/placeholder.jpg' },
  { id: 1008387, title: 'Carry-On', year: 2024, rating: 6.8, poster: '/placeholder.jpg' },
  { id: 980481, title: 'Trap', year: 2024, rating: 6.0, poster: '/placeholder.jpg' },
  { id: 955036, title: 'Hit Man', year: 2024, rating: 7.0, poster: '/placeholder.jpg' },
  { id: 949971, title: 'Blink Twice', year: 2024, rating: 6.4, poster: '/placeholder.jpg' },
  { id: 940632, title: 'Challengers', year: 2024, rating: 7.2, poster: '/placeholder.jpg' },
  { id: 1018609, title: 'A Complete Unknown', year: 2024, rating: 7.5, poster: '/placeholder.jpg' },
  { id: 1008158, title: 'Anora', year: 2024, rating: 7.5, poster: '/placeholder.jpg' },
  { id: 992607, title: 'The Fall Guy', year: 2024, rating: 7.0, poster: '/placeholder.jpg' },
  { id: 991734, title: 'Love Lies Bleeding', year: 2024, rating: 6.8, poster: '/placeholder.jpg' },
  { id: 972341, title: 'Monkey Man', year: 2024, rating: 6.7, poster: '/placeholder.jpg' },
  { id: 967124, title: 'Civil War', year: 2024, rating: 6.8, poster: '/placeholder.jpg' },
  { id: 980494, title: 'Abigail', year: 2024, rating: 6.3, poster: '/placeholder.jpg' },
  { id: 924314, title: 'Maxxxine', year: 2024, rating: 6.0, poster: '/placeholder.jpg' },
  { id: 920808, title: 'The Bikeriders', year: 2024, rating: 6.6, poster: '/placeholder.jpg' },
  { id: 936231, title: 'Road House', year: 2024, rating: 6.5, poster: '/placeholder.jpg' },
  { id: 940726, title: 'Fly Me to the Moon', year: 2024, rating: 6.5, poster: '/placeholder.jpg' },
  { id: 968051, title: 'The Garfield Movie', year: 2024, rating: 5.8, poster: '/placeholder.jpg' },
  { id: 984772, title: 'The Boy and the Heron', year: 2023, rating: 7.5, poster: '/placeholder.jpg' },
  { id: 900149, title: 'Oppenheimer', year: 2023, rating: 8.1, poster: '/placeholder.jpg' },
  { id: 634492, title: 'Spider-Man: Across the Spider-Verse', year: 2023, rating: 8.4, poster: '/placeholder.jpg' },
  { id: 843265, title: 'Killers of the Flower Moon', year: 2023, rating: 7.6, poster: '/placeholder.jpg' },
  { id: 900176, title: 'Barbie', year: 2023, rating: 7.0, poster: '/placeholder.jpg' },
  { id: 774752, title: 'The Super Mario Bros. Movie', year: 2023, rating: 7.0, poster: '/placeholder.jpg' },
  { id: 872585, title: "Five Nights at Freddy's", year: 2023, rating: 6.2, poster: '/placeholder.jpg' },
  { id: 680864, title: 'John Wick: Chapter 4', year: 2023, rating: 7.6, poster: '/placeholder.jpg' },
  { id: 674324, title: 'Ant-Man and the Wasp: Quantumania', year: 2023, rating: 6.2, poster: '/placeholder.jpg' },
  { id: 739405, title: 'Scream VI', year: 2023, rating: 6.7, poster: '/placeholder.jpg' },
  { id: 724494, title: 'Cocaine Bear', year: 2023, rating: 5.9, poster: '/placeholder.jpg' },
  { id: 999543, title: 'The Zone of Interest', year: 2023, rating: 7.2, poster: '/placeholder.jpg' },
  { id: 597526, title: 'Top Gun: Maverick', year: 2022, rating: 8.2, poster: '/placeholder.jpg' },
  { id: 530451, title: 'The Batman', year: 2022, rating: 7.5, poster: '/placeholder.jpg' },
  { id: 574754, title: 'Avatar: The Way of Water', year: 2022, rating: 7.5, poster: '/placeholder.jpg' },
  { id: 458156, title: 'Black Panther: Wakanda Forever', year: 2022, rating: 6.5, poster: '/placeholder.jpg' },
  { id: 761652, title: 'Barbarian', year: 2022, rating: 6.9, poster: '/placeholder.jpg' },
  { id: 705964, title: 'Doctor Strange in the Multiverse of Madness', year: 2022, rating: 6.8, poster: '/placeholder.jpg' },
  { id: 621326, title: 'The Lost City', year: 2022, rating: 6.4, poster: '/placeholder.jpg' },
  { id: 567084, title: 'Scream', year: 2022, rating: 6.6, poster: '/placeholder.jpg' },
  { id: 526896, title: 'Morbius', year: 2022, rating: 5.4, poster: '/placeholder.jpg' },
  { id: 507569, title: 'Turning Red', year: 2022, rating: 7.3, poster: '/placeholder.jpg' },
  { id: 640342, title: 'Jurassic World Dominion', year: 2022, rating: 6.2, poster: '/placeholder.jpg' },
  { id: 614533, title: 'Uncharted', year: 2022, rating: 6.4, poster: '/placeholder.jpg' },
  { id: 592643, title: 'Sonic the Hedgehog 2', year: 2022, rating: 7.0, poster: '/placeholder.jpg' },
  { id: 519182, title: 'Nope', year: 2022, rating: 6.4, poster: '/placeholder.jpg' },
  { id: 561152, title: 'A Quiet Place Part II', year: 2020, rating: 7.2, poster: '/placeholder.jpg' },
  { id: 447404, title: 'The Invisible Man', year: 2020, rating: 7.0, poster: '/placeholder.jpg' },
  { id: 414901, title: 'Us', year: 2019, rating: 6.8, poster: '/placeholder.jpg' },
  { id: 453539, title: 'The Lighthouse', year: 2019, rating: 6.9, poster: '/placeholder.jpg' },
  { id: 475557, title: 'Midsommar', year: 2019, rating: 7.0, poster: '/placeholder.jpg' },
  { id: 522478, title: '1917', year: 2019, rating: 7.8, poster: '/placeholder.jpg' },
  { id: 447332, title: 'Once Upon a Time in Hollywood', year: 2019, rating: 7.4, poster: '/placeholder.jpg' },
  { id: 453306, title: 'Parasite', year: 2019, rating: 8.5, poster: '/placeholder.jpg' },
  { id: 438148, title: 'Ready Player One', year: 2018, rating: 7.4, poster: '/placeholder.jpg' },
  { id: 493922, title: 'Hereditary', year: 2018, rating: 7.2, poster: '/placeholder.jpg' },
  { id: 420617, title: 'A Star Is Born', year: 2018, rating: 7.3, poster: '/placeholder.jpg' },
  { id: 420616, title: 'Bohemian Rhapsody', year: 2018, rating: 8.0, poster: '/placeholder.jpg' },
  { id: 420818, title: 'Blade Runner 2049', year: 2017, rating: 7.4, poster: '/placeholder.jpg' },
  { id: 283995, title: 'Mad Max: Fury Road', year: 2015, rating: 7.6, poster: '/placeholder.jpg' },
  { id: 283993, title: 'The Revenant', year: 2015, rating: 7.7, poster: '/placeholder.jpg' },
  { id: 76341, title: 'Kill Bill: Vol. 1', year: 2003, rating: 8.1, poster: '/placeholder.jpg' },
  { id: 76339, title: 'Kill Bill: Vol. 2', year: 2004, rating: 7.8, poster: '/placeholder.jpg' },
  { id: 76340, title: 'Sin City', year: 2005, rating: 7.5, poster: '/placeholder.jpg' },
  { id: 1726, title: 'Iron Man', year: 2008, rating: 7.9 },
  { id: 10138, title: 'Thor', year: 2011, rating: 6.8 },
  { id: 102899, title: 'Iron Man 2', year: 2010, rating: 6.7 },
  { id: 68721, title: 'Iron Man 3', year: 2013, rating: 7.0 },
  { id: 76338, title: 'Thor: The Dark World', year: 2013, rating: 6.5 },
  { id: 284053, title: 'Thor: Ragnarok', year: 2017, rating: 7.4 },
  { id: 597450, title: 'Thor: Love and Thunder', year: 2022, rating: 6.2 },
  { id: 1771, title: 'Captain America: First Avenger', year: 2011, rating: 6.9 },
  { id: 100382, title: 'Captain America: Winter Soldier', year: 2014, rating: 7.7 },
  { id: 299537, title: 'Captain America: Civil War', year: 2016, rating: 7.4 },
  { id: 284052, title: 'Black Panther', year: 2018, rating: 7.3 },
  { id: 601452, title: 'Wakanda Forever', year: 2022, rating: 6.5 },
  { id: 47971, title: 'Captain Marvel', year: 2019, rating: 6.3 },
  { id: 823463, title: 'Guardians Vol. 3', year: 2023, rating: 7.9 },
  { id: 166426, title: 'Wonder Woman', year: 2017, rating: 7.3 },
  { id: 464052, title: 'Wonder Woman 1984', year: 2020, rating: 5.4 },
  { id: 9800, title: 'Batman Begins', year: 2005, rating: 7.5 },
  { id: 49026, title: 'The Dark Knight Rises', year: 2012, rating: 7.7 },
  { id: 1003596, title: 'Blue Beetle', year: 2023, rating: 6.2 },
  { id: 1891, title: 'Phantom Menace', year: 1999, rating: 6.3 },
  { id: 1892, title: 'Attack of the Clones', year: 2002, rating: 5.9 },
  { id: 1893, title: 'Revenge of the Sith', year: 2005, rating: 7.2 },
  { id: 140607, title: 'The Force Awakens', year: 2015, rating: 7.0 },
  { id: 181808, title: 'The Last Jedi', year: 2017, rating: 6.4 },
  { id: 181812, title: 'The Rise of Skywalker', year: 2019, rating: 5.8 },
  { id: 604, title: 'Matrix Reloaded', year: 2003, rating: 6.7 },
  { id: 605, title: 'Matrix Revolutions', year: 2003, rating: 5.8 },
  { id: 624860, title: 'Matrix Resurrections', year: 2021, rating: 5.0 },
  { id: 329, title: 'Jurassic Park', year: 1993, rating: 8.1 },
  { id: 330, title: 'Lost World JP', year: 1997, rating: 6.3 },
  { id: 135397, title: 'Jurassic World', year: 2015, rating: 6.6 },
  { id: 330847, title: 'JW Fallen Kingdom', year: 2018, rating: 5.9 },
  { id: 761, title: 'From Russia with Love', year: 1963, rating: 7.2 },
  { id: 763, title: 'Goldfinger', year: 1964, rating: 7.5 },
  { id: 762, title: 'Thunderball', year: 1965, rating: 6.8 },
  { id: 764, title: 'You Only Live Twice', year: 1967, rating: 6.6 },
  { id: 624, title: 'The Man with the Golden Gun', year: 1974, rating: 6.1 },
  { id: 765, title: 'The Spy Who Loved Me', year: 1977, rating: 6.8 },
  { id: 766, title: 'Moonraker', year: 1979, rating: 5.7 },
  { id: 768, title: 'For Your Eyes Only', year: 1981, rating: 6.5 },
  { id: 688, title: 'The Living Daylights', year: 1987, rating: 6.4 },
  { id: 714, title: 'Casino Royale', year: 2006, rating: 7.4 },
  { id: 711, title: 'Tomorrow Never Dies', year: 1997, rating: 6.1 },
  { id: 712, title: 'The World Is Not Enough', year: 1999, rating: 6.0 },
  { id: 713, title: 'Die Another Day', year: 2002, rating: 5.9 },
  { id: 715, title: 'Quantum of Solace', year: 2008, rating: 6.0 },
  { id: 716, title: 'Skyfall', year: 2012, rating: 7.4 },
  { id: 717, title: 'Spectre', year: 2015, rating: 6.3 },
  { id: 718, title: 'No Time to Die', year: 2021, rating: 6.8 },
  { id: 954, title: 'Mission: Impossible', year: 1996, rating: 6.9 },
  { id: 956, title: 'MI2', year: 2000, rating: 5.9 },
  { id: 957, title: 'MI3', year: 2006, rating: 6.6 },
  { id: 56292, title: 'Ghost Protocol', year: 2011, rating: 7.0 },
  { id: 177677, title: 'Rogue Nation', year: 2015, rating: 7.2 },
  { id: 353081, title: 'Fallout', year: 2018, rating: 7.5 },
  { id: 577922, title: 'Dead Reckoning', year: 2023, rating: 7.2 },
  { id: 2501, title: 'Bourne Identity', year: 2002, rating: 7.4 },
  { id: 2502, title: 'Bourne Supremacy', year: 2004, rating: 7.0 },
  { id: 2503, title: 'Bourne Ultimatum', year: 2007, rating: 7.6 },
  { id: 2504, title: 'Bourne Legacy', year: 2012, rating: 6.4 },
  { id: 324668, title: 'Jason Bourne', year: 2016, rating: 5.7 },
  { id: 205, title: 'Back to the Future', year: 1985, rating: 8.1 },
  { id: 206, title: 'BTTF II', year: 1989, rating: 7.4 },
  { id: 207, title: 'BTTF III', year: 1990, rating: 6.9 },
  { id: 594, title: 'Ghostbusters', year: 1984, rating: 7.7 },
  { id: 576, title: 'Ghostbusters: Afterlife', year: 2021, rating: 7.0 },
  { id: 941520, title: 'Ghostbusters: Frozen Empire', year: 2024, rating: 5.6 },
  { id: 225, title: 'Rocky', year: 1976, rating: 8.1 },
  { id: 227, title: 'Rocky II', year: 1979, rating: 7.2 },
  { id: 228, title: 'Rocky III', year: 1982, rating: 6.8 },
  { id: 229, title: 'Rocky IV', year: 1985, rating: 6.9 },
  { id: 230, title: 'Rocky V', year: 1990, rating: 5.3 },
  { id: 241131, title: 'Rocky Balboa', year: 2006, rating: 6.9 },
  { id: 601, title: 'Fellowship of the Ring', year: 2001, rating: 8.3 },
  { id: 602, title: 'The Two Towers', year: 2002, rating: 8.3 },
  { id: 111, title: 'Indiana Jones: Last Crusade', year: 1989, rating: 7.8 },
  { id: 185, title: 'Indiana Jones: Temple of Doom', year: 1984, rating: 7.3 },
  { id: 335787, title: 'Indiana Jones: Dial of Destiny', year: 2023, rating: 6.1 },
  { id: 106, title: 'Predator', year: 1987, rating: 7.4 },
  { id: 277, title: 'Predator 2', year: 1990, rating: 5.8 },
  { id: 242582, title: 'Predators', year: 2010, rating: 6.1 },
  { id: 672, title: 'Aliens', year: 1986, rating: 8.3 },
  { id: 673, title: 'Alien 3', year: 1992, rating: 6.1 },
  { id: 674, title: 'Alien: Resurrection', year: 1997, rating: 5.4 },
  { id: 862, title: 'Terminator 2', year: 1991, rating: 8.3 },
  { id: 87101, title: 'Terminator: Genisys', year: 2015, rating: 5.6 },
  { id: 290859, title: 'Terminator: Dark Fate', year: 2019, rating: 5.8 },
  { id: 616, title: 'Nightmare on Elm Street', year: 1984, rating: 7.2 },
  { id: 832, title: 'Halloween', year: 1978, rating: 7.6 },
  { id: 664, title: 'The Exorcist', year: 1973, rating: 7.7 },
  { id: 489, title: 'Carrie', year: 1976, rating: 7.0 },
  { id: 546, title: 'Donnie Darko', year: 2001, rating: 7.6 },
  { id: 926, title: 'Scream', year: 1996, rating: 7.3 },
  { id: 928, title: 'Scream 2', year: 1997, rating: 6.2 },
  { id: 929, title: 'Scream 3', year: 2000, rating: 5.4 },
  { id: 930, title: 'Scream 4', year: 2011, rating: 6.0 },
  { id: 632, title: 'Hellraiser', year: 1987, rating: 6.8 },
  { id: 346, title: 'Se7en', year: 1995, rating: 8.2 },
  { id: 414429, title: 'Mandy', year: 2018, rating: 6.2 },
  { id: 3483, title: 'Saw', year: 2004, rating: 6.5 },
  { id: 5484, title: 'Saw II', year: 2005, rating: 6.1 },
  { id: 5485, title: 'Saw III', year: 2006, rating: 5.7 },
  { id: 49051, title: 'The Conjuring', year: 2013, rating: 7.4 },
  { id: 337254, title: 'Conjuring 2', year: 2016, rating: 7.1 },
  { id: 530385, title: 'Hereditary', year: 2018, rating: 7.2 },
  { id: 484592, title: 'The Lighthouse', year: 2019, rating: 7.0 },
  { id: 155132, title: 'The Purge', year: 2013, rating: 5.9 },
  { id: 168259, title: 'Purge: Anarchy', year: 2014, rating: 6.2 },
  { id: 280152, title: 'Purge: Election Year', year: 2016, rating: 5.8 },
  { id: 480487, title: 'The Forever Purge', year: 2021, rating: 5.6 },
  { id: 508, title: 'Superbad', year: 2007, rating: 7.3 },
  { id: 5966, title: '40-Year-Old Virgin', year: 2005, rating: 6.7 },
  { id: 8848, title: 'Knocked Up', year: 2007, rating: 6.9 },
  { id: 5943, title: 'Anchorman', year: 2004, rating: 7.0 },
  { id: 16859, title: 'Anchorman 2', year: 2013, rating: 6.1 },
  { id: 102952, title: 'Were the Millers', year: 2013, rating: 6.9 },
  { id: 244786, title: 'The Nice Guys', year: 2016, rating: 7.3 },
  { id: 373572, title: 'Game Night', year: 2018, rating: 7.0 },
  { id: 10515, title: 'Dumb and Dumber', year: 1994, rating: 6.8 },
  { id: 9482, title: 'Ace Ventura', year: 1994, rating: 6.6 },
  { id: 847, title: 'The Jerk', year: 1979, rating: 7.0 },
  { id: 5936, title: 'Ferris Buellers Day Off', year: 1986, rating: 7.8 },
  { id: 10681, title: 'Waynes World', year: 1992, rating: 6.8 },
  { id: 8841, title: 'Bridesmaids', year: 2011, rating: 6.6 },
  { id: 10674, title: 'Step Brothers', year: 2008, rating: 6.8 },
  { id: 567, title: 'Airplane!', year: 1980, rating: 7.4 },
  { id: 4904, title: 'Dodgeball', year: 2004, rating: 6.6 },
  { id: 10203, title: 'Old School', year: 2003, rating: 6.5 },
  { id: 9480, title: 'Zoolander', year: 2001, rating: 6.1 },
  { id: 8795, title: 'Tropic Thunder', year: 2008, rating: 6.6 },
  { id: 4476, title: 'Happy Gilmore', year: 1996, rating: 6.7 },
  { id: 240, title: 'Godfather Part II', year: 1974, rating: 8.4 },
  { id: 769, title: 'Goodfellas', year: 1990, rating: 8.2 },
  { id: 597, title: 'Titanic', year: 1997, rating: 7.6 },
  { id: 644479, title: 'Parasite', year: 2019, rating: 8.3 },
  { id: 5915, title: 'American History X', year: 1998, rating: 7.8 },
  { id: 621, title: 'The Truman Show', year: 1998, rating: 8.0 },
  { id: 1128, title: 'Memento', year: 2000, rating: 8.2 },
  { id: 274, title: 'The Sixth Sense', year: 1999, rating: 7.9 },
  { id: 453, title: 'A Beautiful Mind', year: 2001, rating: 7.7 },
  { id: 8392, title: 'The Big Lebowski', year: 1998, rating: 7.8 },
  { id: 539, title: 'Psycho', year: 1960, rating: 8.2 },
  { id: 500, title: 'Reservoir Dogs', year: 1992, rating: 8.0 },
  { id: 68718, title: 'Django Unchained', year: 2012, rating: 7.8 },
  { id: 1124, title: 'The Prestige', year: 2006, rating: 8.1 },
  { id: 4951, title: 'Blade Runner 2049', year: 2017, rating: 7.3 },
  { id: 78, title: 'Blade Runner', year: 1982, rating: 7.6 },
  { id: 599, title: 'E.T.', year: 1982, rating: 7.6 },
  { id: 100402, title: 'Gravity', year: 2013, rating: 7.0 },
  { id: 6637, title: 'The Fifth Element', year: 1997, rating: 7.1 },
  { id: 60308, title: 'Children of Men', year: 2006, rating: 7.5 },
  { id: 27205, title: 'Inception', year: 2010, rating: 8.4 },
  { id: 100362, title: 'Finding Nemo', year: 2003, rating: 7.8 },
  { id: 100367, title: 'WALL-E', year: 2008, rating: 8.1 },
  { id: 100368, title: 'Up', year: 2009, rating: 8.2 },
  { id: 100369, title: 'Inside Out', year: 2015, rating: 7.9 },
  { id: 508447, title: 'Spirited Away', year: 2001, rating: 8.4 },
  { id: 826510, title: 'Inside Out 2', year: 2024, rating: 7.2 },
  { id: 1083862, title: 'The Wild Robot', year: 2024, rating: 8.1 },
  { id: 1011985, title: 'Moana 2', year: 2024, rating: 6.7 },
  { id: 100370, title: 'Brave', year: 2012, rating: 7.0 },
  { id: 100372, title: 'Coco', year: 2017, rating: 8.1 },
  { id: 100373, title: 'Onward', year: 2020, rating: 7.0 },
  { id: 100374, title: 'Soul', year: 2020, rating: 8.0 },
  { id: 100375, title: 'Luca', year: 2021, rating: 7.4 },
  { id: 100376, title: 'Turning Red', year: 2022, rating: 7.1 },
  { id: 9487, title: 'The Lion King', year: 1994, rating: 8.1 },
  { id: 1086, title: 'Ice Age', year: 2002, rating: 7.0 },
  { id: 82774, title: 'Kung Fu Panda 2', year: 2011, rating: 7.0 },
  { id: 82775, title: 'Kung Fu Panda 3', year: 2016, rating: 6.8 },
  { id: 350, title: 'Pirates: Curse of the Black Pearl', year: 2003, rating: 7.6 },
  { id: 4923, title: 'Pirates: At Worlds End', year: 2007, rating: 6.7 },
  { id: 334533, title: 'Pirates: On Stranger Tides', year: 2011, rating: 5.8 },
  { id: 334534, title: 'Pirates: Dead Men Tell No Tales', year: 2017, rating: 5.7 },
  { id: 2208, title: 'Transformers', year: 2007, rating: 6.5 },
  { id: 2209, title: 'Transformers: ROTF', year: 2009, rating: 5.4 },
  { id: 23010, title: 'Transformers: DOTM', year: 2011, rating: 5.6 },
  { id: 70160, title: 'The Hunger Games', year: 2012, rating: 7.0 },
  { id: 70161, title: 'Catching Fire', year: 2013, rating: 7.2 },
  { id: 70162, title: 'Mockingjay Part 1', year: 2014, rating: 6.4 },
  { id: 70163, title: 'Mockingjay Part 2', year: 2015, rating: 6.4 },
  { id: 605, title: 'Men in Black', year: 1997, rating: 7.0 },
  { id: 604, title: 'Men in Black II', year: 2002, rating: 5.8 },
  { id: 606, title: 'Men in Black 3', year: 2012, rating: 6.5 },
  { id: 948, title: 'Lethal Weapon', year: 1987, rating: 7.3 },
  { id: 949, title: 'Lethal Weapon 2', year: 1989, rating: 7.0 },
  { id: 950, title: 'Lethal Weapon 3', year: 1992, rating: 6.3 },
  { id: 951, title: 'Lethal Weapon 4', year: 1998, rating: 6.0 },
  { id: 134, title: 'Star Trek: The Motion Picture', year: 1979, rating: 5.5 },
  { id: 135, title: 'Star Trek II: The Wrath of Khan', year: 1982, rating: 7.6 },
  { id: 929931, title: 'Dune: Part Two', year: 2024, rating: 8.2 },
  { id: 872599, title: 'Killers of the Flower Moon', year: 2023, rating: 7.2 },
  { id: 976458, title: 'Poor Things', year: 2023, rating: 7.5 },
  { id: 917128, title: 'Beetlejuice Beetlejuice', year: 2024, rating: 6.5 },
  { id: 940721, title: 'Godzilla x Kong', year: 2024, rating: 6.5 },
  { id: 653346, title: 'Kingdom Planet Apes', year: 2024, rating: 6.5 },
  { id: 1072904, title: 'Rebel Ridge', year: 2024, rating: 7.0 },
  { id: 748783, title: 'Ballad Songbirds Snakes', year: 2023, rating: 6.8 },
  { id: 614934, title: 'Fast X', year: 2023, rating: 5.9 },
  { id: 1072731, title: 'Anyone But You', year: 2023, rating: 6.2 },
  { id: 675353, title: 'Sonic 3', year: 2024, rating: 6.8 },
  { id: 508442, title: 'Sonic 2', year: 2022, rating: 6.4 },
  { id: 438631, title: 'Dune: Part One', year: 2021, rating: 7.8 },
  { id: 545609, title: 'EEAAO', year: 2022, rating: 7.6 },
  { id: 324857, title: 'Across the Spider-Verse', year: 2023, rating: 8.6 },
  { id: 546554, title: 'Five Nights Freddys', year: 2023, rating: 6.0 },
  { id: 119051, title: 'Wrath of Man', year: 2021, rating: 7.1 },
  { id: 892752, title: 'The Killer', year: 2023, rating: 6.4 },
  { id: 768744, title: 'The Menu', year: 2022, rating: 7.1 },
  { id: 591939, title: 'Banshees of Inisherin', year: 2022, rating: 7.5 },
  { id: 854640, title: 'Nope', year: 2022, rating: 6.3 },
  { id: 614933, title: 'Creed III', year: 2023, rating: 6.7 },
  { id: 739011, title: 'Glass Onion', year: 2022, rating: 7.0 },
  { id: 664769, title: 'The Gentlemen', year: 2019, rating: 7.1 },
  { id: 460465, title: 'No Time to Die', year: 2021, rating: 6.8 },
  { id: 1008032, title: 'The Holdovers', year: 2023, rating: 7.5 },
  { id: 1008344, title: 'Dream Scenario', year: 2023, rating: 6.0 },
  { id: 926417, title: 'Past Lives', year: 2023, rating: 7.5 },
  { id: 920318, title: 'Society of the Snow', year: 2023, rating: 7.3 },
  { id: 447, title: 'The Social Network', year: 2010, rating: 7.4 },
  { id: 154, title: 'Eternal Sunshine', year: 2004, rating: 7.7 },
  { id: 277, title: 'Unforgiven', year: 1992, rating: 7.8 },
  { id: 153518, title: 'The Hateful Eight', year: 2015, rating: 7.4 },
  { id: 338489, title: 'Once Upon a Time in Hollywood', year: 2019, rating: 7.1 },
  { id: 207, title: 'Caddyshack', year: 1980, rating: 7.0 },
];
