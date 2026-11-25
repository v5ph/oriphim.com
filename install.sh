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

RELEASES="${ORI_RELEASES_URL:-https://oriphim.com/ori}"
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
  # The bundled runtime's python is what runs; the launcher only starts it.
  # Only a release the manifest marks signed is checked: the bundled Python carries its
  # maker's signature even in an unsigned build, so verifying it alone proves nothing.
  if [ "$(field signed 2>/dev/null || echo false)" = "true" ]; then
    codesign --verify --strict "$1/runtime/bin/python3.14" >/dev/null 2>&1 \
      || fail "this release should be signed but its signature did not verify; nothing was changed"
    # The publisher is named only when Apple's Developer ID certificate says so.
    codesign -dvv "$1/runtime/bin/python3.14" 2>&1 \
      | grep -qi '^Authority=Developer ID Application: Oriphim' \
      || fail "this release is not signed by Oriphim; nothing was changed"
    say "Verified: distributed by ORIPHIM, Inc."
  else
    say "Download checked against its published checksum. (Not yet signed with an Apple Developer ID.)"
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

# ── workspace: where every project Ori builds is kept (never replaced) ──────
WORKSPACE="${ORIPHIM_WORKSPACE:-$HOME/Documents/ORIPHIM}"
mkdir -p "$WORKSPACE" || fail "could not create your projects folder at $WORKSPACE"
if [ ! -e "$WORKSPACE/README.md" ]; then
  # Same text as oriphim.core.store.runs.WORKSPACE_README.
  cat > "$WORKSPACE/README.md" <<'README'
# ORIPHIM

Each folder here is a project Ori built for you: its code, data, results, and a
record of how they were made. Every project is a git repository, so you can open,
run, and share it without Ori.

Ori keeps its own settings and history in ~/.ori, not here. Uninstalling Ori
never removes this folder.
README
fi
say "Your projects will be kept in $(printf '%s' "$WORKSPACE" | sed "s#^$HOME#~#")"

# ── Apple's Command Line Tools: git, which saves every project, and the compilers
#    some Python packages build with. Ori brings its own Python and uv. ────────
# Only `xcode-select -p` is asked: on a Mac without the tools, running git itself
# would pop Apple's dialog with no explanation.
if xcode-select -p >/dev/null 2>&1; then
  :
elif [ "${ORI_SKIP_DEVTOOLS:-}" = "1" ]; then
  say "Note: Apple's Command Line Tools are not installed; Ori needs them before your first project."
else
  say ""
  say "Ori needs Apple's Command Line Tools (free, from Apple). They give Ori git, which"
  say "saves every project, and the compilers some scientific packages need."
  say "A macOS window is opening: click Install. It takes about 10 minutes."
  say "(Ori itself is already installed. Press Ctrl-C to stop waiting; run 'ori doctor' later.)"
  xcode-select --install >/dev/null 2>&1 || true
  waited=0
  until xcode-select -p >/dev/null 2>&1; do
    if [ "$waited" -ge 2700 ]; then
      say "Still waiting for the Command Line Tools. Ori is installed; when Apple's"
      say "installer finishes, run 'ori doctor' to check everything is ready."
      break
    fi
    sleep 10
    waited=$((waited + 10))
  done
  xcode-select -p >/dev/null 2>&1 && say "Command Line Tools installed."
fi

# ── PATH: added for the user (typing it by hand went wrong in testing). One line in
#    their shell's startup file, never repeated; ORI_NO_MODIFY_PATH=1 skips it. ─────
case ":$PATH:" in
  *":$BIN:"*) say "Run: ori" ;;
  *)
    shown="$(printf '%s' "$BIN" | sed "s#^$HOME#\$HOME#")"
    case "$(basename "${SHELL:-/bin/zsh}")" in
      fish) profile="$HOME/.config/fish/conf.d/ori.fish"; line="fish_add_path $shown" ;;
      bash) profile="$HOME/.bash_profile"; line="export PATH=\"$shown:\$PATH\"" ;;
      *)    profile="$HOME/.zshrc"; line="export PATH=\"$shown:\$PATH\"" ;;
    esac
    if [ "${ORI_NO_MODIFY_PATH:-}" = "1" ]; then
      say "Add Ori to your PATH by adding this line to $profile:"
      say "  $line"
    elif [ -f "$profile" ] && grep -qF "$line" "$profile"; then
      say "Ori is on your PATH in new Terminal windows."
    else
      mkdir -p "$(dirname "$profile")"
      printf '\n# Ori\n%s\n' "$line" >> "$profile" \
        || fail "Ori is installed, but $profile could not be updated; add: $line"
      say "Added Ori to your PATH in $(printf '%s' "$profile" | sed "s#^$HOME#~#")."
    fi
    say "Open a new Terminal window, then run: ori"
    ;;
esac
