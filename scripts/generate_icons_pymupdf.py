"""Recovered Clean Cooking maintenance script.

Uploaded filename sha256: 9784494217bb0c3e46550e9445d7cb5665200f3157f66c2aa0ecc215fe038404
Renamed to: scripts/generate_icons_pymupdf.py
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
import os

img_dir = os.path.join(_repo_root(), "public", "images")
os.makedirs(img_dir, exist_ok=True)

def create_app_icon(size, filename):
    doc = pymupdf.open()
    page = doc.new_page(width=size, height=size)
    
    shape = page.new_shape()
    rect = pymupdf.Rect(0, 0, size, size)
    shape.draw_rect(rect)
    shape.finish(fill=(0.04, 0.05, 0.09)) # #0a0d17
    
    # Outer emerald circle
    shape.draw_circle(pymupdf.Point(size*0.5, size*0.5), size*0.42)
    shape.finish(fill=(0.06, 0.72, 0.51)) # #10b981
    
    # Inner dark ring
    shape.draw_circle(pymupdf.Point(size*0.5, size*0.5), size*0.35)
    shape.finish(fill=(0.04, 0.05, 0.09))
    
    # Lime & amber flame
    shape.draw_circle(pymupdf.Point(size*0.5, size*0.54), size*0.18)
    shape.finish(fill=(0.52, 0.80, 0.09)) # lime #84cc16
    
    shape.draw_circle(pymupdf.Point(size*0.5, size*0.56), size*0.11)
    shape.finish(fill=(0.96, 0.62, 0.04)) # amber #f59e0b
    
    shape.commit()
    
    pix = page.get_pixmap(dpi=72)
    out_path = os.path.join(img_dir, filename)
    pix.save(out_path)
    print(f"Generated {filename}: {pix.width}x{pix.height} PNG")

create_app_icon(192, "icon-192.png")
create_app_icon(512, "icon-512.png")
create_app_icon(512, "icon-maskable.png")
