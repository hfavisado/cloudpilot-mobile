# AGENTS.md

## Project

Android and iOS apps for CloudpilotEmu: native shells hosting the existing web UI and WASM emulators (see [README.md](README.md), [FEASIBILITY.md](FEASIBILITY.md)). Upstream source is in `../cloudpilot-emu`.

## Rules

- **Toolchains via devenv only.** Install build tools by adding them to `devenv.nix` and run every build command inside `devenv shell`. Do not install tools globally (brew, npm -g, etc.) and do not touch other folders' environments.
- **Keep Android and iOS in parity.** Any change to native code, bridge APIs, permissions, lifecycle handling, build config, or assets must be applied to both platforms in the same change. If a change is genuinely platform-specific, state why in the change description.
- **Prefer shared code.** Put logic in the shared TypeScript bridge or the web layer first; add native code only for what a WebView cannot do.
- **Keep the bridge contract identical** across platforms (same message names, payloads, and error behavior). Update bridge docs when it changes.
- **Do not fork upstream web or emulator code.** Reuse `../cloudpilot-emu` as-is; propose upstream changes instead of patching locally.
- **Do not reimplement the UI** in a native or cross-platform UI framework (Flutter, React Native, etc.).
- **Keep changes minimal.** No speculative features, abstractions, or refactors beyond the request.
- **Update docs** ([README.md](README.md), this file) when decisions or structure change.
- **Licensing:** the project is GPL-3.0-or-later. Preserve notices and check licenses of any new dependency.
- **Verify on both platforms** (build at minimum; device test for lifecycle, audio, file access, and performance changes) before declaring work complete.

## Comments

Write a comment only when the code cannot show the reason itself; keep it to one short line.
