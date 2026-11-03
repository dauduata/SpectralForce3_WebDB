#!/usr/bin/env bash
set -euo pipefail

FIREBASE_PROJECT="projn21-d2ab7"
HOSTING_SITE="projn21-d2ab7"
SERVICE_ACCOUNT_PATH="${FIREBASE_SERVICE_ACCOUNT_PATH:-firebase/projn21-d2ab7-service-account.json}"
SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
PUBLIC_DIR="$SCRIPT_DIR"
SERVICE_ACCOUNT="$SCRIPT_DIR/$SERVICE_ACCOUNT_PATH"

if ! command -v firebase >/dev/null 2>&1; then
  echo "ERROR: Firebase CLI not found. Install it with: npm install -g firebase-tools" >&2
  exit 1
fi

if [[ ! -f "$SCRIPT_DIR/firebase.json" || ! -f "$SCRIPT_DIR/.firebaserc" ]]; then
  echo "ERROR: Firebase Hosting configuration is missing (firebase.json or .firebaserc)." >&2
  exit 1
fi

if [[ ! -f "$SERVICE_ACCOUNT" ]]; then
  echo "ERROR: Service Account not found: $SERVICE_ACCOUNT" >&2
  exit 1
fi

if command -v fnm >/dev/null 2>&1; then
  fnm use 22
else
  echo "WARN: fnm not found in PATH; assuming Node.js 22 is already active."
fi

export GOOGLE_APPLICATION_CREDENTIALS="$SERVICE_ACCOUNT"

if [[ ! -f "$PUBLIC_DIR/index.html" ]]; then
  echo "ERROR: Hosting public directory does not contain index.html: $PUBLIC_DIR" >&2
  exit 1
fi

firebase deploy --project "$FIREBASE_PROJECT" --only hosting

echo "============================================================"
echo "DEPLOY SUCCESS"
echo "============================================================"
echo "Project: $FIREBASE_PROJECT"
echo "Hosting site: $HOSTING_SITE"
echo "URL: https://${HOSTING_SITE}.firebaseapp.com/"
echo "URL: https://${HOSTING_SITE}.web.app/"
echo "============================================================"
