import { createElement } from 'react'
import type { LiveModuleManifest } from '../types'
import { ReadingListsLanding } from './renderer/ReadingListsLanding'
import { ReadingListPage } from './renderer/ReadingListPage'
import { ReadingListsPage } from './renderer/ReadingListsPage'
import { searchReadingLists } from './renderer/search'

/**
 * Reading lists: named, sectioned lists of papers, each entry pointing at a reading or a placeholder
 * citation. Reached from inside Readings (a "Lists" link on `ReadingsPage`), not its own card on the
 * Research landing page: no `landingCard`.
 */
export const readingListsModule: LiveModuleManifest = {
  id: 'reading-lists',
  workspace: 'research',
  label: 'Reading lists',
  status: 'live',
  routes: [
    { path: '', element: createElement(ReadingListsLanding) },
    { path: 'all', element: createElement(ReadingListsPage) },
    { path: 'l/:id', element: createElement(ReadingListPage) }
  ],
  search: searchReadingLists
}
