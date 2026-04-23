/* global window, React */
// Master catalog for every Display Mode variable.
// Each entry has: icon (named), palette, legend config, tier, copy.

// ─── Icon library (Lucide-flavored, single-stroke, 24×24) ──────────────────
// Stored as array of path specs — rendered by renderIcon() with React.
window.MODE_ICONS = {
  preferences: [
    ['path', { d: 'M12 2 L3 7 L3 17 L12 22 L21 17 L21 7 Z' }],
    ['path', { d: 'M12 12 L12 22' }],
    ['path', { d: 'M3 7 L12 12 L21 7' }],
  ],
  temperature: [
    ['path', { d: 'M14 4a2 2 0 0 0-4 0v10.5a4 4 0 1 0 4 0z' }],
    ['path', { d: 'M12 9v5.5' }],
  ],
  rainfall: [
    ['path', { d: 'M8 19v2M12 17v4M16 19v2' }],
    ['path', { d: 'M16 14a4 4 0 0 0 0-8 5 5 0 0 0-9.5-1A4.5 4.5 0 0 0 6.5 14Z' }],
  ],
  sunshine: [
    ['circle', { cx: 12, cy: 12, r: 4 }],
    ['path', { d: 'M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41' }],
  ],
  wind: [
    ['path', { d: 'M4 10h11a3 3 0 1 0-3-3' }],
    ['path', { d: 'M4 14h16a3 3 0 1 1-3 3' }],
    ['path', { d: 'M4 18h7' }],
  ],
  safety: [
    ['path', { d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' }],
    ['path', { d: 'M9 12l2 2 4-4' }],
  ],
  snow: [
    ['path', { d: 'M12 2v20M2 12h20' }],
    ['path', { d: 'M5 5l14 14M19 5L5 19' }],
    ['path', { d: 'M9 4l3-2 3 2M9 20l3 2 3-2M4 9l-2 3 2 3M20 9l2 3-2 3' }],
  ],
  sst: [
    ['path', { d: 'M2 12c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0' }],
    ['path', { d: 'M2 17c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0' }],
    ['path', { d: 'M12 2l2.5 4h-5z' }],
  ],
  heat: [
    ['path', { d: 'M8 14a4 4 0 0 0 8 0c0-2-1-3-2-4.5-1-1.5-1-3 0-4.5-2 1-4 3-4 5 0 2 2 2 2 4a2 2 0 0 1-4 0z' }],
  ],
  humidity: [
    ['path', { d: 'M12 2s6 7 6 12a6 6 0 1 1-12 0c0-5 6-12 6-12z' }],
    ['path', { d: 'M8 14a4 4 0 0 0 4 4' }],
  ],
  lock: [
    ['rect', { x: 5, y: 11, width: 14, height: 10, rx: 2 }],
    ['path', { d: 'M8 11V7a4 4 0 0 1 8 0v4' }],
  ],
  info: [
    ['circle', { cx: 12, cy: 12, r: 9 }],
    ['path', { d: 'M12 8h.01M11 12h1v5h1' }],
  ],
  close: [
    ['path', { d: 'M6 6l12 12M6 18L18 6' }],
  ],
  sparkle: [
    ['path', { d: 'M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z' }],
  ],
};

// Render helper — uses React.createElement directly so this file can stay .js
window.renderIcon = function(name, size, stroke, fill) {
  if (size == null) size = 18;
  if (stroke == null) stroke = 'currentColor';
  if (fill == null) fill = 'none';
  const ic = window.MODE_ICONS[name];
  if (!ic) return null;
  const children = ic.map((p, i) => React.createElement(p[0], Object.assign({ key: i }, p[1])));
  return React.createElement('svg', {
    width: size, height: size, viewBox: '0 0 24 24',
    fill, stroke, strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
  }, children);
};

// ─── Variable catalog ─────────────────────────────────────────────────────
window.VARIABLES = {
  preferences: {
    id: 'preferences', label: 'My Preferences', icon: 'preferences', tier: 'free', kind: 'qualitative',
    desc: 'Your ideal weather score — Perfect, Good, Acceptable, or Avoid — using your saved preferences.',
    unit: 'match',
    legend: {
      title: 'Match quality',
      sub: 'Based on your preferences',
      bins: [
        { label: 'Perfect Match', hex: '#0B6E5F' },
        { label: 'Good Option',   hex: '#0072B2' },
        { label: 'Acceptable',    hex: '#B8610E' },
        { label: 'Avoid',         hex: '#7A2E2E' },
      ],
    },
  },

  temperature: {
    id: 'temperature', label: 'Temperature', icon: 'temperature', tier: 'free', kind: 'diverging',
    desc: 'Mean daily temperature, 10-year ERA5 climatology.',
    unit: '°C',
    infoTooltip: 'Mean of daily 2m temperature averaged across the selected month over 2015–2024.',
    legend: {
      title: 'Mean temperature', sub: '°C',
      ramp: ['#08457E', '#5A93C7', '#E6E0C8', '#C97011', '#7A2E2E'],
      ticks: ['< 0°', '15°', '> 30°'],
    },
  },

  rainfall: {
    id: 'rainfall', label: 'Rainfall', icon: 'rainfall', tier: 'free', kind: 'sequential',
    desc: 'Average daily precipitation.',
    unit: 'mm/day',
    infoTooltip: 'Mean daily total precipitation (ERA5). Thresholds calibrated to human comfort, not hydrology.',
    legend: {
      title: 'Rainfall', sub: 'mm/day',
      ramp: ['#F0ECE0', '#B8D4E8', '#5A93C7', '#1C5A8E', '#0A2A4A'],
      ticks: ['0', '5', '> 15'],
    },
  },

  sunshine: {
    id: 'sunshine', label: 'Sunshine', icon: 'sunshine', tier: 'free', kind: 'sequential',
    desc: 'Hours of sunshine per day.',
    unit: 'h/day',
    infoTooltip: 'Estimated from ERA5 surface solar radiation, converted to equivalent clear-sky hours.',
    legend: {
      title: 'Daily sunshine', sub: 'hours',
      ramp: ['#EDE6D2', '#E0C98A', '#C89844', '#B8763E', '#8A4A1E'],
      ticks: ['0h', '6h', '12h'],
    },
  },

  wind: {
    id: 'wind', label: 'Wind speed', icon: 'wind', tier: 'free', kind: 'sequential',
    desc: 'Average wind speed at 10m.',
    unit: 'km/h',
    infoTooltip: 'ERA5 10m wind speed, monthly mean. Gusts and variability not included.',
    legend: {
      title: 'Wind speed', sub: 'km/h',
      ramp: ['#E8E4DC', '#B8C8BE', '#78A095', '#3D7A6E', '#1C4E44'],
      ticks: ['0', '20', '> 40'],
    },
  },

  safety: {
    id: 'safety', label: 'Safety', icon: 'safety', tier: 'free', kind: 'ordinal-safety',
    desc: 'Travel advisory consensus across five governments (US, UK, CA, AU, DE).',
    unit: 'advisory',
    devNote: 'Polygon colour = MAX of the 5 advisories (most cautious). Per-source breakdown in drawer.',
    legend: {
      title: 'Advisory level',
      sub: 'Highest of 5 sources',
      bins: [
        { label: 'Normal',        hex: '#4A5568' },
        { label: 'Caution',       hex: '#B8763E' },
        { label: 'Reconsider',    hex: '#B8610E' },
        { label: 'Do Not Travel', hex: '#7A2E2E' },
      ],
    },
  },

  snow: {
    id: 'snow', label: 'Snow depth', icon: 'snow', tier: 'premium', kind: 'sequential',
    desc: 'Average snow cover depth — plan ski trips or avoid winter storms.',
    unit: 'cm',
    infoTooltip: 'Monthly mean snow depth from ERA5-Land.',
    legend: {
      title: 'Snow depth', sub: 'cm',
      ramp: ['#F7F6F2', '#D6E3ED', '#8AB6D6', '#4682B4', '#1C4270'],
      ticks: ['0', '25', '> 100'],
    },
  },

  sst: {
    id: 'sst', label: 'Sea surface temp', icon: 'sst', tier: 'premium', kind: 'diverging-ocean',
    desc: 'Ocean temperature — ideal for divers, surfers, and beach planners.',
    unit: '°C',
    infoTooltip: 'ERA5 sea surface temperature, monthly mean. Land polygons are dimmed in this view.',
    landMode: 'dimmed',
    legend: {
      title: 'Sea surface temp', sub: '°C · ocean only',
      ramp: ['#1C4270', '#5A93C7', '#E6E0C8', '#D97A4E', '#7A2E2E'],
      ticks: ['< 5°', '20°', '> 30°'],
    },
  },

  heat: {
    id: 'heat', label: 'Heat index', icon: 'heat', tier: 'premium', kind: 'sequential',
    desc: 'Feels-like temperature accounting for humidity — avoid dangerous heat.',
    unit: '°C',
    infoTooltip: 'Apparent temperature (Rothfusz heat index) from ERA5 2m temp + humidity.',
    legend: {
      title: 'Heat index', sub: '°C · apparent',
      ramp: ['#F5ECC4', '#F0C94E', '#E89028', '#C9521C', '#7A1E14'],
      ticks: ['< 25°', '35°', '> 45°'],
    },
  },

  humidity: {
    id: 'humidity', label: 'Humidity', icon: 'humidity', tier: 'premium', kind: 'sequential',
    desc: 'Relative humidity — find crisp air or tropical feel.',
    unit: '%',
    infoTooltip: 'Mean relative humidity at 2m (ERA5).',
    legend: {
      title: 'Humidity', sub: '% relative',
      ramp: ['#F0ECE0', '#C8DCC0', '#6BA899', '#2E7A78', '#134447'],
      ticks: ['< 30%', '60%', '> 90%'],
    },
  },
};

// Ordered groups for the modal
window.VARIABLE_GROUPS = [
  { id: 'hero',    label: null,                 tier: 'free',    items: ['preferences'] },
  { id: 'climate', label: 'Climate variables',  tier: 'free',    items: ['temperature', 'rainfall', 'sunshine', 'wind'] },
  { id: 'safety',  label: 'Advisory',           tier: 'free',    items: ['safety'] },
  { id: 'premium', label: 'Premium variables',  tier: 'premium', items: ['snow', 'sst', 'heat', 'humidity'] },
];
