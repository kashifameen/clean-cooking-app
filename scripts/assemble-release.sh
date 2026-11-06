#!/usr/bin/env bash
# Build a release-signed APK. The keystore and passphrase stay outside this repository.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${CLEAN_COOKING_KEYSTORE:?Set CLEAN_COOKING_KEYSTORE to the release keystore path}"
: "${CLEAN_COOKING_KEY_ALIAS:?Set CLEAN_COOKING_KEY_ALIAS}"

if [[ -z "${CLEAN_COOKING_KEYSTORE_PASSWORD:-}" ]]; then
  : "${CLEAN_COOKING_KEYSTORE_PASSWORD_FILE:?Set CLEAN_COOKING_KEYSTORE_PASSWORD or CLEAN_COOKING_KEYSTORE_PASSWORD_FILE}"
  CLEAN_COOKING_KEYSTORE_PASSWORD="$(<"$CLEAN_COOKING_KEYSTORE_PASSWORD_FILE")"
  export CLEAN_COOKING_KEYSTORE_PASSWORD
fi
export CLEAN_COOKING_KEY_PASSWORD="${CLEAN_COOKING_KEY_PASSWORD:-$CLEAN_COOKING_KEYSTORE_PASSWORD}"

npm run build:css
npx cap sync android
cd android
chmod +x ./gradlew
./gradlew assembleRelease
