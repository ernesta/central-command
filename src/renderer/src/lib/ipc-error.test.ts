import { describe, expect, it } from 'vitest'
import { ipcErrorMessage } from './ipc-error'

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
