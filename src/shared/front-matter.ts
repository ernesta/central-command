/**
 * A note file split into its front matter block and everything after it. `head + body` is always
 * exactly the original text, so the body can be edited and joined back without touching a byte
 * of what the user wrote.
 */
export interface SplitNote {
  /** The opening fence, the key lines, the closing fence and the blank lines after it; '' if none. */
  head: string
  body: string
}

const OPEN_FENCE = /^\uFEFF?---[ \t]*\r?\n/
const NEWLINE = /\r?\n/

/**
 * Split a note into front matter and body. Front matter is only recognised at the very start of the
 * file (`---` on the first line) and needs a closing `---` line; otherwise the whole text is body.
 * Blank lines right after the closing fence go to `head`, so the body starts at real content.
 */
export function splitNote(text: string): SplitNote {
  const open = OPEN_FENCE.exec(text)
  if (!open) return { head: '', body: text }

  let pos = open[0].length
  while (pos <= text.length) {
    const nl = text.indexOf('\n', pos)
    const end = nl === -1 ? text.length : nl + 1
    const line = text.slice(pos, end).replace(/\r?\n$/, '')
    if (/^(---|\.\.\.)[ \t]*$/.test(line)) {
      let after = end
      for (;;) {
        const m = /^[ \t]*\r?\n/.exec(text.slice(after))
        if (!m) break
        after += m[0].length
      }
      return { head: text.slice(0, after), body: text.slice(after) }
    }
    if (nl === -1) break
    pos = end
  }
  return { head: '', body: text }
}

/** The inverse of `splitNote`. */
export function joinNote({ head, body }: SplitNote): string {
  return head + body
}

// ---------------------------------------------------------------------------------------------
// A small reader and editor for the front matter block. It understands exactly the shapes this app
// writes (plain and quoted scalars, inline `[a, b]` lists, block `- item` lists) and leaves every
// line it does not own alone, so unknown keys, comments and their order survive every save.
// ---------------------------------------------------------------------------------------------

export interface Entry {
  key: string
  /** The key line and any continuation lines (indented, list items, blank or comment lines). */
  lines: string[]
}

export interface ParsedHead {
  eol: string
  open: string
  entries: Entry[]
  close: string
  /** Blank lines after the closing fence. */
  trailing: string
  /** Lines before the first key (comments); kept as they are. */
  leading: string[]
}

export function parseHead(head: string): ParsedHead | null {
  if (!head) return null
  const eol = head.includes('\r\n') ? '\r\n' : '\n'
  const lines = head.split(NEWLINE)
  // `split` leaves a final '' after the last newline; blank lines after the fence are trailing.
  const closeIndex = lines.findIndex((l, i) => i > 0 && /^(---|\.\.\.)[ \t]*$/.test(l))
  if (closeIndex === -1) return null
  const entries: Entry[] = []
  const leading: string[] = []
  for (const line of lines.slice(1, closeIndex)) {
    const m = /^([A-Za-z_][\w-]*):(?:\s|$)/.exec(line)
    if (m) entries.push({ key: m[1], lines: [line] })
    else if (entries.length) entries[entries.length - 1].lines.push(line)
    else leading.push(line)
  }
  const trailingLines = lines.slice(closeIndex + 1)
  return {
    eol,
    open: lines[0],
    entries,
    close: lines[closeIndex],
    trailing: trailingLines.join(eol),
    leading
  }
}

function unquote(raw: string): string {
  const s = raw.trim()
  if (s.length >= 2 && s.startsWith("'") && s.endsWith("'"))
    return s.slice(1, -1).replace(/''/g, "'")
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    return s
      .slice(1, -1)
      .replace(/\\(["\\nt])/g, (_m, c: string) => (c === 'n' ? '\n' : c === 't' ? '\t' : c))
  }
  return s
}

/** Remove a trailing ` # comment` that is not inside quotes. */
function stripComment(raw: string): string {
  let quote: string | null = null
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]
    if (quote) {
      if (c === '\\' && quote === '"') i++
      else if (c === quote) quote = null
    } else if (c === "'" || c === '"') quote = c
    else if (c === '#' && (i === 0 || /\s/.test(raw[i - 1]))) return raw.slice(0, i)
  }
  return raw
}

function splitInline(inner: string): string[] {
  const items: string[] = []
  let current = ''
  let quote: string | null = null
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i]
    if (quote) {
      current += c
      if (c === '\\' && quote === '"') current += inner[++i] ?? ''
      else if (c === quote) quote = null
    } else if (c === "'" || c === '"') {
      quote = c
      current += c
    } else if (c === ',') {
      items.push(current)
      current = ''
    } else current += c
  }
  items.push(current)
  return items.map((s) => unquote(s)).filter((s) => s !== '')
}

export type Value = string | string[] | null

export function readValue(entry: Entry): Value {
  const first = stripComment(entry.lines[0].slice(entry.key.length + 1)).trim()
  if (first.startsWith('[')) {
    const close = first.lastIndexOf(']')
    return splitInline(first.slice(1, close === -1 ? undefined : close))
  }
  if (first === '') {
    const items = entry.lines
      .slice(1)
      .map((l) => /^\s*-\s+(.*)$/.exec(l))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => unquote(stripComment(m[1])).trim())
    return items.length ? items : null
  }
  const scalar = unquote(first)
  return scalar === '' || /^(null|~)$/i.test(first) ? null : scalar
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^([01]?\d|2[0-3]):([0-5]\d)$/

export function isValidDate(value: string): boolean {
  if (!DATE.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

/** "9:00" and "09:00" both read as "09:00"; anything else is not a time. */
export function normaliseTime(value: string): string | null {
  const m = TIME.exec(value.trim())
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null
}

export const asList = (v: Value): string[] => (Array.isArray(v) ? v : v ? [v] : [])
export const asText = (v: Value): string => (Array.isArray(v) ? (v[0] ?? '') : (v ?? ''))

/** A value that is safe to write without quotes: plain words, no YAML syntax, not a keyword or number. */
export function needsQuotes(s: string): boolean {
  if (s === '' || s !== s.trim()) return true
  if (/^(true|false|yes|no|on|off|null|~)$/i.test(s)) return true
  if (/^[\d.+-]/.test(s) && /^[\d.+\-:eE_]+$/.test(s)) return true
  if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(s)) return true
  return /: | #|[,[\]{}\n\t]/.test(s) || s.endsWith(':')
}

function quote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`
}

function scalar(s: string): string {
  return needsQuotes(s) ? quote(s) : s
}

export type Style = 'auto' | 'quote' | 'plain'

function renderEntry(
  key: string,
  value: Value,
  style: Style,
  keepEmptyList: readonly string[] = []
): string | null {
  if (
    value === null ||
    (Array.isArray(value) && value.length === 0 && !keepEmptyList.includes(key))
  )
    return null
  if (Array.isArray(value)) return `${key}: [${value.map(scalar).join(', ')}]`
  return `${key}: ${style === 'quote' ? quote(value) : style === 'plain' ? value : scalar(value)}`
}

/** How a note type wants its keys written: their canonical order, quoting, and lists that stay when empty. */
export interface HeadSpec {
  order: readonly string[]
  style?: (key: string) => Style
  /** Keys that keep an empty list (`key: []`) instead of being removed. */
  keepEmptyList?: readonly string[]
}

/**
 * Apply `patch` to a note's head and return the new head. Only the keys in the patch are touched: their
 * lines are replaced in place (or added before the closing fence, after the nearest earlier key of
 * `spec.order`); every other line, including unknown keys and comments, stays exactly as it was. A null
 * value and an empty list (unless kept) remove the key. With no front matter yet, a fresh block is created.
 */
export function updateHeadKeys(
  head: string,
  patch: Readonly<Record<string, Value | undefined>>,
  spec: HeadSpec
): string {
  let parsed = parseHead(head)
  if (!parsed) {
    parsed = { eol: '\n', open: '---', entries: [], close: '---', trailing: '\n', leading: [] }
  }
  const entries = parsed.entries.map((e) => ({ ...e, lines: [...e.lines] }))

  for (const key of spec.order) {
    if (!(key in patch)) continue
    const rendered = renderEntry(
      key,
      patch[key] ?? null,
      spec.style?.(key) ?? 'auto',
      spec.keepEmptyList
    )
    const index = entries.findIndex((e) => e.key === key)
    if (rendered === null) {
      if (index !== -1) entries.splice(index, 1)
    } else if (index !== -1) {
      // Keep any blank or comment lines that followed the old value.
      const tail = entries[index].lines
        .slice(1)
        .filter((l) => !/^\s*-\s+/.test(l) && !/^\s+\S/.test(l))
      entries[index].lines = [rendered, ...tail]
    } else {
      // Insert after the nearest earlier known key, so new keys land in the canonical order.
      const before = spec.order.slice(0, spec.order.indexOf(key)).reverse()
      const anchor = before
        .map((k) => entries.findLastIndex((e) => e.key === k))
        .find((i) => i !== -1)
      entries.splice(anchor === undefined ? 0 : anchor + 1, 0, { key, lines: [rendered] })
    }
  }

  const { eol } = parsed
  const body = [...parsed.leading, ...entries.flatMap((e) => e.lines)]
  return [parsed.open, ...body, parsed.close].join(eol) + eol + parsed.trailing
}
