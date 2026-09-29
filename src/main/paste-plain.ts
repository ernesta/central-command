/** The parts of Electron's `before-input-event` input this needs. */
export interface KeyInput {
  type: string
  key: string
  meta: boolean
  control: boolean
  alt: boolean
  shift: boolean
}

/**
 * Cmd-Shift-V (Ctrl-Shift-V elsewhere): paste without formatting. Electron's default Edit menu claims this chord
 * for "Paste and Match Style" before the page sees the key, and the page then receives an ordinary paste with
 * the formatting still on the clipboard. So the main process takes the chord itself and hands the renderer the
 * clipboard's text.
 */
export function isPastePlainChord(input: KeyInput, platform: NodeJS.Platform): boolean {
  if (input.type !== 'keyDown' || input.key.toLowerCase() !== 'v') return false
  if (!input.shift || input.alt) return false
  return platform === 'darwin' ? input.meta && !input.control : input.control && !input.meta
}
