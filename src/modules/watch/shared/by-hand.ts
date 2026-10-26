/**
 * Places the app cannot watch, listed once under Sources so they are not forgotten. Two cannot be opened by the app (a
 * page behind a sign-in, a shared folder); two have no address to give it. Fixed for now (the user's list of 26 Oct 2026);
 * an address for the last two is an open question (`docs/WATCH_UI_PLAN.md`).
 */
export interface ByHandLine {
  name: string
  why: string
}

export const BY_HAND: readonly ByHandLine[] = [
  { name: 'Royal Holloway intranet', why: 'Needs your sign-in' },
  { name: 'Essex Box folder', why: 'A shared folder' },
  { name: 'Researcher Development Programme', why: 'No address' },
  { name: 'SEDarc (Inkpath)', why: 'No address' }
]
