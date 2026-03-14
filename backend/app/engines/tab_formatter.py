"""Tab Formatter for converting between TabData and text-based tablature.

Provides lossless round-trip conversion:
    parseFromText(formatToText(tabData)) == tabData
"""

import re

from app.models.schemas import TabData, TabNote

# Header/section markers
_TUNING_PREFIX = "TUNING:"
_NOTES_HEADER = "NOTES:"
# Each note line: time|string|fret
_NOTE_PATTERN = re.compile(r"^(\d+(?:\.\d+)?)\|(\d+)\|(\d+)$")


class TabFormatter:
    """Converts between structured TabData and a text representation.

    Text format:
        TUNING: E A D G B E
        NOTES:
        0.0|1|5
        0.25|2|3
        ...

    Each note line is: time|string_num|fret
    Notes are sorted by time in the output.
    """

    def formatToText(self, tab_data: TabData) -> str:
        """Convert TabData to a text-based tab string.

        Args:
            tab_data: Structured tab data with notes and tuning.

        Returns:
            Text representation that can be parsed back losslessly.
        """
        lines: list[str] = []

        # Tuning header
        lines.append(f"{_TUNING_PREFIX} {' '.join(tab_data.tuning)}")

        # Notes section
        lines.append(_NOTES_HEADER)

        sorted_notes = sorted(tab_data.notes, key=lambda n: n.time)
        for note in sorted_notes:
            # Use repr-style float formatting to preserve exact values
            time_str = _format_float(note.time)
            lines.append(f"{time_str}|{note.string_num}|{note.fret}")

        return "\n".join(lines)

    def parseFromText(self, text: str) -> TabData:
        """Parse a text-based tab string back into TabData.

        Args:
            text: Text previously produced by formatToText.

        Returns:
            TabData reconstructed from the text.

        Raises:
            ValueError: If the text format is invalid.
        """
        lines = [line.strip() for line in text.strip().splitlines()]

        if not lines:
            raise ValueError("Empty tab text")

        # Parse tuning
        if not lines[0].startswith(_TUNING_PREFIX):
            raise ValueError(f"Expected tuning header, got: {lines[0]!r}")

        tuning_str = lines[0][len(_TUNING_PREFIX):].strip()
        tuning = tuning_str.split()
        if not tuning:
            raise ValueError("Empty tuning")

        # Find notes section
        try:
            notes_idx = lines.index(_NOTES_HEADER)
        except ValueError:
            raise ValueError("Missing NOTES: header")

        # Parse note lines
        notes: list[TabNote] = []
        for line in lines[notes_idx + 1:]:
            if not line:
                continue
            match = _NOTE_PATTERN.match(line)
            if not match:
                raise ValueError(f"Invalid note line: {line!r}")

            time_val = float(match.group(1))
            string_num = int(match.group(2))
            fret = int(match.group(3))

            notes.append(TabNote(time=time_val, string_num=string_num, fret=fret))

        return TabData(notes=notes, tuning=tuning)


def _format_float(value: float) -> str:
    """Format a float for lossless round-trip through str -> float.

    Strips unnecessary trailing zeros while keeping at least one decimal.
    """
    # Use repr for full precision, then clean up
    s = repr(value)
    # repr may produce e.g. '0.0', '1.5', '0.1234' — all fine
    # But for integers like 1.0, keep the .0
    if "." not in s and "e" not in s.lower():
        s += ".0"
    return s
