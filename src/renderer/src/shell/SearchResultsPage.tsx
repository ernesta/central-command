import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import type { SearchHit } from '@shared/search'
import { EmptyState } from '../components/EmptyState'
import { SearchInput } from '../components/SearchInput'
import { CompletionList } from './CompletionList'
import { searchEverywhere, type SearchOutcome } from './run-search'
import { useSearchSources } from './search-sources'
import { SearchNotices } from './SearchNotices'
import { useSearchCompletion } from './useSearchCompletion'
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
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [result, setResult] = useState<{ query: string } & SearchOutcome>({
    query: '',
    groups: [],
    notices: [],
    searched: false,
    impossible: false
  })

  const sources = useSearchSources()
  const inputRef = useRef<HTMLInputElement>(null)
  const choices = useSearchCompletion(
    query,
    (value) => {
      setQuery(value)
      setParams(value ? { q: value } : {}, { replace: true })
    },
    inputRef
  )

  // Search a moment after typing stops; an answer for words that have since changed is dropped.
  useEffect(() => {
    if (query.trim() === '') return
    let cancelled = false
    const timer = setTimeout(() => {
      void searchEverywhere(sources, query, RESULTS_LIMIT).then((outcome) => {
        if (!cancelled) setResult({ query, ...outcome })
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
  const total = groups.reduce((n, g) => n + g.hits.length, 0)

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Search</h1>
      <div className={styles.field}>
        <SearchInput
          label="Search"
          value={query}
          autoFocus
          ref={inputRef}
          onChange={(value) => {
            setQuery(value)
            setParams(value ? { q: value } : {}, { replace: true })
          }}
          onSelect={(event) => choices.track(event.currentTarget.selectionStart)}
          onKeyUp={(event) => choices.track(event.currentTarget.selectionStart)}
          onKeyDown={choices.onKeyDown}
          role="combobox"
          aria-expanded={choices.completion !== null}
          aria-controls={choices.completion ? 'search-page-filters' : undefined}
          aria-activedescendant={
            choices.completion && choices.active >= 0
              ? `search-page-filters-${choices.active}`
              : undefined
          }
        />
        {choices.completion && (
          <CompletionList
            id="search-page-filters"
            completion={choices.completion}
            active={choices.active}
            onPick={choices.accept}
            floating
          />
        )}
      </div>
      {answered && <SearchNotices notices={choices.completion ? [] : result.notices} />}
      {answered && result.searched && total === 0 && (
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
