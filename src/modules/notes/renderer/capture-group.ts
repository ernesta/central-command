/**
 * The group a note started with the quick-capture shortcut should be in: the one the visitor is looking at.
 * The list page says which it is showing while it is open; anywhere else there is none. A plain module
 * variable, not React state, because the shortcut is handled outside the page.
 */
let current = { group: '', subgroup: '' }

export function setCaptureGroup(group: string, subgroup: string): void {
  current = { group, subgroup }
}

export function getCaptureGroup(): { group: string; subgroup: string } {
  return current
}
