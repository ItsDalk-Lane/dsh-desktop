# Agent Note: Vision-enhancement model setting is a standing entry

Status: implemented

English | [中文](2026-08-29-vision-model-standing-setting.zh.md)

## Problem

The compatible-vision provider and model could only be configured inside the verification dialog, and the dialog was reachable only from the enable flow: the Settings row opened it when the switch was off, and the composer shortcut opened it only when activation failed. While the capability was enabled — its normal state — changing the vision model required toggling the capability off and back on. The Host's `vision.enable` operation already reconfigures atomically while enabled (it disables, re-verifies with one real image, and persists the new selection), so the gap was purely entry-point reachability, not capability.

## Decision

Both surfaces keep a standing settings entry independent of the switch. The Settings row renders a persistent 设置 button beside the toggle that opens the verification dialog regardless of the enabled state. The composer shortcut's hover card carries a 更换视觉模型 (enabled) / 设置视觉模型 (disabled) action that opens the same dialog. The dialog gains a `reconfigure` flag mirroring the Host state: while enabled its copy reads 视觉能力增强设置 / 验证并应用 / 识别成功，视觉模型已更新, and the submit still calls the single atomic `vision.enable` path, so a new provider or model takes effect immediately after verification without a disable-and-re-enable cycle. The on/off switch keeps its existing semantics on both surfaces, and the Host-side disable-only settings guard is unchanged: enabling and model changes still require real-image verification.

## Alternatives considered

**Patch the model through the plain Settings namespace.** Rejected because the Host API proxy deliberately admits only disable-only writes for the `vision-enhancement` namespace; provider and model changes must keep passing real-image verification so an unusable vision model is never persisted as enabled.

**Make the switch open the dialog when enabled instead of disabling.** Rejected because the switch would then hide the off action — the most frequent operation — behind a dialog, trading one missing entry for another.

**Drop re-verification and apply model edits instantly.** Rejected because the verification probe is the only end-to-end check that the configured credential, base URL, and model id actually describe images together; skipping it would let a typo take the compatible route down at request time.

## Verification

`packages/client/ui-desktop-customization/tests/vision.client.spec.tsx` pins the standing entry on both surfaces: the Settings-row 设置 button opens the reconfigure dialog while enabled and 验证并应用 submits the same probe without any disable call; the composer hover card exposes the action in both switch states and the enabled-state action opens the reconfigure dialog. First-time-enable flows keep the original 开启 copy.

## Consequences

The vision model is changeable at any moment from either surface, and the change is protected by the same verification as first-time setup. The Settings row gains one more control, and the composer hover card gains a keyboard-focusable button that is hover-reachable only, so keyboard users configure through the Settings row.
