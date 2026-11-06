"""Recovered Clean Cooking maintenance script.

Uploaded filename sha256: 15abc8890721a6e9c218fba5014ffa2d52a2e8a4f1b50ae854def1e4376be48a
Renamed to: scripts/find_gelatin_ingredients.py
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
    for ing in r["ingredients"]:
        if any(k in ing.lower() for k in ["marshmallow", "jelly", "gelatin"]):
            print(f"#{r['number']} {r['title']}: {ing}")
