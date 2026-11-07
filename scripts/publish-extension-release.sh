#!/usr/bin/env bash
set -euo pipefail

phase=$1
tag=$RELEASE_TAG
chromium="packages/cose-${tag#v}-chromium.zip"
firefox="packages/cose-${tag#v}-firefox.xpi"
tag_ref="refs/tags/$tag"
refs=$(git ls-remote "$GITHUB_SERVER_URL/$GH_REPO.git" "$tag_ref" "$tag_ref^{}")
# Prefer the peeled commit when the tag is annotated.
target=$(awk -v ref="$tag_ref" '$2 == ref { tag = $1 } $2 == ref "^{}" { commit = $1 } END { print (commit ? commit : tag) }' <<< "$refs")
if [[ -z "$target" && "$phase" == chromium && "$GITHUB_REF" == refs/heads/main ]]; then
  gh api --method POST "repos/$GH_REPO/git/refs" -f ref="$tag_ref" -f sha="$RELEASE_SHA" --silent
elif [[ "$target" != "$RELEASE_SHA" ]]; then
  echo "::error::$tag does not point to the tested commit $RELEASE_SHA"
  exit 1
fi

if ! release=$(gh release view "$tag" --json isDraft,isPrerelease,assets); then
  [[ "$phase" == chromium ]]
  gh release create "$tag" --verify-tag --draft --prerelease --title "COSE $tag" --generate-notes
  release=$(gh release view "$tag" --json isDraft,isPrerelease,assets)
fi

# Reruns leave an already published stable release intact.
if jq -e '(.isDraft or .isPrerelease) | not' <<< "$release" > /dev/null; then
  exit 0
fi

has_asset() {
  jq -e --arg name "$1" 'any(.assets[]; .name == $name and .state == "uploaded")' <<< "$release" > /dev/null
}

upload_asset() {
  local asset=$1 published
  unzip -tq "$asset"
  if has_asset "${asset##*/}"; then
    published=$(mktemp -d)
    gh release download "$tag" --dir "$published" --pattern "${asset##*/}"
    # ZIP timestamps can change across rebuilds of the same tested commit.
    unzip -q "$asset" -d "$published/rebuilt"
    unzip -q "$published/${asset##*/}" -d "$published/uploaded"
    diff -qr "$published/rebuilt" "$published/uploaded"
  else
    gh release upload "$tag" "$asset"
  fi
}

if [[ "$phase" == chromium ]]; then
  upload_asset "$chromium"
  if jq -e '.isDraft' <<< "$release" > /dev/null; then
    gh release edit "$tag" --draft=false --prerelease --latest=false
  fi
  echo "firefox_pending=true" >> "$GITHUB_OUTPUT"
  echo "Chromium is available at $GITHUB_SERVER_URL/$GH_REPO/releases/tag/$tag." >> "$GITHUB_STEP_SUMMARY"
else
  has_asset "${chromium##*/}"
  upload_asset "$firefox"
  gh api --method PATCH "repos/$GH_REPO/releases/$(gh release view "$tag" --json databaseId --jq '.databaseId')" \
    -F draft=false -F prerelease=false -f make_latest=legacy --silent
fi
