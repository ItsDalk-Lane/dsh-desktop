# Agent Note: DSH Desktop in-app brand

Status: implemented

## Problem

The desktop distribution absorbed the official engine at source level and ships its own icon family, package identity, and update channel, but the assembled UI still opened on the upstream identity: the fish mark plus the `deepseek HARNESS` svg wordmark occupied `sidebar.brand.mark`, `sidebar.brand.name`, and `conversation.hero.brand.mark`, and the framework-free boot page drew a bare `HARNESS` wordmark. A product whose installer, tray, and window title all say DSH Desktop greeted every session with another project's logo and name.

## Decision

The brand occupants stay where the slot system put them: `ui-brand-official` is already the one package that fills the three brand slots under `DSH_CLIENT_BUILD_PROFILE=official`, so it now carries the DSH Desktop brand instead of a second package being minted.

The mark is the software's desktop icon itself: the `apps/desktop/build/icon.png` source, embedded inline. A 128px render is base64-embedded as a data URL and `DshMark` emits it as an `<img>` that sizes to the square edge each host requests (24 in the sidebar brand row and collapsed rail, 34 in the conversation hero, where the host's hover animation applies through the host class unchanged). Using the icon bitmap directly — not a redrawn SVG — is what makes the in-app brand byte-for-byte the icon the dock and tray use, which is the reviewable requirement. The name is the string `DSH Desktop` in the shell's brand typography at a single weight, so the two words read as one name, and it stays legible in both themes because it rides text ink.

The boot page wordmark becomes the tracked-caps string `DSH DESKTOP`; the boot page is framework-free by design, so it draws text, not the plugin component. `DSH_CLIENT_TITLE` remains the browser/electron title mechanism, and the raster icon assets (`icon.icns`, tray templates) remain the source of record for the icon family — this change owns the in-app drawing only.

Local-profile builds are unchanged: they load the plugin, register no occupants, and keep the generic `DSH Local Build` shell fallbacks.

The same rename covers the settings surfaces in `ui-desktop-customization`: the update card names the product `DSH Desktop` with its version rows labeled 桌面版 (Desktop shell) and 引擎核心 (embedded engine core), the appearance preview's mock window title reads `DSH Desktop`, and the image-free theme describes restoring the `DSH Desktop` native interface.

## Alternatives considered

**Re-letter the svg wordmark and keep the whale mark.** Rejected: the wordmark is exact figma glyph paths, so renaming means hand-drawing letterforms; its badge plate depends on an inverted-label ink that breaks wherever themes differ from the two it was tuned for; and a name that exists only as artwork must be redrawn for every size and cannot flow as text.

**A redrawn SVGs — a low-node constellation or a 4×4 grid of nodes.** Rejected: both are interpretations of the icon rather than the icon itself. A review of the rendered mark against the software showed any hand-drawn network, however closely it approximates the layout, is distinguishable from the actual desktop icon; the requirement is that the in-app mark be the icon, so only the bitmap satisfies it. An `<img>` does not ride `currentColor`, but the icon's plate already carries its own colors, which is what the desktop icon does everywhere else.

**Replace the shell fallbacks inside `ui-sidebar` and `ui-conversation`.** Rejected: the brand slots exist precisely so a deployment package can replace identity without touching layout packages; baking a product brand into the shells would leak distribution identity into engine packages and take the replacement seam away from every other profile.

**A new brand package alongside `ui-brand-official`.** Rejected: the slots are `kind: single`; two official-profile brand packages would compete for them, and the profile gate already gives the existing package exactly this job. Minting a second package adds a registration conflict for zero capability.

**Runtime-configurable branding (config-driven name and mark).** Rejected: this distribution has exactly one brand; identity is not a deployment-varying tunable, and the existing `DSH_CLIENT_BUILD_PROFILE` gate already separates the official distribution from local engine builds.

**Weight-contrast wordmark (bold `DSH`, regular `Desktop`).** Rejected after review: the two-word contrast reads as an inconsistency rather than a stylization, and the distribution names itself `DSH Desktop` as one unit; a single weight keeps the wordmark uniform.

## Consequences

Every `official`-profile surface — sidebar brand row, collapsed rail, conversation hero, boot page — now projects the DSH Desktop identity, while the engine's local builds keep their generic fallbacks through the same slots. The mark is the icon bitmap, so it cannot drift from the desktop icon; the cost is a ~31KB base64 data URL in the brand bundle and a mark that carries the icon's own plate colors rather than riding `currentColor`. The desktop build additionally composes desktop-only plugins (plugin center, vision enhancement) into its profile, which is why those entries appear in the desktop app and not in the base engine `dsh web` profile; the brand change does not alter profile composition. No snapshot fixture pinned the upstream wordmark, so the assembled-output replay stayed green without re-recording.

## Testing

`ui-brand-official` unit tests pin the name string, the mark's requested sizes, and that the mark is the embedded PNG data URL; the boot-page test pins the `DSH DESKTOP` wordmark; the built-boot snapshot asserts the `DSH Desktop` name in the assembled graph; the `ui-desktop-customization` update spec pins the update card's product name and version-row labels; `pnpm run test:gui` covers the changed packages.
