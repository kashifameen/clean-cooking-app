"""Recovered Clean Cooking maintenance script.

Uploaded filename sha256: 73d7b5a738e2344052c22e72ac4a974e08d21fa8152f98afe4adbf56e1805cea
Renamed to: scripts/inspect_pdf_page_images.py
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
imgs = page.get_images()
print(f"Page 13 image count: {len(imgs)}")
for img in imgs:
    xref = img[0]
    b = doc.extract_image(xref)
    print(f"  xref {xref}: {b['width']}x{b['height']}, {len(b['image'])} bytes, ext: {b['ext']}")
