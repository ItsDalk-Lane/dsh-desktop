// Pure Web API permission policy for the Desktop session: clipboard writes
// from the loopback Web GUI are the single grant; every other request denies.

/** One permission question Chromium asks the shell. */
export interface DesktopPermissionRequest {
  /** Chromium permission identifier, e.g. `clipboard-sanitized-write`. */
  readonly permission: string
  /** Origin of the requesting frame, or undefined when its URL does not parse. */
  readonly requestingOrigin: string | undefined
}

/**
 * Origin of a requesting URL, or undefined when it does not parse.
 * @param url - URL string supplied by a Chromium permission callback.
 * @returns the URL's origin for exact comparison against the Host origin.
 */
export function originOfUrl(url: string): string | undefined {
  try {
    return new URL(url).origin
  } catch {
    return undefined
  }
}

/**
 * Decide one Web API permission request. `navigator.clipboard.writeText` from
 * the current Web Host origin — the copy controls in the chat UI — is the only
 * grant: it places text the page already holds onto the clipboard behind a
 * user gesture. Everything else, clipboard reads included, stays denied.
 * @param request - Permission name and requesting origin.
 * @param hostOrigin - Current Web Host origin, or undefined before the Host reports one.
 * @returns whether the session grants the request.
 */
export function grantsDesktopPermission(
  request: DesktopPermissionRequest,
  hostOrigin: string | undefined,
): boolean {
  return request.permission === 'clipboard-sanitized-write'
    && hostOrigin !== undefined
    && request.requestingOrigin === hostOrigin
}
