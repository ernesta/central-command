import { describe, expect, it } from 'vitest'
import { parseCsv } from './csv'

describe('parseCsv', () => {
  it('reads plain cells, CRLF lines and a final line with no break', () => {
    expect(parseCsv('a,b\r\nc,d\r\ne,f')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
      ['e', 'f']
    ])
  })
  it('reads quoted cells with commas, doubled quotes and line breaks', () => {
    expect(parseCsv('a,"x, ""y""\nz",c\n')).toEqual([['a', 'x, "y"\nz', 'c']])
  })
  it('keeps empty cells and drops a byte-order mark', () => {
    expect(parseCsv('﻿a,,c\n,,\n')).toEqual([
      ['a', '', 'c'],
      ['', '', '']
    ])
  })
  it('refuses a file that ends inside a quote', () => {
    expect(() => parseCsv('a,"b')).toThrow('quoted')
  })
})
