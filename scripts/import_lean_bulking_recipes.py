"""Recovered Clean Cooking maintenance script.

Uploaded filename sha256: 47c67c3c8411afe34dac6474bedd122505f3fb0de96ca3c76a0685b8c20377a3
Renamed to: scripts/import_lean_bulking_recipes.py
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
import json

base_dir = _repo_root()
data_dir = os.path.join(base_dir, "public", "data")
img_dir = os.path.join(base_dir, "public", "images", "recipes")
os.makedirs(img_dir, exist_ok=True)

pdf_dir = _pdf_dir()
files = sorted([f for f in os.listdir(pdf_dir) if f.endswith('.pdf')])

# Load existing 205 halal recipes
recipes_json_path = os.path.join(data_dir, "recipes.json")
with open(recipes_json_path, "r", encoding="utf-8") as f:
    existing_recipes = json.load(f)

print(f"Loaded {len(existing_recipes)} existing halal recipes.")

def clean_title(raw):
    raw = raw.strip()
    raw = re.sub(r'[\r\n]+', ' ', raw)
    raw = re.sub(r'\s+', ' ', raw)
    words = raw.split(' ')
    clean_words = []
    minor_words = {'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of', 'on', 'or', 'so', 'the', 'to', 'with', '&', "n'"}
    for i, w in enumerate(words):
        lw = w.lower()
        if w.upper() in ['KFC', 'BBQ', 'PB', 'PB&J', 'NYC', 'BLT', 'BEEF']:
            clean_words.append('Beef' if w.upper() == 'BEEF' else w.upper())
        elif i == 0 or lw not in minor_words:
            clean_words.append(w.capitalize())
        else:
            clean_words.append(lw)
    res = ' '.join(clean_words)
    res = re.sub(r'\bBEEF\b', 'Beef', res)
    res = re.sub(r'\bBULking\b', 'Bulking', res, flags=re.I)
    res = re.sub(r'\bBULK-up\b', 'Bulk-Up', res, flags=re.I)
    return res

def slugify(text):
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '-', text).strip('-')
    return text

def parse_servings_number(s_str):
    if not s_str: return 1.0
    m = re.search(r'(\d+(?:\.\d+)?)', s_str)
    if m:
        try: return float(m.group(1))
        except: return 1.0
    return 1.0

def to_metric_text(text):
    if not text: return text
    text = re.sub(r'(\d+)\s*°?F\s*\(\s*(\d+)\s*°?C\s*\)', r'\2°C', text, flags=re.I)
    text = re.sub(r'(\d+)\s*°?C\s*\(\s*(\d+)\s*°?F\s*\)', r'\1°C', text, flags=re.I)
    text = re.sub(r'165\s*°?F', '75°C', text, flags=re.I)
    text = re.sub(r'350\s*°?F', '180°C', text, flags=re.I)
    text = re.sub(r'400\s*°?F', '200°C', text, flags=re.I)
    text = re.sub(r'425\s*°?F', '220°C', text, flags=re.I)
    text = re.sub(r'428\s*°?F', '220°C', text, flags=re.I)
    text = re.sub(r'\b1\s*cup\b', '240ml', text, flags=re.I)
    text = re.sub(r'\b1/2\s*cup\b', '120ml', text, flags=re.I)
    text = re.sub(r'\b1/3\s*cup\b', '80ml', text, flags=re.I)
    text = re.sub(r'\b1/4\s*cup\b', '60ml', text, flags=re.I)
    text = re.sub(r'\b2\s*cups\b', '480ml', text, flags=re.I)
    text = re.sub(r'\b1\s*tbsp\b', '15ml (1 tbsp)', text, flags=re.I)
    text = re.sub(r'\b2\s*tbsp\b', '30ml (2 tbsp)', text, flags=re.I)
    text = re.sub(r'\b1\s*tsp\b', '5ml (1 tsp)', text, flags=re.I)
    text = re.sub(r'\b1/2\s*tsp\b', '2.5ml (1/2 tsp)', text, flags=re.I)
    text = re.sub(r'\brice wine vinegar\b', 'halal rice vinegar', text, flags=re.I)
    text = re.sub(r'\bmini marshmallows\b', 'halal / plant-based mini marshmallows', text, flags=re.I)
    text = re.sub(r'\bjelly sachet\b', 'halal / vegetarian jelly crystals sachet', text, flags=re.I)
    text = text.replace('\ufffd', "'")
    return text

def generate_instant_pot_guide(title, category, ingredients_text, instructions_text):
    combo = (title + " " + ingredients_text + " " + instructions_text).lower()
    
    if "tikka" in combo or "chicken" in combo or "curry" in combo or "nando" in combo:
        return {
            "applicable": True,
            "mode": "Sauté (High) then Pressure Cook (High)",
            "cookTime": "8-10 mins",
            "pressureLevel": "High Pressure",
            "release": "10-Minute Natural Release (NR)",
            "steps": [
                "Select 'Sauté' (High) on your Instant Pot Pro. Add 10ml olive oil and brown marinated chicken and aromatics for 3 minutes.",
                "Pour in 100ml water, coconut milk, or broth to deglaze the bottom of the pot thoroughly.",
                "Lock lid, set valve to Seal, and Pressure Cook on High for 8 minutes.",
                "Allow a 10-minute Natural Release (NR). Stir in Greek yogurt or cream on Keep Warm mode for an ultra-rich bulking curry!"
            ]
        }
    elif "beef" in combo or "steak" in combo or "chilli" in combo or "lasagna" in combo:
        return {
            "applicable": True,
            "mode": "Sauté (High) / Pressure Cook (High)",
            "cookTime": "12-15 mins",
            "pressureLevel": "High Pressure",
            "release": "10-Minute Natural Release (NR)",
            "steps": [
                "Press 'Sauté' (High). Brown seasoned ground beef or steak cubes with onions and garlic for 5 minutes.",
                "Deglaze the base with 100ml beef broth, then stir in crushed tomatoes, beans, and spices.",
                "Secure lid and Pressure Cook on High for 12 minutes to deeply infuse spices.",
                "Allow 10-minute Natural Release, then Quick Release remaining steam. Serve over rice or with nachos!"
            ]
        }
    elif "rice" in combo or "pilau" in combo:
        return {
            "applicable": True,
            "mode": "Sauté then Rice / Pressure Cook (Low)",
            "cookTime": "5 mins",
            "pressureLevel": "Low Pressure",
            "release": "10-Minute Natural Release (NR)",
            "steps": [
                "Press 'Sauté' (Medium). Sauté whole spices (cardamom, cumin seeds) in 10g butter or ghee for 1 minute.",
                "Add rinsed basmati rice and water/stock at a 1:1.15 ratio.",
                "Lock lid and Pressure Cook on Low for 5 minutes (or use 'Rice' preset).",
                "Allow 10 minutes Natural Release. Fluff gently with a fork for restaurant-quality aromatic rice."
            ]
        }
    elif "pasta" in combo or "spaghetti" in combo or "noodle" in combo:
        return {
            "applicable": True,
            "mode": "Pressure Cook (High) then Sauté",
            "cookTime": "4-5 mins",
            "pressureLevel": "High Pressure",
            "release": "Quick Release (QR)",
            "steps": [
                "Layer broken pasta into the pot. Add just enough seasoned stock to barely cover the pasta.",
                "Pressure Cook on High for 4 minutes (half the box time minus 1 min).",
                "Immediately perform Quick Release (QR).",
                "Switch to Sauté (Low), fold in cheeses, cream, and cooked meats until rich and glossy."
            ]
        }
    elif "oats" in combo or "baked oats" in combo:
        return {
            "applicable": True,
            "mode": "Pot-in-Pot (PIP) Pressure Cook (High)",
            "cookTime": "12 mins",
            "pressureLevel": "High Pressure",
            "release": "10-Minute Natural Release (NR)",
            "steps": [
                "Pour 240ml water into the main inner pot and place the trivet inside.",
                "Pour oat batter into a greased, heat-safe baking dish and cover lightly with foil.",
                "Place on the trivet. Pressure Cook on High for 12 minutes.",
                "Allow 10 minutes Natural Release for cake-like, golden bulking baked oats."
            ]
        }
    elif "shake" in combo or "smoothie" in combo:
        return {
            "applicable": False,
            "mode": "Blender Prep (No Pressure Cooking)",
            "cookTime": "Instant",
            "pressureLevel": "Ambient",
            "release": "N/A",
            "steps": [
                "This is a high-calorie, nutrient-dense bulking shake.",
                "Add all ingredients into a high-speed blender and blend for 45-60 seconds until completely smooth.",
                "Serve chilled or pour into a shaker cup to sip on the go!"
            ]
        }
    else:
        return {
            "applicable": False,
            "mode": "Ready-to-Serve / Stove-top Prep",
            "cookTime": "Direct Cook",
            "pressureLevel": "Ambient",
            "release": "N/A",
            "steps": [
                "This recipe is best prepared using the primary stovetop or pan method as instructed.",
                "If meal-prepping large quantities, you can use the Instant Pot's Sauté mode for searing and Keep Warm for holding temperature."
            ]
        }

# Non-halal pages in Lean Bulking book to skip
pork_pages_to_skip = {14, 16, 45, 49, 86, 89, 95}

bulking_recipes = []
global_page = 0
recipe_counter = len(existing_recipes)

for f in files:
    doc = pymupdf.open(os.path.join(pdf_dir, f))
    for page_idx in range(len(doc)):
        global_page += 1
        if global_page < 13 or global_page > 96:
            continue
            
        page = doc[page_idx]
        raw_text = page.get_text()
        
        is_recipe = (('calories' in raw_text.lower() or 'kcal' in raw_text.lower()) and 'protein' in raw_text.lower())
        if not is_recipe:
            continue
            
        if global_page in pork_pages_to_skip:
            print(f"Skipping non-halal bulking page {global_page} ({f} p{page_idx})")
            continue
            
        recipe_counter += 1
        blocks = page.get_text('blocks')
        
        # 1. Title
        title_blocks = [b for b in blocks if 50 < b[1] < 150]
        title_blocks.sort(key=lambda b: (b[1], b[0]))
        raw_title = "Delicious Bulking Meal"
        for tb in title_blocks:
            cand = tb[4].strip().replace('\n', ' ')
            if cand and cand.lower() not in ['panacea palm', 'per serving nutrition', 'per serving']:
                raw_title = cand
                break
        title = clean_title(raw_title)
        slug = slugify(f"bulk-{recipe_counter:03d}-{title}")
        
        # 2. Nutrition
        cal_m = re.search(r'calories\s*[-–:]\s*(\d+)', raw_text, re.I)
        pro_m = re.search(r'protein\s*[-–:]\s*(\d+(?:\.\d+)?)', raw_text, re.I)
        carb_m = re.search(r'carbs?\s*[-–:]\s*(\d+(?:\.\d+)?)', raw_text, re.I)
        fat_m = re.search(r'fat\s*[-–:]\s*(\d+(?:\.\d+)?)', raw_text, re.I)
        serv_m = re.search(r'servings?\s*[-–:]\s*([^\n\r]+)', raw_text, re.I)
        
        cals = int(cal_m.group(1)) if cal_m else 0
        pro = float(pro_m.group(1)) if pro_m else 0.0
        carbs = float(carb_m.group(1)) if carb_m else 0.0
        fat = float(fat_m.group(1)) if fat_m else 0.0
        servings_str = serv_m.group(1).strip() if serv_m else "1"
        servings_num = parse_servings_number(servings_str)
        
        # 3. Category & Subcategory
        if global_page <= 38:
            cat = "Breakfast"
            sub = "Bulking Oats" if "oat" in title.lower() or global_page >= 28 else "Bulking Breakfast"
        elif global_page <= 52:
            cat = "Lunch"
            sub = "Bulking Lunch & Sandwiches"
        elif global_page <= 58:
            cat = "Snacks"
            sub = "Bulking Snacks & Bites"
        elif global_page <= 70:
            cat = "Drinks"
            sub = "High-Calorie Bulking Shakes"
        else:
            cat = "Dinner"
            sub = "Bulking Pastas, Rice & Mains"
            
        # 4. Instructions (Right column, x >= 200, y >= 400)
        instr_blocks = [b for b in blocks if b[0] >= 200 and b[1] >= 400]
        instr_blocks.sort(key=lambda b: b[1])
        steps = []
        current_step = []
        last_y1 = None

        for b in instr_blocks:
            btxt = b[4].strip()
            if not btxt: continue
            if re.match(r'^Each (one|serving|portion) packs around', btxt, re.I):
                continue
            if last_y1 is not None and (b[1] - last_y1) > 8:
                s_joined = ' '.join(current_step)
                s_clean = re.sub(r'\s+', ' ', s_joined).strip()
                if s_clean: steps.append(to_metric_text(s_clean))
                current_step = [btxt]
            else:
                current_step.append(btxt)
            last_y1 = b[3]

        if current_step:
            s_joined = ' '.join(current_step)
            s_clean = re.sub(r'\s+', ' ', s_joined).strip()
            if s_clean: steps.append(to_metric_text(s_clean))
            
        if not steps:
            fallback_blocks = [b for b in blocks if b[0] >= 180 and b[1] >= 350]
            fallback_blocks.sort(key=lambda b: b[1])
            for b in fallback_blocks:
                btxt = b[4].strip()
                if btxt and not btxt.lower().startswith('panacea'):
                    steps.append(to_metric_text(re.sub(r'\s+', ' ', btxt)))
                    
        # Capitalize first letter of steps
        steps = [s[0].upper() + s[1:] if s else s for s in steps]
        
        # 5. Left column: Ingredients & Notes
        left_blocks = [b for b in blocks if b[0] < 210]
        left_blocks.sort(key=lambda b: b[1])
        
        ing_header_idx = -1
        for i, b in enumerate(left_blocks):
            if 'ingredient' in b[4].lower():
                ing_header_idx = i
                break
                
        notes_header_idx = len(left_blocks)
        for i, b in enumerate(left_blocks):
            if i > ing_header_idx and b[4].strip().lower().startswith(('note', 'notes', 'bonus:', 'tip:')):
                notes_header_idx = i
                break
                
        notes_text = ""
        if notes_header_idx < len(left_blocks):
            note_parts = []
            for b in left_blocks[notes_header_idx:]:
                t = b[4].strip()
                if t and not t.lower() in ['notes', 'notes:', 'note']:
                    note_parts.append(t)
            notes_text = to_metric_text(re.sub(r'\s+', ' ', ' '.join(note_parts)).strip())
            
        ingredient_sections = []
        current_section = {"name": "Ingredients", "items": []}
        flat_ingredients = []
        
        ing_content_blocks = left_blocks[ing_header_idx+1:notes_header_idx] if ing_header_idx != -1 else []
        for b in ing_content_blocks:
            btxt = b[4].strip()
            if not btxt: continue
            lines = [l.strip() for l in btxt.splitlines() if l.strip()]
            
            if len(lines) == 1 and len(lines[0]) < 35 and not re.match(r'^\d', lines[0]) and lines[0].lower() not in ['salt and pepper', 'cooking spray', 'water', 'oil']:
                if current_section["items"]:
                    ingredient_sections.append(current_section)
                current_section = {"name": lines[0].title(), "items": []}
                continue
                
            items_in_block = []
            for l in lines:
                if items_in_block and (l.startswith(('(', '-', '+')) or (not re.match(r'^\d', l) and l[0].islower() and not l.startswith(('salt', 'cooking', 'low cal', 'chopped', 'water', 'oil', 'pinch')))):
                    items_in_block[-1] = items_in_block[-1] + ' ' + l
                else:
                    items_in_block.append(l)
                    
            for it in items_in_block:
                it_clean = to_metric_text(re.sub(r'\s+', ' ', it).strip())
                if it_clean:
                    current_section["items"].append(it_clean)
                    flat_ingredients.append(it_clean)
                    
        if current_section["items"]:
            ingredient_sections.append(current_section)
            
        if not flat_ingredients:
            flat_ingredients = ["Fresh metric ingredients as listed in recipe instructions"]
            ingredient_sections = [{"name": "Ingredients", "items": flat_ingredients}]
            
        # 6. Hero Image Extraction
        imgs = page.get_images()
        best_img_info = None
        best_sz = 0
        for img in imgs:
            xref = img[0]
            try:
                base_img = doc.extract_image(xref)
                sz = base_img['width'] * base_img['height']
                if sz > best_sz and sz > 40000:
                    best_sz = sz
                    best_img_info = base_img
            except:
                pass
                
        image_rel_path = f"images/recipes/{slug}.jpg"
        image_disk_path = os.path.join(img_dir, f"{slug}.jpg")
        
        if best_img_info:
            with open(image_disk_path, 'wb') as img_f:
                img_f.write(best_img_info['image'])
        else:
            pix = page.get_pixmap(dpi=150)
            rect = pymupdf.Rect(page.rect.width * 0.35, page.rect.height * 0.12, page.rect.width, page.rect.height * 0.54)
            pix_crop = page.get_pixmap(dpi=150, clip=rect)
            pix_crop.save(image_disk_path)
            
        # 7. Tags
        tags = ["100% Halal", "Lean Bulking", "Calorie Surplus"]
        if pro >= 45: tags.append("Ultra High Protein")
        elif pro >= 30: tags.append("High Protein")
        
        combo_str = (title + " " + " ".join(flat_ingredients) + " " + " ".join(steps) + " " + notes_text).lower()
        if "chicken" in combo_str: tags.append("Chicken")
        elif "beef" in combo_str or "steak" in combo_str: tags.append("Beef")
        elif "air fryer" in combo_str or "air fry" in combo_str: tags.append("Air Fryer")
        if "oat" in combo_str: tags.append("Oats")
        if "shake" in combo_str or "smoothie" in combo_str: tags.append("Bulking Shake")
        if "rice" in combo_str: tags.append("Rice Dish")
        if "pasta" in combo_str or "lasagna" in combo_str: tags.append("Pasta & Noodles")
        
        # 8. Instant Pot Pro Guide
        ip_guide = generate_instant_pot_guide(title, cat, " ".join(flat_ingredients), " ".join(steps))
        
        protein_cal_pct = round((pro * 4 / cals * 100), 1) if cals > 0 else 0
        protein_density = round((pro / cals * 100), 1) if cals > 0 else 0
        
        recipe_obj = {
            "id": slug,
            "number": recipe_counter,
            "title": title,
            "category": cat,
            "subCategory": sub,
            "book": "The Ultimate Guide to Lean Bulking",
            "page": global_page,
            "sourceFile": f,
            "sourcePage": page_idx,
            "isHalal": True,
            "nutrition": {
                "calories": cals,
                "protein": pro,
                "carbs": carbs,
                "fat": fat,
                "servings": servings_str,
                "servingsCount": servings_num,
                "proteinCalPct": protein_cal_pct,
                "proteinDensity": protein_density
            },
            "ingredients": flat_ingredients,
            "ingredientSections": ingredient_sections,
            "instructions": steps,
            "notes": notes_text,
            "tags": list(dict.fromkeys(tags)),
            "image": image_rel_path,
            "instantPot": ip_guide
        }
        
        bulking_recipes.append(recipe_obj)

print(f"Successfully extracted {len(bulking_recipes)} Halal recipes from Lean Bulking book!")

# Combine all recipes
combined_recipes = existing_recipes + bulking_recipes

# Re-index all numbers from 1 to N
for i, r in enumerate(combined_recipes, 1):
    r["number"] = i

# Save to data/recipes.json
with open(recipes_json_path, "w", encoding="utf-8") as f:
    json.dump(combined_recipes, f, indent=2, ensure_ascii=False)

print(f"Total Combined Halal Recipes: {len(combined_recipes)}")
