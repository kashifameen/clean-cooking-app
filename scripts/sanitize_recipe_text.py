"""Recovered Clean Cooking maintenance script.

Uploaded filename sha256: d6e8ff3fef6718facd1a3d78f6d710292527f12ba11e110b29d21a046f476abd
Renamed to: scripts/sanitize_recipe_text.py
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
import re

path = os.path.join(_repo_root(), "public", "data", "recipes.json")
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

# Common Unicode replacement character fixes from PDF fonts
text = text.replace('\ufffdC', '°C')
text = text.replace('\ufffdF', '°F')
text = text.replace('\ufffd', "'")
text = text.replace("don't", "don't")
text = text.replace("it's", "it's")

# Let's reload and parse as json to verify validity
data = json.loads(text)

# Also capitalize first letter of each instruction step
for r in data:
    clean_steps = []
    for s in r.get("instructions", []):
        s = s.strip()
        if s:
            s = s[0].upper() + s[1:]
            clean_steps.append(s)
    r["instructions"] = clean_steps

with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"Sanitized and validated {len(data)} recipes!")
