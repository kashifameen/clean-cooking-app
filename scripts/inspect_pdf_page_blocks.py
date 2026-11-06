"""Recovered Clean Cooking maintenance script.

Uploaded filename sha256: 9e2e545da90d32f40da2c70018a00626327f2b2b42f6dacf275148c1587149fe
Renamed to: scripts/inspect_pdf_page_blocks.py
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

doc = pymupdf.open(os.path.join(_pdf_dir(), "011-020.pdf"))
page = doc[2]
blocks = page.get_text("blocks")
print(f"Page 13 blocks count: {len(blocks)}")
for b in sorted(blocks, key=lambda x: (x[1], x[0])):
    txt = b[4].strip().replace('\n', ' // ')
    if txt:
        print(f"  bbox=({b[0]:.0f},{b[1]:.0f},{b[2]:.0f},{b[3]:.0f}): {txt[:90]}")
