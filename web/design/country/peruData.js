/* global window */
// Peru country data — 10-year monthly climatology (ERA5), 25 admin-1 regions, advisories.
// Numbers are realistic placeholders grounded in known Peru climate patterns
// (dry coast, wet highlands Oct-Mar, moderate Amazon). Final integration: replace
// with real ERA5 pulls.

window.COUNTRY = {
  slug: 'peru',
  name: 'Peru',
  nameLocal: 'República del Perú',
  capital: 'Lima',
  region: 'South America',
  coastal: true,
  hasSnow: true,
  currency: 'PEN',
  language: 'Spanish, Quechua, Aymara',
  tz: 'UTC−5',
  area: '1,285,216 km²',
  population: '34.0M',

  // Short serif-worthy opening paragraph
  summary:
    'Peru spans three climates in one country: the rainless Pacific coast, the high Andean sierra with cool-dry days and cold nights, and the humid Amazon lowlands. The coast stays mild year-round; the sierra is best from May through September when skies are clear; the jungle is warm and wet almost always. National averages hide all of this — the regional view below is the one that matters.',

  bestMonths: [
    { month: 'June',   score: 94, note: 'Dry sierra, clear skies, peak trekking' },
    { month: 'July',   score: 92, note: 'Coolest, driest — cold nights in Cusco' },
    { month: 'August', score: 89, note: 'Still dry, warmer days returning' },
  ],

  // 12-month climatology (national aggregate — aspirational narrative)
  // T = mean temp (°C), Tmin/Tmax = 10th/90th percentile bands (Premium)
  // R = rainfall (mm/month), S = sunshine hours/day, W = wind (km/h)
  climate: {
    months: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    t:     [22.1, 22.6, 22.2, 20.8, 18.7, 17.2, 16.4, 16.6, 17.3, 18.5, 19.8, 21.2],
    tMin:  [15.8, 16.2, 15.9, 14.5, 12.1, 10.3, 9.4,  9.7,  10.8, 12.2, 13.5, 14.9],
    tMax:  [28.4, 29.1, 28.7, 27.2, 25.3, 24.1, 23.3, 23.6, 24.2, 25.1, 26.3, 27.7],
    r:     [148, 168, 142, 72,  28,  12,  8,   12,  28,  62,  88, 118],
    s:     [5.8, 5.6, 5.9, 6.8, 7.2, 7.4, 7.6, 7.5, 7.1, 6.6, 6.2, 5.9],
    w:     [10.2, 10.8, 11.1, 10.4, 9.8, 10.1, 10.6, 11.2, 11.8, 11.5, 10.9, 10.5],
    // Premium variables
    snow:  [0,   0,   0,   0,   2,   6,   8,   7,   4,   1,   0,   0], // cm, Andean stations
    sst:   [22.8, 23.4, 23.2, 22.1, 20.4, 18.9, 18.2, 18.0, 18.4, 19.2, 20.3, 21.6], // Pacific
    heat:  [25.4, 26.1, 25.7, 23.8, 21.2, 19.5, 18.7, 19.0, 19.8, 21.0, 22.7, 24.5],
    hum:   [82,  83,  82,  80,  78,  76,  75,  76,  78,  80,  81,  82], // %
  },

  // 25 admin-1 regions (departamentos). score = current-month match to defaults.
  // sparkline = 12 monthly temps for that region.
  regions: [
    { name: 'Amazonas',      score: 71, tl: [26,26,26,26,25,24,24,25,26,26,26,26] },
    { name: 'Áncash',        score: 84, tl: [19,19,19,19,18,17,17,17,18,19,19,19] },
    { name: 'Apurímac',      score: 88, tl: [15,15,15,15,13,12,11,12,14,15,15,15] },
    { name: 'Arequipa',      score: 91, tl: [17,17,17,16,14,13,13,14,15,16,17,17] },
    { name: 'Ayacucho',      score: 86, tl: [16,16,16,15,13,12,12,13,14,15,16,16] },
    { name: 'Cajamarca',     score: 79, tl: [15,15,15,15,14,13,13,14,15,15,15,15] },
    { name: 'Callao',        score: 74, tl: [23,24,23,22,20,18,17,17,18,19,20,22] },
    { name: 'Cusco',         score: 93, tl: [13,13,13,13,11,10, 9,11,12,13,13,13] },
    { name: 'Huancavelica',  score: 85, tl: [10,10,10,10, 8, 7, 6, 7, 9,10,10,10] },
    { name: 'Huánuco',       score: 77, tl: [19,19,19,19,18,17,17,17,18,19,19,19] },
    { name: 'Ica',           score: 78, tl: [23,24,23,22,20,18,17,17,18,19,20,22] },
    { name: 'Junín',         score: 83, tl: [12,12,12,12,10, 9, 8,10,11,12,12,12] },
    { name: 'La Libertad',   score: 76, tl: [22,23,22,21,19,18,17,17,18,19,20,21] },
    { name: 'Lambayeque',    score: 72, tl: [24,25,24,23,21,19,18,19,20,21,22,23] },
    { name: 'Lima',          score: 74, tl: [23,24,23,22,20,18,17,17,18,19,20,22] },
    { name: 'Loreto',        score: 62, tl: [26,26,26,26,26,25,25,26,26,26,26,26] },
    { name: 'Madre de Dios', score: 64, tl: [26,26,26,26,24,22,22,24,26,26,26,26] },
    { name: 'Moquegua',      score: 89, tl: [18,18,18,17,15,14,13,14,15,16,17,18] },
    { name: 'Pasco',         score: 81, tl: [10,10,10,10, 9, 8, 7, 8, 9,10,10,10] },
    { name: 'Piura',         score: 70, tl: [26,27,26,25,23,21,20,20,21,22,23,25] },
    { name: 'Puno',          score: 82, tl: [10,10, 9, 9, 6, 4, 3, 5, 7, 8, 9,10] },
    { name: 'San Martín',    score: 68, tl: [25,25,25,25,24,23,22,23,24,25,25,25] },
    { name: 'Tacna',         score: 87, tl: [19,19,19,18,16,14,14,14,15,16,17,18] },
    { name: 'Tumbes',        score: 73, tl: [26,27,27,26,25,24,23,23,23,24,25,26] },
    { name: 'Ucayali',       score: 66, tl: [26,26,26,26,25,24,23,24,25,26,26,26] },
  ],

  advisories: {
    combined: { level: 2, label: 'Exercise increased caution', color: '#B88A2E' },
    lastUpdated: 'Apr 18, 2026',
    sources: [
      { gov: 'United States',  level: 2, label: 'Exercise increased caution', date: 'Apr 12, 2026', url: 'travel.state.gov/peru' },
      { gov: 'United Kingdom', level: 2, label: 'See our travel advice',       date: 'Apr 15, 2026', url: 'gov.uk/foreign-travel-advice/peru' },
      { gov: 'Canada',         level: 2, label: 'Exercise a high degree of caution', date: 'Apr 10, 2026', url: 'travel.gc.ca/destinations/peru' },
      { gov: 'Australia',      level: 1, label: 'Exercise normal safety precautions', date: 'Apr 16, 2026', url: 'smartraveller.gov.au/peru' },
      { gov: 'Germany',        level: 2, label: 'Teilreisewarnung',            date: 'Apr 14, 2026', url: 'auswaertiges-amt.de/peru' },
    ],
  },

  related: [
    { slug: 'ecuador',  name: 'Ecuador',  sub: 'Similar coastal + highland split',  score: 86 },
    { slug: 'bolivia',  name: 'Bolivia',  sub: 'Shares the altiplano climate',      score: 84 },
    { slug: 'colombia', name: 'Colombia', sub: 'Tropical Andes, warmer overall',    score: 82 },
    { slug: 'chile',    name: 'Chile',    sub: 'Atacama mirrors dry Peru coast',    score: 88 },
    { slug: 'nepal',    name: 'Nepal',    sub: 'Mountain-trek climate analog',       score: 79 },
    { slug: 'morocco',  name: 'Morocco',  sub: 'Comparable arid variability',        score: 77 },
  ],

  monthNotes: {
    Jan: 'Coast warm and humid; Andes wet (trekking season closed); Amazon peak rains.',
    Feb: 'Wettest month in the sierra. Inca Trail closed. Coastal cities pleasant.',
    Mar: 'Rains tapering. Carnival. Lima still warm, Cusco still wet.',
    Apr: 'Shoulder — green sierra, lighter rains. Fewer tourists, lower prices.',
    May: 'Dry season begins. Cool, clear in the highlands. Great value.',
    Jun: 'Peak trekking. Inti Raymi in Cusco. Cold nights, sunny days.',
    Jul: 'Coolest, driest month. Peak tourism — book ahead.',
    Aug: 'Dry continues. Amazon lowest water levels — easier wildlife viewing.',
    Sep: 'Shoulder returning. Fewer crowds, still mostly dry.',
    Oct: 'Rains returning to sierra. Coast beginning to warm.',
    Nov: 'Transition month. Wet in the Andes, summer building on coast.',
    Dec: 'High summer on the coast, full wet season inland. Christmas crowds.',
  },
};
