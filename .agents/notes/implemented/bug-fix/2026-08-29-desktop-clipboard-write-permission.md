# Agent Note: Desktop session grants clipboard writes to the Web GUI origin

Status: implemented

English | [中文](2026-08-29-desktop-clipboard-write-permission.zh.md)

## Problem

The Desktop shell's session policy denied every Web API permission request and check. Chromium gates `navigator.clipboard.writeText` on the `clipboard-sanitized-write` permission, so in the Desktop window every copy control in the chat UI — message bubbles, the assistant turn tail, code blocks — failed silently: the shared `writeClipboard` helper reports the denial without feedback or fallback, and the clipboard stays unchanged. The same controls work in a plain browser tab, where localhost is a secure context and clipboard writes carry an implicit grant.

## Decision

`hardenSession` keeps the deny-by-default policy with one grant: `clipboard-sanitized-write` is allowed only when the requesting origin equals the current Web Host origin. The pure decision lives in `apps/desktop/src/session-permissions.ts` (`grantsDesktopPermission`, `originOfUrl`), and the Electron handlers in `main.ts` feed it the live origin from the Host supervisor, so the grant follows Host replacement to a new port. Before the Host reports an origin, and for every other origin or permission — clipboard reads included — the answer stays deny.

Clipboard writes only place text the page already holds onto the system clipboard behind a user gesture; they expose no host data the renderer cannot already read.

## Alternatives considered

**Keep the blanket deny and route copies through an IPC bridge on the preload `dshDesktop` face.** Rejected because the Web UI runs unchanged in browsers and the Desktop shell; a bridge would fork the copy path per host and grow the preload surface for one call site.

**Fall back to `document.execCommand('copy')` in `writeClipboard` when the async API rejects.** Rejected because the denial is a host policy signal the helper deliberately reports instead of masking; a deprecated fallback would hide future permission regressions across every host, not just Desktop.

**Grant `clipboard-sanitized-write` without an origin check.** Rejected because the session also renders the recovery page; only the loopback Web GUI origin owns the grant.

## Verification

`apps/desktop/tests/session-permissions.spec.ts` covers the grant for the current Host origin, denial for other origins and for a not-yet-reported Host origin, denial of clipboard reads and every other permission from the Web GUI origin, and URL-to-origin reduction including unparseable URLs.

## Consequences

Copy controls work in the Desktop window without any Web client change. The Desktop session now answers one permission affirmatively, so future permission additions must be weighed against the deny-by-default stance rather than inherit it for free. Clipboard reads stay denied; nothing in the product reads the clipboard programmatically.
