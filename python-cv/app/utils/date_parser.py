"""
Expiry date parser for AED label text.
Handles many date formats found on AED labels worldwide.
"""
from __future__ import annotations

import re
from datetime import date, datetime
from typing import Optional

# Ordered list of patterns, most-specific first. Full Y-M-D / M-D-Y dates
# MUST be tried before the bare Y-M / M-Y patterns below, otherwise the
# shorter pattern matches the leading "2025/06" of "2025/06/15" and the day
# is silently dropped.
_PATTERNS = [
    # 2025-06-15  |  2025/06/15
    (r"\b(20\d{2})[-/\.](0[1-9]|1[0-2])[-/\.](\d{1,2})\b", "%Y-%m-%d"),
    # 06/15/2025  |  06-15-2025
    (r"\b(0[1-9]|1[0-2])[-/\.](\d{1,2})[-/\.](20\d{2})\b", "%m-%d-%Y"),
    # 2025-06  |  2025/06  |  2025.06
    (r"\b(20\d{2})[-/\.](0[1-9]|1[0-2])\b", "%Y-%m"),
    # 06/2025  |  06-2025  |  06.2025
    (r"\b(0[1-9]|1[0-2])[-/\.](20\d{2})\b", "%m-%Y"),
    # JUN 2025  |  Jun-2025  |  JUN/2025
    (r"\b([A-Za-z]{3})[-/ ]*(20\d{2})\b", "%b %Y"),
    # USE BY 2025-06
    (r"[Uu][Ss][Ee][\s]+[Bb][Yy][\s]+(20\d{2})[-/\.](0[1-9]|1[0-2])", "%Y-%m"),
    # EXP 2025-06
    (r"[Ee][Xx][Pp][:\s]*(20\d{2})[-/\.](0[1-9]|1[0-2])", "%Y-%m"),
]

_MONTH_ABBR = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def parse_expiry_date(text: str) -> Optional[str]:
    """
    Extract and normalise expiry date from OCR text.
    Returns ISO string "YYYY-MM" or "YYYY-MM-DD", or None.
    """
    if not text:
        return None

    text = text.strip()

    for pattern, fmt in _PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if not match:
            continue

        groups = match.groups()
        try:
            if fmt in ("%Y-%m", "%m-%Y"):
                if fmt == "%Y-%m":
                    year, month = int(groups[0]), int(groups[1])
                else:
                    month, year = int(groups[0]), int(groups[1])
                return f"{year:04d}-{month:02d}"

            elif fmt == "%b %Y":
                month_str = groups[0].lower()[:3]
                month = _MONTH_ABBR.get(month_str)
                if not month:
                    continue
                year = int(groups[1])
                return f"{year:04d}-{month:02d}"

            elif fmt == "%Y-%m-%d":
                year, month, day = int(groups[0]), int(groups[1]), int(groups[2])
                return f"{year:04d}-{month:02d}-{day:02d}"

            elif fmt == "%m-%d-%Y":
                month, day, year = int(groups[0]), int(groups[1]), int(groups[2])
                return f"{year:04d}-{month:02d}-{day:02d}"

        except (ValueError, IndexError):
            continue

    return None


def is_expired(date_str: str) -> bool:
    """Return True if the parsed date is in the past."""
    if not date_str:
        return False
    try:
        parts = date_str.split("-")
        if len(parts) == 2:
            year, month = int(parts[0]), int(parts[1])
            expiry = date(year, month, 1)
        else:
            expiry = date.fromisoformat(date_str)
        return expiry < date.today()
    except ValueError:
        return False
