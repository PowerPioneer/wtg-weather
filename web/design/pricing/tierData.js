/* global window */
// Single source of truth for pricing page content. Copy is verbatim from the brief.

window.PRICING = {
  hero: {
    // Proposed copy — one-line value prop + sub-line
    eyebrow: 'Pricing',
    headline: 'Plan trips around the weather you actually like.',
    sub: 'Ten years of ERA5 climate data and five-government travel advisories in one map. Free to explore. €2.99/mo to go deeper.',
  },

  // Premium card closing copy — proposed below the card title
  premiumCopy: {
    headline: 'See past the average.',
    bullets: [
      'Zoom past admin-1 into district-level climate — compare Cusco vs. Lima, not just Peru.',
      'See how each of the five governments actually rates your destination, not the most-cautious consensus.',
      '10 / 50 / 90 percentile bands on every chart — April is 18°C, but how often is it 11 or 26?',
      'Four extra variables: snow depth, sea-surface temperature, heat index, humidity.',
      'Save unlimited trips, get an email the moment a destination starts matching your preferences.',
    ],
  },

  tiers: [
    {
      id: 'free',
      name: 'Free',
      eyebrow: 'For the curious',
      price: { monthly: 0, yearly: 0, suffix: '' },
      cta: { label: 'Start free', kind: 'ghost' },
      subline: 'Everything you need to explore.',
      features: [
        'Country and admin-1 (state / region) zoom',
        'Climate variables: Temperature, Rainfall, Sunshine, Wind speed',
        'Safety advisories from US, UK, Canada, Australia, Germany (combined view, most-cautious-wins)',
        'Display modes: My Preferences, Temperature, Rainfall, Sunshine, Wind, Safety',
        '10-year monthly climatology averages',
        'Ad-supported',
      ],
    },
    {
      id: 'premium',
      name: 'Consumer Premium',
      shortName: 'Premium',
      eyebrow: 'Most travellers',
      featured: true,
      price: { monthly: 2.99, yearly: 24, suffix: '/mo' },
      yearlyNote: '€24/yr — save 33%',
      cta: { label: 'Try Premium · €2.99/mo', kind: 'primary' },
      subline: 'Everything in Free, plus:',
      featuredBullets: [
        // The 3 highest-perceived-value items, emphasised on the card
        'Admin-2 (district) deep zoom',
        'Per-government advisory breakdown',
        '10 / 50 / 90 percentile bands on charts',
      ],
      features: [
        'Admin-2 (district / county) deep zoom',
        'Additional variables: Snow depth, Sea surface temperature, Heat index, Humidity',
        '10 / 50 / 90 percentile bands on charts (see how variable the weather actually is, not just the average)',
        'Save unlimited trips',
        'Save favourite destinations',
        'Email alerts when a destination starts matching your preferences',
        'No ads',
        'Per-government advisory breakdown view (see how each country rates a destination, not just the combined view)',
      ],
    },
    {
      id: 'starter',
      name: 'Agency Starter',
      shortName: 'Starter',
      eyebrow: 'Small agencies',
      price: { monthly: 39, yearly: 39 * 12 * 0.83, suffix: '/mo' },
      seats: '3 seats included',
      cta: { label: 'Start 14-day trial', kind: 'outline' },
      subline: 'Everything in Premium for 3 seats, plus:',
      features: [
        'Client management (create client profiles, store their preferences, assign trips)',
        'Shared organisation workspace',
        'Audit log of all agent actions',
        'Branded shareable trip pages (your agency name on /trips/[id])',
      ],
    },
    {
      id: 'pro',
      name: 'Agency Pro',
      shortName: 'Pro',
      eyebrow: 'Growing agencies',
      price: { monthly: 99, yearly: 99 * 12 * 0.83, suffix: '/mo' },
      seats: '10 seats included',
      cta: { label: 'Start 14-day trial', kind: 'outline' },
      subline: 'Everything in Starter, plus:',
      features: [
        '10 seats',
        'Priority support',
        'Advanced filters and export options',
      ],
    },
    {
      id: 'enterprise',
      name: 'Agency Enterprise',
      shortName: 'Enterprise',
      eyebrow: 'Large operators',
      price: { monthly: null, yearly: null, suffix: '' },
      priceDisplay: 'Custom',
      cta: { label: 'Contact sales', kind: 'outline' },
      subline: 'Everything in Pro, plus:',
      features: [
        'Unlimited seats',
        'API access for integration with your booking systems',
        'Custom data refresh cadence',
        'White-label (subdomain + full branding) — coming 2026',
        'SLA and dedicated support',
      ],
    },
  ],

  // Comparison table — groups of rows, values per tier id
  comparison: {
    // columns: ['free', 'premium', 'starter', 'pro', 'enterprise']
    groups: [
      {
        title: 'Data & map',
        rows: [
          ['Country & admin-1 zoom',                     [true, true, true, true, true]],
          ['Admin-2 (district) deep zoom',               [false, true, true, true, true]],
          ['10-year ERA5 monthly climatology',           [true, true, true, true, true]],
          ['10 / 50 / 90 percentile bands on charts',    [false, true, true, true, true]],
          ['Custom data refresh cadence',                [false, false, false, false, true]],
        ],
      },
      {
        title: 'Variables',
        rows: [
          ['Temperature, Rainfall, Sunshine, Wind',      [true, true, true, true, true]],
          ['Safety advisories (combined view)',          [true, true, true, true, true]],
          ['Snow depth',                                 [false, true, true, true, true]],
          ['Sea surface temperature',                    [false, true, true, true, true]],
          ['Heat index',                                 [false, true, true, true, true]],
          ['Humidity',                                   [false, true, true, true, true]],
          ['Per-government advisory breakdown',          [false, true, true, true, true]],
        ],
      },
      {
        title: 'Trips & personalisation',
        rows: [
          ['Save unlimited trips',                       [false, true, true, true, true]],
          ['Favourite destinations',                     [false, true, true, true, true]],
          ['Email alerts on new matches',                [false, true, true, true, true]],
          ['No ads',                                     [false, true, true, true, true]],
        ],
      },
      {
        title: 'Agency tools',
        rows: [
          ['Client management',                          [false, false, true, true, true]],
          ['Shared organisation workspace',              [false, false, true, true, true]],
          ['Audit log',                                  [false, false, true, true, true]],
          ['Branded trip pages',                         [false, false, true, true, true]],
          ['Seats included',                             ['—', '1', '3', '10', 'Unlimited']],
          ['Advanced filters & export',                  [false, false, false, true, true]],
          ['Priority support',                           [false, false, false, true, true]],
          ['API access',                                 [false, false, false, false, true]],
          ['White-label (2026)',                         [false, false, false, false, true]],
          ['SLA & dedicated support',                    [false, false, false, false, true]],
        ],
      },
    ],
  },

  trust: {
    signals: [
      { title: '10-year ERA5 climatology',
        sub: 'ECMWF Reanalysis v5 — the reference climate dataset. Updated monthly.' },
      { title: '5 government advisories',
        sub: 'US, UK, Canada, Australia, Germany — refreshed daily, source & timestamp on every record.' },
      { title: 'EU VAT handled by Paddle',
        sub: 'Paddle is our Merchant of Record. Invoices in your country, local currency, legally compliant.' },
      { title: 'No card details stored',
        sub: 'We never see your card. PCI-DSS handled end-to-end by Paddle.' },
      { title: 'Cancel anytime',
        sub: 'One-click cancellation from your Paddle customer portal. Refunds within 14 days, no questions.' },
      { title: 'Used by 40+ travel agencies',
        sub: 'From solo consultants to mid-market operators across 12 countries.' },
    ],
  },

  faq: [
    {
      q: 'What does the €2.99/mo actually unlock?',
      a: 'Deeper zoom (admin-2 districts, not just countries), four extra variables (snow, sea-surface temperature, heat index, humidity), percentile bands on every chart so you can see variability not just averages, the per-government breakdown of travel advisories, saved trips, email alerts, and no ads. Full list in the comparison table above.',
    },
    {
      q: 'What is ERA5 and why should I trust it?',
      a: 'ERA5 is the European Centre for Medium-Range Weather Forecasts’ reanalysis dataset — a reconstruction of global climate from 1950 to today at ~25km resolution, used by the IPCC and most working climate scientists. We compute 10-year monthly averages from it, so what you see is calibrated against a decade of real observations, not a forecast.',
    },
    {
      q: 'Whose travel advisories are these?',
      a: 'Five governments: United States, United Kingdom, Canada, Australia, Germany. By default we show the most-cautious view (the highest advisory across the five). Premium unlocks the per-government breakdown so you can see where they agree and where they diverge — useful when one government flags a region others don’t.',
    },
    {
      q: 'Can I cancel? How do refunds work?',
      a: 'Yes, cancel anytime from the Paddle customer portal (one click, linked from your account). Refunds are granted within 14 days of purchase, no questions. After cancellation you keep Premium access until the end of the billing period.',
    },
    {
      q: 'How does agency billing work?',
      a: 'Starter includes 3 seats for €39/mo, Pro includes 10 seats for €99/mo, Enterprise is unlimited and quoted individually. All agency tiers include everything in Consumer Premium for every seat. Billed monthly or annually via Paddle; VAT handled by Paddle as Merchant of Record.',
    },
    {
      q: 'Do you offer a free trial for the agency plans?',
      a: '14 days free on Starter and Pro, no card required up front. Enterprise starts with a scoped pilot — talk to sales.',
    },
  ],
};
