import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@renderer/components/Button'
import { EmptyState } from '@renderer/components/EmptyState'
import { FilterRow } from '@renderer/components/FilterRow'
import { SearchInput } from '@renderer/components/SearchInput'
import { queryLists } from '@modules/reading-lists/shared/query'
import { NewListButton } from './NewListButton'
import { readingListsBase } from './reading-lists-paths'
import { ReadingListsTable } from './ReadingListsTable'
import { useReadingListsList } from './useReadingListsList'
import styles from './ReadingListsPage.module.css'

/** All reading lists: search and the table. */
export function ReadingListsPage(): React.JSX.Element {
  const rows = useReadingListsList()
  const [search, setSearch] = useState('')

  const everything = rows ?? []
  const visible = queryLists(everything, search)

  let content: React.ReactNode = null
  if (rows === null) content = null
  else if (everything.length === 0) {
    content = <EmptyState heading="No reading lists yet" message="Create a list to start." />
  } else if (visible.length === 0) {
    content = (
      <EmptyState heading="No matching lists" message="Try a different search.">
        <Button onClick={() => setSearch('')}>Clear search</Button>
      </EmptyState>
    )
  } else content = <ReadingListsTable rows={visible} />

  return (
    <div className={styles.page}>
      <Link className={styles.back} to={readingListsBase}>
        <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
        Reading lists
      </Link>
      <header className={styles.header}>
        <h1 className={styles.heading}>All reading lists</h1>
        <NewListButton />
      </header>

      <FilterRow>
        <SearchInput label="Search reading lists" value={search} onChange={setSearch} />
      </FilterRow>

      <div className={styles.content}>{content}</div>

      {rows !== null && visible.length > 0 && (
        <p className={styles.hint}>Most recently edited first. Click any row to open the list.</p>
      )}
    </div>
  )
}
