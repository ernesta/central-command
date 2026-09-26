import { describe, expect, it, vi } from 'vitest'
import { buildContextMenu, type ContextMenuActions, type ContextMenuParams } from './context-menu'

const params = (over: Partial<ContextMenuParams>): ContextMenuParams => ({
  isEditable: false,
  selectionText: '',
  misspelledWord: '',
  dictionarySuggestions: [],
  linkURL: '',
  ...over
})
const actions = (): ContextMenuActions => ({
  replaceMisspelling: vi.fn(),
  addToDictionary: vi.fn(),
  openLink: vi.fn(),
  copyLink: vi.fn()
})
const labels = (items: ReturnType<typeof buildContextMenu>): string[] =>
  items.map((i) => i.label ?? i.role ?? i.type ?? '')

describe('buildContextMenu', () => {
  it('is empty where there is nothing to do', () => {
    expect(buildContextMenu(params({}), actions())).toEqual([])
  })

  it('offers Copy only for selected text that cannot be edited', () => {
    expect(labels(buildContextMenu(params({ selectionText: 'x' }), actions()))).toEqual(['copy'])
  })

  it('offers the editing commands in editable text, with Cut and Copy only for a selection', () => {
    const plain = buildContextMenu(params({ isEditable: true }), actions())
    expect(labels(plain)).toEqual(['cut', 'copy', 'paste', 'selectAll'])
    expect(plain.find((i) => i.role === 'cut')?.enabled).toBe(false)
    const selected = buildContextMenu(params({ isEditable: true, selectionText: 'x' }), actions())
    expect(selected.find((i) => i.role === 'cut')?.enabled).toBe(true)
  })

  it('puts up to five spelling suggestions and Add to dictionary first, and they do what they say', () => {
    const a = actions()
    const menu = buildContextMenu(
      params({
        isEditable: true,
        misspelledWord: 'recieve',
        dictionarySuggestions: ['receive', 'relieve', 'reprieve', 'revive', 'retrieve', 'recede']
      }),
      a
    )
    expect(labels(menu).slice(0, 7)).toEqual([
      'receive',
      'relieve',
      'reprieve',
      'revive',
      'retrieve',
      'Add to dictionary',
      'separator'
    ])
    menu[0].click?.({} as never, undefined, {} as never)
    expect(a.replaceMisspelling).toHaveBeenCalledWith('receive')
    menu[5].click?.({} as never, undefined, {} as never)
    expect(a.addToDictionary).toHaveBeenCalledWith('recieve')
  })

  it('says when there are no suggestions, and ignores a misspelling outside editable text', () => {
    const none = buildContextMenu(params({ isEditable: true, misspelledWord: 'zzq' }), actions())
    expect(none[0]).toMatchObject({ label: 'No suggestions', enabled: false })
    expect(buildContextMenu(params({ misspelledWord: 'zzq' }), actions())).toEqual([])
  })

  it('offers Open link only for web addresses, and always Copy link address', () => {
    const web = buildContextMenu(params({ linkURL: 'https://example.org' }), actions())
    expect(labels(web)).toEqual(['Open link', 'Copy link address'])
    const other = buildContextMenu(params({ linkURL: 'file:///etc/passwd' }), actions())
    expect(labels(other)).toEqual(['Copy link address'])
  })
})
