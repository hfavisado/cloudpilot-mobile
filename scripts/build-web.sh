#!/usr/bin/env bash
# Builds the unmodified upstream web app, then layers the mobile shell on top. Run inside `devenv shell`.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UPSTREAM="${CLOUDPILOT_EMU:-$ROOT/../cloudpilot-emu}"
OUT="$ROOT/web-build"

if [ -z "${SKIP_WASM:-}" ]; then
    EMCC_DIR="$(dirname "$(readlink -f "$(command -v emcc)")")"
    # Upstream expects an EMSDK layout, which the Nix packages do not have.
    EM_CACHE="$ROOT/.emscripten-cache" \
        WEBIDL_BINDER="python3 $EMCC_DIR/../share/emscripten/tools/webidl_binder.py" \
        WASMOPT="$(command -v wasm-opt)" \
        make -C "$UPSTREAM/src" emscripten
fi

(
    cd "$UPSTREAM/web"
    yarn install --frozen-lockfile
    yarn gen-revision
    yarn build
    yarn generate-worker
)

rm -rf "$OUT"
cp -R "$UPSTREAM/web/build-pwa" "$OUT"

# The mobile app never needs the PWA service worker.
rm -f "$OUT"/sw.js "$OUT"/workbox-*.js "$OUT"/ngsw*.json

(cd "$ROOT" && npx esbuild shared/src/mobile-shell.ts --bundle --minify --format=iife --outfile="$OUT/mobile-shell.js")
cp "$ROOT/shared/src/mobile-shell.css" "$OUT/mobile-shell.css"

python3 - "$OUT/index.html" <<'PY'
import re, sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
s = re.sub(r'(<meta name="viewport" content="[^"]*)"', r'\1, viewport-fit=cover"', s, count=1)
s = s.replace("</head>", '<link rel="stylesheet" href="mobile-shell.css"></head>', 1)
s = s.replace("</body>", '<script src="mobile-shell.js"></script></body>', 1)
open(p, "w", encoding="utf-8").write(s)
PY
