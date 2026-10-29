# Cloudpilot Mobile: Feasibility Findings

**Assessment date:** 2026-10-30  
**Source project:** [`cloudpilot-emu`](../cloudpilot-emu/README.md)

## Executive summary

Building an Android and iOS Cloudpilot app is feasible. A mobile app is not a greenfield effort: the existing project already has an iOS native app, an iOS WebKit bridge, and changelog references to native shim apps on Android. The emulator engines and the mature application UI are present in this repository.

The important distinction is what “natively emulates” means:

- **Native mobile app, existing emulator engine:** package the existing Angular/Ionic interface and Emscripten/WebAssembly emulators in mobile shells. The emulation itself remains WASM in a WebView. This is the lowest-risk route and is closest to what the existing iOS app and shim integration appear to do.
- **Native mobile emulator, no WebView for emulation/UI:** compile the C/C++ engines into Android and iOS applications, expose host APIs through JNI and Objective-C++/Swift, and build native rendering, controls, storage, and lifecycle integration. This is technically achievable but is a substantial port, not a build-target toggle.

**Recommendation:** begin with the first route unless native rendering or a specific performance/integration requirement rules out WebView/WASM. If the project is specifically intended to deliver a truly native emulator, use the second route as an explicit product goal and plan a small architecture/prototype phase before committing to a full app.

## Evidence in this repository

- The README says CloudpilotEmu emulates Dragonball-era Palm devices and the ARM-based Tungsten E2, documents an App Store iOS app, and says the web app can be installed on iOS and Android. See [`README.md`](../cloudpilot-emu/README.md).
- The current emulation front end is C++ compiled to WebAssembly, with an Angular/Ionic TypeScript application around it. The build instructions describe Emscripten and the web app as separate build steps. See [`README.md`](../cloudpilot-emu/README.md) and [`src/Makefile`](../cloudpilot-emu/src/Makefile).
- The C++ `Cloudpilot` interface already exposes session initialization, emulation stepping, frame buffers, pen/buttons, snapshots, database installation, and external-card operations. Its WebIDL binding demonstrates a concrete host boundary that could inform a native API. See [`Cloudpilot.h`](../cloudpilot-emu/src/cloudpilot/web/Cloudpilot.h) and [`cloudpilot.idl`](../cloudpilot-emu/src/cloudpilot/web/binding/cloudpilot.idl).
- The iOS backend detects a `pwashell` user agent and communicates with a `WKWebView` message handler for features such as clipboard and networking. That is a native host bridge, not evidence that the emulator engine itself is currently built as native iOS code. See [`platform-backend-native-app-ios.ts`](../cloudpilot-emu/web/pwa/src/app/service/platform/platform-backend-native-app-ios.ts).
- The Tauri backend provides native clipboard, file dialogs, filesystem operations, and network integration. It identifies Android as a supported platform value. The changelog also records native shim apps on Android, Windows, macOS, and Linux. The Android/mobile host implementation itself is not present in this repository's visible web source. See [`platform-backend-native-app-tauri.ts`](../cloudpilot-emu/web/pwa/src/app/service/platform/platform-backend-native-app-tauri.ts) and [`CHANGELOG.md`](../cloudpilot-emu/CHANGELOG.md).
- The existing desktop C++ native target is not a mobile target: it links SDL2, SDL2_image, readline, libcurl, pthread, and platform-specific networking libraries; its entry point owns an SDL window and event loop. The OS5 emulator has a parallel SDL native shell. See [`src/Makefile.common`](../cloudpilot-emu/src/Makefile.common), [`src/cloudpilot/Makefile`](../cloudpilot-emu/src/cloudpilot/Makefile), and [`src/uarm/Makefile`](../cloudpilot-emu/src/uarm/Makefile).
- The README notes that demanding OS5 software may struggle on older or slower Android hardware. Performance needs testing on target devices, especially for OS5, rather than being inferred from the fact that the host phone uses ARM. See [`README.md`](../cloudpilot-emu/README.md).
- The project is GPL-3.0-or-later. A distributable app should preserve applicable notices and review the licenses and obligations of included dependencies and submodules. See [`LICENSE`](../cloudpilot-emu/LICENSE) and [`README.md`](../cloudpilot-emu/README.md).

## Option A: Reuse the WASM emulator in native mobile shells

### Feasibility: High

Keep the existing Angular/Ionic UI and Emscripten builds, then package them for Android and iOS. The iOS app and platform bridge are evidence that this pattern already works at least for one platform. Android support is suggested by the Tauri backend and changelog, but this checkout does not contain enough native host code to confirm the full Android release/build path.

This option preserves the existing session management, skins, audio, storage workflows, and shared UI. The host app supplies platform services such as lifecycle notifications, clipboard, file import/export, and networking. The emulator remains WebAssembly running inside the app's web runtime.

Main work before treating this as a standalone new project:

- Locate and confirm access to the existing iOS shell source and Android shim source; they are not included in this repository tree.
- Confirm whether the desired Android shell is Tauri-based or another wrapper, and establish reproducible signing/build/release workflows for both stores.
- Validate WebAssembly threading/worker behavior, audio, background/foreground transitions, file access, and long-running sessions on current iOS and Android versions.
- Audit the mobile-specific UI and feature matrix. Existing web/mobile support is not identical to native OS integration, and the README documents limitations for some OS5 features.

This gives users installed apps but should not be described as a native C++ emulator. “Native app shell with WASM emulation” is accurate.

## Option B: Embed the C++ emulators in fully native apps

### Feasibility: Medium, with meaningful porting effort

The emulator implementation is reusable C/C++ and already has distinct emulation code and Emscripten builds. Both the classic Dragonball emulator and OS5/uARM emulator have native and Emscripten builds. However, the checked-in native targets are desktop developer tools, not reusable Android/iOS libraries: they include SDL event/render/audio code, CLI entry points, and desktop dependencies.

A mobile implementation would need to:

- Define a platform-independent engine library boundary for both emulators, separating emulation and session state from SDL, CLI, Emscripten, and desktop networking concerns.
- Build the libraries for Android ABIs and iOS architectures, then provide JNI/Kotlin or Java bindings on Android and Objective-C++/Swift bindings on iOS. Reusing the existing C++ interface is a useful starting point, but it is coupled to the current WebIDL/Emscripten bridge and needs a deliberate native API.
- Implement native display/framebuffer presentation, Palm device skins and controls, touch/pen input, physical/virtual keyboard behavior, audio output, and lifecycle-aware scheduling.
- Implement durable session/savestate storage, ROM and app import, export, virtual SD/Memory Stick handling, and safe file-picker integration on both platforms.
- Port or replace host services such as clipboard, networking, timers, and any worker-based execution. The existing iOS WebKit bridge does not supply these for a native C++ engine.
- Test performance, thermal behavior, memory limits, suspend/resume correctness, and audio timing on representative iPhones and a range of Android devices. OS5 is the highest performance risk called out by the existing README.
- Add CI for Xcode/iOS and Android NDK builds, device tests, packaging, and release signing. Store policy and GPL compliance need to be handled as product requirements.

The likely strategy is to share the emulator implementation while writing new native host applications, not to port the desktop SDL app wholesale. SDL may be useful for an early prototype, but it does not eliminate the need for mobile lifecycle, file, UI, and release integration.

## Recommended project name

Use **`cloudpilot-mobile`** for a repository whose deliverable is the Android/iOS product, whether its engine is WASM or C++. It describes the supported product/platform without promising that all emulation is implemented natively.

Use **`cloudpilot-native`** only if the defining requirement is a native C++ engine and native rendering. `cloudpilot-emu-native` is understandable, but may be confused with the existing desktop CLI native builds and with the current native app shells.

## Suggested decision and next steps

1. Decide whether “native” means an installed app or a native emulator engine. This changes the scope by a large margin.
2. Obtain/inspect the existing iOS app and Android shim host projects and their build/release pipelines before recreating their functionality.
3. If WASM in a WebView is acceptable, prototype store-ready builds and verify the feature/lifecycle matrix on physical devices.
4. If a native engine is required, prototype one end-to-end vertical slice first: build the classic emulator library for Android and iOS, initialize a user-supplied ROM/session, render a frame, and route pen input. Then repeat the feasibility check for OS5 and benchmark it before choosing the shared architecture.
5. Confirm source availability and licensing for the native host projects and all dependencies before splitting or publishing a new repository.

## Bottom line

There is a strong foundation for a cross-platform **mobile app**, and the existing iOS app plus Android shim references reduce product uncertainty. There is not yet a turnkey **native Android/iOS emulator engine** in this checkout. Reusing the existing WASM engine is high-feasibility; delivering a truly native engine and UI is feasible but requires a separate mobile architecture and a significant implementation/testing effort.