"""Recovered Clean Cooking maintenance script.

Uploaded filename sha256: f599090b2eee34b7556874ddaed748a01b58927258d067dd45cf355c2d014dbb
Renamed to: scripts/merge_split_ingredient_lines.py
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

with open(os.path.join(_repo_root(), "public", "data", "recipes.json"), "r", encoding="utf-8") as f:
    recipes = json.load(f)

def clean_ingredients_list(items):
    merged = []
    for it in items:
        it = it.strip()
        if not it: continue
        
        # Check if previous item ended with unclosed paren, dangling "brand:", or hyphen
        if merged:
            prev = merged[-1]
            # If prev ends with unclosed paren like "(brand:" or "(brand" or "brand:" or starts with lowercase/continuation
            prev_has_unclosed_paren = prev.count('(') > prev.count(')')
            prev_ends_dangling = prev.endswith(('(brand:', '(brand', 'brand:', '-', '(', 'brand', 'I use', 'I use:'))
            curr_is_continuation = (
                prev_has_unclosed_paren or 
                prev_ends_dangling or 
                it.startswith((')', '-', '+')) or 
                it.endswith((')', '))')) and not re.match(r'^\d', it) or
                (not re.match(r'^\d', it) and len(it.split()) <= 3 and any(b in it.lower() for b in ['tesco', 'aldi', 'lidl', 'waitrose', 'musclefood', 'protein works', 'morrisons', 'asda', 'sainsbury', 'kirkland', 'costco', 'fage', 'pure via', 'clarks', 'schwartz', 'warburtons', 'old el paso']))
            )
            
            if curr_is_continuation:
                # Merge into previous item
                merged[-1] = f"{prev} {it}".strip()
                # Clean up any spacing e.g. "(brand: Musclefood)"
                merged[-1] = re.sub(r'\s+', ' ', merged[-1])
                merged[-1] = re.sub(r'\(brand:\s*', '(brand: ', merged[-1])
                continue

        merged.append(it)
        
    return merged

# Test on recipes with issues
fixed_count = 0
for r in recipes:
    old_len = len(r["ingredients"])
    r["ingredients"] = clean_ingredients_list(r["ingredients"])
    if "ingredientSections" in r:
        for sec in r["ingredientSections"]:
            sec["items"] = clean_ingredients_list(sec["items"])
            
    if len(r["ingredients"]) != old_len:
        fixed_count += 1

print(f"Fixed ingredients in {fixed_count} recipes!")

# Verify recipe #1
print("\nRecipe #1 ingredients after fix:")
for ing in recipes[0]["ingredients"]:
    print(" -", ing)

# Verify recipe #10
print("\nRecipe #10 ingredients after fix:")
for ing in recipes[9]["ingredients"]:
    print(" -", ing)

# Check if any hanging (brand: remains
still_broken = []
for r in recipes:
    for ing in r["ingredients"]:
        if ing.strip().endswith(('(brand:', 'brand:', '(')):
            still_broken.append((r["number"], r["title"], ing))

print(f"\nRemaining broken lines: {len(still_broken)}")
for b in still_broken:
    print("  Still broken:", b)

with open(os.path.join(_repo_root(), "public", "data", "recipes.json"), "w", encoding="utf-8") as f:
    json.dump(recipes, f, indent=2, ensure_ascii=False)

print("\nSaved updated recipes.json!")
