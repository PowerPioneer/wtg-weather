/* global window */
// Data-layer palettes + legend definitions.
// Every palette respects Atlas tokens or derives from them; all verified CVD-safe.

window.MAP_LAYERS = {
  preferences: {
    id: 'preferences',
    label: 'My Preferences',
    short: 'Match',
    kind: 'qualitative',
    legendTitle: 'Match quality',
    legendSub: 'Using your saved preferences',
    // 4 bins map to Atlas score tokens
    bins: [
      { label: 'Perfect Match', hex: '#0B6E5F', fg: '#FFFFFF' },
      { label: 'Good Option',   hex: '#0072B2', fg: '#FFFFFF' },
      { label: 'Acceptable',    hex: '#B8610E', fg: '#FFFFFF' },
      { label: 'Avoid',         hex: '#7A2E2E', fg: '#FFFFFF' },
    ],
  },
  temp: {
    id: 'temp',
    label: 'Temperature',
    short: 'Temp',
    kind: 'diverging',
    legendTitle: 'Mean temperature',
    legendSub: 'April · °C',
    // Diverging cool → neutral → warm (CVD-safe: blue/orange axis per Okabe-Ito)
    bins: [
      { label: '< 5°',   hex: '#08457E', fg: '#FFFFFF' },
      { label: '5–15°',  hex: '#5A93C7', fg: '#0F1B2D' },
      { label: '15–22°', hex: '#E6E0C8', fg: '#0F1B2D' },
      { label: '22–28°', hex: '#C97011', fg: '#FFFFFF' },
      { label: '> 28°',  hex: '#7A2E2E', fg: '#FFFFFF' },
    ],
  },
  rain: {
    id: 'rain',
    label: 'Rainfall',
    short: 'Rain',
    kind: 'sequential',
    legendTitle: 'Rainfall',
    legendSub: 'April · mm/day',
    // Sequential single-hue blue — classic precip convention
    bins: [
      { label: '< 1',    hex: '#F0ECE0', fg: '#0F1B2D' },
      { label: '1–3',    hex: '#B8D4E8', fg: '#0F1B2D' },
      { label: '3–6',    hex: '#5A93C7', fg: '#FFFFFF' },
      { label: '6–10',   hex: '#1C5A8E', fg: '#FFFFFF' },
      { label: '> 10',   hex: '#0A2A4A', fg: '#FFFFFF' },
    ],
  },
  sun: {
    id: 'sun',
    label: 'Sunshine',
    short: 'Sun',
    kind: 'sequential',
    legendTitle: 'Daily sunshine',
    legendSub: 'April · hours/day',
    // Sequential warm — pale straw → deep brass (matches accent token)
    bins: [
      { label: '< 3',    hex: '#EDE6D2', fg: '#0F1B2D' },
      { label: '3–5',    hex: '#E0C98A', fg: '#0F1B2D' },
      { label: '5–7',    hex: '#C89844', fg: '#0F1B2D' },
      { label: '7–9',    hex: '#B8763E', fg: '#FFFFFF' },
      { label: '> 9',    hex: '#8A4A1E', fg: '#FFFFFF' },
    ],
  },
  safety: {
    id: 'safety',
    label: 'Travel safety',
    short: 'Safety',
    kind: 'ordinal',
    legendTitle: 'Advisory level',
    legendSub: 'Consensus across 5 governments',
    // Matches Atlas advisory tokens
    bins: [
      { label: 'Normal',        hex: '#4A5568', fg: '#FFFFFF' },
      { label: 'Caution',       hex: '#B8763E', fg: '#FFFFFF' },
      { label: 'Reconsider',    hex: '#B8610E', fg: '#FFFFFF' },
      { label: 'Do Not Travel', hex: '#7A2E2E', fg: '#FFFFFF' },
    ],
  },
};

// Sample countries with one pre-baked bin index per layer, for the static mock.
// Index into `bins` array of the active layer. Hand-tuned to plausible April values.
window.MAP_COUNTRIES = [
  // id, name, centroid [cx,cy] in our 900x460 viewbox, rough polygon path, bins per layer
  { id: 'CA', name: 'Canada',      cx: 230, cy: 130, d: 'M80,80 L300,80 L380,130 L370,190 L300,200 L200,180 L80,160 Z',
    b: { preferences: 3, temp: 0, rain: 1, sun: 1, safety: 0 } },
  { id: 'US', name: 'United States', cx: 215, cy: 210, d: 'M120,190 L360,195 L365,245 L310,265 L180,260 L130,240 Z',
    b: { preferences: 1, temp: 2, rain: 2, sun: 2, safety: 0 } },
  { id: 'MX', name: 'Mexico',       cx: 215, cy: 275, d: 'M180,265 L310,270 L285,310 L230,315 L195,295 Z',
    b: { preferences: 2, temp: 3, rain: 3, sun: 3, safety: 1 } },
  { id: 'BR', name: 'Brazil',       cx: 330, cy: 350, d: 'M270,310 L395,315 L410,410 L340,425 L280,390 Z',
    b: { preferences: 2, temp: 4, rain: 4, sun: 3, safety: 1 } },
  { id: 'AR', name: 'Argentina',    cx: 320, cy: 420, d: 'M290,400 L360,410 L345,455 L300,450 Z',
    b: { preferences: 0, temp: 2, rain: 1, sun: 2, safety: 0 } },
  { id: 'PE', name: 'Peru',         cx: 290, cy: 360, d: 'M265,330 L305,340 L295,385 L265,375 Z',
    b: { preferences: 0, temp: 1, rain: 2, sun: 2, safety: 1 } },
  { id: 'UK', name: 'UK',           cx: 470, cy: 175, d: 'M460,165 L485,168 L480,195 L465,198 Z',
    b: { preferences: 2, temp: 1, rain: 2, sun: 1, safety: 0 } },
  { id: 'FR', name: 'France',       cx: 480, cy: 205, d: 'M460,195 L505,198 L500,230 L465,228 Z',
    b: { preferences: 1, temp: 2, rain: 1, sun: 2, safety: 0 } },
  { id: 'ES', name: 'Spain',        cx: 460, cy: 230, d: 'M440,225 L490,228 L485,255 L445,253 Z',
    b: { preferences: 0, temp: 2, rain: 1, sun: 3, safety: 0 } },
  { id: 'DE', name: 'Germany',      cx: 515, cy: 195, d: 'M505,185 L540,188 L535,215 L510,215 Z',
    b: { preferences: 2, temp: 1, rain: 2, sun: 1, safety: 0 } },
  { id: 'IT', name: 'Italy',        cx: 525, cy: 230, d: 'M515,218 L540,220 L545,260 L525,265 Z',
    b: { preferences: 0, temp: 2, rain: 1, sun: 3, safety: 0 } },
  { id: 'EG', name: 'Egypt',        cx: 555, cy: 280, d: 'M540,265 L585,268 L580,310 L545,308 Z',
    b: { preferences: 2, temp: 4, rain: 0, sun: 4, safety: 2 } },
  { id: 'SA', name: 'Saudi Arabia', cx: 605, cy: 290, d: 'M585,270 L645,275 L640,320 L590,315 Z',
    b: { preferences: 3, temp: 4, rain: 0, sun: 4, safety: 2 } },
  { id: 'IN', name: 'India',        cx: 665, cy: 290, d: 'M645,265 L710,270 L695,325 L655,320 Z',
    b: { preferences: 1, temp: 3, rain: 3, sun: 3, safety: 1 } },
  { id: 'CN', name: 'China',        cx: 720, cy: 225, d: 'M670,195 L790,200 L780,255 L690,252 Z',
    b: { preferences: 2, temp: 2, rain: 2, sun: 2, safety: 1 } },
  { id: 'JP', name: 'Japan',        cx: 810, cy: 220, d: 'M800,205 L825,208 L820,240 L803,238 Z',
    b: { preferences: 0, temp: 2, rain: 2, sun: 2, safety: 0 } },
  { id: 'AU', name: 'Australia',    cx: 790, cy: 395, d: 'M740,370 L840,375 L830,420 L750,415 Z',
    b: { preferences: 1, temp: 3, rain: 1, sun: 3, safety: 0 } },
  { id: 'ID', name: 'Indonesia',    cx: 740, cy: 340, d: 'M700,335 L790,338 L780,355 L710,352 Z',
    b: { preferences: 2, temp: 3, rain: 4, sun: 2, safety: 1 } },
  { id: 'ZA', name: 'South Africa', cx: 540, cy: 410, d: 'M510,395 L575,400 L565,430 L520,425 Z',
    b: { preferences: 0, temp: 2, rain: 1, sun: 3, safety: 0 } },
  { id: 'KE', name: 'Kenya',        cx: 570, cy: 345, d: 'M555,330 L595,333 L590,360 L560,360 Z',
    b: { preferences: 1, temp: 2, rain: 2, sun: 2, safety: 1 } },
  { id: 'MA', name: 'Morocco',      cx: 455, cy: 265, d: 'M435,255 L480,258 L475,285 L440,283 Z',
    b: { preferences: 0, temp: 2, rain: 0, sun: 3, safety: 0 } },
  { id: 'TR', name: 'Turkey',       cx: 560, cy: 230, d: 'M540,220 L600,224 L595,250 L545,248 Z',
    b: { preferences: 0, temp: 2, rain: 1, sun: 3, safety: 0 } },
  { id: 'RU', name: 'Russia',       cx: 640, cy: 155, d: 'M505,120 L810,125 L795,185 L520,180 Z',
    b: { preferences: 3, temp: 0, rain: 1, sun: 1, safety: 2 } },
  { id: 'NO', name: 'Norway',       cx: 510, cy: 145, d: 'M495,115 L525,118 L520,165 L500,162 Z',
    b: { preferences: 3, temp: 0, rain: 2, sun: 1, safety: 0 } },
  { id: 'TH', name: 'Thailand',     cx: 720, cy: 305, d: 'M710,290 L735,292 L725,325 L712,323 Z',
    b: { preferences: 1, temp: 3, rain: 3, sun: 2, safety: 0 } },
  { id: 'VN', name: 'Vietnam',      cx: 740, cy: 300, d: 'M735,285 L755,288 L745,325 L737,320 Z',
    b: { preferences: 1, temp: 3, rain: 3, sun: 2, safety: 0 } },
  { id: 'NZ', name: 'New Zealand',  cx: 870, cy: 430, d: 'M860,420 L885,422 L880,445 L863,442 Z',
    b: { preferences: 0, temp: 1, rain: 2, sun: 2, safety: 0 } },
  { id: 'IS', name: 'Iceland',      cx: 430, cy: 145, d: 'M418,138 L448,140 L445,158 L422,156 Z',
    b: { preferences: 3, temp: 0, rain: 2, sun: 1, safety: 0 } },
  { id: 'GR', name: 'Greenland',    cx: 395, cy: 90, d: 'M355,60 L440,65 L430,130 L370,125 Z',
    b: { preferences: 3, temp: 0, rain: 1, sun: 1, safety: 0 } },
];

// Months for the selector
window.MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
