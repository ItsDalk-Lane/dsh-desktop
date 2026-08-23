// DSH Desktop mark: the software's desktop icon (apps/desktop/build/icon.png),
// embedded inline so the in-app brand is exactly the icon the dock and tray use.

import { DSH_MARK_DATA_URL } from './dsh-mark-data.ts'
import type { IconProps } from '@deepseek-ai/dsh-client-ui-primitives'

/**
 * Render the DSH Desktop app icon.
 * @param props.size - square edge in px (default 24).
 * @param props.className - extra class for layout placement.
 * @returns the icon image (aria-hidden decorative brand art).
 */
export function DshMark({ size = 24, className }: IconProps) {
  return (
    <img
      src={DSH_MARK_DATA_URL}
      width={size}
      height={size}
      className={className}
      alt=""
      aria-hidden="true"
    />
  )
}
