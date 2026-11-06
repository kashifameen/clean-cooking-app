"""Recovered Clean Cooking maintenance script.

Uploaded filename sha256: ca5d3833ffbb6a65917ec564deb27ca014275c23a5aeb541eb075c52a49205f2
Renamed to: scripts/fix_replacement_chars_in_ingredients.py
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
    recipes = json.load(f)

for r in recipes:
    clean_ings = []
    for ing in r["ingredients"]:
        ing = ing.replace("\ufffd", "1/2 ")
        ing = ing.replace("  ", " ").strip()
        clean_ings.append(ing)
    r["ingredients"] = clean_ings

    if "ingredientSections" in r:
        for sec in r["ingredientSections"]:
            sec["items"] = [item.replace("\ufffd", "1/2 ").replace("  ", " ").strip() for item in sec["items"]]

with open(os.path.join(_repo_root(), "public", "data", "recipes.json"), "w", encoding="utf-8") as f:
    json.dump(recipes, f, indent=2, ensure_ascii=False)

print("Safely replaced all replacement characters with 1/2 in ingredients!")
