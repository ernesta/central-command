/**
 * Every text field takes the direction of what is typed in it (`dir="auto"`): Arabic, Urdu or Hebrew runs from the right
 * in a search box, a title, a note's field, English from the left, and an empty one stays left to right. Set when a
 * field first takes focus, so fields made later are covered without each one saying so.
 */
const TEXT_TYPES = new Set(['text', 'search', 'url', 'email', 'tel', ''])

export function isTextField(el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (el instanceof HTMLTextAreaElement) return true
  return el instanceof HTMLInputElement && TEXT_TYPES.has(el.type)
}

export function autoDirectionOnFocus(root: Document = document): void {
  root.addEventListener('focusin', (event) => {
    const el = event.target
    if (isTextField(el) && !el.hasAttribute('dir')) el.setAttribute('dir', 'auto')
  })
}
