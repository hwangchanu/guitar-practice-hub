"""Tests for TabFormatter: formatToText, parseFromText, and round-trip."""

import pytest

from app.engines.tab_formatter import TabFormatter
from app.models.schemas import TabData, TabNote


@pytest.fixture
def formatter():
    return TabFormatter()


class TestFormatToText:
    def test_empty_notes(self, formatter: TabFormatter):
        tab = TabData(notes=[], tuning=["E", "A", "D", "G", "B", "E"])
        text = formatter.formatToText(tab)
        assert "TUNING: E A D G B E" in text
        assert "NOTES:" in text

    def test_single_note(self, formatter: TabFormatter):
        tab = TabData(
            notes=[TabNote(time=0.0, string_num=1, fret=5)],
            tuning=["E", "A", "D", "G", "B", "E"],
        )
        text = formatter.formatToText(tab)
        assert "0.0|1|5" in text

    def test_notes_sorted_by_time(self, formatter: TabFormatter):
        tab = TabData(
            notes=[
                TabNote(time=1.0, string_num=2, fret=3),
                TabNote(time=0.5, string_num=1, fret=5),
            ],
        )
        text = formatter.formatToText(tab)
        lines = text.strip().splitlines()
        note_lines = [l for l in lines if "|" in l]
        assert note_lines[0].startswith("0.5|")
        assert note_lines[1].startswith("1.0|")


class TestParseFromText:
    def test_parse_valid(self, formatter: TabFormatter):
        text = "TUNING: E A D G B E\nNOTES:\n0.0|1|5\n1.0|3|7"
        tab = formatter.parseFromText(text)
        assert tab.tuning == ["E", "A", "D", "G", "B", "E"]
        assert len(tab.notes) == 2
        assert tab.notes[0].time == 0.0
        assert tab.notes[0].string_num == 1
        assert tab.notes[0].fret == 5

    def test_parse_empty_text_raises(self, formatter: TabFormatter):
        with pytest.raises(ValueError, match="Empty tab text"):
            formatter.parseFromText("")

    def test_parse_missing_tuning_raises(self, formatter: TabFormatter):
        with pytest.raises(ValueError, match="Expected tuning header"):
            formatter.parseFromText("NOTES:\n0.0|1|5")

    def test_parse_missing_notes_header_raises(self, formatter: TabFormatter):
        with pytest.raises(ValueError, match="Missing NOTES"):
            formatter.parseFromText("TUNING: E A D G B E\n0.0|1|5")

    def test_parse_invalid_note_line_raises(self, formatter: TabFormatter):
        with pytest.raises(ValueError, match="Invalid note line"):
            formatter.parseFromText("TUNING: E A D G B E\nNOTES:\nbad_line")


class TestRoundTrip:
    """parseFromText(formatToText(tabData)) == tabData"""

    def test_empty_notes_roundtrip(self, formatter: TabFormatter):
        original = TabData(notes=[], tuning=["E", "A", "D", "G", "B", "E"])
        result = formatter.parseFromText(formatter.formatToText(original))
        assert result == original

    def test_single_note_roundtrip(self, formatter: TabFormatter):
        original = TabData(
            notes=[TabNote(time=1.5, string_num=3, fret=12)],
        )
        result = formatter.parseFromText(formatter.formatToText(original))
        assert result == original

    def test_multiple_notes_roundtrip(self, formatter: TabFormatter):
        original = TabData(
            notes=[
                TabNote(time=0.0, string_num=6, fret=0),
                TabNote(time=0.25, string_num=5, fret=2),
                TabNote(time=0.5, string_num=4, fret=2),
                TabNote(time=0.75, string_num=3, fret=0),
                TabNote(time=1.0, string_num=2, fret=0),
                TabNote(time=1.25, string_num=1, fret=0),
            ],
        )
        result = formatter.parseFromText(formatter.formatToText(original))
        assert result == original

    def test_high_fret_roundtrip(self, formatter: TabFormatter):
        original = TabData(
            notes=[TabNote(time=2.1234, string_num=1, fret=24)],
        )
        result = formatter.parseFromText(formatter.formatToText(original))
        assert result == original

    def test_custom_tuning_roundtrip(self, formatter: TabFormatter):
        original = TabData(
            notes=[TabNote(time=0.0, string_num=6, fret=0)],
            tuning=["D", "A", "D", "G", "B", "E"],
        )
        result = formatter.parseFromText(formatter.formatToText(original))
        assert result == original

    def test_unsorted_notes_roundtrip(self, formatter: TabFormatter):
        """Notes provided out of order should still round-trip (sorted)."""
        original = TabData(
            notes=[
                TabNote(time=2.0, string_num=1, fret=5),
                TabNote(time=0.5, string_num=3, fret=7),
                TabNote(time=1.0, string_num=2, fret=3),
            ],
        )
        text = formatter.formatToText(original)
        result = formatter.parseFromText(text)
        # Round-trip produces sorted notes
        expected = TabData(
            notes=sorted(original.notes, key=lambda n: n.time),
            tuning=original.tuning,
        )
        assert result == expected
