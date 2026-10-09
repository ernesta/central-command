import { parseHead, updateHeadKeys } from './front-matter'

/**
 * Entities: the things a note can point to. A mention is an ordinary Markdown link whose address uses the app's own
 * scheme, `[Kathy Rastle](cc://person/Kathy%20Rastle)`, so it is valid Markdown everywhere (the editor's serialiser cannot
 * mangle it, and any other tool shows it as a link with its label). What the address names depends on the kind:
 *
 * - `person`: the person's name (renaming a person rewrites the mentions).
 * - `reading`: the citekey.
 * - `meeting`, `note`: a `uid` kept in the item's front matter, added the first time something links to it, so the link
 *   survives renames and moves between workspaces.
 * - `file`: a file kept beside the notes (a spreadsheet, a PDF), by its path inside the notes folder,
 *   `research/Data Sources Summary.xlsx`. A file has no front matter to hold a `uid`, so moving or renaming it breaks the link.
 * - `task`: the task's `uid` (always there; tasks live in the database).
 *
 * A kind is one entry here and one provider in the renderer (`renderer/src/entities`).
 */
export const ENTITY_KINDS = ['person', 'reading', 'meeting', 'note', 'file', 'task'] as const
export type EntityKind = (typeof ENTITY_KINDS)[number]

export interface EntityRef {
  kind: EntityKind
  key: string
}

const PREFIX = 'cc://'

/** A key made safe inside a Markdown link address: no spaces, no parentheses, nothing that needs `<…>` or escaping. */
function encodeKey(key: string): string {
  return encodeURIComponent(key).replace(
    /[!'()*~]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  )
}

/** The link address of an entity: `cc://meeting/k3f9a2x1`. */
export function entityHref(ref: EntityRef): string {
  return `${PREFIX}${ref.kind}/${encodeKey(ref.key)}`
}

/** The entity an address names, or null when it is not one of ours (a web link, a malformed or unknown kind). */
export function parseEntityHref(href: string): EntityRef | null {
  if (!href.startsWith(PREFIX)) return null
  const rest = href.slice(PREFIX.length)
  const slash = rest.indexOf('/')
  if (slash <= 0) return null
  const kind = rest.slice(0, slash)
  if (!(ENTITY_KINDS as readonly string[]).includes(kind)) return null
  let key: string
  try {
    key = decodeURIComponent(rest.slice(slash + 1))
  } catch {
    return null
  }
  return key ? { kind: kind as EntityKind, key } : null
}

/** One mention found in Markdown text. */
export interface EntityMention {
  ref: EntityRef
  label: string
  /** The whole `[label](address)` in the text. */
  start: number
  end: number
}

// [label](cc://kind/key): the label may hold escaped brackets; the address has no spaces or parentheses (see encodeKey).
const MENTION = /\[((?:\\.|[^\]\\\n])*)\]\((cc:\/\/[^\s()]+)\)/g

/** Every mention in some Markdown text, in order. Fenced code is skipped. */
export function findMentions(markdown: string): EntityMention[] {
  const found: EntityMention[] = []
  let fenced = false
  let offset = 0
  for (const line of markdown.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced
    if (!fenced) {
      for (const match of line.matchAll(MENTION)) {
        const ref = parseEntityHref(match[2])
        if (ref) {
          const start = offset + (match.index ?? 0)
          found.push({ ref, label: match[1], start, end: start + match[0].length })
        }
      }
    }
    offset += line.length + 1
  }
  return found
}

/** The label a mention gets in the Markdown: brackets and backslashes escaped so the link stays one link. */
export function escapeLabel(label: string): string {
  return label.replace(/[\\[\]]/g, (c) => `\\${c}`)
}

/**
 * The text after a person was renamed: every mention of `from` now names `to`, and its label too when it was the
 * old name (a label the writer chose, such as "Kathy", stays). Nothing else changes; text with no such mention comes
 * back untouched.
 */
export function renamePersonMentions(markdown: string, names: ReadonlyMap<string, string>): string {
  if (names.size === 0) return markdown
  let out = markdown
  const mentions = findMentions(markdown).filter(
    (m) => m.ref.kind === 'person' && names.has(m.ref.key)
  )
  for (const m of mentions.reverse()) {
    const to = names.get(m.ref.key) as string
    const label = m.label === escapeLabel(m.ref.key) ? escapeLabel(to) : m.label
    out =
      out.slice(0, m.start) +
      `[${label}](${entityHref({ kind: 'person', key: to })})` +
      out.slice(m.end)
  }
  return out
}

const ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

/** A new uid: eight characters from an alphabet without look-alikes. `random` gives numbers in [0, 1). */
export function newUid(random: () => number = Math.random): string {
  let uid = ''
  for (let i = 0; i < 8; i++) uid += ID_ALPHABET[Math.floor(random() * ID_ALPHABET.length)]
  return uid
}

/** The `uid` in a note's front matter (the part `splitNote` calls the head), or '' when it has none. */
export function readUid(head: string): string {
  const entry = parseHead(head)?.entries.find((e) => e.key === 'uid')
  const value = entry?.lines[0]
    .slice('uid:'.length)
    .trim()
    .replace(/^['"]|['"]$/g, '')
  return value && /^[a-z0-9]{4,32}$/i.test(value) ? value : ''
}

/** The head with a `uid` added (a head with no front matter becomes a new block). Everything else stays as it was. */
export function addUid(head: string, uid: string): string {
  // Listing the keys already there first puts the uid after the last of them, at the end of the block.
  const order = [...(parseHead(head)?.entries.map((e) => e.key) ?? []), 'uid']
  return updateHeadKeys(head, { uid }, { order, style: () => 'plain' })
}

/** Where a mention is written: what kind of file, in which workspace, and its id (file name without the extension). */
export interface BacklinkSource {
  kind: 'note' | 'meeting' | 'training' | 'reading-list' | 'reading-notes' | 'plan' | 'task'
  workspace: string
  id: string
}

/** One place an entity is mentioned. */
export interface Backlink {
  source: BacklinkSource
  /** What to call the place: a note's title, a meeting's date, a reading's citekey. */
  title: string
  /** The line the mention is in, as plain text. */
  context: string
}
