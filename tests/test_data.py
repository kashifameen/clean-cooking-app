import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
DATA = PUBLIC / "data"

REQUIRED = {
    "id",
    "number",
    "title",
    "category",
    "ingredients",
    "instructions",
    "nutrition",
    "image",
    "tags",
    "instantPot",
    "isHalal",
}


class RecipeDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.recipes = json.loads((DATA / "recipes.json").read_text(encoding="utf-8"))

    def test_recipe_count_matches_public_site(self):
        self.assertEqual(len(self.recipes), 277)

    def test_recipe_shape_and_unique_ids(self):
        ids = [recipe["id"] for recipe in self.recipes]
        self.assertEqual(len(ids), len(set(ids)))
        for recipe in self.recipes:
            self.assertTrue(REQUIRED <= set(recipe))
            self.assertTrue(recipe["title"].strip())
            self.assertGreaterEqual(len(recipe["ingredients"]), 1)
            self.assertGreaterEqual(len(recipe["instructions"]), 1)
            self.assertIn("calories", recipe["nutrition"])
            self.assertIn("protein", recipe["nutrition"])
            self.assertTrue(recipe["isHalal"])
            self.assertTrue(recipe["image"].startswith("images/recipes/"))
            image = PUBLIC / recipe["image"]
            self.assertTrue(image.is_file(), recipe["image"])
            self.assertGreater(image.stat().st_size, 1000)

    def test_category_counts(self):
        counts = {}
        for recipe in self.recipes:
            counts[recipe["category"]] = counts.get(recipe["category"], 0) + 1
        self.assertEqual(
            counts,
            {"Dinner": 87, "Breakfast": 68, "Lunch": 52, "Snacks": 49, "Drinks": 21},
        )

    def test_guides_parse(self):
        shopping = json.loads((DATA / "shopping_guide.json").read_text(encoding="utf-8"))
        cookbook = json.loads((DATA / "cookbook_guide.json").read_text(encoding="utf-8"))
        self.assertIn("meats", shopping)
        self.assertIn("faqs", cookbook)
        self.assertIn("tdee_guide", cookbook)

    def test_no_remote_runtime_or_personal_paths_in_web_shell(self):
        html = (PUBLIC / "index.html").read_text(encoding="utf-8")
        css = (PUBLIC / "css" / "style.css").read_text(encoding="utf-8")
        joined = html + css
        for needle in (
            "cdn.tailwindcss.com",
            "unpkg.com",
            "fonts.googleapis.com",
            "netlify",
            "Fit" + "Girl",
            "Users\\" + "Kashi",
            "c:\\" + "Users",
        ):
            self.assertNotIn(needle, joined)


class FlaskApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from app import app

        cls.client = app.test_client()

    def test_index_and_static_json(self):
        index = self.client.get("/")
        self.assertEqual(index.status_code, 200)
        self.assertIn(b"Clean Cooking", index.data)
        recipes = self.client.get("/data/recipes.json")
        self.assertEqual(recipes.status_code, 200)
        self.assertEqual(len(recipes.get_json()), 277)

    def test_api_filters(self):
        all_recipes = self.client.get("/api/recipes")
        body = all_recipes.get_json()
        self.assertEqual(body["count"], 277)
        drinks = self.client.get("/api/recipes?category=Drinks")
        self.assertEqual(drinks.get_json()["count"], 21)
        missing = self.client.get("/api/recipes/does-not-exist")
        self.assertEqual(missing.status_code, 404)
        guides = self.client.get("/api/guides")
        self.assertEqual(guides.status_code, 200)
        self.assertIn("shopping", guides.get_json())


if __name__ == "__main__":
    unittest.main()
