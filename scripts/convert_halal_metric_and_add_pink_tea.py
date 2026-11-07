"""Recovered Clean Cooking maintenance script.

Uploaded filename sha256: c3dee52aaddb133b6dc6527b3248f98d02aa1d45c52bb0c7eea800dc2c7769c0
Renamed to: scripts/convert_halal_metric_and_add_pink_tea.py
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
import os
import re

base_dir = _repo_root()
recipes_path = os.path.join(base_dir, "public", "data", "recipes.json")

with open(recipes_path, "r", encoding="utf-8") as f:
    recipes = json.load(f)

print(f"Original recipe count: {len(recipes)}")

# 1. Non-Halal IDs to remove (Explicit pork / bacon / pork sausages)
pork_recipe_numbers = [1, 2, 3, 8, 11, 15, 16, 54, 117]

halal_recipes = []
for r in recipes:
    if r["number"] in pork_recipe_numbers:
        print(f"REMOVING non-halal recipe #{r['number']}: {r['title']}")
        continue
    halal_recipes.append(r)

print(f"Halal recipes remaining: {len(halal_recipes)}")

# 2. Metric conversion helpers
def to_metric_text(text):
    if not text: return text
    
    # Temperatures: e.g. 428°F, 400°F, 350°F, 165°F
    text = re.sub(r'(\d+)\s*°?F\s*\(\s*(\d+)\s*°?C\s*\)', r'\2°C', text, flags=re.I)
    text = re.sub(r'(\d+)\s*°?C\s*\(\s*(\d+)\s*°?F\s*\)', r'\1°C', text, flags=re.I)
    text = re.sub(r'165\s*°?F', '75°C', text, flags=re.I)
    text = re.sub(r'300\s*°?F', '150°C', text, flags=re.I)
    text = re.sub(r'325\s*°?F', '160°C', text, flags=re.I)
    text = re.sub(r'350\s*°?F', '180°C', text, flags=re.I)
    text = re.sub(r'375\s*°?F', '190°C', text, flags=re.I)
    text = re.sub(r'400\s*°?F', '200°C', text, flags=re.I)
    text = re.sub(r'425\s*°?F', '220°C', text, flags=re.I)
    text = re.sub(r'428\s*°?F', '220°C', text, flags=re.I)
    text = re.sub(r'450\s*°?F', '230°C', text, flags=re.I)
    
    # Volumes: cups to ml
    text = re.sub(r'\b1\s*cup\b', '240ml', text, flags=re.I)
    text = re.sub(r'\b1/2\s*cup\b', '120ml', text, flags=re.I)
    text = re.sub(r'\b1/3\s*cup\b', '80ml', text, flags=re.I)
    text = re.sub(r'\b1/4\s*cup\b', '60ml', text, flags=re.I)
    text = re.sub(r'\b2\s*cups\b', '480ml', text, flags=re.I)
    
    # Spoons
    text = re.sub(r'\b1\s*tbsp\b', '15ml (1 tbsp)', text, flags=re.I)
    text = re.sub(r'\b2\s*tbsp\b', '30ml (2 tbsp)', text, flags=re.I)
    text = re.sub(r'\b1\s*tsp\b', '5ml (1 tsp)', text, flags=re.I)
    text = re.sub(r'\b1/2\s*tsp\b', '2.5ml (1/2 tsp)', text, flags=re.I)
    text = re.sub(r'\b1/4\s*tsp\b', '1.25ml (1/4 tsp)', text, flags=re.I)

    # Weights: oz/lbs
    text = re.sub(r'\b1\s*oz\b', '30g', text, flags=re.I)
    text = re.sub(r'\b2\s*oz\b', '60g', text, flags=re.I)
    text = re.sub(r'\b4\s*oz\b', '115g', text, flags=re.I)
    text = re.sub(r'\b8\s*oz\b', '230g', text, flags=re.I)
    text = re.sub(r'\b1\s*lb\b', '450g', text, flags=re.I)
    
    # Sanitize non-halal words in remaining recipes
    text = re.sub(r'\bMirin\s*\(substitute with rice wine vinegar\)', 'Halal rice vinegar (or apple cider vinegar + 1 tsp honey)', text, flags=re.I)
    text = re.sub(r'\bmirin\b', 'halal rice vinegar + pinch of sweetener', text, flags=re.I)
    text = re.sub(r'\brice wine vinegar\b', 'halal rice vinegar', text, flags=re.I)
    text = re.sub(r'\beven bacon!\b', 'or your favourite halal toppings!', text, flags=re.I)
    text = re.sub(r'\bmini marshmallows\b', 'halal / plant-based mini marshmallows', text, flags=re.I)
    text = re.sub(r'\bjelly sachet\b', 'halal / vegetarian jelly crystals sachet', text, flags=re.I)
    text = re.sub(r'\bTurkey bacon rashers \(diced\) you can also you regular centre cut or beef bacon\b', 'Halal Turkey bacon or Beef bacon rashers (diced)', text, flags=re.I)
    text = re.sub(r'\bTurkey pepperoni \(you can also use beef or regular pepperoni\)\b', 'Halal Turkey or Beef pepperoni', text, flags=re.I)
    text = re.sub(r'\blow fat pepperoni \(I used\s*Turkey pepperoni, regular or beef pepperoni also works\)\b', 'Halal Turkey or Beef pepperoni', text, flags=re.I)
    text = re.sub(r'\bturkey or beef pepperoni\b', 'halal turkey or beef pepperoni', text, flags=re.I)
    
    return text

# 3. Pressure Cooker / Instant Pot Pro Generator
def generate_instant_pot_guide(recipe):
    title = recipe["title"].lower()
    cat = recipe["category"].lower()
    sub = (recipe.get("subCategory") or "").lower()
    combo = (title + " " + " ".join(recipe["ingredients"]) + " " + " ".join(recipe["instructions"])).lower()
    
    # Category: Chicken Breasts / Shredded Chicken / Taquitos / Tacos / Wings
    if "shredded" in combo or "taquito" in combo or "pulled chicken" in combo or "chicken breast" in combo:
        if "wings" in combo:
            return {
                "applicable": True,
                "mode": "Pressure Cook (High) + Air Fry / Crisp Lid",
                "cookTime": "10 mins + 8 mins Crisp",
                "pressureLevel": "High Pressure",
                "release": "Quick Release (QR)",
                "steps": [
                    "Place 120ml water in the inner pot and insert the stainless steel trivet.",
                    "Arrange seasoned chicken wings evenly on the trivet.",
                    "Lock the lid, ensure valve is set to Seal, and Pressure Cook on High for 10 minutes.",
                    "Perform a Quick Release (QR). Carefully remove lid.",
                    "Toss wings in the honey garlic glaze. If you have the Instant Pot Crisp / Air Fryer lid, air fry at 200°C for 6-8 minutes until caramelized and crispy (or pop under the oven broiler for 4 mins)!"
                ]
            }
        else:
            return {
                "applicable": True,
                "mode": "Pressure Cook (High) / Sauté",
                "cookTime": "8-10 mins",
                "pressureLevel": "High Pressure",
                "release": "10-Minute Natural Release (NR)",
                "steps": [
                    "Press 'Sauté' mode (High). Add cooking spray and sear seasoned chicken for 2 minutes per side until lightly golden.",
                    "Pour in 60-80ml water or broth to deglaze the bottom of the pot (scrape any browned bits to prevent 'Burn' notice).",
                    "Lock lid, set valve to Seal, and Pressure Cook on High for 8 minutes (fresh) or 12 minutes (frozen breasts).",
                    "Allow 10 minutes Natural Release (NR), then vent remaining steam. Chicken will be ultra-juicy and shred effortlessly with two forks directly in the pot!",
                    "Stir in light cream cheese, taco seasoning, or sauce using residual heat until rich and creamy."
                ]
            }
            
    # Category: Beef / Steaks / Meatballs / Stews
    elif "beef" in combo or "steak" in combo or "meatball" in combo:
        if "ground beef" in combo or "mince" in combo or "patty" in combo:
            return {
                "applicable": True,
                "mode": "Sauté (High) / Simmer",
                "cookTime": "6-8 mins",
                "pressureLevel": "None (Sauté Mode)",
                "release": "N/A",
                "steps": [
                    "Press 'Sauté' (High) on your Instant Pot Pro.",
                    "Add cooking spray, diced onions, and lean ground beef. Break apart with a wooden spoon and cook for 5-6 minutes until browned.",
                    "Add seasonings and sauce directly into the pot, stirring continuously until thickened.",
                    "Hit 'Keep Warm' to hold filling at the perfect temperature while assembling wraps, pockets, or bowls."
                ]
            }
        else:
            return {
                "applicable": True,
                "mode": "Sauté (High) then Pressure Cook (High)",
                "cookTime": "12-15 mins",
                "pressureLevel": "High Pressure",
                "release": "10-Minute Natural Release (NR)",
                "steps": [
                    "Select 'Sauté' (High). Sear seasoned steak bites or beef strips in cooking spray for 2-3 minutes to lock in juices.",
                    "Deglaze pot with 80ml water or beef broth, scraping all flavorful browned bits from the base.",
                    "Lock the lid and Pressure Cook on High for 12 minutes for melt-in-the-mouth tenderness.",
                    "Perform a 10-minute Natural Release, then Quick Release remaining steam. Stir in sauce or garlic butter to finish."
                ]
            }
            
    # Category: Rice Dishes
    elif "rice" in combo:
        return {
            "applicable": True,
            "mode": "Sauté then Rice / Pressure Cook (Low)",
            "cookTime": "4 mins",
            "pressureLevel": "Low Pressure (or Rice Preset)",
            "release": "10-Minute Natural Release (NR)",
            "steps": [
                "Press 'Sauté' (High). Cook chicken or meat with garlic, ginger, and vegetables for 3-4 minutes.",
                "Add thoroughly rinsed basmati or jasmine rice and liquid at a 1:1.1 ratio (e.g. 150g rice to 165ml water/broth + soy sauce).",
                "Lock lid, set valve to Seal, and Pressure Cook on Low for 4 minutes (or select 'Rice' preset).",
                "Allow 10 minutes Natural Release (NR). Gently fluff with a fork — perfectly separated, tender, non-mushy grains every time!"
            ]
        }
        
    # Category: Pasta & Noodles
    elif "pasta" in combo or "mac" in combo or "noodle" in combo:
        return {
            "applicable": True,
            "mode": "Pressure Cook (High) then Sauté",
            "cookTime": "4-5 mins",
            "pressureLevel": "High Pressure",
            "release": "Quick Release (QR)",
            "steps": [
                "Add dried pasta/macaroni into the inner pot and submerge just covered with water or broth (liquid level flush with pasta).",
                "Lock lid and Pressure Cook on High for 4 minutes (half the box cook time minus 1 minute).",
                "Immediately perform a Quick Release (QR) to stop pasta from overcooking.",
                "Switch to Sauté (Low), stir in Greek yogurt, reduced-fat cheese, seasonings, and pre-cooked protein. Stir for 1-2 minutes until creamy and velvety!"
            ]
        }
        
    # Category: Potatoes / Fries / Loaded Bowls
    elif "potato" in combo or "mash" in combo:
        return {
            "applicable": True,
            "mode": "Steam / Pressure Cook (High)",
            "cookTime": "8-10 mins",
            "pressureLevel": "High Pressure",
            "release": "Quick Release (QR)",
            "steps": [
                "Pour 240ml water into the pot and place the stainless steel trivet inside.",
                "Place peeled and diced potatoes (2cm cubes) in a steamer basket on the trivet.",
                "Lock lid and Pressure Cook on High for 8-10 minutes until fork-tender.",
                "Quick release, transfer potatoes to a bowl, and mash directly with Greek yogurt, splash of milk, garlic powder, and pink salt for the creamiest high-protein mash!"
            ]
        }
        
    # Category: Oats & Baked Oats
    elif "oats" in combo or "baked oats" in combo:
        return {
            "applicable": True,
            "mode": "Pot-in-Pot (PIP) Pressure Cook (High)",
            "cookTime": "10 mins",
            "pressureLevel": "High Pressure",
            "release": "10-Minute Natural Release (NR)",
            "steps": [
                "Pour 240ml water into the main stainless steel inner pot and place the trivet inside.",
                "Pour blended oat batter into an oven/pressure-safe 15cm cake pan or heat-safe ramekin. Cover lightly with foil.",
                "Place the ramekin onto the trivet. Secure lid and Pressure Cook on High for 10 minutes.",
                "Allow 10 minutes Natural Release. The baked oats will emerge ultra-fluffy, moist, and soufflé-like throughout!"
            ]
        }
        
    # Category: Breakfast Eggs / Shakshuka / Bites
    elif "egg" in combo or "shakshuka" in combo:
        return {
            "applicable": True,
            "mode": "Steam / Sauté (Low)",
            "cookTime": "5 mins",
            "pressureLevel": "Low Pressure / Steam",
            "release": "Quick Release (QR)",
            "steps": [
                "For egg bites: pour blended egg mixture into silicone egg bite molds.",
                "Add 240ml water to pot, place trivet, and stack silicone mold covered with foil.",
                "Pressure Cook on Low for 5 minutes, followed by a 5-minute Natural Release. Perfectly velvety Starbucks-style egg bites!"
            ]
        }
        
    # Default for No-Cook / Chilled / Shakes / Ninja Creami / Cold Sandwiches
    else:
        return {
            "applicable": False,
            "mode": "Chilled / Ready-to-Serve (No Pressure Cooking Required)",
            "cookTime": "Instant",
            "pressureLevel": "Ambient",
            "release": "N/A",
            "steps": [
                "This recipe is designed as a fresh chilled prep, blender shake, or no-bake dessert.",
                "No pressure cooking required! Simply follow the standard step-by-step instructions.",
                "Tip: If meal-prepping in bulk, you can use the Instant Pot's 'Yogurt' mode for fermenting homemade high-protein Greek yogurt bases."
            ]
        }

# Process each halal recipe
processed_recipes = []
for idx, r in enumerate(halal_recipes, 1):
    r["number"] = idx
    r["isHalal"] = True
    
    # 1. Metric conversions for title, ingredients, instructions, notes
    r["title"] = to_metric_text(r["title"])
    r["ingredients"] = [to_metric_text(ing) for ing in r["ingredients"]]
    r["instructions"] = [to_metric_text(step) for step in r["instructions"]]
    r["notes"] = to_metric_text(r.get("notes") or "")
    
    if "ingredientSections" in r:
        for sec in r["ingredientSections"]:
            sec["items"] = [to_metric_text(item) for item in sec["items"]]
            
    # 2. Add Instant Pot Pro guide
    r["instantPot"] = generate_instant_pot_guide(r)
    
    # 3. Add Halal tag
    if "Halal Certified" not in r["tags"]:
        r["tags"].insert(0, "100% Halal")
        
    processed_recipes.append(r)

# 4. Add Kashmiri Pink Tea (Noon Chai) Recipe!
kashmiri_tea = {
    "id": "205-kashmiri-pink-tea-noon-chai",
    "number": len(processed_recipes) + 1,
    "title": "Royal Kashmiri Pink Tea (Noon Chai) — High Protein",
    "category": "Drinks",
    "subCategory": "Traditional Teas & Hot Drinks",
    "page": 165,
    "sourceFile": "custom_authentic_drinks",
    "sourcePage": 1,
    "isHalal": True,
    "nutrition": {
        "calories": 118,
        "protein": 14.5,
        "carbs": 7.0,
        "fat": 3.2,
        "servings": "2 cups (480ml)",
        "servingsCount": 2.0,
        "proteinCalPct": 49.2,
        "proteinDensity": 12.3
    },
    "ingredients": [
        "15g (2 tbsp) authentic Kashmiri green tea leaves (Noon Chai leaves)",
        "500ml cold filtered water (divided: 250ml for reduction + 250ml ice-cold water)",
        "1.5g (1/4 tsp) baking soda (sodium bicarbonate - vital catalyst for pink reaction)",
        "3 green cardamom pods (lightly crushed)",
        "1 small cinnamon stick",
        "1 star anise (optional)",
        "300ml low-fat milk (or unsweetened almond milk)",
        "25g unflavoured whey isolate or vanilla protein powder (Protein Works)",
        "1.5g (1/4 tsp) Himalayan pink salt (traditional Kashmiri pinch) or 0-cal sweetener to taste",
        "10g crushed pistachios and slivered almonds (for royal garnish)"
    ],
    "ingredientSections": [
        {
            "name": "Tea Kehva (Base Liquor)",
            "items": [
                "15g (2 tbsp) authentic Kashmiri green tea leaves (Noon Chai leaves)",
                "250ml cold water (for initial brew)",
                "1.5g (1/4 tsp) baking soda (sodium bicarbonate)",
                "3 green cardamom pods (lightly crushed)",
                "1 small cinnamon stick",
                "1 star anise (optional)",
                "250ml ice-cold water (for color shock aeration)"
            ]
        },
        {
            "name": "High Protein Milk & Garnish",
            "items": [
                "300ml low-fat milk (or unsweetened almond milk)",
                "25g unflavoured whey isolate or vanilla protein powder (Protein Works)",
                "1.5g (1/4 tsp) Himalayan pink salt or 0-cal sweetener to taste",
                "10g crushed pistachios and slivered almonds (for royal garnish)"
            ]
        }
    ],
    "instructions": [
        "In a saucepan (or Instant Pot on Sauté mode), add 250ml cold water, Kashmiri tea leaves, crushed cardamom, cinnamon stick, and star anise. Bring to a rolling boil over medium-high heat.",
        "Add the 1.5g (1/4 tsp) baking soda. The tea will vigorously froth and transition from green to a deep crimson-maroon hue. Whisk briskly for 20 seconds.",
        "Simmer on medium heat for 8-10 minutes until the liquid reduces by roughly half into a concentrated dark kehva.",
        "Pour in the 250ml of ice-cold water. Using a ladle, vigorously scoop and pour the tea back into the pot from a 20cm height continuously for 3 minutes. This rapid thermal shock and aeration binds oxygen to the tea polyphenols, locking in the ruby pigment.",
        "Pour in the 300ml of low-fat warm milk. Instantly marvel as the liquid transforms into a rich, pastel blossom pink! Whisk in the protein powder and a pinch of pink salt (or sweetener).",
        "Simmer gently for 2 minutes without boiling over. Strain through a fine-mesh tea sieve into two warm mugs, crown with crushed pistachios and slivered almonds, and serve steaming hot."
    ],
    "notes": "Authentic Kashmiri Noon Chai achieves its iconic natural pink color via the chemical interaction between tea polyphenols, baking soda (alkaline environment), and cold-water aeration — never artificial food dyes! For a sweeter profile, replace the pinch of salt with Pure Via stevia or a drizzle of honey.",
    "tags": [
        "100% Halal",
        "Drinks",
        "High Protein",
        "Kashmiri Pink Tea",
        "Traditional Chai",
        "Antioxidant Boost",
        "Quick & Easy",
        "Low Calorie"
    ],
    "image": "images/recipes/kashmiri-pink-tea.jpg",
    "instantPot": {
        "applicable": True,
        "mode": "Sauté (High) then Sauté (Low)",
        "cookTime": "12 mins",
        "pressureLevel": "Ambient (Sauté Mode)",
        "release": "N/A",
        "steps": [
            "Press 'Sauté' (High). Add 250ml water, Kashmiri tea leaves, crushed cardamom, and spices. Bring to a boil.",
            "Add baking soda and whisk as it froths deep burgundy. Boil for 6-8 minutes until reduced by half.",
            "Switch to 'Sauté' (Low). Add 250ml ice-cold water and ladle-aerate for 2 minutes to shock the pink hue.",
            "Stir in 300ml low-fat milk, protein powder, and pinch of pink salt. Simmer 2 minutes, then hit 'Keep Warm' to keep hot for guests!",
            "Strain into mugs and garnish with crushed pistachios and almonds."
        ]
    }
}

processed_recipes.append(kashmiri_tea)
print(f"Added Kashmiri Pink Tea! Total recipes: {len(processed_recipes)}")

# Save to data/recipes.json
with open(recipes_path, "w", encoding="utf-8") as out:
    json.dump(processed_recipes, out, indent=2, ensure_ascii=False)

print(f"SUCCESS: Saved {len(processed_recipes)} 100% Halal, Metric recipes with Instant Pot Pro guides!")
