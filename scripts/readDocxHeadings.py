#!/usr/bin/env python3
"""
readDocxHeadings.py — Evidence Package template importer helper (spec §8.2).

Reads a .docx and prints JSON with ONLY its heading hierarchy and any regulation
citations found. It deliberately stores no body prose — just headings (level +
text), their order, and matched citation strings. Never raises: prints
{"ok": false, "error": "..."} on failure.

Usage: python3 readDocxHeadings.py <file.docx>
"""

import sys
import json
import re

CITATION_RE = re.compile(
    r"(8\s*C\.?F\.?R\.?\s*§?\s*204\.5\([a-z]\)\(\d+\)(?:\([ivxlcdm]+\))?"
    r"|Kazarian\s+v\.?\s+USCIS)",
    re.IGNORECASE,
)


def heading_level(style_name: str):
    if not style_name:
        return None
    s = style_name.strip().lower()
    if s == "title":
        return 1
    m = re.match(r"heading\s*(\d+)", s)
    return int(m.group(1)) if m else None


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "usage: readDocxHeadings.py <file.docx>"}))
        return 2
    path = sys.argv[1]
    try:
        from docx import Document

        doc = Document(path)
        headings = []
        regulations = []
        for p in doc.paragraphs:
            text = (p.text or "").strip()
            if not text:
                continue
            lvl = heading_level(getattr(p.style, "name", "") or "")
            if lvl is not None:
                headings.append({"level": lvl, "text": text})
            for m in CITATION_RE.findall(text):
                cit = m if isinstance(m, str) else m[0]
                if cit and cit not in regulations:
                    regulations.append(cit)
        print(json.dumps({"ok": True, "headings": headings, "regulations": regulations}))
        return 0
    except Exception as exc:  # never raise
        print(json.dumps({"ok": False, "error": f"{type(exc).__name__}: {exc}"}))
        return 0


if __name__ == "__main__":
    sys.exit(main())
