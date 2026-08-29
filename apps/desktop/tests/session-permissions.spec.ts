import { describe, expect, it } from 'vitest'
import { grantsDesktopPermission, originOfUrl } from '../src/session-permissions.ts'

const HOST = 'http://127.0.0.1:61887'

describe('desktop session permission policy', () => {
  it('grants clipboard-sanitized-write only to the current Web Host origin', () => {
    expect(grantsDesktopPermission(
      { permission: 'clipboard-sanitized-write', requestingOrigin: HOST }, HOST,
    )).toBe(true)
    expect(grantsDesktopPermission(
      { permission: 'clipboard-sanitized-write', requestingOrigin: 'http://127.0.0.1:9' }, HOST,
    )).toBe(false)
    expect(grantsDesktopPermission(
      { permission: 'clipboard-sanitized-write', requestingOrigin: 'file://' }, HOST,
    )).toBe(false)
  })

  it('denies clipboard-sanitized-write before the Host reports an origin', () => {
    expect(grantsDesktopPermission(
      { permission: 'clipboard-sanitized-write', requestingOrigin: HOST }, undefined,
    )).toBe(false)
    expect(grantsDesktopPermission(
      { permission: 'clipboard-sanitized-write', requestingOrigin: undefined }, undefined,
    )).toBe(false)
  })

  it('denies clipboard reads and every other permission from the Web Host origin', () => {
    for (const permission of ['clipboard-read', 'geolocation', 'notifications', 'media', 'unknown']) {
      expect(grantsDesktopPermission({ permission, requestingOrigin: HOST }, HOST)).toBe(false)
    }
  })

  it('reduces requesting URLs to origins, denying unparseable ones', () => {
    expect(originOfUrl(`${HOST}/?dsh-desktop-platform=darwin`)).toBe(HOST)
    expect(originOfUrl('not a url')).toBeUndefined()
  })
})
