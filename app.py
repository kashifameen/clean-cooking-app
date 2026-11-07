"""Clean Cooking Flask server.

Uploaded filename sha256: df9d64bb198dea33751d89f75aca6955dd21b2c5ddbc8bdd5529d9e562714c62
The deployed Netlify site serves the static files directly. These /api routes exist for
local use; the browser app reads public/data/*.json and does not call /api.
"""
import os
import json
from flask import Flask, send_from_directory, jsonify, request

base_dir = os.path.dirname(os.path.abspath(__file__))
public_dir = os.path.join(base_dir, "public")
data_dir = os.path.join(public_dir, "data")

app = Flask(__name__, static_folder=public_dir)

# Helper to load JSON data
def load_json(filename):
    filepath = os.path.join(data_dir, filename)
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    return None

# Serve index.html
@app.route("/")
def index():
    return send_from_directory(public_dir, "index.html")

# Serve data directory
@app.route("/data/<path:path>")
def serve_data(path):
    return send_from_directory(data_dir, path)

# Serve static files (CSS, JS, Images)
@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory(public_dir, path)

# API Endpoints
@app.route("/api/recipes", methods=["GET"])
def get_recipes():
    recipes = load_json("recipes.json") or []
    
    # Query parameters
    category = request.args.get("category")
    min_protein = request.args.get("min_protein", type=float)
    max_cals = request.args.get("max_calories", type=int)
    search = request.args.get("q")

    if category and category != "All":
        recipes = [r for r in recipes if r.get("category") == category]
    if min_protein:
        recipes = [r for r in recipes if r.get("nutrition", {}).get("protein", 0) >= min_protein]
    if max_cals:
        recipes = [r for r in recipes if r.get("nutrition", {}).get("calories", 0) <= max_cals]
    if search:
        s = search.lower()
        recipes = [r for r in recipes if s in r.get("title", "").lower() or any(s in ing.lower() for ing in r.get("ingredients", []))]

    return jsonify({
        "count": len(recipes),
        "recipes": recipes
    })

@app.route("/api/recipes/<recipe_id>", methods=["GET"])
def get_recipe(recipe_id):
    recipes = load_json("recipes.json") or []
    for r in recipes:
        if r.get("id") == recipe_id:
            return jsonify(r)
    return jsonify({"error": "Recipe not found"}), 404

@app.route("/api/guides", methods=["GET"])
def get_guides():
    return jsonify({
        "shopping": load_json("shopping_guide.json"),
        "cookbook": load_json("cookbook_guide.json")
    })

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    loaded = load_json("recipes.json") or []
    print("==================================================")
    print(" CLEAN COOKING APP - SERVER RUNNING")
    print(" Static UI and JSON are served from public/")
    print(f" Access URL: http://127.0.0.1:{port}")
    print(f" Total Recipes: {len(loaded)}")
    print("==================================================")
    app.run(host="127.0.0.1", port=port, debug=False)
