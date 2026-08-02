// ── CineVault US Cable Channel Database ──
// Complete channel lineup: DirecTV, Discovery, USA, ESPN, Fox, NBC, CBS, ABC, etc.
// Each channel: id, name, category, logo (SVG inline or URL), color (brand), number, group

const CHANNEL_DATABASE = {
  // ═══════════════════════════════════
  //  BROADCAST — Big Four Networks
  // ═══════════════════════════════════
  abc: {
    id: 'abc', name: 'ABC', number: 7, group: 'Broadcast',
    color: '#000000', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23000000%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EABC%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['broadcast', 'entertainment', 'live']
  },
  cbs: {
    id: 'cbs', name: 'CBS', number: 2, group: 'Broadcast',
    color: '#0047AB', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%230047AB%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3ECBS%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['broadcast', 'entertainment', 'live']
  },
  nbc: {
    id: 'nbc', name: 'NBC', number: 4, group: 'Broadcast',
    color: '#000000', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23000000%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3ENBC%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['broadcast', 'entertainment', 'live']
  },
  fox: {
    id: 'fox', name: 'FOX', number: 5, group: 'Broadcast',
    color: '#0039A6', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%230039A6%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EFOX%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['broadcast', 'entertainment', 'live']
  },
  pbs: {
    id: 'pbs', name: 'PBS', number: 11, group: 'Broadcast',
    color: '#0D4F8B', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%230D4F8B%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EPBS%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['broadcast', 'education', 'live']
  },
  thecw: {
    id: 'thecw', name: 'The CW', number: 9, group: 'Broadcast',
    color: '#003B5C', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23003B5C%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3ECW%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['broadcast', 'entertainment', 'live']
  },
  mynetworktv: {
    id: 'mynetworktv', name: 'MyNetworkTV', number: 13, group: 'Broadcast',
    color: '#BD1F17', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23BD1F17%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EMNT%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['broadcast', 'entertainment', 'live']
  },

  // ═══════════════════════════════════
  //  NEWS
  // ═══════════════════════════════════
  cnn: {
    id: 'cnn', name: 'CNN', number: 202, group: 'News',
    color: '#CC0000', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23CC0000%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3ECNN%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['news', 'live']
  },
  foxnews: {
    id: 'foxnews', name: 'Fox News', number: 360, group: 'News',
    color: '#003366', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23003366%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2244%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EFOX%3C%2Ftext%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2262%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2212%22%20font-weight%3D%22400%22%3ENEWS%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['news', 'live']
  },
  msnbc: {
    id: 'msnbc', name: 'MSNBC', number: 356, group: 'News',
    color: '#0072CE', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%230072CE%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EMSN%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['news', 'live']
  },
  hln: {
    id: 'hln', name: 'HLN', number: 204, group: 'News',
    color: '#EE3A43', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23EE3A43%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EHLN%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['news', 'live']
  },
  bbcworld: {
    id: 'bbcworld', name: 'BBC World News', number: 346, group: 'News',
    color: '#BB1919', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23BB1919%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EBBC%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['news', 'international', 'live']
  },
  cnbc: {
    id: 'cnbc', name: 'CNBC', number: 355, group: 'News',
    color: '#005594', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23005594%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3ECNB%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['news', 'business', 'live']
  },
  bloomberg: {
    id: 'bloomberg', name: 'Bloomberg TV', number: 353, group: 'News',
    color: '#000000', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23000000%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EBLO%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['news', 'business', 'live']
  },
  foxbusiness: {
    id: 'foxbusiness', name: 'Fox Business', number: 359, group: 'News',
    color: '#003366', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23003366%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EFOX%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['news', 'business', 'live']
  },
  weatherchannel: {
    id: 'weatherchannel', name: 'The Weather Channel', number: 362, group: 'News',
    color: '#006BCC', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23006BCC%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3ETHE%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['news', 'weather', 'live']
  },

  // ═══════════════════════════════════
  //  ESPN & SPORTS
  // ═══════════════════════════════════
  espn: {
    id: 'espn', name: 'ESPN', number: 206, group: 'Sports',
    color: '#FF3B30', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23FF3B30%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EESP%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['sports', 'live']
  },
  espn2: {
    id: 'espn2', name: 'ESPN2', number: 209, group: 'Sports',
    color: '#FF3B30', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23FF3B30%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EESP%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['sports', 'live']
  },
  espnews: {
    id: 'espnews', name: 'ESPNews', number: 207, group: 'Sports',
    color: '#FF3B30', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23FF3B30%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EESP%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['sports', 'news', 'live']
  },
  espnu: {
    id: 'espnu', name: 'ESPNU', number: 208, group: 'Sports',
    color: '#FF3B30', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23FF3B30%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EESP%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['sports', 'college', 'live']
  },
  foxsports1: {
    id: 'foxsports1', name: 'FS1', number: 219, group: 'Sports',
    color: '#0077C8', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%230077C8%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EFS1%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['sports', 'live']
  },
  foxsports2: {
    id: 'foxsports2', name: 'FS2', number: 618, group: 'Sports',
    color: '#0077C8', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%230077C8%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EFS2%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['sports', 'live']
  },
  nbcsports: {
    id: 'nbcsports', name: 'NBC Sports', number: 220, group: 'Sports',
    color: '#0DB25B', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%230DB25B%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3ENBC%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['sports', 'live']
  },
  tbs_sports: {
    id: 'tbs_sports', name: 'TBS', number: 247, group: 'Sports/Entertainment',
    color: '#E87722', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23E87722%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3ETBS%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['sports', 'entertainment', 'live']
  },
  tnt_sports: {
    id: 'tnt_sports', name: 'TNT', number: 245, group: 'Sports/Entertainment',
    color: '#0061AF', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%230061AF%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3ETNT%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['sports', 'entertainment', 'live']
  },
  nflnetwork: {
    id: 'nflnetwork', name: 'NFL Network', number: 212, group: 'Sports',
    color: '#013369', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23013369%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3ENFL%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['sports', 'football', 'live']
  },
  mlbnetwork: {
    id: 'mlbnetwork', name: 'MLB Network', number: 213, group: 'Sports',
    color: '#002855', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23002855%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EMLB%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['sports', 'baseball', 'live']
  },
  nbanetwork: {
    id: 'nbanetwork', name: 'NBA TV', number: 216, group: 'Sports',
    color: '#C8102E', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23C8102E%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3ENBA%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['sports', 'basketball', 'live']
  },
  nbcsn: {
    id: 'nbcsn', name: 'NBCSN', number: 220, group: 'Sports',
    color: '#0DB25B', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%230DB25B%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3ENBC%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['sports', 'live']
  },

  // ═══════════════════════════════════
  //  ENTERTAINMENT & USA NETWORK
  // ═══════════════════════════════════
  usa: {
    id: 'usa', name: 'USA Network', number: 242, group: 'Entertainment',
    color: '#0046AD', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%230046AD%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EUSA%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['entertainment', 'live']
  },
  tnt: {
    id: 'tnt', name: 'TNT', number: 245, group: 'Entertainment',
    color: '#0061AF', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%230061AF%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3ETNT%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['entertainment', 'movies', 'live']
  },
  tbs: {
    id: 'tbs', name: 'TBS', number: 247, group: 'Entertainment',
    color: '#E87722', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23E87722%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3ETBS%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['entertainment', 'comedy', 'live']
  },
  amc: {
    id: 'amc', name: 'AMC', number: 254, group: 'Entertainment',
    color: '#4A4A4A', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%234A4A4A%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EAMC%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['entertainment', 'movies', 'live']
  },
  fx: {
    id: 'fx', name: 'FX', number: 248, group: 'Entertainment',
    color: '#000000', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23000000%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EFX%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['entertainment', 'live']
  },
  fxx: {
    id: 'fxx', name: 'FXX', number: 249, group: 'Entertainment',
    color: '#ED1C24', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23ED1C24%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EFXX%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['entertainment', 'comedy', 'live']
  },
  hallmark: {
    id: 'hallmark', name: 'Hallmark Channel', number: 312, group: 'Entertainment',
    color: '#8B2FC9', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%238B2FC9%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EHAL%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['entertainment', 'family', 'live']
  },
  lifetime: {
    id: 'lifetime', name: 'Lifetime', number: 252, group: 'Entertainment',
    color: '#6B2D8B', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%236B2D8B%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3ELIF%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['entertainment', 'drama', 'live']
  },
  syfy: {
    id: 'syfy', name: 'Syfy', number: 244, group: 'Entertainment',
    color: '#00BCD4', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%2300BCD4%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3ESYF%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['entertainment', 'sci-fi', 'live']
  },
  trutv: {
    id: 'trutv', name: 'truTV', number: 246, group: 'Entertainment',
    color: '#00B4D8', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%2300B4D8%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3ETRU%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['entertainment', 'reality', 'live']
  },
  bravo: {
    id: 'bravo', name: 'Bravo', number: 237, group: 'Entertainment',
    color: '#DF1B5E', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23DF1B5E%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EBRA%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['entertainment', 'reality', 'live']
  },
  eentertainment: {
    id: 'eentertainment', name: 'E!', number: 236, group: 'Entertainment',
    color: '#C4161C', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23C4161C%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EE%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['entertainment', 'celebrity', 'live']
  },
  oxygen: {
    id: 'oxygen', name: 'Oxygen', number: 251, group: 'Entertainment',
    color: '#00AEEF', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%2300AEEF%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EOXY%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['entertainment', 'true-crime', 'live']
  },
  aetv: {
    id: 'aetv', name: 'A&E', number: 265, group: 'Entertainment',
    color: '#000000', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23000000%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EAE%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['entertainment', 'reality', 'live']
  },
  freeform: {
    id: 'freeform', name: 'Freeform', number: 180, group: 'Entertainment',
    color: '#000000', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23000000%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EFRE%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['entertainment', 'young-adult', 'live']
  },

  // ═══════════════════════════════════
  //  DISCOVERY FAMILY
  // ═══════════════════════════════════
  discovery: {
    id: 'discovery', name: 'Discovery Channel', number: 278, group: 'Discovery',
    color: '#1E88E5', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%231E88E5%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EDIS%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['discovery', 'documentary', 'live']
  },
  discovery_science: {
    id: 'discovery_science', name: 'Science Channel', number: 284, group: 'Discovery',
    color: '#0D47A1', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%230D47A1%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3ESCI%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['discovery', 'science', 'live']
  },
  animalplanet: {
    id: 'animalplanet', name: 'Animal Planet', number: 282, group: 'Discovery',
    color: '#2E7D32', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%232E7D32%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EANI%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['discovery', 'animals', 'live']
  },
  tlc: {
    id: 'tlc', name: 'TLC', number: 280, group: 'Discovery',
    color: '#E91E63', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23E91E63%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3ETLC%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['discovery', 'reality', 'live']
  },
  hgtv: {
    id: 'hgtv', name: 'HGTV', number: 229, group: 'Discovery',
    color: '#43A047', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%2343A047%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EHGT%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['discovery', 'home', 'live']
  },
  foodnetwork: {
    id: 'foodnetwork', name: 'Food Network', number: 231, group: 'Discovery',
    color: '#F57C00', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23F57C00%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EFOO%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['discovery', 'cooking', 'live']
  },
  cookingchannel: {
    id: 'cookingchannel', name: 'Cooking Channel', number: 232, group: 'Discovery',
    color: '#FF6F00', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23FF6F00%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3ECOO%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['discovery', 'cooking', 'live']
  },
  trvl: {
    id: 'trvl', name: 'Travel Channel', number: 277, group: 'Discovery',
    color: '#1976D2', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%231976D2%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3ETRA%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['discovery', 'travel', 'live']
  },
  investigation_discovery: {
    id: 'investigation_discovery', name: 'Investigation Discovery', number: 285, group: 'Discovery',
    color: '#6A1B9A', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%236A1B9A%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EINV%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['discovery', 'true-crime', 'live']
  },
  discovery_life: {
    id: 'discovery_life', name: 'Discovery Life', number: 261, group: 'Discovery',
    color: '#1B5E20', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%231B5E20%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EDIS%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['discovery', 'documentary', 'live']
  },
  own: {
    id: 'own', name: 'OWN', number: 279, group: 'Discovery',
    color: '#E65100', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23E65100%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EOWN%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['discovery', 'entertainment', 'live']
  },
  magnolia: {
    id: 'magnolia', name: 'Magnolia Network', number: 230, group: 'Discovery',
    color: '#5D4037', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%235D4037%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EMAG%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['discovery', 'home', 'live']
  },

  // ═══════════════════════════════════
  //  MOVIE CHANNELS
  // ═══════════════════════════════════
  hbo: {
    id: 'hbo', name: 'HBO', number: 501, group: 'Movies',
    color: '#000000', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23000000%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EHBO%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['movies', 'premium', 'live']
  },
  hbomax: {
    id: 'hbomax', name: 'HBO Max', number: 501, group: 'Movies',
    color: '#B01EE5', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23B01EE5%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EHBO%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['movies', 'premium', 'streaming', 'live']
  },
  hbo2: {
    id: 'hbo2', name: 'HBO 2', number: 502, group: 'Movies',
    color: '#000000', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23000000%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EHBO%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['movies', 'premium', 'live']
  },
  showtime: {
    id: 'showtime', name: 'SHOWTIME', number: 545, group: 'Movies',
    color: '#D32F2F', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23D32F2F%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3ESHO%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['movies', 'premium', 'live']
  },
  stars: {
    id: 'stars', name: 'STARZ', number: 525, group: 'Movies',
    color: '#000000', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23000000%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3ESTA%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['movies', 'premium', 'live']
  },
  cinemax: {
    id: 'cinemax', name: 'Cinemax', number: 515, group: 'Movies',
    color: '#FFB300', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23FFB300%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3ECIN%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['movies', 'premium', 'live']
  },

  // ═══════════════════════════════════
  //  KIDS & FAMILY
  // ═══════════════════════════════════
  nickelodeon: {
    id: 'nickelodeon', name: 'Nickelodeon', number: 299, group: 'Kids',
    color: '#FF6F00', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23FF6F00%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3ENIC%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['kids', 'animation', 'live']
  },
  nickjr: {
    id: 'nickjr', name: 'Nick Jr.', number: 301, group: 'Kids',
    color: '#FF9800', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23FF9800%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3ENIC%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['kids', 'preschool', 'live']
  },
  nicktoons: {
    id: 'nicktoons', name: 'Nicktoons', number: 302, group: 'Kids',
    color: '#FF6F00', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23FF6F00%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3ENIC%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['kids', 'animation', 'live']
  },
  disneychannel: {
    id: 'disneychannel', name: 'Disney Channel', number: 290, group: 'Kids',
    color: '#0044CC', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%230044CC%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EDIS%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['kids', 'family', 'live']
  },
  disneyxd: {
    id: 'disneyxd', name: 'Disney XD', number: 292, group: 'Kids',
    color: '#00C853', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%2300C853%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EDIS%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['kids', 'action', 'live']
  },
  disneyjr: {
    id: 'disneyjr', name: 'Disney Junior', number: 289, group: 'Kids',
    color: '#1565C0', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%231565C0%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EDIS%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['kids', 'preschool', 'live']
  },
  cartoonnetwork: {
    id: 'cartoonnetwork', name: 'Cartoon Network', number: 296, group: 'Kids',
    color: '#000000', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23000000%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3ECAR%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['kids', 'animation', 'live']
  },
  pbskids: {
    id: 'pbskids', name: 'PBS Kids', number: 288, group: 'Kids',
    color: '#4CAF50', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%234CAF50%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EPBS%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['kids', 'education', 'preschool', 'live']
  },

  // ═══════════════════════════════════
  //  MUSIC
  // ═══════════════════════════════════
  mtv: {
    id: 'mtv', name: 'MTV', number: 331, group: 'Music',
    color: '#FF3B30', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23FF3B30%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EMTV%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['music', 'entertainment', 'live']
  },
  vh1: {
    id: 'vh1', name: 'VH1', number: 335, group: 'Music',
    color: '#FFD600', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23FFD600%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EVH1%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['music', 'entertainment', 'live']
  },
  bet: {
    id: 'bet', name: 'BET', number: 329, group: 'Music',
    color: '#000000', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23000000%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EBET%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['music', 'entertainment', 'live']
  },
  cmt: {
    id: 'cmt', name: 'CMT', number: 327, group: 'Music',
    color: '#D32F2F', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23D32F2F%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3ECMT%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['music', 'country', 'live']
  },

  // ═══════════════════════════════════
  //  DOCUMENTARY & SPECIALTY
  // ═══════════════════════════════════
  natgeo: {
    id: 'natgeo', name: 'National Geographic', number: 276, group: 'Documentary',
    color: '#FFCE00', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23FFCE00%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3ENAT%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['documentary', 'science', 'live']
  },
  natgeowild: {
    id: 'natgeowild', name: 'Nat Geo Wild', number: 283, group: 'Documentary',
    color: '#FFCE00', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23FFCE00%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3ENAT%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['documentary', 'animals', 'live']
  },
  history: {
    id: 'history', name: 'History Channel', number: 269, group: 'Documentary',
    color: '#C8102E', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23C8102E%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EHIS%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['documentary', 'history', 'live']
  },
  smithsonian: {
    id: 'smithsonian', name: 'Smithsonian Channel', number: 277, group: 'Documentary',
    color: '#E8B400', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23E8B400%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3ESMI%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['documentary', 'science', 'live']
  },

  // ═══════════════════════════════════
  //  COMEDY
  // ═══════════════════════════════════
  comedycentral: {
    id: 'comedycentral', name: 'Comedy Central', number: 249, group: 'Comedy',
    color: '#FFC107', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23FFC107%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3ECOM%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['comedy', 'entertainment', 'live']
  },
  adultswim: {
    id: 'adultswim', name: 'Adult Swim', number: 297, group: 'Comedy',
    color: '#000000', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23000000%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EADU%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['comedy', 'animation', 'adult', 'live']
  },
  trutv: {
    id: 'trutv_comedy', name: 'truTV', number: 246, group: 'Comedy',
    color: '#00B4D8', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%2300B4D8%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3ETRU%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['comedy', 'reality', 'live']
  },

  // ═══════════════════════════════════
  //  LIFESTYLE
  // ═══════════════════════════════════
  bravo_lifestyle: {
    id: 'bravo_lifestyle', name: 'Bravo', number: 237, group: 'Lifestyle',
    color: '#DF1B5E', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23DF1B5E%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EBRA%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['lifestyle', 'reality', 'live']
  },
  mt_: {
    id: 'mt_', name: 'MTV', number: 331, group: 'Lifestyle',
    color: '#FF3B30', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23FF3B30%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EMTV%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['lifestyle', 'music', 'live']
  },

  // ═══════════════════════════════════
  //  SPANISH / LATINO
  // ═══════════════════════════════════
  univision: {
    id: 'univision', name: 'Univision', number: 401, group: 'Latino',
    color: '#1A73E8', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%231A73E8%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EUNI%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['latino', 'entertainment', 'live']
  },
  telemundo: {
    id: 'telemundo', name: 'Telemundo', number: 406, group: 'Latino',
    color: '#CF0A2C', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23CF0A2C%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3ETEL%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['latino', 'entertainment', 'live']
  },
  galavision: {
    id: 'galavision', name: 'Galavisión', number: 404, group: 'Latino',
    color: '#FF6D00', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23FF6D00%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EGAL%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['latino', 'entertainment', 'live']
  },
  unimas: {
    id: 'unimas', name: 'UniMás', number: 402, group: 'Latino',
    color: '#F44336', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23F44336%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EUNI%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['latino', 'entertainment', 'live']
  },

  // ═══════════════════════════════════
  //  STREAMING / OTA
  // ═══════════════════════════════════
  netflix: {
    id: 'netflix', name: 'Netflix', number: null, group: 'Streaming',
    color: '#E50914', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23E50914%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3ENET%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['streaming', 'movies', 'tv']
  },
  amazon: {
    id: 'amazon', name: 'Prime Video', number: null, group: 'Streaming',
    color: '#00A8E1', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%2300A8E1%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EPRI%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['streaming', 'movies', 'tv']
  },
  disneyplus: {
    id: 'disneyplus', name: 'Disney+', number: null, group: 'Streaming',
    color: '#113CCF', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23113CCF%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EDIS%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['streaming', 'family', 'movies']
  },
  hulumax: {
    id: 'hulumax', name: 'Hulu', number: null, group: 'Streaming',
    color: '#1CE783', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%231CE783%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EHUL%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['streaming', 'tv', 'movies']
  },
  appletv: {
    id: 'appletv', name: 'Apple TV+', number: null, group: 'Streaming',
    color: '#000000', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23000000%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EAPP%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['streaming', 'originals']
  },
  peacock: {
    id: 'peacock', name: 'Peacock', number: null, group: 'Streaming',
    color: '#000000', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%23000000%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EPEA%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['streaming', 'nbc', 'live']
  },
  paramount: {
    id: 'paramount', name: 'Paramount+', number: null, group: 'Streaming',
    color: '#0064FF', logo: 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2212%22%20fill%3D%22%230064FF%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22central%22%20text-anchor%3D%22middle%22%20fill%3D%22white%22%20font-family%3D%22Inter%2Csystem-ui%2Csans-serif%22%20font-size%3D%2222%22%20font-weight%3D%22800%22%3EPAR%3C%2Ftext%3E%3C%2Fsvg%3E',
    categories: ['streaming', 'cbs', 'live']
  },

  // ═══════════════════════════════════
  //  TUBI — Free Ad-Supported TV (FAST)
  // ═══════════════════════════════════
  tubi: {
    id: 'tubi', name: 'Tubi', number: null, group: 'Tubi',
    color: '#FF5A1F', logo: channelLogoSVG('TUBI', '#FF5A1F'),
    categories: ['streaming', 'tubi', 'live']
  },
  tubi_nbcnewsnow: {
    id: 'tubi_nbcnewsnow', name: 'NBC News NOW', number: null, group: 'Tubi',
    color: '#005EB8', logo: channelLogoSVG('NBCN', '#005EB8'),
    categories: ['streaming', 'tubi', 'news', 'live']
  },
  tubi_livenowfox: {
    id: 'tubi_livenowfox', name: 'LiveNOW from FOX', number: null, group: 'Tubi',
    color: '#0039A6', logo: channelLogoSVG('FOX', '#0039A6'),
    categories: ['streaming', 'tubi', 'news', 'live']
  },
  tubi_abcnews: {
    id: 'tubi_abcnews', name: 'ABC News Live', number: null, group: 'Tubi',
    color: '#000000', logo: channelLogoSVG('ABCN', '#000000'),
    categories: ['streaming', 'tubi', 'news', 'live']
  },
  tubi_topstory: {
    id: 'tubi_topstory', name: 'Top Story with Tom Llamas', number: null, group: 'Tubi',
    color: '#1A1A2E', logo: channelLogoSVG('TOP', '#1A1A2E'),
    categories: ['streaming', 'tubi', 'news', 'live']
  },
  tubi_bloomberg: {
    id: 'tubi_bloomberg', name: 'Bloomberg TV', number: null, group: 'Tubi',
    color: '#7D0063', logo: channelLogoSVG('BLOO', '#7D0063'),
    categories: ['streaming', 'tubi', 'news', 'live']
  },
  tubi_fastmoney: {
    id: 'tubi_fastmoney', name: 'Fast Money', number: null, group: 'Tubi',
    color: '#006400', logo: channelLogoSVG('FAST', '#006400'),
    categories: ['streaming', 'tubi', 'news', 'live']
  },
  tubi_weather: {
    id: 'tubi_weather', name: 'FOX Weather', number: null, group: 'Tubi',
    color: '#1E88E5', logo: channelLogoSVG('WX', '#1E88E5'),
    categories: ['streaming', 'tubi', 'live']
  },
  tubi_fs1: {
    id: 'tubi_fs1', name: 'FS1', number: null, group: 'Tubi',
    color: '#0077C8', logo: channelLogoSVG('FS1', '#0077C8'),
    categories: ['streaming', 'tubi', 'sports', 'live']
  },
  tubi_nfl: {
    id: 'tubi_nfl', name: 'NFL Channel', number: null, group: 'Tubi',
    color: '#013369', logo: channelLogoSVG('NFL', '#013369'),
    categories: ['streaming', 'tubi', 'sports', 'live']
  },
  tubi_nflhighlights: {
    id: 'tubi_nflhighlights', name: 'NFL Highlights', number: null, group: 'Tubi',
    color: '#013369', logo: channelLogoSVG('NFLH', '#013369'),
    categories: ['streaming', 'tubi', 'sports', 'live']
  },
  tubi_nfldaily: {
    id: 'tubi_nfldaily', name: 'NFL Daily', number: null, group: 'Tubi',
    color: '#1A3A6B', logo: channelLogoSVG('NFD', '#1A3A6B'),
    categories: ['streaming', 'tubi', 'sports', 'live']
  },
  tubi_nascar: {
    id: 'tubi_nascar', name: 'NASCAR', number: null, group: 'Tubi',
    color: '#FFD700', logo: channelLogoSVG('NSCR', '#2D2D2D'),
    categories: ['streaming', 'tubi', 'sports', 'live']
  },
  tubi_boxing: {
    id: 'tubi_boxing', name: 'Tubi Boxing', number: null, group: 'Tubi',
    color: '#8B0000', logo: channelLogoSVG('BOX', '#8B0000'),
    categories: ['streaming', 'tubi', 'sports', 'live']
  },
  tubi_tmzsports: {
    id: 'tubi_tmzsports', name: 'TMZ SPORTS', number: null, group: 'Tubi',
    color: '#FF4500', logo: channelLogoSVG('TMZ', '#FF4500'),
    categories: ['streaming', 'tubi', 'sports', 'entertainment', 'live']
  },
  tubi_dateline: {
    id: 'tubi_dateline', name: 'Dateline NBC', number: null, group: 'Tubi',
    color: '#8B0000', logo: channelLogoSVG('DATE', '#8B0000'),
    categories: ['streaming', 'tubi', 'documentary', 'live']
  },
  tubi_svutubich: {
    id: 'tubi_svutubich', name: 'Law & Order: SVU', number: null, group: 'Tubi',
    color: '#2C2C2C', logo: channelLogoSVG('SVU', '#2C2C2C'),
    categories: ['streaming', 'tubi', 'entertainment', 'live']
  },
  tubi_familyfeud: {
    id: 'tubi_familyfeud', name: 'Family Feud', number: null, group: 'Tubi',
    color: '#006B3F', logo: channelLogoSVG('FEUD', '#006B3F'),
    categories: ['streaming', 'tubi', 'comedy', 'entertainment', 'live']
  },
  tubi_patrolcourt: {
    id: 'tubi_patrolcourt', name: 'Paternity Court', number: null, group: 'Tubi',
    color: '#4B0082', logo: channelLogoSVG('PATC', '#4B0082'),
    categories: ['streaming', 'tubi', 'entertainment', 'live']
  },
  tubi_howardstern: {
    id: 'tubi_howardstern', name: 'Howard Stern', number: null, group: 'Tubi',
    color: '#1A1A1A', logo: channelLogoSVG('HOW', '#1A1A1A'),
    categories: ['streaming', 'tubi', 'comedy', 'entertainment', 'live']
  },
  tubi_localish: {
    id: 'tubi_localish', name: 'Localish', number: null, group: 'Tubi',
    color: '#E4002B', logo: channelLogoSVG('LOCL', '#E4002B'),
    categories: ['streaming', 'tubi', 'entertainment', 'live']
  },
  tubi_cooking: {
    id: 'tubi_cooking', name: 'Tubi Good Eats', number: null, group: 'Tubi',
    color: '#FF6600', logo: channelLogoSVG('EATS', '#FF6600'),
    categories: ['streaming', 'tubi', 'live']
  },
  tubi_howitsmade: {
    id: 'tubi_howitsmade', name: 'How It\'s Made', number: null, group: 'Tubi',
    color: '#008080', logo: channelLogoSVG('MADE', '#008080'),
    categories: ['streaming', 'tubi', 'documentary', 'live']
  },
  tubi_horror: {
    id: 'tubi_horror', name: 'Tubi Horror', number: null, group: 'Tubi',
    color: '#4A0000', logo: channelLogoSVG('HORR', '#4A0000'),
    categories: ['streaming', 'tubi', 'movies', 'live']
  },
  tubi_movies: {
    id: 'tubi_movies', name: 'Tubi Movies', number: null, group: 'Tubi',
    color: '#8311FA', logo: channelLogoSVG('MOV', '#8311FA'),
    categories: ['streaming', 'tubi', 'movies', 'live']
  },
  tubi_scifi: {
    id: 'tubi_scifi', name: 'Tubi Sci-Fi', number: null, group: 'Tubi',
    color: '#1B1464', logo: channelLogoSVG('SCIF', '#1B1464'),
    categories: ['streaming', 'tubi', 'movies', 'live']
  },
  tubi_mystery: {
    id: 'tubi_mystery', name: 'Tubi Mystery', number: null, group: 'Tubi',
    color: '#2F4F4F', logo: channelLogoSVG('MYS', '#2F4F4F'),
    categories: ['streaming', 'tubi', 'movies', 'live']
  },
  tubi_action: {
    id: 'tubi_action', name: 'Tubi Action', number: null, group: 'Tubi',
    color: '#8B0000', logo: channelLogoSVG('ACTN', '#8B0000'),
    categories: ['streaming', 'tubi', 'movies', 'live']
  },
  tubi_comedy: {
    id: 'tubi_comedy', name: 'Tubi Comedy', number: null, group: 'Tubi',
    color: '#FFD700', logo: channelLogoSVG('COM', '#2D2D2D'),
    categories: ['streaming', 'tubi', 'comedy', 'live']
  },
  tubi_western: {
    id: 'tubi_western', name: 'Tubi Western', number: null, group: 'Tubi',
    color: '#8B4513', logo: channelLogoSVG('WEST', '#8B4513'),
    categories: ['streaming', 'tubi', 'movies', 'live']
  },
  tubi_classictv: {
    id: 'tubi_classictv', name: 'Tubi Classic TV', number: null, group: 'Tubi',
    color: '#556B2F', logo: channelLogoSVG('TVCL', '#556B2F'),
    categories: ['streaming', 'tubi', 'entertainment', 'live']
  },
  tubi_kids: {
    id: 'tubi_kids', name: 'Tubi Kids', number: null, group: 'Tubi',
    color: '#FF69B4', logo: channelLogoSVG('KIDS', '#FF69B4'),
    categories: ['streaming', 'tubi', 'kids', 'live']
  },
  tubi_reality: {
    id: 'tubi_reality', name: 'Tubi Reality', number: null, group: 'Tubi',
    color: '#FF6347', logo: channelLogoSVG('REAL', '#FF6347'),
    categories: ['streaming', 'tubi', 'entertainment', 'live']
  },
  tubi_documentary: {
    id: 'tubi_documentary', name: 'Tubi Docs', number: null, group: 'Tubi',
    color: '#2E8B57', logo: channelLogoSVG('DOCS', '#2E8B57'),
    categories: ['streaming', 'tubi', 'documentary', 'live']
  },
  tubi_truecrime: {
    id: 'tubi_truecrime', name: 'Tubi True Crime', number: null, group: 'Tubi',
    color: '#2C2C2C', logo: channelLogoSVG('CRIM', '#2C2C2C'),
    categories: ['streaming', 'tubi', 'documentary', 'live']
  },
  tubi_blackcinema: {
    id: 'tubi_blackcinema', name: 'Tubi Black Cinema', number: null, group: 'Tubi',
    color: '#1A1A1A', logo: channelLogoSVG('BLCK', '#1A1A1A'),
    categories: ['streaming', 'tubi', 'movies', 'live']
  },
  tubi_latino: {
    id: 'tubi_latino', name: 'Tubi En Español', number: null, group: 'Tubi',
    color: '#CE1126', logo: channelLogoSVG('ESP', '#CE1126'),
    categories: ['streaming', 'tubi', 'latino', 'live']
  },
  'tubi_nbcsports': {
    id: 'tubi_nbcsports', name: 'NBC Sports', number: null, group: 'Tubi',
    color: '#005EB8', logo: channelLogoSVG('NSPT', '#005EB8'),
    categories: ['streaming', 'tubi', 'sports', 'live']
  },
  tubi_fifa: {
    id: 'tubi_fifa', name: 'FIFA World Cup Hub', number: null, group: 'Tubi',
    color: '#326295', logo: channelLogoSVG('FIFA', '#326295'),
    categories: ['streaming', 'tubi', 'sports', 'live']
  },

  // ═══════════════════════════════════
  //  MISSING US CABLE CHANNELS
  // ═══════════════════════════════════
  cspan: {
    id: 'cspan', name: 'C-SPAN', number: 350, group: 'News',
    color: '#003366', logo: channelLogoSVG('CSP', '#003366'),
    categories: ['news', 'entertainment']
  },
  cspan2: {
    id: 'cspan2', name: 'C-SPAN 2', number: 351, group: 'News',
    color: '#003366', logo: channelLogoSVG('CS2', '#003366'),
    categories: ['news', 'entertainment']
  },
  newsnation: {
    id: 'newsnation', name: 'NewsNation', number: 307, group: 'News',
    color: '#003399', logo: channelLogoSVG('NEWS', '#003399'),
    categories: ['news']
  },
  tcm: {
    id: 'tcm', name: 'TCM', number: 256, group: 'Movies',
    color: '#2C2C2C', logo: channelLogoSVG('TCM', '#2C2C2C'),
    categories: ['movies']
  },
  hbo_signature: {
    id: 'hbo_signature', name: 'HBO Signature', number: 503, group: 'Movies',
    color: '#7B2D8E', logo: channelLogoSVG('HBOS', '#7B2D8E'),
    categories: ['movies']
  },
  encore: {
    id: 'encore', name: 'STARZ Encore', number: 540, group: 'Movies',
    color: '#1A1A6C', logo: channelLogoSVG('ESU', '#1A1A6C'),
    categories: ['movies']
  },
  moviechannel: {
    id: 'moviechannel', name: 'The Movie Channel', number: 553, group: 'Movies',
    color: '#8B0000', logo: channelLogoSVG('TMC', '#8B0000'),
    categories: ['movies']
  },
  foodnetwork: {
    id: 'foodnetwork', name: 'Food Network', number: 231, group: 'Discovery',
    color: '#4CAF50', logo: channelLogoSVG('FOOD', '#4CAF50'),
    categories: ['discovery', 'entertainment']
  },
  tennis: {
    id: 'tennis', name: 'Tennis Channel', number: 217, group: 'Sports',
    color: '#2E8B57', logo: channelLogoSVG('TEN', '#2E8B57'),
    categories: ['sports']
  },
  ifc: {
    id: 'ifc', name: 'IFC', number: 333, group: 'Entertainment',
    color: '#1A1A1A', logo: channelLogoSVG('IFC', '#1A1A1A'),
    categories: ['entertainment', 'comedy']
  },
  sundance: {
    id: 'sundance', name: 'SundanceTV', number: 334, group: 'Entertainment',
    color: '#2D5F2D', logo: channelLogoSVG('SUN', '#2D5F2D'),
    categories: ['entertainment', 'movies']
  },
  wetv: {
    id: 'wetv', name: 'WE tv', number: 260, group: 'Entertainment',
    color: '#E91E63', logo: channelLogoSVG('WE', '#E91E63'),
    categories: ['entertainment', 'reality']
  },
  hallmarkmovies: {
    id: 'hallmarkmovies', name: 'Hallmark Movies', number: 314, group: 'Entertainment',
    color: '#8B4513', logo: channelLogoSVG('HMM', '#8B4513'),
    categories: ['entertainment', 'movies']
  },
  ion: {
    id: 'ion', name: 'ION Television', number: 306, group: 'Entertainment',
    color: '#1565C0', logo: channelLogoSVG('ION', '#1565C0'),
    categories: ['entertainment', 'broadcast']
  },
  uptv: {
    id: 'uptv', name: 'UPtv', number: 338, group: 'Entertainment',
    color: '#FF8F00', logo: channelLogoSVG('UP', '#FF8F00'),
    categories: ['entertainment']
  },
  gacfamily: {
    id: 'gacfamily', name: 'GAC Family', number: 326, group: 'Entertainment',
    color: '#D32F2F', logo: channelLogoSVG('GAC', '#D32F2F'),
    categories: ['entertainment', 'movies']
  },
  boomerang: {
    id: 'boomerang', name: 'Boomerang', number: 298, group: 'Kids',
    color: '#FF6F00', logo: channelLogoSVG('BOOM', '#FF6F00'),
    categories: ['kids']
  },
  bether: {
    id: 'bether', name: 'BET Her', number: 330, group: 'Entertainment',
    color: '#880E4F', logo: channelLogoSVG('HER', '#880E4F'),
    categories: ['entertainment', 'latino']
  },
  espndeportes: {
    id: 'espndeportes', name: 'ESPN Deportes', number: 468, group: 'Latino',
    color: '#FF3D00', logo: channelLogoSVG('ESPD', '#FF3D00'),
    categories: ['sports', 'latino']
  },
  cheddar: {
    id: 'cheddar', name: 'Cheddar', number: 352, group: 'News',
    color: '#FF6D00', logo: channelLogoSVG('CHD', '#FF6D00'),
    categories: ['news', 'streaming']
  },
  fusetv: {
    id: 'fusetv', name: 'Fuse', number: 339, group: 'Music',
    color: '#00BCD4', logo: channelLogoSVG('FUSE', '#00BCD4'),
    categories: ['music', 'entertainment']
  },
  revolt: {
    id: 'revolt', name: 'Revolt', number: 384, group: 'Music',
    color: '#212121', logo: channelLogoSVG('RVT', '#212121'),
    categories: ['music']
  },
  ovation: {
    id: 'ovation', name: 'Ovation', number: 274, group: 'Entertainment',
    color: '#5D4037', logo: channelLogoSVG('OVA', '#5D4037'),
    categories: ['entertainment', 'documentary']
  },
  gustotv: {
    id: 'gustotv', name: 'Gusto TV', number: 236, group: 'Discovery',
    color: '#E65100', logo: channelLogoSVG('GSTO', '#E65100'),
    categories: ['discovery']
  },
  qvc: {
    id: 'qvc', name: 'QVC', number: 275, group: 'Entertainment',
    color: '#1A237E', logo: channelLogoSVG('QVC', '#1A237E'),
    categories: ['entertainment']
  },
  hsn: {
    id: 'hsn', name: 'HSN', number: 276, group: 'Entertainment',
    color: '#00695C', logo: channelLogoSVG('HSN', '#00695C'),
    categories: ['entertainment']
  }
};

// ── CHANNEL CATEGORIES (for filter tabs) ──
const CHANNEL_CATEGORIES = [
  { id: 'all', label: '📺 All Channels' },
  { id: 'live', label: '● Live TV' },
  { id: 'broadcast', label: '📡 Broadcast' },
  { id: 'news', label: '📰 News' },
  { id: 'sports', label: '🏈 Sports' },
  { id: 'entertainment', label: '🎬 Entertainment' },
  { id: 'discovery', label: '🔬 Discovery' },
  { id: 'movies', label: '🎥 Movies' },
  { id: 'kids', label: '🧒 Kids' },
  { id: 'comedy', label: '😂 Comedy' },
  { id: 'documentary', label: '📚 Documentary' },
  { id: 'latino', label: '🌎 Latino' },
  { id: 'streaming', label: '📱 Streaming' },
  { id: 'tubi', label: '🆓 Tubi Free TV' },
  { id: 'music', label: '🎵 Music' }
];

// ── DIRECTV CHANNEL MAP (number → channel, for lookup) ──
const DIRECTV_CHANNELS = Object.values(CHANNEL_DATABASE)
  .filter(ch => ch.number !== null)
  .sort((a, b) => a.number - b.number);

// ── HELPER: Get channels by category ──
function getChannelsByCategory(categoryId) {
  if (categoryId === 'all') return Object.values(CHANNEL_DATABASE);
  return Object.values(CHANNEL_DATABASE).filter(ch =>
    ch.categories.includes(categoryId)
  );
}

// ── HELPER: Get channel by DirecTV number ──
function getChannelByNumber(number) {
  return Object.values(CHANNEL_DATABASE).find(ch => ch.number === number);
}

// ── HELPER: Fallback SVG logo generator (when Wikipedia images fail) ──
function channelLogoSVG(name, color = '#e50914') {
  const initials = name.replace(/[^A-Z0-9]/gi, '').substring(0, 3).toUpperCase();
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" rx="12" fill="${color}"/><text x="50%" y="54%" dominant-baseline="central" text-anchor="middle" fill="white" font-family="Inter,system-ui,sans-serif" font-size="22" font-weight="800">${initials}</text></svg>`)}`;
}

// ══════════════════════════════════════════════════════════════
//  LIVE STREAM URLs — Real M3U8/HLS streams for cable channels
//  Source: iptv-org free streams + verified working URLs
// ══════════════════════════════════════════════════════════════
const LIVE_STREAM_URLS = {
  // ── BROADCAST ──
  abc: 'http://41.205.93.154/ABC/index.m3u8',
  nbc: 'https://nbculocallive.akamaized.net/hls/live/2037084/losangeles/stream1/master.m3u8',
  fox: 'https://fox-foxnewsnow-vizio.amagi.tv/playlist.m3u8',
  pbskids: 'https://livestream.pbskids.org/out/v1/14507d931bbe48a69287e4850e53443c/est.m3u8',

  // ── NEWS ──
  foxnews: 'http://41.205.93.154/FOX-NEWS/index.m3u8',
  bloomberg: 'https://www.bloomberg.com/media-manifest/streams/originals-global.m3u8',
  weatherchannel: 'https://247wlive.foxweather.com/stream/index.m3u8',
  cnbc: 'https://live.cnbcindonesia.com/livecnbc/smil:cnbctv.smil/playlist.m3u8',
  cspan: 'https://www.c-span.org/networks/?channel=c-span',
  cspan2: 'https://www.c-span.org/networks/?channel=c-span-2',
  newsnation: 'https://www.newsnationnow.com/live/',

  // ── ENTERTAINMENT ──
  comedycentral: 'http://23.237.104.106:8080/USA_COMEDY_CENTRAL/index.m3u8',
  nickelodeon: 'http://23.237.104.106:8080/USA_NICKELODEON/index.m3u8',
  disneyjr: 'http://23.237.104.106:8080/USA_DISNEY_JUNIOR/index.m3u8',
  disneyxd: 'http://23.237.104.106:8080/USA_DISNEY_XD/index.m3u8',

  // ── TUBI FREE CHANNELS (open in Tubi player) ──
  tubi: 'https://tubitv.com/live',
  tubi_livenowfox: 'https://tubitv.com/live',
  tubi_nbcnewsnow: 'https://tubitv.com/live',
  tubi_abcnews: 'https://tubitv.com/live',
  tubi_fs1: 'https://tubitv.com/live',
  tubi_nfl: 'https://tubitv.com/live',
  tubi_movies: 'https://tubitv.com/live',
  tubi_horror: 'https://tubitv.com/live',
  tubi_scifi: 'https://tubitv.com/live',
  tubi_action: 'https://tubitv.com/live',
  tubi_comedy: 'https://tubitv.com/live',
  tubi_mystery: 'https://tubitv.com/live',
  tubi_documentary: 'https://tubitv.com/live',
  tubi_truecrime: 'https://tubitv.com/live',
  tubi_kids: 'https://tubitv.com/live',
  tubi_classictv: 'https://tubitv.com/live',
  tubi_reality: 'https://tubitv.com/live',
  tubi_western: 'https://tubitv.com/live',
  tubi_blackcinema: 'https://tubitv.com/live',
  tubi_latino: 'https://tubitv.com/live',
  tubi_boxing: 'https://tubitv.com/live',
  tubi_dateline: 'https://tubitv.com/live',
  tubi_svutubich: 'https://tubitv.com/live',
  tubi_familyfeud: 'https://tubitv.com/live',
  tubi_weather: 'https://tubitv.com/live',
  tubi_howardstern: 'https://tubitv.com/live',
  tubi_cooking: 'https://tubitv.com/live',
  tubi_howitsmade: 'https://tubitv.com/live',
  tubi_bloomberg: 'https://tubitv.com/live',
  tubi_fastmoney: 'https://tubitv.com/live',
  tubi_topstory: 'https://tubitv.com/live',
  tubi_localish: 'https://tubitv.com/live',
  tubi_patrolcourt: 'https://tubitv.com/live',
  tubi_tmzsports: 'https://tubitv.com/live',
  tubi_nascar: 'https://tubitv.com/live',
  tubi_nbcnewsnow: 'https://tubitv.com/live',
  tubi_nflhighlights: 'https://tubitv.com/live',
  tubi_nfldaily: 'https://tubitv.com/live',
  tubi_nbcsports: 'https://tubitv.com/live',
  tubi_fifa: 'https://tubitv.com/live',

  // ── TVPASS.ORG LIVE STREAMS (auto-mapped by flix-ai) ──
  // 177 free live TV channels from the-tv.app / tvpass.org
  // Pattern: https://tvpass.org/live/{STREAM_ID}/hd  (/sd for standard)
  abc: 'https://tvpass.org/live/abc-kabc-los-angeles-ca/hd',
  cbs: 'https://tvpass.org/live/cbs-kcbs-los-angeles-ca/hd',
  nbc: 'https://tvpass.org/live/nbc-knbc-los-angeles-ca/hd',
  fox: 'https://tvpass.org/live/fox-kttv-los-angeles-ca/hd',
  pbs: 'https://tvpass.org/live/PBSEast/hd',
  thecw: 'https://tvpass.org/live/cw-kfmbtv2-san-diego-ca/hd',
  cnn: 'https://tvpass.org/live/CNN/hd',
  foxnews: 'https://tvpass.org/live/FoxNewsChannel/hd',
  msnbc: 'https://tvpass.org/live/MSNBC/hd',
  cnbc: 'https://tvpass.org/live/CNBC/hd',
  bloomberg: 'https://tvpass.org/live/BloombergTV/hd',
  weatherchannel: 'https://tvpass.org/live/WeatherChannel/hd',
  espn: 'https://tvpass.org/live/ESPN/hd',
  espn2: 'https://tvpass.org/live/ESPN2/hd',
  espnews: 'https://tvpass.org/live/ESPNews/hd',
  espnu: 'https://tvpass.org/live/ESPNU/hd',
  foxsports1: 'https://tvpass.org/live/FoxSports1/hd',
  foxsports2: 'https://tvpass.org/live/FoxSports2/hd',
  nflnetwork: 'https://tvpass.org/live/NFLNetwork/hd',
  mlbnetwork: 'https://tvpass.org/live/MLBNetwork/hd',
  nbanetwork: 'https://tvpass.org/live/NBATV/hd',
  nbcsn: 'https://tvpass.org/live/BTN/hd',
  amc: 'https://tvpass.org/live/AMCEast/hd',
  aetv: 'https://tvpass.org/live/AEEast/hd',
  comedycentral: 'https://tvpass.org/live/ComedyCentralEast/hd',
  discovery: 'https://tvpass.org/live/DiscoveryChannelEast/hd',
  animalplanet: 'https://tvpass.org/live/AnimalPlanetEast/hd',
  tlc: 'https://tvpass.org/live/TLCEast/hd',
  hgtv: 'https://tvpass.org/live/HGTV/hd',
  foodnetwork: 'https://tvpass.org/live/FoodNetwork/hd',
  bravo: 'https://tvpass.org/live/BravoEast/hd',
  syfy: 'https://tvpass.org/live/SyfyEast/hd',
  usa: 'https://tvpass.org/live/USANetworkEast/hd',
  tbs: 'https://tvpass.org/live/TBSDriveEast/hd',
  tnt: 'https://tvpass.org/live/TNTEast/hd',
  trutv: 'https://tvpass.org/live/TruTVEast/hd',
  history: 'https://tvpass.org/live/HistoryEast/hd',
  lifetime: 'https://tvpass.org/live/LifetimeEast/hd',
  nickelodeon: 'https://tvpass.org/live/NickelodeonEast/hd',
  disneyjr: 'https://tvpass.org/live/DisneyJuniorEast/hd',
  disneyxd: 'https://tvpass.org/live/DisneyXDEast/hd',
  cartoonnetwork: 'https://tvpass.org/live/CartoonNetworkEast/hd',
  mtv: 'https://tvpass.org/live/MTVEast/hd',
  vh1: 'https://tvpass.org/live/VH1East/hd',
  cmt: 'https://tvpass.org/live/CMTEast/hd',
  bet: 'https://tvpass.org/live/BETEast/hd',
  bether: 'https://tvpass.org/live/BETHerEast/hd',
  paramount: 'https://tvpass.org/live/ParamountNetworkEast/hd',
  eentertainment: 'https://tvpass.org/live/EntertainmentEast/hd',
  oxygen: 'https://tvpass.org/live/OxygenEast/hd',
  freeform: 'https://tvpass.org/live/FreeformEast/hd',
  fx: 'https://tvpass.org/live/FXEast/hd',
  fxx: 'https://tvpass.org/live/FXXEast/hd',
  hallmark: 'https://tvpass.org/live/HallmarkEast/hd',
  hbo: 'https://tvpass.org/live/HBOEast/hd',
  hbo2: 'https://tvpass.org/live/HBO2East/hd',
  showtime: 'https://tvpass.org/live/ShowtimeEast/hd',
  cinemax: 'https://tvpass.org/live/CinemaxEast/hd',
  cspan: 'https://tvpass.org/live/CSPAN/hd',
  cspan2: 'https://tvpass.org/live/CSPAN2/hd',
  bbcworld: 'https://tvpass.org/live/BBCWorldNewsNorthAmerica/hd',
  foxbusiness: 'https://tvpass.org/live/FoxBusiness/hd',
  investigation_discovery: 'https://tvpass.org/live/InvestigationDiscoveryEast/hd',
  cookingchannel: 'https://tvpass.org/live/CookingChannel/hd',
  trvl: 'https://tvpass.org/live/TravelChannelEast/hd',
  discovery_science: 'https://tvpass.org/live/DiscoveryScienceEast/hd',
  discovery_life: 'https://tvpass.org/live/DiscoveryLife/hd',
  own: 'https://tvpass.org/live/OWNEast/hd',
  magnolia: 'https://tvpass.org/live/MagnoliaNetwork/hd',
  ion: 'https://tvpass.org/live/ION/hd',
  nickjr: 'https://tvpass.org/live/NickJrEast/hd',
  teenick: 'https://tvpass.org/live/TeenNickEast/hd',
  tvland: 'https://tvpass.org/live/tv-land-eastern/hd',
  pop: 'https://tvpass.org/live/PopTV/hd',
  sundance: 'https://tvpass.org/live/SundanceTVEast/hd',
  ifc: 'https://tvpass.org/live/IFCEast/hd',
  wetv: 'https://tvpass.org/live/WETVEast/hd',
  gustotv: 'https://tvpass.org/live/GustoTV/hd',
  boomerang: 'https://tvpass.org/live/Boomerang/hd',
  tennis: 'https://tvpass.org/live/TennisChannel/hd',
  espndeportes: 'https://tvpass.org/live/espn-deportes/hd',
  pbskids: 'https://tvpass.org/live/PBSKids/hd',
};

// ── MACATTACK PORTAL PRESETS — known stalker portal configs ──
const MACATTACK_PORTAL_PRESETS = [
  { name: 'Portal A3', url: 'http://www.streamtv.to:8080/c/', prefix: '00:1A:79:', mac: '00:1A:79:A3:96:BF' },
];

// ── MACATTACK SCANNER — sound alert when portal found ──
// Audio context for hit alerts
let macAttackAudioCtx = null;
function macAttackAlertSound() {
  try {
    if (!macAttackAudioCtx) macAttackAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = macAttackAudioCtx.createOscillator();
    const gain = macAttackAudioCtx.createGain();
    osc.connect(gain);
    gain.connect(macAttackAudioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, macAttackAudioCtx.currentTime);      // A5
    osc.frequency.setValueAtTime(1320, macAttackAudioCtx.currentTime + 0.1); // E6
    osc.frequency.setValueAtTime(1760, macAttackAudioCtx.currentTime + 0.2); // A6
    gain.gain.setValueAtTime(0.3, macAttackAudioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, macAttackAudioCtx.currentTime + 0.4);
    osc.start(macAttackAudioCtx.currentTime);
    osc.stop(macAttackAudioCtx.currentTime + 0.4);
  } catch (e) { /* Audio not available */ }
}

// ── Channel stream player ──
// Plays an M3U8/HLS stream using an iframe (for sites that embed) or HTML5 video (for raw m3u8)
function playChannelStream(channelId) {
  const ch = CHANNEL_DATABASE[channelId];
  const streamUrl = LIVE_STREAM_URLS[channelId];
  if (!ch || !streamUrl) {
    console.warn('No stream URL for channel:', channelId);
    return;
  }

  // Use the main player overlay
  const overlay = document.getElementById('player-overlay');
  const videoWrap = document.getElementById('player-video-wrap');
  const title = document.getElementById('player-title');
  const sourceTabs = document.getElementById('player-source-tabs');
  const prevBtn = document.getElementById('player-prev-btn');
  const nextBtn = document.getElementById('player-next-btn');

  if (!overlay || !videoWrap) return;

  // Set up player for live TV
  currentMovieId = channelId;
  currentIsTV = false;
  currentSource = 'livetv';
  isPlaying = true;

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  if (title) title.textContent = `📺 ${ch.name} — LIVE`;
  if (sourceTabs) sourceTabs.style.display = 'none';
  if (prevBtn) prevBtn.style.display = 'none';
  if (nextBtn) nextBtn.style.display = 'none';

  // Show skull spinner
  showPlayerSpinner(`💀 Connecting to ${ch.name}...`);
  setSkullEyes('red');

  // Determine actual stream URL — route through server proxy with header injection
  let resolvedUrl = streamUrl;
  const isTVPassUrl = streamUrl.includes('tvpass.org') || streamUrl.includes('the-tv.app');
  if (isTVPassUrl) {
    resolvedUrl = `/api/tvpass-stream?url=${encodeURIComponent(streamUrl)}`;
  } else if (streamUrl.includes('.m3u8') || streamUrl.includes('m3u8')) {
    // Generic HLS streams — route through proxy for header injection
    resolvedUrl = `/api/hls-proxy?url=${encodeURIComponent(streamUrl)}`;
  }

  // Try HLS.js first for m3u8, then fallback to iframe
  videoWrap.innerHTML = '';

  // tvpass.org streams & HLS URLs — force HLS.js (they're always HLS even without .m3u8 extension)
  const forceHLS = isTVPassUrl || streamUrl.endsWith('.m3u8');
  if (forceHLS && typeof Hls !== 'undefined') {
    const video = document.createElement('video');
    video.id = 'live-hls-player';
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.background = '#000';
    video.controls = true;

    const hls = new Hls({
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 90,
      // Inject required headers on every XHR (manifest + segments)
      xhrSetup: function(xhr, url) {
        xhr.setRequestHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        xhr.setRequestHeader('Referer', window.location.origin);
        xhr.setRequestHeader('Origin', window.location.origin);
        xhr.withCredentials = false;
      },
    });

    hls.loadSource(resolvedUrl);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(() => {});
      hidePlayerSpinner();
      setSkullConnected(ch.name);
      macAttackAlertSound(); // 🔊 Alert on successful connect
    });
    hls.on(Hls.Events.ERROR, (event, data) => {
      // Auto-retry through ffmpeg transcoder on codec errors (HEVC/H.265)
      if (data.details === 'BUFFER_INCOMPATIBLE_CODECS' || data.details === 'FRAG_PARSING_ERROR' || (data.type === Hls.ErrorTypes.MEDIA_ERROR && !streamUrl.includes('/api/transcode'))) {
        console.warn('Codec error detected — retrying through transcoder...', data);
        hls.destroy();
        const transcodeUrl = `/api/transcode/master.m3u8?url=${encodeURIComponent(streamUrl)}`;
        const hls2 = new Hls({
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
          xhrSetup: function(xhr, url) {
            xhr.setRequestHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
            xhr.setRequestHeader('Referer', window.location.origin);
            xhr.setRequestHeader('Origin', window.location.origin);
            xhr.withCredentials = false;
          },
        });
        hls2.loadSource(transcodeUrl);
        hls2.attachMedia(video);
        hls2.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
          hidePlayerSpinner();
          setSkullConnected(ch.name + ' (H.264)');
          macAttackAlertSound();
        });
        hls2.on(Hls.Events.ERROR, (e2, d2) => {
          if (d2.fatal) {
            console.warn('Transcode also failed, falling back to iframe:', d2);
            tryEmbedStream(videoWrap, streamUrl, ch);
          }
        });
        window._currentHls = hls2;
        return;
      }
      if (data.fatal) {
        console.warn('HLS fatal error, falling back to iframe:', data);
        tryEmbedStream(videoWrap, streamUrl, ch);
      }
    });
    videoWrap.appendChild(video);
    // Save hls instance for cleanup
    videoWrap.dataset.hlsInstance = 'true';
    window._currentHls = hls;
  } else if (streamUrl.endsWith('.m3u8') && videoWrap.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari HLS support
    const video = document.createElement('video');
    video.src = resolvedUrl;
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.controls = true;
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.background = '#000';
    video.addEventListener('playing', () => {
      hidePlayerSpinner();
      setSkullConnected(ch.name);
      macAttackAlertSound();
    });
    video.addEventListener('error', () => tryEmbedStream(videoWrap, streamUrl, ch));
    videoWrap.appendChild(video);
  } else {
    // Fallback: embed as iframe
    tryEmbedStream(videoWrap, streamUrl, ch);
  }
}

function tryEmbedStream(container, streamUrl, ch) {
  container.innerHTML = '';
  const iframe = document.createElement('iframe');
  iframe.src = streamUrl;
  iframe.allow = 'autoplay; fullscreen; encrypted-media';
  iframe.allowFullscreen = true;
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.style.background = '#000';
  container.appendChild(iframe);

  // For iframe, we can't detect when it loads, so just show after delay
  setTimeout(() => {
    hidePlayerSpinner();
    setSkullConnected(ch.name);
    macAttackAlertSound();
  }, 2000);
}