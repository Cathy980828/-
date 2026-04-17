#!/bin/sh

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
DIST_DIR="$ROOT_DIR/dist"

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

cp "$ROOT_DIR/index.html" "$DIST_DIR/index.html"
cp "$ROOT_DIR/app.js" "$DIST_DIR/app.js"
cp "$ROOT_DIR/journals.js" "$DIST_DIR/journals.js"
cp "$ROOT_DIR/styles.css" "$DIST_DIR/styles.css"

if [ -d "$ROOT_DIR/assets" ]; then
  cp -R "$ROOT_DIR/assets" "$DIST_DIR/assets"
fi
