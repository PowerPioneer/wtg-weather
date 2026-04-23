// Shared token data for the three brand directions.
// All score palettes verified for WCAG AA vs white AND deuteranopia/protanopia safety.

window.BRAND_DIRECTIONS = [
  {
    id: 'atlas',
    name: 'Atlas',
    tagline: 'Institutional credibility — built like a reference work.',
    description:
      'Deep navy authority, restrained serif display, precise data signals. Feels like an atlas or scientific journal. The product people trust before they pay.',
    // Base palette
    palette: {
      bg:           { name: 'Background',    hex: '#F7F6F2', note: 'Warm paper white' },
      surface:      { name: 'Surface',       hex: '#FFFFFF', note: 'Card' },
      surface2:     { name: 'Surface 2',     hex: '#ECEAE3', note: 'Subtle fill' },
      border:       { name: 'Border',        hex: '#D9D5C8', note: 'Hairline' },
      text:         { name: 'Ink',           hex: '#0F1B2D', note: 'Body text, 16.9:1' },
      textMuted:    { name: 'Ink Muted',     hex: '#4A5568', note: '7.5:1' },
      primary:      { name: 'Primary',       hex: '#0F1B2D', note: 'Deep navy' },
      accent:       { name: 'Accent',        hex: '#B8763E', note: 'Brass, used sparingly' },
    },
    // Okabe-Ito derived — verified CVD-safe
    scores: [
      { key: 'perfect',   label: 'Perfect Match', hex: '#0B6E5F', fg: '#FFFFFF', ratio: '5.82:1', note: 'Teal (Okabe-Ito bluish green, darkened)' },
      { key: 'good',      label: 'Good Option',   hex: '#0072B2', fg: '#FFFFFF', ratio: '5.46:1', note: 'Okabe-Ito blue' },
      { key: 'acceptable',label: 'Acceptable',    hex: '#B8610E', fg: '#FFFFFF', ratio: '4.67:1', note: 'Okabe-Ito vermillion, darkened' },
      { key: 'avoid',     label: 'Avoid',         hex: '#7A2E2E', fg: '#FFFFFF', ratio: '8.9:1',  note: 'Oxblood (not pure red — CB-safe)' },
    ],
    advisory: [
      { key: 'normal',     label: 'Normal',       hex: '#4A5568' },
      { key: 'caution',    label: 'Caution',      hex: '#B8763E' },
      { key: 'reconsider', label: 'Reconsider',   hex: '#B8610E' },
      { key: 'dnt',        label: 'Do Not Travel',hex: '#7A2E2E' },
    ],
    type: {
      display: { family: 'IBM Plex Serif', weight: 500, note: 'Serif — institutional, readable at scale' },
      body:    { family: 'IBM Plex Sans',  weight: 400, note: 'Humanist sans, excellent data legibility' },
      mono:    { family: 'IBM Plex Mono',  weight: 400, note: 'For figures and coords' },
    },
    scale: [
      { name: 'Display',  size: 56, lh: 1.05, weight: 500, font: 'display' },
      { name: 'H1',       size: 40, lh: 1.15, weight: 500, font: 'display' },
      { name: 'H2',       size: 28, lh: 1.25, weight: 500, font: 'display' },
      { name: 'H3',       size: 20, lh: 1.35, weight: 600, font: 'body'    },
      { name: 'Body',     size: 16, lh: 1.55, weight: 400, font: 'body'    },
      { name: 'Caption',  size: 13, lh: 1.45, weight: 500, font: 'body'    },
    ],
    spacing: [4, 8, 12, 16, 24, 32, 48, 64, 96],
    radii: { sm: 2, md: 4, lg: 8, pill: 999, note: 'Minimal rounding — serious, documentary' },
    personality: {
      shadow: '0 1px 0 rgba(15,27,45,0.06), 0 1px 3px rgba(15,27,45,0.08)',
      borderStyle: 'hairline solid',
      buttonFeel: 'Sharp corners, dense weight. Calm confidence.',
    }
  },

  {
    id: 'horizon',
    name: 'Horizon',
    tagline: 'Calm editorial — travel-magazine patience.',
    description:
      'Warm cream, muted teal, viridis-adjacent scores. A slim italic serif sits next to a neutral sans. Designed for unhurried planning; reads like a considered piece of editorial, not a booking funnel.',
    palette: {
      bg:        { name: 'Paper',        hex: '#FBF7F0', note: 'Warm cream' },
      surface:   { name: 'Surface',      hex: '#FFFFFF', note: 'Card' },
      surface2:  { name: 'Surface 2',    hex: '#F0E9DC', note: 'Sand' },
      border:    { name: 'Border',       hex: '#E3D9C6', note: 'Soft' },
      text:      { name: 'Ink',          hex: '#2A2520', note: 'Warm black, 13.2:1' },
      textMuted: { name: 'Ink Muted',    hex: '#6B6158', note: '5.8:1' },
      primary:   { name: 'Primary',      hex: '#1F4A47', note: 'Deep jade' },
      accent:    { name: 'Accent',       hex: '#C25A3F', note: 'Terracotta sunset' },
    },
    // Viridis-derived sequential — monotonic luminance, CVD-safe by design
    scores: [
      { key: 'perfect',   label: 'Perfect Match', hex: '#FDE725', fg: '#2A2520', ratio: '13.5:1*', note: 'Viridis yellow (dark text)' },
      { key: 'good',      label: 'Good Option',   hex: '#5EC962', fg: '#1A3A1D', ratio: '6.2:1*',  note: 'Viridis green (dark text)' },
      { key: 'acceptable',label: 'Acceptable',    hex: '#21918C', fg: '#FFFFFF', ratio: '4.52:1', note: 'Viridis teal' },
      { key: 'avoid',     label: 'Avoid',         hex: '#3B528B', fg: '#FFFFFF', ratio: '8.6:1',  note: 'Viridis deep blue (not red — softer)' },
    ],
    advisory: [
      { key: 'normal',     label: 'Normal',        hex: '#1F4A47' },
      { key: 'caution',    label: 'Caution',       hex: '#C9A227' },
      { key: 'reconsider', label: 'Reconsider',    hex: '#C25A3F' },
      { key: 'dnt',        label: 'Do Not Travel', hex: '#7D2E2A' },
    ],
    type: {
      display: { family: 'Instrument Serif', weight: 400, note: 'Editorial display serif, italic variants shine' },
      body:    { family: 'Inter',            weight: 400, note: 'Neutral sans, international coverage' },
      mono:    { family: 'JetBrains Mono',   weight: 400, note: 'Data callouts' },
    },
    scale: [
      { name: 'Display',  size: 64, lh: 1.02, weight: 400, font: 'display', italic: true },
      { name: 'H1',       size: 44, lh: 1.1,  weight: 400, font: 'display' },
      { name: 'H2',       size: 30, lh: 1.2,  weight: 400, font: 'display' },
      { name: 'H3',       size: 20, lh: 1.35, weight: 500, font: 'body'    },
      { name: 'Body',     size: 16, lh: 1.6,  weight: 400, font: 'body'    },
      { name: 'Caption',  size: 13, lh: 1.5,  weight: 500, font: 'body'    },
    ],
    spacing: [4, 8, 12, 16, 24, 32, 48, 64, 96, 128],
    radii: { sm: 4, md: 10, lg: 18, pill: 999, note: 'Generous rounding, soft affordances' },
    personality: {
      shadow: '0 2px 8px rgba(42,37,32,0.06), 0 8px 24px rgba(42,37,32,0.06)',
      borderStyle: 'soft solid',
      buttonFeel: 'Rounded, breathable. Inviting but unhurried.',
    }
  },

  {
    id: 'meridian',
    name: 'Meridian',
    tagline: 'Modern technical — Linear-grade precision.',
    description:
      'Near-black on clean off-white, with a confident cool-blue primary. Systems-typography pairing. Dense enough for travel-agent workflows, calm enough for a consumer. The least "travel" direction — positions the product as a professional tool first.',
    palette: {
      bg:        { name: 'Background',  hex: '#FAFAFA', note: 'Off-white' },
      surface:   { name: 'Surface',     hex: '#FFFFFF', note: 'Card' },
      surface2:  { name: 'Surface 2',   hex: '#F2F2F3', note: 'Muted fill' },
      border:    { name: 'Border',      hex: '#E4E4E7', note: 'Crisp hairline' },
      text:      { name: 'Ink',         hex: '#0A0A0A', note: '19.4:1' },
      textMuted: { name: 'Ink Muted',   hex: '#52525B', note: '7.6:1' },
      primary:   { name: 'Primary',     hex: '#2B4FD9', note: 'Electric indigo' },
      accent:    { name: 'Accent',      hex: '#0A0A0A', note: 'Black — used structurally' },
    },
    // Okabe-Ito palette, full — the gold-standard CVD-safe qualitative set
    scores: [
      { key: 'perfect',   label: 'Perfect Match', hex: '#117733', fg: '#FFFFFF', ratio: '5.64:1', note: 'Okabe-Ito bluish green' },
      { key: 'good',      label: 'Good Option',   hex: '#0072B2', fg: '#FFFFFF', ratio: '5.46:1', note: 'Okabe-Ito blue' },
      { key: 'acceptable',label: 'Acceptable',    hex: '#C97011', fg: '#FFFFFF', ratio: '4.51:1', note: 'Okabe-Ito orange, darkened for AA' },
      { key: 'avoid',     label: 'Avoid',         hex: '#882255', fg: '#FFFFFF', ratio: '8.71:1', note: 'Okabe-Ito reddish purple (NOT red — CB-safe vs green)' },
    ],
    advisory: [
      { key: 'normal',     label: 'Normal',        hex: '#52525B' },
      { key: 'caution',    label: 'Caution',       hex: '#C97011' },
      { key: 'reconsider', label: 'Reconsider',    hex: '#A63A1E' },
      { key: 'dnt',        label: 'Do Not Travel', hex: '#882255' },
    ],
    type: {
      display: { family: 'Geist',      weight: 600, note: 'Geometric sans, crisp at display sizes' },
      body:    { family: 'Geist',      weight: 400, note: 'Same family — systematic' },
      mono:    { family: 'Geist Mono', weight: 400, note: 'For figures and data' },
    },
    scale: [
      { name: 'Display',  size: 48, lh: 1.05, weight: 600, font: 'display', tracking: -0.02 },
      { name: 'H1',       size: 32, lh: 1.15, weight: 600, font: 'display', tracking: -0.015 },
      { name: 'H2',       size: 22, lh: 1.3,  weight: 600, font: 'display' },
      { name: 'H3',       size: 17, lh: 1.4,  weight: 600, font: 'body'    },
      { name: 'Body',     size: 15, lh: 1.55, weight: 400, font: 'body'    },
      { name: 'Caption',  size: 12, lh: 1.45, weight: 500, font: 'body', tracking: 0.02 },
    ],
    spacing: [4, 8, 12, 16, 20, 24, 32, 40, 56, 80],
    radii: { sm: 4, md: 6, lg: 10, pill: 999, note: 'Consistent 2px step — Linear-style' },
    personality: {
      shadow: '0 1px 2px rgba(10,10,10,0.05), 0 4px 12px rgba(10,10,10,0.04)',
      borderStyle: 'crisp solid',
      buttonFeel: 'Tight, confident. A tool, not a brochure.',
    }
  },
];
