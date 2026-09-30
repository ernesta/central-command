/**
 * The hidden switch between the old editor (Milkdown) and the new one (`LiveEditor`) while the new one is being
 * built (`docs/EDITOR_LIVE_MARKUP_PLAN.md`). Not in Settings on purpose. To try it, run
 * `localStorage.setItem('central-command.liveEditor', '1')` in the developer tools and reload; remove the key to go back.
 */
const KEY = 'central-command.liveEditor'

export function liveEditorEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}
