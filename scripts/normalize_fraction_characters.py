"""Recovered Clean Cooking maintenance script.

Uploaded filename sha256: 6af91e0de91ddf90f5154eec98646e45ded3c0a7fa424b1971eb3349f2baa0b3
Renamed to: scripts/normalize_fraction_characters.py
Personal machine paths were removed. Cookbook PDFs are not stored in this repository.
Historical one-off tool: scripts that write recipes.json will replace the published dataset.
"""
import os

def _repo_root():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

def _pdf_dir():
    path = os.environ.get("LEAN_BULKING_PDF_DIR", "").strip()
    if not path:
        raise SystemExit(
            "Set LEAN_BULKING_PDF_DIR to a local folder of cookbook PDFs you are allowed to read. "
            "Those PDFs are not part of this repository."
        )
    return path

import os
import json

with open(os.path.join(_repo_root(), "public", "data", "recipes.json"), "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace('\xbd', '1/2')
text = text.replace('\xbc', '1/4')
text = text.replace('\xbe', '3/4')
text = text.replace('½', '1/2')
text = text.replace('¼', '1/4')
text = text.replace('¾', '3/4')

with open(os.path.join(_repo_root(), "public", "data", "recipes.json"), "w", encoding="utf-8") as f:
    f.write(text)

print("Replaced Latin-1 vulgar fractions with clean 1/2, 1/4, 3/4!")
