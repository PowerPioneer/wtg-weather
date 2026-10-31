"""Tests for `publish.intro` — the country page's intro paragraph.

The paragraph is generated, so what is pinned here is the contract that keeps
generated prose honest: each comparative ("wetter", "cooler") is true of the
figures it prints, an activity's reason is printed beside its own months, and
nothing is said about a country with no curated activities.
"""

from __future__ import annotations

import re

import pytest

from wtg_pipeline.processing.activities import Activity, CountryActivities, Window
from wtg_pipeline.processing.scoring import DEFAULT_PREFERENCES
from wtg_pipeline.publish import intro
from wtg_pipeline.publish.intro import MonthlyClimate, build_intro


def _climate(
    *,
    t_max: list[float],
    t_min: list[float] | None = None,
    rain_day: list[float] | None = None,
    sun: list[float] | None = None,
    scores: list[int],
) -> MonthlyClimate:
    return MonthlyClimate(
        t_max=t_max,
        t_min=t_min or [t - 10 for t in t_max],
        rain_day=rain_day or [1.0] * 12,
        sun=sun or [8.0] * 12,
        scores=scores,
    )


# A dry season May–September, rains the rest of the year.
DRY_SEASON = _climate(
    t_max=[29, 29, 29, 28, 27, 26, 26, 27, 28, 29, 29, 29],
    rain_day=[6.0, 6.5, 6.0, 4.0, 1.0, 0.5, 0.4, 0.5, 1.2, 4.5, 5.5, 6.0],
    scores=[60, 60, 60, 75, 90, 90, 90, 90, 90, 75, 60, 60],
)


def _activity(name: str, kind: str, status: str, *windows: tuple[str, tuple[int, ...], str]) -> Activity:
    return Activity(
        id=name.lower().replace(" ", "-"),
        name=name,
        kind=kind,
        status=status,
        windows=tuple(Window(status=s, months=m, reason=r) for s, m, r in windows),
    )


def test_the_preference_words_match_the_default_preferences() -> None:
    """"Warm, dry and sunny" is a gloss on the table; it must stay one.

    If the defaults ever stop being warm days, a dry ceiling and a sunshine
    floor, every intro on the site is describing a rule the map does not use.
    """
    by_variable = {p.variable: p for p in DEFAULT_PREFERENCES}
    assert by_variable["t2m_max"].lo >= 20  # warm
    assert by_variable["tp"].lo == 0 and by_variable["tp"].hi < 5  # dry
    assert by_variable["sun_hours"].lo >= 5  # sunny
    assert intro.PREFERENCE_WORDS == "warm, dry and sunny weather"


def test_opens_with_when_to_go_and_the_conditions_then() -> None:
    text = build_intro(name="Peru", climate=DRY_SEASON)
    first = text.split(". ")[0]
    assert first.startswith("The best time to visit Peru for warm, dry and sunny weather is May–September")
    assert "daytime highs of 26–28 °C" in first


def test_names_what_is_wrong_with_the_rest_of_the_year() -> None:
    text = build_intro(name="Peru", climate=DRY_SEASON)
    # 6.0 mm/day × 31 days; February's 6.5 × 28 is less.
    assert "October–April is wetter, with up to 186 mm of rain in January." in text


def test_a_comparative_is_never_false_of_its_own_figures() -> None:
    """Iceland's best months are its sunny spring; July is warmer but greyer.

    Calling July "cooler" because it misses the temperature preference, at a
    higher temperature than the best months, was the bug this pins.
    """
    iceland = _climate(
        t_max=[2, 2, 3, 6, 9, 11, 13, 13, 10, 6, 3, 2],
        t_min=[-3, -3, -2, 0, 3, 6, 8, 8, 5, 1, -2, -3],
        rain_day=[5.0, 5.0, 4.5, 2.5, 2.4, 2.3, 2.6, 2.7, 4.0, 5.0, 5.0, 5.0],
        sun=[0.5, 2.0, 4.0, 6.0, 7.0, 6.5, 4.0, 4.0, 3.5, 2.0, 1.0, 0.3],
        scores=[25, 25, 25, 60, 60, 60, 25, 25, 25, 25, 25, 25],
    )
    text = build_intro(name="Iceland", climate=iceland)
    assert "July" in text
    for clause in re.findall(r"[A-Z][a-z]+(?:–[A-Z][a-z]+)? (?:is|are) cooler, with highs around (-?\d+) °C", text):
        assert int(clause) < 6, text
    assert "greyer" in text


def test_warmer_nights_are_not_called_hotter_days() -> None:
    """South Africa's January: highs as high as the best months, nights warmer."""
    climate = _climate(
        t_max=[30.2, 29, 28, 26, 22, 20, 20, 22, 24, 26, 28, 29.6],
        t_min=[23.5, 18, 16, 13, 9, 6, 5, 7, 10, 13, 15, 17],
        scores=[60, 75, 90, 90, 60, 60, 60, 60, 60, 90, 90, 90],
    )
    text = build_intro(name="South Africa", climate=climate)
    assert "January is warmer at night, with lows near 24 °C" in text
    assert "hotter" not in text


def test_admits_when_even_the_best_months_are_not_a_perfect_match() -> None:
    climate = _climate(t_max=[18] * 12, scores=[60, 60, 75, 75, 60, 60, 60, 60, 60, 60, 60, 60])
    text = build_intro(name="Norway", climate=climate)
    assert "March–April, though even then it is only a good option" in text


def test_a_year_round_destination_says_so_without_inventing_a_season() -> None:
    climate = _climate(t_max=[27] * 12, scores=[90] * 12)
    text = build_intro(name="Aruba", climate=climate)
    assert text.startswith("Aruba is a perfect match for warm, dry and sunny weather in every month")
    assert "wetter" not in text and "cooler" not in text


@pytest.mark.parametrize(
    ("name", "expected"),
    [
        ("Netherlands", "the Netherlands"),
        ("United States", "the United States"),
        ("Cayman Islands", "the Cayman Islands"),
        ("The Bahamas", "the Bahamas"),
        ("Dominican Republic", "the Dominican Republic"),
        ("Peru", "Peru"),
        ("Saint Vincent and the Grenadines", "Saint Vincent and the Grenadines"),
        ("Isle of Man", "Isle of Man"),
    ],
)
def test_country_names_take_the_article_they_take_in_english(name: str, expected: str) -> None:
    assert intro.with_article(name) == expected


def test_no_curated_activities_means_no_activity_sentences() -> None:
    text = build_intro(name="Peru", climate=DRY_SEASON, curated=None)
    assert "at its best" not in text and "closed in" not in text


def test_a_closure_comes_first_and_keeps_its_own_reason() -> None:
    curated = CountryActivities(
        iso2="PE",
        reviewed="2026-10-26",
        activities=(
            _activity("Amazon by canoe", "wildlife", "open", ("best", (12, 1, 2, 3, 4, 5), "high water")),
            _activity(
                "Classic Inca Trail",
                "trek",
                "open",
                ("closed", (2,), "annual maintenance after the rains; reopens 1 March"),
                ("best", (5, 6, 7, 8), "the drier months"),
            ),
        ),
    )
    text = build_intro(name="Peru", climate=DRY_SEASON, curated=curated)
    closure = text.index("Classic Inca Trail is closed in February: annual maintenance after the rains.")
    assert closure < text.index("Amazon by canoe is at its best in December–May: high water.")
    # The reason is cut at its first clause, never reworded.
    assert "reopens" not in text


def test_a_reason_is_printed_beside_its_own_window_only() -> None:
    """Diani's kitesurfing has two seasons with two reasons.

    The union of their months beside the first window's reason claimed that
    the December trade wind blew in July.
    """
    curated = CountryActivities(
        iso2="KE",
        reviewed="2026-10-26",
        activities=(
            _activity(
                "Kitesurfing at Diani",
                "sport",
                "open",
                ("best", (12, 1, 2, 3), "the Kaskazi blows from December to March"),
                ("best", (6, 7, 8, 9), "the Kusi blows from June to September"),
            ),
        ),
    )
    text = build_intro(name="Kenya", climate=DRY_SEASON, curated=curated)
    assert "Kitesurfing at Diani is at its best in December–March: the Kaskazi blows from December to March." in text
    assert "June" not in text.split("Kitesurfing")[1]


@pytest.mark.parametrize(
    ("name", "label", "verb"),
    [
        ("Southern right whales, Hermanus", "Southern right whales in Hermanus", "are"),
        ("Skiing at Grandvalira", "Skiing at Grandvalira", "is"),
        ("Swimming with whale sharks, Ningaloo Reef", "Swimming with whale sharks in Ningaloo Reef", "is"),
        ("Northern lights", "Northern lights", "are"),
        ("Highland F-roads (Landmannalaugar, Askja)", "Highland F-roads (Landmannalaugar, Askja)", "are"),
        ("Kruger game viewing", "Kruger game viewing", "is"),
        ("Whales off Atauro Island", "Whales off Atauro Island", "are"),
        ("Nesting sea turtles at Ureca", "Nesting sea turtles at Ureca", "are"),
        ("Masada and the Dead Sea", "Masada and the Dead Sea", "are"),
        ("Climbing Mount Kenya", "Climbing Mount Kenya", "is"),
        ("Diving, snorkelling and the canal", "Diving, snorkelling and the canal", "are"),
        ("Furka, Grimsel and Susten passes", "Furka, Grimsel and Susten passes", "are"),
        ("Nyerere (Selous) game drives", "Nyerere (Selous) game drives", "are"),
        ("Isle of Man TT races", "Isle of Man TT races", "are"),
        ("Battle of Flowers", "Battle of Flowers", "is"),
        ("Victoria Falls", "Victoria Falls", "is"),
        ("Persepolis", "Persepolis", "is"),
        ("Christmas at St Peter's", "Christmas at St Peter's", "is"),
        ("Tracking jaguars in the Pantanal", "Tracking jaguars in the Pantanal", "is"),
        ("Walking safaris in South Luangwa", "Walking safaris in South Luangwa", "are"),
        ("Skiing at Shymbulak, above Almaty", "Skiing at Shymbulak, above Almaty", "is"),
        ("Blacks and Whites' Carnival in Pasto", "Blacks and Whites' Carnival in Pasto", "is"),
        ("Diving and snorkelling", "Diving and snorkelling", "is"),
        ("Perhentian Islands", "Perhentian Islands", "are"),
        ("Cliffs of Moher", "Cliffs of Moher", "are"),
        ("Fiestas Patrias", "Fiestas Patrias", "are"),
        ("Bluebells in the Hallerbos", "Bluebells in the Hallerbos", "are"),
        ("Desert safaris", "Desert safaris", "are"),
        ("Peaks of the Balkans trail", "Peaks of the Balkans trail", "is"),
        ("Wings of Tatev cable car", "Wings of Tatev cable car", "is"),
    ],
)
def test_activity_labels_read_as_the_subject_of_a_sentence(name: str, label: str, verb: str) -> None:
    curated = CountryActivities(
        iso2="ZA",
        reviewed="2026-10-26",
        activities=(_activity(name, "wildlife", "open", ("best", (6, 7), "the season")),),
    )
    text = build_intro(name="South Africa", climate=DRY_SEASON, curated=curated)
    assert f"{label} {verb} at" in text


def test_an_event_named_after_a_place_is_one_event() -> None:
    curated = CountryActivities(
        iso2="BE",
        reviewed="2026-10-26",
        activities=(_activity("Bruges at Christmas", "festival", "not-on", ("best", (12,), "the market")),),
    )
    text = build_intro(name="Belgium", climate=DRY_SEASON, curated=curated)
    assert "Bruges at Christmas is held in December: the market." in text


def test_festivals_are_held_rather_than_at_their_best() -> None:
    curated = CountryActivities(
        iso2="MX",
        reviewed="2026-10-26",
        activities=(_activity("Day of the Dead", "festival", "not-on", ("best", (11,), "families honour their dead")),),
    )
    text = build_intro(name="Mexico", climate=DRY_SEASON, curated=curated)
    assert "Day of the Dead is held in November: families honour their dead." in text


def test_at_most_three_activity_sentences() -> None:
    curated = CountryActivities(
        iso2="IT",
        reviewed="2026-10-26",
        activities=tuple(
            _activity(f"Thing {n}", "site", "open", ("best", (n,), "a reason")) for n in range(1, 7)
        ),
    )
    text = build_intro(name="Italy", climate=DRY_SEASON, curated=curated)
    assert text.count("at its best") == intro.MAX_ACTIVITY_SENTENCES


def test_measurements_use_the_shapes_the_web_converts_for_imperial_readers() -> None:
    """`convertMeasurementsInText` rewrites `N °C`, `N–M °C` and `N mm` only."""
    text = build_intro(name="Peru", climate=DRY_SEASON)
    assert re.search(r"\d+–\d+ °C", text)
    assert re.search(r"\d+ mm", text)
    assert "°F" not in text and "inches" not in text


def test_a_region_says_how_its_season_differs_from_the_country() -> None:
    """The reason to read a region page: its window is not the national one."""
    text = build_intro(name="Cusco", climate=DRY_SEASON, parent=("Peru", [1, 2, 3]))
    assert "Across Peru as a whole, the best months are January–March." in text


def test_a_region_on_the_national_calendar_does_not_repeat_it() -> None:
    text = build_intro(name="Cusco", climate=DRY_SEASON, parent=("Peru", [5, 6, 7, 8, 9]))
    assert "as a whole" not in text
