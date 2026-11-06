# Clean Cooking

100% halal, high-protein cookbook and meal planner. This repository holds the app that is published at [https://clean-cooking-app.netlify.app/](https://clean-cooking-app.netlify.app/), plus a sideloadable Android package. Version 1.1.0 follows the current site: Pressure Cooker / Hotpot guides and a meal-prep planner with a Mifflin-St Jeor BMR calculator, still on 277 recipes. The copy of `app.js` on the public site had a stray block after `filterPickerRecipes` that stopped the script from parsing. That fragment is removed here so the rest of the live meal-prep code can run. If a newer service worker is already controlling the page, the app reloads once so the new shell replaces the cached one.

The public site is a static web app. Recipe data is `public/data/recipes.json` (277 recipes). The browser does not call `/api`. A Flask server is included for local use and for the same static files.

The uploaded Python tools were renamed from their SHA-256 filenames. Personal filesystem paths were removed. See [docs/PROVENANCE.md](docs/PROVENANCE.md). The earlier project note is archived in [docs/uploaded-readme.md](docs/uploaded-readme.md). Counts in that note are from an older snapshot. The recovered site has 277 recipes.

## Run the web app

```bash
pip install -r requirements.txt
python app.py
```

Open [http://127.0.0.1:5000](http://127.0.0.1:5000).

`python app.py` serves `public/` and the JSON API under `/api/recipes` and `/api/guides`. Favorites, the meal plan, meal prep, the shopping list, and the profile stay in `localStorage` in the browser. They are not stored on the server.

Opening `public/index.html` as a `file://` URL cannot load the recipe JSON. Use the Flask server or any static file server whose root is `public/`.

## Android app

| | |
| --- | --- |
| Package | `app.cleancooking.halal` |
| Version | `1.1.0` (`versionCode` 4) |
| Min / target SDK | 23 / 35 |
| Wrapper | Capacitor 7, web assets in `public/` |
| Distribution build | **Release-signed and not debuggable.** This is the APK to send to friends. It is not a Google Play upload. |
| Output | `android/app/build/outputs/apk/release/app-release.apk` |

The release keystore and its passphrase are not in this repository. `assembleRelease` reads them from the environment:

```bash
export ANDROID_HOME=/path/to/android-sdk
export CLEAN_COOKING_KEYSTORE=/path/to/cleancooking-release.jks
export CLEAN_COOKING_KEY_ALIAS=cleancooking-release
export CLEAN_COOKING_KEYSTORE_PASSWORD_FILE=/path/to/keystore.pass
chmod +x scripts/assemble-release.sh
./scripts/assemble-release.sh
```

`CLEAN_COOKING_KEYSTORE_PASSWORD` can be set instead of the password file. Do not commit either value, a `.jks`, a `.keystore`, or `android/local.properties`.

`npm run android:debug` still builds a debug APK with the machine debug key. That file is only for local development. It cannot update or replace the release-signed app, and the release app cannot update a copy that was installed from the older debug releases (v1.0.0 or v1.0.1). Remove those debug installs first, then install the release APK. Saved data in a debug install is not carried into the new install.

### Install on a phone

1. Copy `app-release.apk` to the phone, or use `adb install -r app-release.apk` from a computer.
2. Allow installation from the app you used to open the file (Files, Chrome, or similar). Android calls this “install unknown apps.”
3. Confirm the install. Google Play Protect may scan the file. Signing this APK does not turn Play Protect, Samsung Auto Blocker, or a work-profile restriction off, and this project does not ask you to disable them.
4. Open Clean Cooking. The recipe list, search, timers, and meal prep work without a network. Photos in the APK are the bundled thumbnails.

### Sideload checks that signing does not remove

As of the [Android developer verification guide](https://developer.android.com/developer-verification/guides) (checked November 2026):

- From 30 September 2026, certified devices in Brazil, Indonesia, Singapore, and Thailand check developer registration for installs that come through participating stores (Google Play, Galaxy Store, and several other manufacturer stores).
- Installing an APK file outside those stores can still work. Google’s guide says unregistered apps use an advanced sideload flow with extra prompts, and that `adb` install behavior stays the same. A wider requirement for certified devices is planned for 2027.
- This package is not registered in the Android Developer Console or Google Play. No developer account was created for it. Friends in the countries above may see extra install prompts. That is a device policy, not a broken APK.
- Play Protect can still warn about an app it has not seen before. A private signature does not make that warning impossible.

A GitHub Actions workflow (`.github/workflows/android-debug-apk.yml`) still builds a debug APK for pull requests. It does not have the release key, so it is not the file to share.

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
