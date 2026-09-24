import { describe, expect, it } from 'vitest'
import { friendlyFileError, ipcErrorMessage } from './ipc-error'

describe('ipcErrorMessage', () => {
  it('strips the Electron prefix and the error class', () => {
    expect(
      ipcErrorMessage(
        new Error("Error invoking remote method 'meetings:people-add': Error: KR is used")
      )
    ).toBe('KR is used')
    expect(ipcErrorMessage(new Error("Error invoking remote method 'x': PeopleError: nope"))).toBe(
      'nope'
    )
  })
  it('leaves other messages alone', () => {
    expect(ipcErrorMessage(new Error('Plain message'))).toBe('Plain message')
    expect(ipcErrorMessage('a string')).toBe('a string')
  })
})

describe('friendlyFileError', () => {
  it('turns file-system codes into plain words', () => {
    expect(friendlyFileError("EACCES: permission denied, open '/x/y.tmp'")).toContain(
      'not allowed to write'
    )
    expect(friendlyFileError('EPERM: operation not permitted')).toContain('not allowed to write')
    expect(friendlyFileError('ENOSPC: no space left on device')).toBe('The disk is full.')
    expect(friendlyFileError('EROFS: read-only file system')).toBe('The notes folder is read-only.')
  })
  it('leaves other messages alone', () => {
    expect(friendlyFileError('Invalid date: soon')).toBe('Invalid date: soon')
  })
})
