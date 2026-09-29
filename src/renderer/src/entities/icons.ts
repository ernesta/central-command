import { createElement, type CSSProperties } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { entityProviders } from './registry'

/**
 * The icon of every kind of entity as a CSS custom property (`--entity-icon-person: url(…)`), for the editor to set on
 * itself: a mention is drawn as text, so its icon is a mask on a pseudo-element, and the mask is the same Lucide icon the
 * picker shows. Kinds that arrive later need no CSS of their own.
 */
export function entityIconVars(): CSSProperties {
  const vars: Record<string, string> = {}
  for (const provider of entityProviders()) {
    const svg = renderToStaticMarkup(
      createElement(provider.icon, { size: 24, strokeWidth: 1.75, color: '#000' })
    )
    vars[`--entity-icon-${provider.kind}`] = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  }
  return vars as CSSProperties
}
