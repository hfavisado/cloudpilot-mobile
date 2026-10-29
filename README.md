# Cloudpilot Mobile

Android and iOS apps for [CloudpilotEmu](../cloudpilot-emu/README.md). Each app is a thin native shell that hosts the existing Angular/Ionic web UI and Emscripten/WebAssembly emulators in a WebView. Emulation stays in WASM. See [FEASIBILITY.md](FEASIBILITY.md) (Option A).

## Decision: shell technology

Cross-platform UI frameworks (Flutter, React Native, Kotlin Multiplatform UI) were evaluated and rejected. The UI and emulator host layer already exist as a web app, so those frameworks would require rewriting the UI on a new stack, or would only wrap a WebView anyway.

What is actually platform-specific is small: a WebView host, a JS-to-native bridge, and lifecycle/file/clipboard/network services. The recommended approach is therefore:

| Approach | Verdict |
| --- | --- |
| Flutter / React Native / KMP | Rejected. UI rewrite or redundant WebView wrapper, no code saved. |
| Two fully separate native shells (WKWebView + Android WebView) | Fallback. Maximum control, but every bridge feature is written twice. |
| **Capacitor** (WebView shell, single TypeScript bridge, small per-platform plugins) | **Preferred to prototype.** Matches the Angular/Ionic stack and keeps native code minimal. |
| Tauri 2 mobile | Alternative. The upstream web app already has a Tauri backend; requires a Rust toolchain. |

"Upstream" means the `cloudpilot-emu` project in `../cloudpilot-emu`, which this app reuses unmodified.

Reuse the upstream bridge contract (`platform-backend-native-app-*.ts` in `cloudpilot-emu/web/pwa`) so the web app needs few or no changes. Only implement natively what a WebView cannot do.

### Prototype gates (verify before committing to the shell)

- WASM threads / `SharedArrayBuffer` (cross-origin isolation) work in both WebViews, or the non-threaded build is used.
- Audio starts and survives background/foreground transitions.
- File import/export (ROMs, `.prc/.pdb`, SD images, sessions) works via native pickers.
- Long-running sessions are not killed by memory limits; OS5 performance is acceptable on mid-range Android devices.

If Capacitor fails a gate, fall back to separate native shells.

## Product behavior

- **Launch straight into the emulator.** The app resumes the last session (ROM/device image already loaded) and starts emulating without showing a session list. If no session exists, it opens the device-image/session flow once.
- **Auto-resume is the default.** No setting is needed to get it.
- **Periodic save plus save on background.** While emulating, the session state is saved periodically (interval to be tuned), so only a small amount of changed state remains to be written when the app is backgrounded. On background or close, emulation pauses and a final save runs, which makes the flush fast enough to finish before the OS suspends the app. The next launch resumes where the user left off. This needs a lifecycle event forwarded from native to the shared bridge, with the same message name on both platforms. Whether the periodic saves are incremental depends on what the existing session persistence supports; to be verified.
- **Full-screen display.** Hide the upstream tab bar and header. Stretch the Palm OS screen to fill the device screen while keeping the device's fixed resolution and aspect ratio unchanged: no cropping and no distortion, so letterboxing is limited to the leftover edge on one axis. Scale by the largest factor that fits, with nearest-neighbor or integer-friendly sampling to keep it crisp.
- **Swipe-down menu.** Swiping down from the top edge opens a menu over the emulator. Entries, mapped to existing upstream pages:

  | Menu entry | Upstream page |
  | --- | --- |
  | Load / switch device image (session) | `sessions` |
  | Create / load memory card images | `storage` |
  | Settings | `settings` |
  | About | `about` |
  | Future features | add entries here |

  Emulation is paused while the menu is open and resumes when it closes. Swiping up or tapping outside closes the menu and returns to the emulator. The gesture must not conflict with pen input on the Palm screen: only an edge-start swipe in the status-bar region triggers it.

### How this is built without forking upstream

Upstream already provides every screen above (`web/pwa/src/app/page/{emulation,sessions,storage,settings,about}`), but navigates them with a bottom tab bar. The shell must not patch that code, so:

1. The shell loads the unmodified web app and injects a small shared TypeScript/CSS layer that hides the tab bar and header and scales the emulator canvas.
2. The swipe-down menu is rendered by the same injected layer (one implementation for both platforms) and navigates to the existing routes.
3. Native code only forwards the edge-swipe gesture if the WebView cannot detect it reliably, plus safe-area insets.

Open items to verify against the `cloudpilot-emu` code before implementing: whether the tab bar and canvas scaling can be controlled purely by injected CSS/route navigation, how it resumes the last session and saves snapshots, and how long a save takes on real devices. Contributing changes back to `cloudpilot-emu` is out of scope for now; the goal is to get emulation working on mobile first.

## Development environment

Toolchains are managed by [devenv](https://devenv.sh) (`devenv.nix`) and are scoped to this repository. Run `devenv shell` before building. Xcode and CocoaPods are host tools that Nix cannot provide.

## Layout

```
shared/    # TypeScript layer injected into the web app (menu, scaling, lifecycle); same code on both platforms
scripts/   # build-web.sh builds the unmodified upstream app and layers the shared code on top
web-build/ # generated web bundle loaded by both shells (not committed)
android/   # Capacitor Android project
ios/       # Capacitor iOS project (Swift Package Manager, no CocoaPods)
```

## Build

All commands run inside `devenv shell`. The upstream build runs in place in `../cloudpilot-emu` (WASM with Emscripten 4.0.10, then the web app), so it writes build output and `node_modules` there but never changes its source.

```
yarn install
yarn build:web        # SKIP_WASM=1 yarn build:web reuses an existing WASM build
yarn cap sync
cd android && ./gradlew assembleDebug
xcodebuild -project ios/App/App.xcodeproj -scheme App -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

Both debug builds succeed. Nothing has been run on a device or simulator yet.

### Status of behavior in `shared/src/mobile-shell.ts`

- Implemented: start on the emulation route, hidden tab bar and header, canvas scaled to fill the screen at its native aspect ratio, swipe-down menu, pause by leaving the emulation page while the menu is open or the app is backgrounded.
- Unverified: that upstream actually resumes the last session on launch and saves its state when the emulation page is left. Periodic saving is not implemented yet.

## Next steps

1. Locate the existing iOS (`pwashell`) and Android shim sources.
2. Build the upstream web app and load it in a Capacitor shell on both platforms.
3. Run the prototype gates on physical devices.
4. Add signing, CI, and store release pipelines.
5. Complete a GPL-3.0-or-later compliance review before distribution.

## Rules for contributors

See [AGENTS.md](AGENTS.md).
