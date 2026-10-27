#!/bin/sh
# Ori installer for macOS on Apple Silicon — served at https://oriphim.com/install.sh
#
#   curl -fsSL https://oriphim.com/install.sh | sh
#
# Installs one versioned directory under ~/.local/share/ori and links
# ~/.local/bin/ori to it. No administrator rights; nothing outside your home.
# Options (environment): ORI_CHANNEL=stable|latest, ORI_VERSION=x.y.z to pin.
# Research in your Ori workspace is never touched by installing or updating.
set -eu

RELEASES="${ORI_RELEASES_URL:-https://kvcoyxofptmtaywdjbzo.supabase.co/storage/v1/object/public/ori-releases}"
CHANNEL="${ORI_CHANNEL:-stable}"
VERSION="${ORI_VERSION:-}"
ROOT="${ORI_INSTALL_ROOT:-$HOME/.local/share/ori}"
BIN="${ORI_BIN_DIR:-$HOME/.local/bin}"
MIN_MACOS=14

say() { printf '%s\n' "$*"; }
fail() { printf 'ori install: %s\n' "$*" >&2; exit 1; }

# ── platform ────────────────────────────────────────────────────────────────
[ "$(uname -s)" = "Darwin" ] || fail "Ori supports macOS on Apple Silicon only (found $(uname -s)). See https://oriphim.com/install#requirements"
arch="$(uname -m)"
if [ "$arch" != "arm64" ]; then
  # An arm64 Mac running this shell under Rosetta reports x86_64.
  if [ "$(sysctl -n sysctl.proc_translated 2>/dev/null || echo 0)" = "1" ]; then
    arch=arm64
  else
    fail "Ori needs an Apple Silicon Mac (M1 or later); this Mac reports $arch."
  fi
fi
macos="$(sw_vers -productVersion 2>/dev/null || echo 0)"
[ "${macos%%.*}" -ge "$MIN_MACOS" ] 2>/dev/null || fail "Ori needs macOS $MIN_MACOS or later (found $macos)."
case "$CHANNEL" in stable|latest) ;; *) fail "ORI_CHANNEL must be stable or latest" ;; esac
for tool in curl shasum tar plutil; do
  command -v "$tool" >/dev/null 2>&1 || fail "missing system tool: $tool"
done

# ── release manifest ────────────────────────────────────────────────────────
mkdir -p "$ROOT/versions"
staging="$(mktemp -d "$ROOT/versions/.staging-XXXXXX")"
trap 'rm -rf "$staging"' EXIT INT TERM
if [ -n "$VERSION" ]; then
  manifest_url="$RELEASES/releases/$VERSION/manifest.json"
else
  manifest_url="$RELEASES/channels/$CHANNEL.json"
fi
curl -fsSL --proto '=https,file' "$manifest_url" -o "$staging/manifest.json" \
  || fail "could not download the release manifest ($manifest_url). Check your connection; see https://oriphim.com/install#troubleshooting"
field() { plutil -extract "$1" raw -o - "$staging/manifest.json" 2>/dev/null; }
version="$(field version)" || fail "the release manifest is unreadable"
url="$(field platforms.macos-arm64.url)" || fail "release $version has no Apple Silicon build"
sha="$(field platforms.macos-arm64.sha256)" || fail "release $version has no checksum"
case "$version" in *[!0-9a-z.]*|"") fail "unexpected version in manifest: $version" ;; esac
if [ -n "$VERSION" ] && [ "$version" != "$VERSION" ]; then fail "manifest is for $version, not $VERSION"; fi

# ── download, verify, extract (into staging; nothing final until it passes) ─
target="$ROOT/versions/$version"
if [ -x "$target/ori" ]; then
  say "Ori $version is already installed."
else
  say "Downloading Ori $version for macOS (Apple Silicon)..."
  curl -fSL --proto '=https,file' --progress-bar "$url" -o "$staging/ori.tar.gz" \
    || fail "download failed; nothing was changed"
  actual="$(shasum -a 256 "$staging/ori.tar.gz" | awk '{print $1}')"
  [ "$actual" = "$sha" ] || fail "integrity check failed (expected $sha, got $actual); nothing was changed"
  mkdir "$staging/x"
  tar -xzf "$staging/ori.tar.gz" -C "$staging/x" || fail "the archive could not be extracted"
  set -- "$staging"/x/*
  [ "$#" -eq 1 ] && [ -x "$1/ori" ] || fail "the archive does not contain an ori directory"
  if codesign --verify --strict "$1/ori" >/dev/null 2>&1; then
    say "Signature verified."
  elif [ "$(field signed 2>/dev/null || echo false)" = "true" ]; then
    fail "this release should be signed but its signature did not verify; nothing was changed"
  else
    say "Note: this is an unsigned development build."
  fi
  mv "$1" "$target"
fi

# ── activate: switch links, keep earlier versions for `ori rollback` ────────
previous=""
[ -L "$ROOT/current" ] && previous="$(basename "$(readlink "$ROOT/current")")"
ln -sfh "versions/$version" "$ROOT/current"
mkdir -p "$BIN"
if [ -e "$BIN/ori" ] && [ ! -L "$BIN/ori" ]; then
  fail "$BIN/ori exists and is not a link Ori made; move it aside and run the installer again"
fi
ln -sfh "$ROOT/current/ori" "$BIN/ori"
if [ ! -f "$ROOT/state.json" ]; then
  history="[]"
  [ -n "$previous" ] && [ "$previous" != "$version" ] && history="[\"$previous\"]"
  pin=""
  [ -n "$VERSION" ] && pin=", \"pinned\": \"$VERSION\""
  printf '{"channel": "%s", "history": %s%s}\n' "$CHANNEL" "$history" "$pin" > "$ROOT/state.json"
fi

"$BIN/ori" --version >/dev/null 2>&1 || fail "Ori was installed but did not start. Run '$BIN/ori doctor' for details."
say "Installed $("$BIN/ori" --version) in $target"

case ":$PATH:" in
  *":$BIN:"*) say "Run: ori" ;;
  *)
    shown="$(printf '%s' "$BIN" | sed "s#^$HOME#\$HOME#")"
    case "$(basename "${SHELL:-/bin/zsh}")" in
      fish) say "Add Ori to your PATH:"; say "  fish_add_path $shown" ;;
      bash) say "Add Ori to your PATH:"; say "  echo 'export PATH=\"$shown:\$PATH\"' >> ~/.bash_profile && source ~/.bash_profile" ;;
      *)    say "Add Ori to your PATH:"; say "  echo 'export PATH=\"$shown:\$PATH\"' >> ~/.zshrc && source ~/.zshrc" ;;
    esac
    say "Then run: ori"
    ;;
esac
