"""Recovered Clean Cooking maintenance script.

Uploaded filename sha256: 2dd34cd0909a37020755d04a2d36bdaa417895c7a3afae257071b7cc7a7a4159
Renamed to: scripts/check_local_api_recipe_counts.py
Personal machine paths were removed. Cookbook PDFs are not stored in this repository.
Historical one-off tool: scripts that write recipes.json will replace the published dataset.
"""
import urllib.request
import json

req = urllib.request.urlopen("http://127.0.0.1:5000/api/recipes")
data = json.loads(req.read().decode("utf-8"))
print(f"Total Halal recipes on server: {data['count']}")

bulking = [r for r in data["recipes"] if r.get("book") == "The Ultimate Guide to Lean Bulking"]
print(f"Lean Bulking recipes on server: {len(bulking)}")
for r in bulking[:6]:
    print(f"  * {r['title']} ({r['nutrition']['calories']} kcal, {r['nutrition']['protein']}g P)")

cutting = [r for r in data["recipes"] if r.get("book") != "The Ultimate Guide to Lean Bulking"]
print(f"Clean Cutting recipes on server: {len(cutting)}")
