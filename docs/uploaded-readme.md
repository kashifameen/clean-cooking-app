> Archived copy of the uploaded README (`b8f7ee95ab44a999fcd26ed9a06c5fb5fed6e69b2587c53c32f4451b6eaaf1eb.md`).
> The personal `file://` path was removed. Counts in this note describe an earlier snapshot. The site recovered from https://clean-cooking-app.netlify.app/ contains 277 recipes.

# Clean Cooking App 🔥
### 100% Halal High-Protein Cookbook App & Meal Planner
**Featuring Dhiraj's (Panacea Palm) Recipes + Royal Kashmiri Pink Tea (Noon Chai)**

A modern web application built with **205 verified 100% Halal, high-protein recipes** in strictly **metric measurements** ($g$, $ml$, $°C$), featuring **interactive step timers**, **completion tick boxes**, and **Instant Pot Pro pressure cooker guides** for every recipe.

---

## 🚀 Quick Start

### 1. Launch with Python Flask (Recommended)
```bash
python app.py
```
Open your browser to: **[http://localhost:5000](http://localhost:5000)**

### 2. Standalone Static Mode
Serve this repository with `python app.py` and open http://127.0.0.1:5000. A `file://` open of `public/index.html` cannot fetch the recipe JSON.

---

## ⚡ Key Updates & Customizations

1. **🕌 100% Halal Compliance**:
   - All pork, pork bacon, and pork sausage recipes were audited and removed.
   - Any non-halal cooking wines / mirin were replaced with halal rice vinegar or apple cider vinegar.
   - Pepperoni and bacon in remaining dishes are 100% Halal Turkey Bacon / Beef Bacon / Halal Beef Pepperoni.
   - Marshmallows and jelly sachets specify Halal / plant-based alternatives.

2. **📏 Strictly Metric Units**:
   - All weights in grams ($g$) and kilograms ($kg$).
   - All liquid volumes in milliliters ($ml$) and liters ($L$).
   - All temperatures in Celsius ($°C$).

3. **☕ Dedicated Drinks Section & Royal Kashmiri Pink Tea (Noon Chai)**:
   - Features **Authentic Kashmiri Pink Tea (Noon Chai) — High Protein Edition** ($118 \text{ kcal}$, $14.5\text{g protein}$).
   - Authentic kehva brew using green tea leaves, baking soda catalyst, cardamom, cinnamon, ice shock aeration, low-fat milk, protein powder, and pistachio-almond crown.
   - 10 delicious high-protein shakes, frappes, and digestion smoothies.

4. **⏱️ Interactive Cooking Timers & Step Tick Boxes**:
   - Each recipe step has an interactive tick box with strikethrough and a live progress tracker (*e.g., Step 3 of 5 Complete (60%)*).
   - In-step countdown timers (*Start 10m Timer*) with play, pause, reset, and audio chime notification.

5. **🍲 Instant Pot Pro / Pressure Cooker Guides for Every Recipe**:
   - Every single recipe includes a dedicated **Instant Pot Pro** tab.
   - Specifies exact Mode (*Pressure Cook High, Sauté, Steam*), Time, and Pressure Release (*Quick Release vs 10-Min Natural Release*).

6. **⚖️ Interactive Servings Scaler**:
   - Scale recipes ($0.5\times, 1\times, 2\times, 3\times, 4\times$) with automatic metric ingredient and macro recalculation.

7. **📊 Daily Macro Planner & Grocery List**:
   - Target deficit calculator based on $2.2g \text{ protein} / \text{kg}$ body weight.
   - 1-click export of recipe ingredients to a smart, categorized shopping list.
