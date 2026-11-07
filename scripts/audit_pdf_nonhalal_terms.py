"""Recovered Clean Cooking maintenance script.

Uploaded filename sha256: e7b576795343d8ae66f9aa524e10c60489f0f1caf214bb9a677efc8e216553cc
Renamed to: scripts/audit_pdf_nonhalal_terms.py
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
import pymupdf
import re

pdf_dir = _pdf_dir()
files = sorted([f for f in os.listdir(pdf_dir) if f.endswith('.pdf')])

pattern = re.compile(r'\b(pork|bacon|ham|prosciutto|lard|chorizo|pepperoni|wine|mirin|beer|gelatin)\b', re.I)

flagged = []
global_page = 0

for f in files:
    doc = pymupdf.open(os.path.join(pdf_dir, f))
    for page_idx in range(len(doc)):
        global_page += 1
        if global_page < 13 or global_page > 96:
            continue
        page = doc[page_idx]
        txt = page.get_text()
        
        is_recipe = (('calories' in txt.lower() or 'kcal' in txt.lower()) and 'protein' in txt.lower())
        if not is_recipe: continue
        
        matches = pattern.findall(txt)
        if matches:
            flagged.append((global_page, f, page_idx, set(m.lower() for m in matches), txt[:200]))

print(f"Total flagged recipes in Lean Bulking: {len(flagged)}")
for pg, f, idx, m, snippet in flagged:
    print(f"Page {pg}: {m}")
