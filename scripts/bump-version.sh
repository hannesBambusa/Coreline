#!/bin/sh
# Bump the patch version in src/version.js and version.json (1.2.3 -> 1.2.4) and stage both.
# Pass "minor" or "major" to bump those instead. SKIP_BUMP=1 skips (used by the pre-commit hook).
set -e
cd "$(dirname "$0")/.."
cur=$(sed -n "s/^export const VERSION = '\([0-9.]*\)';/\1/p" src/version.js)
[ -n "$cur" ] || { echo "bump-version: could not read VERSION from src/version.js" >&2; exit 1; }
IFS=. read -r major minor patch <<EOF2
$cur
EOF2
case "${1:-patch}" in
  major) major=$((major + 1)); minor=0; patch=0 ;;
  minor) minor=$((minor + 1)); patch=0 ;;
  *) patch=$((patch + 1)) ;;
esac
new="$major.$minor.$patch"
sed -i '' "s/^export const VERSION = '$cur';/export const VERSION = '$new';/" src/version.js
printf '{ "version": "%s" }\n' "$new" > version.json
git add src/version.js version.json
echo "version $cur -> $new"
