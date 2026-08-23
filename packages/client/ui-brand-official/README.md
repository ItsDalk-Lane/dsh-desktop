# @deepseek-ai/dsh-client-ui-brand-official

English | [中文](README.zh.md)

This package fills `sidebar.brand.mark`, `sidebar.brand.name`, and `conversation.hero.brand.mark` only when `DSH_CLIENT_BUILD_PROFILE` is `official`. Other builds load the plugin but register no occupants, leaving the shell fallbacks visible.

The occupants carry the DSH Desktop brand: the mark is the distribution's app icon — a rounded plate with a node network — embedded inline as a data-URL `<img>`, and the name is the `DSH Desktop` wordmark set at one weight in the shell's brand typography. The mark draws at the square edge each host requests (24 in the sidebar brand row and collapsed rail, 34 in the conversation hero), so one component serves every surface.

The three occupants install as one declaration-aware registration set through nested `slots.inject()` calls. The package therefore works whether its row activates before or after the sidebar and conversation declarers, withdraws all occupants when either declaration collapses, and leaves no partial brand mix during HMR. It retains no runtime state. The node half is an empty Loader seat, and the browser title remains a build-environment concern outside this package.

## Model Experience

None, as the package contributes browser presentation only; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **The package supplies one occupant set** — alternative presentation belongs in another Cordis package occupying the same slots.
- **The browser title is independent** — `DSH_CLIENT_TITLE` selects title text at build time rather than through a UI slot, and the boot page draws its own wordmark.
- **The mark is the icon bitmap, inlined** — the in-app mark is byte-for-byte the distribution's app icon; updating the icon requires regenerating `dsh-mark-data.ts`, not editing an SVG.
