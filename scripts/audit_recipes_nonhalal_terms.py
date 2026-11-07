"""Recovered Clean Cooking maintenance script.

Uploaded filename sha256: f1aeb6d94de090ae4670fabe6577668eb2bf95d72aa0b85f9c9db78b377c81f6
Renamed to: scripts/audit_recipes_nonhalal_terms.py
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

pattern = re.compile(r'\b(pork|bacon|ham|prosciutto|lard|pepperoni|wine|mirin|beer|gelatin)\b', re.I)

halal_issues = []

for r in recipes:
    num = r["number"]
    title = r["title"]
    
    # Check ingredients
    bad_ings = [ing for ing in r["ingredients"] if pattern.search(ing)]
    
    # Check text
    combo = title + " " + " ".join(r["instructions"]) + " " + (r.get("notes") or "")
    text_matches = set(m.lower() for m in pattern.findall(combo))
    
    if bad_ings or text_matches:
        halal_issues.append({
            "num": num,
            "title": title,
            "bad_ings": bad_ings,
            "text_matches": list(text_matches)
        })

print(f"Total flagged recipes: {len(halal_issues)}")
for issue in halal_issues:
    print(f"#{issue['num']:03d} {issue['title']}")
    if issue['bad_ings']:
        print(f"    Ingredients: {issue['bad_ings']}")
    if issue['text_matches']:
        print(f"    Text matches: {issue['text_matches']}")
