import { deflateRawSync } from 'zlib'
import { describe, expect, it } from 'vitest'
import { readXlsxRows, readZip } from './xlsx'

/** A minimal zip writer for tests: entries are stored or deflated; checksums are not needed by the reader. */
function zip(files: Record<string, string>, deflate = false): Buffer {
  const locals: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  for (const [name, text] of Object.entries(files)) {
    const nameBuf = Buffer.from(name)
    const raw = Buffer.from(text)
    const data = deflate ? deflateRawSync(raw) : raw
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(deflate ? 8 : 0, 8)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(raw.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    const cd = Buffer.alloc(46)
    cd.writeUInt32LE(0x02014b50, 0)
    cd.writeUInt16LE(deflate ? 8 : 0, 10)
    cd.writeUInt32LE(data.length, 20)
    cd.writeUInt32LE(raw.length, 24)
    cd.writeUInt16LE(nameBuf.length, 28)
    cd.writeUInt32LE(offset, 42)
    locals.push(local, nameBuf, data)
    central.push(cd, nameBuf)
    offset += local.length + nameBuf.length + data.length
  }
  const centralBuf = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(Object.keys(files).length, 10)
  end.writeUInt32LE(centralBuf.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, centralBuf, end])
}

const SHARED = `<?xml version="1.0"?><sst><si><t>Name</t></si><si><t xml:space="preserve">Line one
line two &amp; more</t></si><si><r><t>Rich </t></r><r><t>text</t></r><rPh><t>ignored</t></rPh></si><si><t>Ünï &#233; &#x41;</t></si></sst>`
const SHEET = `<worksheet><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="D1" t="s"><v>2</v></c></row>
<row r="3"><c r="A3" t="inlineStr"><is><t>inline</t></is></c><c r="B3"><v>2</v></c><c r="C3"/><c r="D3" t="s"><v>3</v></c></row>
</sheetData></worksheet>`

describe('readXlsxRows', () => {
  for (const deflate of [false, true]) {
    it(`reads shared and inline strings, numbers, gaps and entities (${deflate ? 'deflated' : 'stored'})`, () => {
      const rows = readXlsxRows(
        zip({ 'xl/sharedStrings.xml': SHARED, 'xl/worksheets/sheet1.xml': SHEET }, deflate)
      )
      expect(rows[0]).toEqual(['Name', 'Line one\nline two & more', '', 'Rich text'])
      expect(rows[1]).toEqual([])
      expect(rows[2]).toEqual(['inline', '2', '', 'Ünï é A'])
    })
  }

  it('refuses a file that is not a zip, and a workbook without a sheet', () => {
    expect(() => readXlsxRows(Buffer.from('not a zip at all'))).toThrow('Not a zip')
    expect(() => readXlsxRows(zip({ 'xl/other.xml': '<x/>' }))).toThrow('no sheet')
  })

  it('lists the files of an archive', () => {
    expect([...readZip(zip({ 'a.txt': 'A', 'b/c.txt': 'C' })).keys()]).toEqual(['a.txt', 'b/c.txt'])
  })
})
