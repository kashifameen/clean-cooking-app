"""Recovered Clean Cooking maintenance script.

Uploaded filename sha256: 0d2c23fe418b22a5e8cc161c9d9f6f8b64cd4978b3ca32bfa789df30da4c9eaa
Renamed to: scripts/classify_pdf_recipe_pages.py
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

pdf_dir = _pdf_dir()
files = sorted([f for f in os.listdir(pdf_dir) if f.endswith('.pdf')])

print(f"Found {len(files)} PDF files.")

recipe_pages = []
non_recipe_pages = []
global_page = 0

for f in files:
    doc = pymupdf.open(os.path.join(pdf_dir, f))
    for page_idx in range(len(doc)):
        global_page += 1
        page = doc[page_idx]
        txt = page.get_text()
        txt_lower = txt.lower()
        is_recipe = (('calories' in txt_lower or 'kcal' in txt_lower) and 'protein' in txt_lower)
        first_line = txt.strip().splitlines()[0] if txt.strip() else 'EMPTY'
        
        if is_recipe:
            recipe_pages.append((global_page, f, page_idx, first_line[:50]))
        else:
            non_recipe_pages.append((global_page, f, page_idx, first_line[:50]))

print(f"Total pages: {global_page}")
print(f"Recipe pages detected: {len(recipe_pages)}")
print(f"Non-recipe pages: {len(non_recipe_pages)}")

print("\nNon-recipe pages:")
for nr in non_recipe_pages:
    print(f"  Page {nr[0]} ({nr[1]} p{nr[2]}): {nr[3]}")

print("\nFirst 10 Recipe pages:")
for r in recipe_pages[:10]:
    print(f"  Page {r[0]} ({r[1]} p{r[2]}): {r[3]}")
