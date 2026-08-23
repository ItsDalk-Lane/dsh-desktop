import { DshMark } from './DshMark.tsx'
import css from './Brand.module.css'
import type { HeroBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SidebarBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'

type OfficialBrandMarkProps = HeroBrandMarkOwnerProps & SidebarBrandMarkOwnerProps

/**
 * Render the DSH Desktop mark with the presentation requested by its host surface.
 * @param props - Host-supplied mark presentation.
 * @returns the DSH Desktop network mark.
 */
export function OfficialBrandMark({ size, className }: OfficialBrandMarkProps) {
  return <DshMark size={size} className={className} />
}

/**
 * Render the DSH Desktop product name.
 * @returns the product-name text.
 */
export function OfficialBrandName() {
  return <span className={css.productName}>DSH Desktop</span>
}
