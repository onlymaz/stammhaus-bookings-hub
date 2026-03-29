#!/usr/bin/env sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
DIST_DIR="$ROOT_DIR/dist"
HOSTING_DIR="$DIST_DIR/_hosting"

if [ -x /opt/homebrew/bin/npm ]; then
  export PATH="/opt/homebrew/bin:$PATH"
fi

cd "$ROOT_DIR"

echo "Building production bundle..."
npm run build

echo "Preparing hosting files..."
mkdir -p "$HOSTING_DIR"

cp "$SCRIPT_DIR/apache.htaccess" "$DIST_DIR/.htaccess"
cp "$SCRIPT_DIR/nginx.conf" "$HOSTING_DIR/nginx.conf"
cp "$SCRIPT_DIR/DEPLOY-README.txt" "$HOSTING_DIR/DEPLOY-README.txt"

echo "Deploy kit ready."
echo "Upload the contents of: $DIST_DIR"
echo "Apache/cPanel: include .htaccess"
echo "Nginx: use $HOSTING_DIR/nginx.conf on the server"
