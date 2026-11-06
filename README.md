# Clean Cooking

100% halal, high-protein cookbook and meal planner. This repository holds the app that is published at [https://clean-cooking-app.netlify.app/](https://clean-cooking-app.netlify.app/), plus a sideloadable Android package.

The public site is a static web app. Recipe data is `public/data/recipes.json` (277 recipes). The browser does not call `/api`. A Flask server is included for local use and for the same static files.

The uploaded Python tools were renamed from their SHA-256 filenames. Personal filesystem paths were removed. See [docs/PROVENANCE.md](docs/PROVENANCE.md). The earlier project note is archived in [docs/uploaded-readme.md](docs/uploaded-readme.md). Counts in that note are from an older snapshot. The recovered site has 277 recipes.

## Run the web app

```bash
pip install -r requirements.txt
python app.py
```

Open [http://127.0.0.1:5000](http://127.0.0.1:5000).

`python app.py` serves `public/` and the JSON API under `/api/recipes` and `/api/guides`. Favorites, the meal plan, the shopping list, and the profile stay in `localStorage` in the browser. They are not stored on the server.

Opening `public/index.html` as a `file://` URL cannot load the recipe JSON. Use the Flask server or any static file server whose root is `public/`.

## Android app

| | |
| --- | --- |
| Package | `app.cleancooking.halal` |
| Version | `1.0.0` (`versionCode` 1) |
| Min / target SDK | 23 / 35 |
| Wrapper | Capacitor 7, web assets in `public/` |
| Signing | **Debug**. `assembleDebug` uses the machine-local debug keystore (`~/.android/debug.keystore`). That file is not in this repository. The certificate subject is `CN=Android Debug`. This build is for sideload, not Google Play. |
| Output | `android/app/build/outputs/apk/debug/app-debug.apk` |

No release keystore is configured. Do not commit a `.keystore`, `.jks`, or `android/local.properties` (it contains a machine-specific SDK path).

### Build

Install Node.js 22, JDK 21, and Android SDK platform 35 with build-tools 35.0.0. Point `ANDROID_HOME` at the SDK.

```bash
npm ci
npm run android:debug
```

`npm run android:debug` rebuilds the Tailwind CSS, copies `public/` into the Android project, and runs `./gradlew assembleDebug`.

On a phone, enable install from unknown sources and open the APK, or:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

A GitHub Actions workflow (`.github/workflows/android-debug-apk.yml`) builds the same debug APK on pull requests. Its signature differs from a local debug keystore because GitHub-hosted runners generate their own debug key.

## Offline and photos

Bundled for offline use:

- HTML, app script, precompiled Tailwind CSS, and app CSS
- Plus Jakarta Sans and Outfit (self-hosted)
- Lucide `0.469.0` (`public/js/vendor/lucide.min.js`)
- `recipes.json`, `shopping_guide.json`, `cookbook_guide.json`
- App icons and the recipe photos

Recipe photos on the public site were about 235.5 MB. This repo stores JPEG thumbnails at a 960px long edge and quality 78, about 15.2 MB for all 277 images. The APK is about 20 MB and includes those thumbnails, so recipe photos render without a network. Details are in [docs/photo-optimization.json](docs/photo-optimization.json).

The only runtime network fallback is the Unsplash image used when a recipe photo fails to load (`onerror` in `public/js/app.js`). Core browsing, search, recipe details, step timers, serving scale, meal planning, shopping, and guides do not need that image.

On a phone, the top tabs scroll sideways inside the header (`overflow-x-auto`). The page itself does not slide sideways. Swipe that tab row to reach Drinks, Macro Planner, Shopping, and Guides.

The service worker caches the app shell, JSON, icons, fonts, CSS, and Lucide. It does not cache recipe photos or the Unsplash fallback. Inside the APK the photos are already local files.

The public Netlify host does not publish `/.well-known/assetlinks.json`. This package is a Capacitor app, not a Trusted Web Activity.

## Tests

```bash
pip install -r requirements.txt
python3 -m unittest discover -s tests -p 'test_*.py' -v
npm ci
npm run test:scale
npm run test:ui
```

- `tests/test_data.py` checks the 277-recipe dataset, image files, guides, and the Flask routes.
- `tests/scale.test.mjs` checks ingredient scaling and step-timer parsing in `public/js/app.js`. The leading-fraction pattern is matched before a plain number so `1/2 tsp` scales to `1 tsp` at 2x. The previous order matched only the `1` and produced `2/2 tsp`.
- `tests/smoke-ui.mjs` drives headless Chrome through search, recipe details, scaling, a step timer, meal-plan persistence, and favorites on desktop and mobile viewports. Chrome must be installed (`CHROME_PATH` overrides the default `/usr/bin/google-chrome`).

## Maintenance scripts

Files in `scripts/` are the uploaded one-off importers and audits. They are not required to run the app. Scripts that read cookbook PDFs expect `LEAN_BULKING_PDF_DIR` and exit if it is unset. Those PDFs are not in this repository. Scripts that rewrite `public/data/recipes.json` will replace the published dataset if you run them.

Regenerate Tailwind after changing class names:

```bash
npm run build:css
```

The checked-in `public/css/tailwind.css` is the file the app and the APK load, so the web app runs without Node after that file exists.
