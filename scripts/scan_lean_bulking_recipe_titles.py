"""Recovered Clean Cooking maintenance script.

Uploaded filename sha256: a4d75e570ed846c458a4e1c0f963be12f66aaa55fe001371da6483b22cd3eb27
Renamed to: scripts/scan_lean_bulking_recipe_titles.py
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

recipes = []
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
        if not is_recipe:
            print(f"Page {global_page} ({f} p{page_idx}) is section divider: {txt.strip().splitlines()[0] if txt.strip() else 'EMPTY'}")
            continue
            
        blocks = page.get_text('blocks')
        title_blocks = [b for b in blocks if 50 < b[1] < 150]
        title_blocks.sort(key=lambda b: (b[1], b[0]))
        raw_title = "Unknown"
        for tb in title_blocks:
            cand = tb[4].strip().replace('\n', ' ')
            if cand and cand.lower() not in ['panacea palm', 'per serving nutrition', 'per serving']:
                raw_title = cand
                break
                
        cal_m = re.search(r'calories\s*[-–:]\s*(\d+)', txt, re.I)
        pro_m = re.search(r'protein\s*[-–:]\s*(\d+(?:\.\d+)?)', txt, re.I)
        carb_m = re.search(r'carbs?\s*[-–:]\s*(\d+(?:\.\d+)?)', txt, re.I)
        fat_m = re.search(r'fat\s*[-–:]\s*(\d+(?:\.\d+)?)', txt, re.I)
        serv_m = re.search(r'servings?\s*[-–:]\s*([^\n\r]+)', txt, re.I)
        
        imgs = page.get_images()
        
        recipes.append({
            "page": global_page,
            "file": f,
            "page_idx": page_idx,
            "title": raw_title,
            "calories": cal_m.group(1) if cal_m else None,
            "protein": pro_m.group(1) if pro_m else None,
            "carbs": carb_m.group(1) if carb_m else None,
            "fat": fat_m.group(1) if fat_m else None,
            "servings": serv_m.group(1).strip() if serv_m else None,
            "img_count": len(imgs)
        })

print(f"\nTotal Lean Bulking recipes scanned: {len(recipes)}")
print("Sample of first 10 recipes:")
for r in recipes[:10]:
    print(f"  Page {r['page']}: {r['title']} ({r['calories']} kcal, {r['protein']}g P, {r['carbs']}g C, {r['fat']}g F, serv: {r['servings']})")
print("Sample of last 5 recipes:")
for r in recipes[-5:]:
    print(f"  Page {r['page']}: {r['title']} ({r['calories']} kcal, {r['protein']}g P)")
