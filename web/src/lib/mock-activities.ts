import type { ActivityBlock } from "./types";

/**
 * Peru's curated activity block, exactly as `wtg publish api-data` emits it.
 *
 * Generated, not written here: the source of truth is
 * `pipeline/src/wtg_pipeline/processing/activity_data/pe.json`, and both ledes
 * come out of `processing/activities.py`. Regenerate rather than hand-edit —
 * a fixture that has drifted from the pipeline is a fixture that passes tests
 * the real payload would fail.
 *
 *   uv run --directory pipeline python -c "import json;  *     from wtg_pipeline.publish.api_data import build_activities;  *     from wtg_pipeline.processing import activities as A;  *     print(json.dumps(build_activities(A.load_all()['PE'], name='Peru')))"
 *
 * Only Peru is mocked. The other fixture countries are uncurated, which is the
 * majority case in production too, and exercises the "render no section at
 * all" path that most of the world takes.
 */
export const PERU_ACTIVITIES: ActivityBlock = {
  reviewed: "2026-10-26",
  lede: "February is the only month Peru closes anything; one of the 6 below runs all year.",
  items: [
    {
      id: "amazon-high-water",
      name: "Amazon by canoe",
      kind: "wildlife",
      regions: [
        "PE-LOR",
        "PE-UCA",
        "PE-MDD"
      ],
      yearRound: false,
      datedEvent: false,
      onMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      sources: [
        {
          url: "https://www.rainforestcruises.com/guides/best-time-to-visit-iquitos",
          checked: "2026-10-26"
        },
        {
          url: "https://www.adventure-life.com/amazon/articles/best-time-of-year-to-travel-to-the-amazon",
          checked: "2026-10-26"
        }
      ]
    },
    {
      id: "amazon-jungle-walking",
      name: "Amazon walking trails",
      kind: "wildlife",
      regions: [
        "PE-LOR",
        "PE-UCA",
        "PE-MDD"
      ],
      yearRound: false,
      datedEvent: false,
      onMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      sources: [
        {
          url: "https://www.rainforestcruises.com/guides/best-time-to-visit-iquitos",
          checked: "2026-10-26"
        },
        {
          url: "https://www.adventure-life.com/amazon/articles/best-time-of-year-to-travel-to-the-amazon",
          checked: "2026-10-26"
        }
      ]
    },
    {
      id: "inca-trail",
      name: "Classic Inca Trail",
      kind: "trek",
      regions: [
        "PE-CUS"
      ],
      yearRound: false,
      datedEvent: false,
      onMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      sources: [
        {
          url: "https://www.alpacaexpeditions.com/why-the-inca-trail-closes-in-february-and-why-it-reopens-on-march-1/",
          checked: "2026-10-26"
        },
        {
          url: "https://trexperienceperu.com/travel-news/inca-trail-closed-february-2026-alternatives-treks",
          checked: "2026-10-26"
        }
      ]
    },
    {
      id: "colca-condors",
      name: "Colca Canyon condors",
      kind: "wildlife",
      regions: [
        "PE-ARE"
      ],
      yearRound: false,
      datedEvent: false,
      onMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      sources: [
        {
          url: "https://colcacanyontours-arequipa.com/complete-guide-to-andean-condor-watching-in-colca-canyon-peru-2026/",
          checked: "2026-08-28"
        },
        {
          url: "https://perutravel-tours.com/best-time-to-visit-colca-canyon-for-condor-watching/",
          checked: "2026-08-28"
        }
      ]
    },
    {
      id: "machu-picchu",
      name: "Machu Picchu",
      kind: "site",
      regions: [
        "PE-CUS"
      ],
      yearRound: true,
      datedEvent: false,
      onMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      sources: [
        {
          url: "https://www.alpacaexpeditions.com/why-the-inca-trail-closes-in-february-and-why-it-reopens-on-march-1/",
          checked: "2026-10-26"
        },
        {
          url: "https://trexperienceperu.com/travel-news/inca-trail-closed-february-2026-alternatives-treks",
          checked: "2026-10-26"
        }
      ]
    },
    {
      id: "vinicunca",
      name: "Rainbow Mountain (Vinicunca)",
      kind: "hike",
      regions: [
        "PE-CUS"
      ],
      yearRound: false,
      datedEvent: false,
      onMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      sources: [
        {
          url: "https://bushop.com/peru/guides/best-time-visit-rainbow-mountain/",
          checked: "2026-08-28"
        },
        {
          url: "https://www.salkantaytrekking.com/blog/rainbow-mountain-vinicunca-everything-need-know/",
          checked: "2026-08-28"
        }
      ]
    },
    {
      id: "inti-raymi",
      name: "Inti Raymi",
      kind: "festival",
      regions: [
        "PE-CUS"
      ],
      yearRound: false,
      datedEvent: true,
      onMonths: [6],
      sources: [
        {
          url: "https://www.perurail.com/peruvian-holidays/all-you-need-to-know-about-inti-raymi/",
          checked: "2026-08-28"
        },
        {
          url: "https://en.wikipedia.org/wiki/Inti_Raymi",
          checked: "2026-08-28"
        }
      ]
    }
  ],
  months: {
    Jan: {
      lede: "Nothing is closed in January, but 2 things below are weather-dependent and 1 is at its best.",
      rows: [
        {
          id: "amazon-jungle-walking",
          status: "limited",
          reason: "under high water the forest floor is submerged and travel is by boat"
        },
        {
          id: "vinicunca",
          status: "limited",
          reason: "the stripes are often under snow or cloud and the trail turns to mud"
        },
        {
          id: "amazon-high-water",
          status: "best",
          reason: "high water makes the rivers and creeks navigable and lets boats into hidden creeks and lakes; around Iquitos the river peaks in May"
        },
        {
          id: "inca-trail",
          status: "open",
          reason: "permit-only, and permits for the dry months sell out well in advance"
        },
        {
          id: "colca-condors",
          status: "open",
          reason: "condors are sighted year-round from the Cruz del Condor viewpoint, best between about 07:30 and 09:00"
        },
        {
          id: "machu-picchu",
          status: "open",
          reason: "the citadel stays open all year, including February when the Inca Trail is shut; the alternative treks reach it by train"
        }
      ]
    },
    Feb: {
      lede: "February is the only month Peru closes anything — 1 thing below.",
      rows: [
        {
          id: "inca-trail",
          status: "closed",
          reason: "closed the whole month for maintenance after the rains; reopens 1 March. The Salkantay and Lares treks stay open"
        },
        {
          id: "amazon-jungle-walking",
          status: "limited",
          reason: "under high water the forest floor is submerged and travel is by boat"
        },
        {
          id: "vinicunca",
          status: "limited",
          reason: "the stripes are often under snow or cloud and the trail turns to mud"
        },
        {
          id: "amazon-high-water",
          status: "best",
          reason: "high water makes the rivers and creeks navigable and lets boats into hidden creeks and lakes; around Iquitos the river peaks in May"
        },
        {
          id: "colca-condors",
          status: "open",
          reason: "condors are sighted year-round from the Cruz del Condor viewpoint, best between about 07:30 and 09:00"
        },
        {
          id: "machu-picchu",
          status: "open",
          reason: "the citadel stays open all year, including February when the Inca Trail is shut; the alternative treks reach it by train"
        }
      ]
    },
    Mar: {
      lede: "Nothing is closed in March, but 2 things below are weather-dependent and 1 is at its best.",
      rows: [
        {
          id: "amazon-jungle-walking",
          status: "limited",
          reason: "under high water the forest floor is submerged and travel is by boat"
        },
        {
          id: "vinicunca",
          status: "limited",
          reason: "the stripes are often under snow or cloud and the trail turns to mud"
        },
        {
          id: "amazon-high-water",
          status: "best",
          reason: "high water makes the rivers and creeks navigable and lets boats into hidden creeks and lakes; around Iquitos the river peaks in May"
        },
        {
          id: "inca-trail",
          status: "open",
          reason: "permit-only, and permits for the dry months sell out well in advance"
        },
        {
          id: "colca-condors",
          status: "open",
          reason: "condors are sighted year-round from the Cruz del Condor viewpoint, best between about 07:30 and 09:00"
        },
        {
          id: "machu-picchu",
          status: "open",
          reason: "the citadel stays open all year, including February when the Inca Trail is shut; the alternative treks reach it by train"
        }
      ]
    },
    Apr: {
      lede: "Nothing is closed in April, and 2 things below are at their best, though 1 is weather-dependent.",
      rows: [
        {
          id: "amazon-jungle-walking",
          status: "limited",
          reason: "under high water the forest floor is submerged and travel is by boat"
        },
        {
          id: "amazon-high-water",
          status: "best",
          reason: "high water makes the rivers and creeks navigable and lets boats into hidden creeks and lakes; around Iquitos the river peaks in May"
        },
        {
          id: "colca-condors",
          status: "best",
          reason: "the dry season — clearest visibility down the canyon"
        },
        {
          id: "inca-trail",
          status: "open",
          reason: "permit-only, and permits for the dry months sell out well in advance"
        },
        {
          id: "machu-picchu",
          status: "open",
          reason: "the citadel stays open all year, including February when the Inca Trail is shut; the alternative treks reach it by train"
        },
        {
          id: "vinicunca",
          status: "open",
          reason: "a high-altitude day hike above 5,000 m from Cusco"
        }
      ]
    },
    May: {
      lede: "Nothing is closed in May, and 4 things below are at their best, though 1 is weather-dependent.",
      rows: [
        {
          id: "amazon-jungle-walking",
          status: "limited",
          reason: "under high water the forest floor is submerged and travel is by boat"
        },
        {
          id: "amazon-high-water",
          status: "best",
          reason: "high water makes the rivers and creeks navigable and lets boats into hidden creeks and lakes; around Iquitos the river peaks in May"
        },
        {
          id: "inca-trail",
          status: "best",
          reason: "the drier months — and the busiest on the trail"
        },
        {
          id: "colca-condors",
          status: "best",
          reason: "the dry season — clearest visibility down the canyon"
        },
        {
          id: "vinicunca",
          status: "best",
          reason: "dry, stable weather and the colour bands reliably visible"
        },
        {
          id: "machu-picchu",
          status: "open",
          reason: "the citadel stays open all year, including February when the Inca Trail is shut; the alternative treks reach it by train"
        }
      ]
    },
    Jun: {
      lede: "Nothing is closed in June, and 5 things below are at their best, though 1 is weather-dependent.",
      rows: [
        {
          id: "amazon-high-water",
          status: "limited",
          reason: "outside the flood the smaller channels are too shallow to paddle"
        },
        {
          id: "amazon-jungle-walking",
          status: "best",
          reason: "low water opens the usually submerged trails to walking, and there are fewer mosquitoes"
        },
        {
          id: "inca-trail",
          status: "best",
          reason: "the drier months — and the busiest on the trail"
        },
        {
          id: "colca-condors",
          status: "best",
          reason: "the dry season — clearest visibility down the canyon"
        },
        {
          id: "inti-raymi",
          status: "best",
          reason: "held on 24 June in Cusco, at Coricancha, the Plaza de Armas and Sacsayhuaman, for the southern winter solstice"
        },
        {
          id: "vinicunca",
          status: "best",
          reason: "dry, stable weather and the colour bands reliably visible"
        },
        {
          id: "machu-picchu",
          status: "open",
          reason: "the citadel stays open all year, including February when the Inca Trail is shut; the alternative treks reach it by train"
        }
      ]
    },
    Jul: {
      lede: "Nothing is closed in July, and 4 things below are at their best, though 1 is weather-dependent.",
      rows: [
        {
          id: "amazon-high-water",
          status: "limited",
          reason: "outside the flood the smaller channels are too shallow to paddle"
        },
        {
          id: "amazon-jungle-walking",
          status: "best",
          reason: "low water opens the usually submerged trails to walking, and there are fewer mosquitoes"
        },
        {
          id: "inca-trail",
          status: "best",
          reason: "the drier months — and the busiest on the trail"
        },
        {
          id: "colca-condors",
          status: "best",
          reason: "the dry season — clearest visibility down the canyon"
        },
        {
          id: "vinicunca",
          status: "best",
          reason: "dry, stable weather and the colour bands reliably visible"
        },
        {
          id: "machu-picchu",
          status: "open",
          reason: "the citadel stays open all year, including February when the Inca Trail is shut; the alternative treks reach it by train"
        }
      ]
    },
    Aug: {
      lede: "Nothing is closed in August, and 4 things below are at their best, though 1 is weather-dependent.",
      rows: [
        {
          id: "amazon-high-water",
          status: "limited",
          reason: "outside the flood the smaller channels are too shallow to paddle"
        },
        {
          id: "amazon-jungle-walking",
          status: "best",
          reason: "low water opens the usually submerged trails to walking, and there are fewer mosquitoes"
        },
        {
          id: "inca-trail",
          status: "best",
          reason: "the drier months — and the busiest on the trail"
        },
        {
          id: "colca-condors",
          status: "best",
          reason: "the dry season — clearest visibility down the canyon"
        },
        {
          id: "vinicunca",
          status: "best",
          reason: "dry, stable weather and the colour bands reliably visible"
        },
        {
          id: "machu-picchu",
          status: "open",
          reason: "the citadel stays open all year, including February when the Inca Trail is shut; the alternative treks reach it by train"
        }
      ]
    },
    Sep: {
      lede: "Nothing is closed in September, and 3 things below are at their best, though 1 is weather-dependent.",
      rows: [
        {
          id: "amazon-high-water",
          status: "limited",
          reason: "outside the flood the smaller channels are too shallow to paddle"
        },
        {
          id: "amazon-jungle-walking",
          status: "best",
          reason: "low water opens the usually submerged trails to walking, and there are fewer mosquitoes"
        },
        {
          id: "colca-condors",
          status: "best",
          reason: "the dry season — clearest visibility down the canyon"
        },
        {
          id: "vinicunca",
          status: "best",
          reason: "dry, stable weather and the colour bands reliably visible"
        },
        {
          id: "inca-trail",
          status: "open",
          reason: "permit-only, and permits for the dry months sell out well in advance"
        },
        {
          id: "machu-picchu",
          status: "open",
          reason: "the citadel stays open all year, including February when the Inca Trail is shut; the alternative treks reach it by train"
        }
      ]
    },
    Oct: {
      lede: "Nothing is closed in October, and 2 things below are at their best, though 1 is weather-dependent.",
      rows: [
        {
          id: "amazon-high-water",
          status: "limited",
          reason: "outside the flood the smaller channels are too shallow to paddle"
        },
        {
          id: "amazon-jungle-walking",
          status: "best",
          reason: "low water opens the usually submerged trails to walking, and there are fewer mosquitoes"
        },
        {
          id: "colca-condors",
          status: "best",
          reason: "the dry season — clearest visibility down the canyon"
        },
        {
          id: "inca-trail",
          status: "open",
          reason: "permit-only, and permits for the dry months sell out well in advance"
        },
        {
          id: "machu-picchu",
          status: "open",
          reason: "the citadel stays open all year, including February when the Inca Trail is shut; the alternative treks reach it by train"
        },
        {
          id: "vinicunca",
          status: "open",
          reason: "a high-altitude day hike above 5,000 m from Cusco"
        }
      ]
    },
    Nov: {
      lede: "Nothing is closed in November, but 2 things below are weather-dependent and 1 is at its best.",
      rows: [
        {
          id: "amazon-high-water",
          status: "limited",
          reason: "outside the flood the smaller channels are too shallow to paddle"
        },
        {
          id: "vinicunca",
          status: "limited",
          reason: "the stripes are often under snow or cloud and the trail turns to mud"
        },
        {
          id: "amazon-jungle-walking",
          status: "best",
          reason: "low water opens the usually submerged trails to walking, and there are fewer mosquitoes"
        },
        {
          id: "inca-trail",
          status: "open",
          reason: "permit-only, and permits for the dry months sell out well in advance"
        },
        {
          id: "colca-condors",
          status: "open",
          reason: "condors are sighted year-round from the Cruz del Condor viewpoint, best between about 07:30 and 09:00"
        },
        {
          id: "machu-picchu",
          status: "open",
          reason: "the citadel stays open all year, including February when the Inca Trail is shut; the alternative treks reach it by train"
        }
      ]
    },
    Dec: {
      lede: "Nothing is closed in December, but 2 things below are weather-dependent and 1 is at its best.",
      rows: [
        {
          id: "amazon-jungle-walking",
          status: "limited",
          reason: "under high water the forest floor is submerged and travel is by boat"
        },
        {
          id: "vinicunca",
          status: "limited",
          reason: "the stripes are often under snow or cloud and the trail turns to mud"
        },
        {
          id: "amazon-high-water",
          status: "best",
          reason: "high water makes the rivers and creeks navigable and lets boats into hidden creeks and lakes; around Iquitos the river peaks in May"
        },
        {
          id: "inca-trail",
          status: "open",
          reason: "permit-only, and permits for the dry months sell out well in advance"
        },
        {
          id: "colca-condors",
          status: "open",
          reason: "condors are sighted year-round from the Cruz del Condor viewpoint, best between about 07:30 and 09:00"
        },
        {
          id: "machu-picchu",
          status: "open",
          reason: "the citadel stays open all year, including February when the Inca Trail is shut; the alternative treks reach it by train"
        }
      ]
    }
  }
};
