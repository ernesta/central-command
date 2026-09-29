import { ArrowLeft } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { moduleSearches } from '@modules/index'
import { searchPeople } from '@modules/meetings/renderer/people-search'
import type { SearchHit } from '@shared/search'
import { EmptyState } from '../components/EmptyState'
import { SearchInput } from '../components/SearchInput'
import { searchCommands } from './commands'
import { useQuickActionWorkspace } from './useQuickActionWorkspace'
import { searchEverywhere, type SearchGroup, type Searchable } from './run-search'
import styles from './SearchResultsPage.module.css'

const RESULTS_LIMIT = 40
const DELAY_MS = 150

function Hit({ hit, onRun }: { hit: SearchHit; onRun: () => void }): React.JSX.Element {
  const body = (
    <>
      <span className={styles.title}>{hit.title}</span>
      {hit.detail && <span className={styles.detail}>{hit.detail}</span>}
    </>
  )
  if (hit.run) {
    return (
      <button type="button" className={styles.hit} onClick={onRun}>
        {body}
      </button>
    )
  }
  return (
    <Link className={styles.hit} to={hit.route ?? '#'} onClick={onRun}>
      {body}
    </Link>
  )
}

/**
 * Every result, not just the best few: opened from "See all results" in the search window, or reached on its own.
 * The same `in:` modifiers work here. See `docs/DECISIONS.md`, "Global search" for how results are ordered.
 */
export function SearchResultsPage(): React.JSX.Element {
  const navigate = useNavigate()
  const workspace = useQuickActionWorkspace()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [result, setResult] = useState<{ query: string; groups: SearchGroup[] }>({
    query: '',
    groups: []
  })

  const sources: Searchable[] = useMemo(
    () => [
      {
        id: 'actions',
        label: 'Actions',
        search: (q: string, limit?: number) => searchCommands(q, navigate, limit, workspace)
      },
      { id: 'people', label: 'People', search: searchPeople },
      ...moduleSearches()
    ],
    [navigate, workspace]
  )

  // Search a moment after typing stops; an answer for words that have since changed is dropped.
  useEffect(() => {
    if (query.trim() === '') return
    let cancelled = false
    const timer = setTimeout(() => {
      void searchEverywhere(sources, query, RESULTS_LIMIT).then((groups) => {
        if (!cancelled) setResult({ query, groups })
      })
    }, DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, sources])

  const searched = query.trim() !== ''
  const groups = searched ? result.groups : []
  const answered = searched && result.query === query
  const goBack = (): void =>
    void (location.key !== 'default' ? navigate(-1) : navigate('/research'))
  const total = groups.reduce((n, g) => n + g.hits.length, 0)

  return (
    <div className={styles.page}>
      <button type="button" className={styles.back} onClick={goBack}>
        <ArrowLeft size={14} strokeWidth={1.75} aria-hidden />
        Back
      </button>
      <h1 className={styles.heading}>Search</h1>
      <SearchInput
        label="Search"
        value={query}
        autoFocus
        onChange={(value) => {
          setQuery(value)
          setParams(value ? { q: value } : {}, { replace: true })
        }}
      />
      <p className={styles.hint}>
        <code>in:notes</code>, <code>in:meetings</code>, <code>in:training</code>,{' '}
        <code>in:readings</code> or <code>in:people</code> searches just one of them.
      </p>
      {answered && total === 0 && query.trim() !== '' && (
        <EmptyState heading="No results" message={`Nothing matches “${query.trim()}”.`} />
      )}
      <div className={styles.groups}>
        {groups.map((group, index) => (
          <section key={group.label} className={styles.group} aria-labelledby={`results-${index}`}>
            <h2 id={`results-${index}`} className={styles.groupTitle}>
              {group.label}
            </h2>
            <div className={styles.list}>
              {group.hits.map((hit) => (
                <Hit key={hit.key} hit={hit} onRun={() => hit.run && void hit.run()} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
