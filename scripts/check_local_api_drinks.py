"""Recovered Clean Cooking maintenance script.

Uploaded filename sha256: a299fc730952b18b4dbb782f80e86fd4023b2077e42ca9fef9a0bb23c1076bb7
Renamed to: scripts/check_local_api_drinks.py
Personal machine paths were removed. Cookbook PDFs are not stored in this repository.
Historical one-off tool: scripts that write recipes.json will replace the published dataset.
"""
import urllib.request
import json

req = urllib.request.urlopen("http://127.0.0.1:5000/api/recipes?category=Drinks")
data = json.loads(req.read().decode("utf-8"))
print(f"Total drinks in API: {data['count']}")
for r in data["recipes"]:
    print(f" - {r['title']} ({r['nutrition']['calories']} kcal, {r['nutrition']['protein']}g P)")

# Check Kashmiri Pink Tea specifically
pink_tea = [r for r in data["recipes"] if "kashmiri" in r["title"].lower()]
if pink_tea:
    pt = pink_tea[0]
    print("\nKashmiri Pink Tea Verified:")
    print("Title:", pt["title"])
    print("Nutrition:", pt["nutrition"])
    print("Ingredients count:", len(pt["ingredients"]))
    print("Steps count:", len(pt["instructions"]))
    print("Instant Pot Mode:", pt["instantPot"]["mode"])
    print("Instant Pot Steps:", len(pt["instantPot"]["steps"]))
    print("Image:", pt["image"])
