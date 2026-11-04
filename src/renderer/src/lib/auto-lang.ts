import { hasArabicScript } from '@shared/text-direction'

/**
 * Text in the Arabic script is tagged `lang="ur"`, where it is drawn: the font gives 4, 6 and 7 their Urdu forms only
 * for text it is told is Urdu, and the page itself is tagged with the Mac's language. An element is tagged when its own
 * text has Arabic-script letters, and untagged again when it no longer does; a text field when its value has them.
 * The note editor tags runs itself (`editor/live-language.ts`) and is left alone. The app cannot yet tell Urdu from
 * Arabic or Persian, so all of it is tagged Urdu: see `docs/ROADMAP.md`.
 */
const AUTO = 'data-auto-lang'
const SKIP = '.cm-editor, script, style, [contenteditable="true"]'
const FIELDS = 'input, textarea'

function ownText(el: Element): string {
  let text = ''
  for (const node of el.childNodes) if (node.nodeType === Node.TEXT_NODE) text += node.nodeValue
  return text
}

function tag(el: Element, wanted: boolean): void {
  if (wanted) {
    if (el.hasAttribute('lang')) return
    el.setAttribute('lang', 'ur')
    el.setAttribute(AUTO, '')
  } else if (el.hasAttribute(AUTO)) {
    el.removeAttribute('lang')
    el.removeAttribute(AUTO)
  }
}

function refresh(el: Element | null): void {
  if (!el || el.closest(SKIP)) return
  if (el.matches(FIELDS)) tag(el, hasArabicScript((el as HTMLInputElement).value))
  else tag(el, hasArabicScript(ownText(el)))
}

function scan(node: Node): void {
  if (node.nodeType === Node.TEXT_NODE) return refresh(node.parentElement)
  if (!(node instanceof Element)) return
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
  for (let text = walker.nextNode(); text; text = walker.nextNode()) refresh(text.parentElement)
  if (node.matches(FIELDS)) refresh(node)
  for (const field of node.querySelectorAll(FIELDS)) refresh(field)
}

export function autoLang(root: Document = document): void {
  scan(root.body)
  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'characterData') refresh(record.target.parentElement)
      else {
        refresh(record.target instanceof Element ? record.target : null)
        for (const added of record.addedNodes) scan(added)
      }
    }
  }).observe(root.body, { childList: true, characterData: true, subtree: true })
  const onField = (event: Event): void => {
    if (event.target instanceof Element && event.target.matches(FIELDS)) refresh(event.target)
  }
  root.addEventListener('focusin', onField)
  root.addEventListener('input', onField)
}
