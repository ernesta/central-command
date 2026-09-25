import { inflateRawSync } from 'zlib'

/** The largest single file read out of a workbook, so a hostile archive cannot fill the memory. */
const MAX_ENTRY_BYTES = 64 * 1024 * 1024

/**
 * The files of a zip archive by name (an .xlsx is one). Reads the central directory, so no external
 * program or dependency is needed. Only stored and deflated entries exist in practice; anything else is
 * refused.
 */
export function readZip(buffer: Buffer): Map<string, Buffer> {
  // The end-of-central-directory record is within the last 64 KB + 22 bytes.
  let eocd = -1
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 22 - 0xffff); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd === -1) throw new Error('Not a zip file (no end record)')
  const count = buffer.readUInt16LE(eocd + 10)
  let pos = buffer.readUInt32LE(eocd + 16)
  const files = new Map<string, Buffer>()
  for (let n = 0; n < count; n++) {
    if (buffer.readUInt32LE(pos) !== 0x02014b50) throw new Error('Damaged zip directory')
    const method = buffer.readUInt16LE(pos + 10)
    const compressedSize = buffer.readUInt32LE(pos + 20)
    const size = buffer.readUInt32LE(pos + 24)
    const nameLength = buffer.readUInt16LE(pos + 28)
    const extraLength = buffer.readUInt16LE(pos + 30)
    const commentLength = buffer.readUInt16LE(pos + 32)
    const localOffset = buffer.readUInt32LE(pos + 42)
    const name = buffer.toString('utf8', pos + 46, pos + 46 + nameLength)
    pos += 46 + nameLength + extraLength + commentLength
    if (name.endsWith('/')) continue
    if (size > MAX_ENTRY_BYTES) throw new Error(`${name} is too large`)
    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('Damaged zip entry')
    const dataStart =
      localOffset +
      30 +
      buffer.readUInt16LE(localOffset + 26) +
      buffer.readUInt16LE(localOffset + 28)
    const raw = buffer.subarray(dataStart, dataStart + compressedSize)
    if (method === 0) files.set(name, Buffer.from(raw))
    else if (method === 8)
      files.set(name, inflateRawSync(raw, { maxOutputLength: MAX_ENTRY_BYTES }))
    else throw new Error(`Unsupported zip compression (${method}) for ${name}`)
  }
  return files
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : ''
    }
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e] ?? ''
  })
}

/** The text of the `<t>` elements inside one string item (rich text has several), phonetic runs left out. */
function textOf(xml: string): string {
  const cleaned = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '')
  return [...cleaned.matchAll(/<t\b[^>]*?(?:\/>|>([\s\S]*?)<\/t>)/g)]
    .map((m) => decodeEntities(m[1] ?? ''))
    .join('')
}

function columnIndex(letters: string): number {
  let n = 0
  for (const c of letters) n = n * 26 + (c.charCodeAt(0) - 64)
  return n - 1
}

/**
 * The rows of the first sheet of an .xlsx workbook as text, cell by cell (blank cells are ''). Numbers
 * keep the text Excel stored for them, so `2` stays `2` and a date stored as a number arrives as its
 * serial number; the caller decides what each column means.
 */
export function readXlsxRows(buffer: Buffer): string[][] {
  const files = readZip(buffer)
  const sheetName =
    [...files.keys()].find((k) => k === 'xl/worksheets/sheet1.xml') ??
    [...files.keys()].filter((k) => /^xl\/worksheets\/[^/]+\.xml$/.test(k)).sort()[0]
  if (!sheetName) throw new Error('The workbook has no sheet')
  const sheet = (files.get(sheetName) as Buffer).toString('utf8')
  const shared = files.has('xl/sharedStrings.xml')
    ? [
        ...(files.get('xl/sharedStrings.xml') as Buffer)
          .toString('utf8')
          .matchAll(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g)
      ].map((m) => textOf(m[1] ?? ''))
    : []

  const rows: string[][] = []
  for (const rowMatch of sheet.matchAll(/<row\b[^>]*?r="(\d+)"[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const rowIndex = Number(rowMatch[1]) - 1
    const cells: string[] = []
    for (const cell of (rowMatch[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cell[1]
      const ref = /\br="([A-Z]+)\d+"/.exec(attrs)
      if (!ref) continue
      const type = /\bt="([^"]*)"/.exec(attrs)?.[1] ?? 'n'
      const inner = cell[2] ?? ''
      let value = ''
      if (type === 's') value = shared[Number(/<v>([\s\S]*?)<\/v>/.exec(inner)?.[1])] ?? ''
      else if (type === 'inlineStr') value = textOf(/<is>([\s\S]*?)<\/is>/.exec(inner)?.[1] ?? '')
      else value = decodeEntities(/<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? '')
      cells[columnIndex(ref[1])] = value
    }
    rows[rowIndex] = Array.from(cells, (c) => c ?? '')
  }
  return Array.from(rows, (r) => r ?? [])
}
