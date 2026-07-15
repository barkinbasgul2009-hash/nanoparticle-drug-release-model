#!/usr/bin/env python3
"""Fail CI if prohibited hidden / bidirectional / zero-width characters are
introduced into source, workflow, JSON, Markdown, or configuration files.

Legitimate *visible* scientific and typographic symbols (µ, ∂, π, ∇, √, ², ³,
→, ⇒, em/en dashes, box-drawing, emoji, curly quotes, …) are allowed. Only
genuinely invisible or bidirectional-control characters are prohibited.

Usage:  python3 tools/check_hidden_chars.py
Exit 0 = clean; exit 1 = prohibited characters found (with a report).
"""
import subprocess
import sys
import unicodedata

# Prohibited code points -> human-readable reason.
PROHIBITED = {
    0xFEFF: "BOM / ZERO WIDTH NO-BREAK SPACE",
    0x200B: "ZERO WIDTH SPACE",
    0x200C: "ZERO WIDTH NON-JOINER",
    0x200D: "ZERO WIDTH JOINER",
    0x2060: "WORD JOINER",
    0x00AD: "SOFT HYPHEN",
    0x200E: "LEFT-TO-RIGHT MARK (bidi)",
    0x200F: "RIGHT-TO-LEFT MARK (bidi)",
    0x202A: "LEFT-TO-RIGHT EMBEDDING (bidi)",
    0x202B: "RIGHT-TO-LEFT EMBEDDING (bidi)",
    0x202C: "POP DIRECTIONAL FORMATTING (bidi)",
    0x202D: "LEFT-TO-RIGHT OVERRIDE (bidi)",
    0x202E: "RIGHT-TO-LEFT OVERRIDE (bidi)",
    0x2066: "LEFT-TO-RIGHT ISOLATE (bidi)",
    0x2067: "RIGHT-TO-LEFT ISOLATE (bidi)",
    0x2068: "FIRST STRONG ISOLATE (bidi)",
    0x2069: "POP DIRECTIONAL ISOLATE (bidi)",
    0x00A0: "NO-BREAK SPACE",
    0x2007: "FIGURE SPACE",
    0x202F: "NARROW NO-BREAK SPACE",
    0x2028: "LINE SEPARATOR",
    0x2029: "PARAGRAPH SEPARATOR",
}

# File types that are text we care about. Others (images, etc.) are skipped.
TEXT_SUFFIXES = (
    ".md", ".json", ".yml", ".yaml", ".r", ".R", ".js", ".mjs",
    ".html", ".htm", ".css", ".txt", ".sh", ".py", ".ipynb", ".toml", ".cfg",
)
TEXT_NAMES = (".gitignore", ".nojekyll", "package.json", "DESCRIPTION")


def tracked_files():
    out = subprocess.run(["git", "ls-files"], capture_output=True, text=True).stdout
    return out.split()


def is_text_target(path):
    if path.endswith(TEXT_SUFFIXES):
        return True
    base = path.rsplit("/", 1)[-1]
    return base in TEXT_NAMES


def main():
    findings = []
    for path in tracked_files():
        if not is_text_target(path):
            continue
        try:
            with open(path, "rb") as fh:
                raw = fh.read()
            if b"\x00" in raw:          # binary; skip
                continue
            text = raw.decode("utf-8")
        except (UnicodeDecodeError, FileNotFoundError):
            continue
        for lineno, line in enumerate(text.splitlines(), 1):
            for col, ch in enumerate(line, 1):
                cp = ord(ch)
                if cp in PROHIBITED:
                    findings.append((path, lineno, col, cp, PROHIBITED[cp]))

    if findings:
        print("Prohibited hidden/bidirectional characters found:\n")
        for path, ln, col, cp, reason in findings:
            print(f"  {path}:{ln}:{col}  U+{cp:04X}  {reason}")
        print(f"\n{len(findings)} prohibited character(s) found. "
              "Remove them (or use a visible equivalent).")
        return 1

    print("OK: no prohibited hidden/bidirectional/zero-width characters found.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
