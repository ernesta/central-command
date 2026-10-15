import type { ParsedItem } from '../shared/types'
import { findDate } from '../shared/dates'
import { decodeEntities } from './parse-feed'

export interface ParsedPage {
  links: ParsedItem[]
  /** The page's readable text, whitespace collapsed; changes when the page does. */
  text: string
}

/** Link texts that are the page's furniture, not something it announces. */
const FURNITURE =
  /^(skip to|read more|learn more|more|view all|see all|show more|home|menu|search|log ?in|sign ?in|register|contact|about|cookies?|privacy|terms|accessibility|sitemap|back to|next|previous|share|print|download|apply now|book now|find out more|click here|here)\b/i

function stripNoise(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, ' ')
}

function resolve(href: string, base: string): string | null {
  try {
    const u = new URL(decodeEntities(href.trim()), base)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    u.hash = ''
    return u.toString()
  } catch {
    return null
  }
}

/** Links worth watching and the page's text. Navigation and footer are left out, since they are the same on every visit and would only add noise. */
export function parsePage(html: string, baseUrl: string): ParsedPage {
  const clean = stripNoise(html)
  const main = clean.replace(/<(nav|header|footer|aside)[\s\S]*?<\/\1>/gi, ' ')
  const links: ParsedItem[] = []
  const seen = new Set<string>()
  for (const m of main.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(m[1])
    if (!href) continue
    const url = resolve(href[1], baseUrl)
    if (!url || seen.has(url)) continue
    const title = decodeEntities(m[2].replace(/<[^>]+>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim()
    if (title.length < 12 || FURNITURE.test(title)) continue
    seen.add(url)
    links.push({ key: url, title, url, summary: '', publishedAt: null })
  }
  const text = decodeEntities(main.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
  return { links, text }
}

const MAX_DATED_SENTENCES = 15

/**
 * Sentences of a page's text that name a coming date ("EPS Meeting: University College London. 6th – 8th January
 * 2027."), for pages that announce things as prose rather than as links. Each one is an item of its own, found
 * again next time by its wording, so a rewritten sentence counts as new.
 */
export function datedSentences(text: string, pageUrl: string, today: string): ParsedItem[] {
  const out: ParsedItem[] = []
  const seen = new Set<string>()
  for (const raw of text.split(/(?<=[.!?])\s+(?=[A-Z£"“(])/)) {
    const sentence = raw.trim()
    if (sentence.length < 25 || sentence.length > 260) continue
    if (!findDate(sentence, today)) continue
    const key = `text:${sentence
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
      .slice(0, 160)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ key, title: sentence, url: pageUrl, summary: '', publishedAt: null })
    if (out.length >= MAX_DATED_SENTENCES) break
  }
  return out
}
