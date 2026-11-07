"""Recovered Clean Cooking maintenance script.

Uploaded filename sha256: 103062edb6afa86df0b26be00737b3c7c42db48bb79dce317877db5421a8930a
Renamed to: scripts/inspect_selected_pdf_pages.py
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

pages_to_check = [14, 16, 45, 46, 48, 49, 86, 87, 89, 95]
global_page = 0

for f in files:
    doc = pymupdf.open(os.path.join(pdf_dir, f))
    for page_idx in range(len(doc)):
        global_page += 1
        if global_page in pages_to_check:
            page = doc[page_idx]
            txt = page.get_text()
            title = txt.strip().splitlines()[0] if txt.strip() else 'EMPTY'
            blocks = page.get_text('blocks')
            title_b = [b[4].strip() for b in blocks if 50 < b[1] < 150]
            print(f"=== Page {global_page} ({f} p{page_idx}): {title_b[:1]} ===")
            ing_b = [b[4].strip() for b in blocks if 'ingredient' in b[4].lower() or any(k in b[4].lower() for k in ['bacon', 'chorizo', 'pepperoni', 'wine'])]
            for b in ing_b[:3]:
                print("   ", b.replace('\n', ' // ')[:120])
