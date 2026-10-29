import { useToday } from '@renderer/state/use-today'
import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Button } from '@renderer/components/Button'
import { EmptyState } from '@renderer/components/EmptyState'
import {
  AllLink,
  LandingHeader,
  LandingPage,
  LandingSection,
  SeeAllLink
} from '@renderer/components/Landing'
import { Notice } from '@renderer/components/Notice'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { SECTION_NOUN, SHOWN_PER_SECTION, sectionsOf } from '../shared/rows'
import type { WatchSection } from '../shared/types'
import { useWatchWorkspace, watchListRoute } from './watch-paths'
import { useManualEntries } from './useManualEntries'
import { useWatchItems } from './useWatchItems'
import { useWatchSources } from './useWatchSources'
import { WatchList } from './WatchList'
import listStyles from './WatchList.module.css'

const SETTINGS_WATCH = { settingsTab: 'watch' }

/** The Watch page: what the places the user watches have announced, saved items first, then trainings, conferences, events and opportunities. */
export function WatchPage(): React.JSX.Element {
  const { items, ...itemActions } = useWatchItems()
  const entries = useManualEntries()
  const actions = { ...itemActions, ...entries.actions }
  const workspace = useWatchWorkspace()
  const { sources } = useWatchSources(workspace)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const today = useToday()
  const sections = sectionsOf(items ?? [], today)

  const checkNow = async (): Promise<void> => {
    setChecking(true)
    setError(null)
    try {
      await window.api.watch.checkNow(undefined, workspace)
    } catch (e) {
      setError(`Couldn’t check: ${ipcErrorMessage(e)}`)
    } finally {
      setChecking(false)
    }
  }

  const section = (kind: WatchSection, list: typeof sections.training): React.JSX.Element => (
    <LandingSection
      id={`watch-${kind}`}
      label={SECTION_NOUN[kind].many}
      aside={
        <SeeAllLink to={watchListRoute(kind, workspace)}>
          See all {SECTION_NOUN[kind].many.toLowerCase()}
          <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
        </SeeAllLink>
      }
    >
      {list.length === 0 ? (
        <p className={listStyles.empty}>Nothing new in {SECTION_NOUN[kind].many.toLowerCase()}</p>
      ) : (
        <WatchList items={list.slice(0, SHOWN_PER_SECTION)} today={today} actions={actions} />
      )}
    </LandingSection>
  )

  return (
    <LandingPage>
      <LandingHeader
        title="Watch"
        actions={
          <>
            <AllLink to="/settings" state={SETTINGS_WATCH}>
              Sources
            </AllLink>
            <Button onClick={entries.openNew}>New entry</Button>
            <Button
              variant="primary"
              disabled={checking || !sources || sources.length === 0}
              onClick={() => void checkNow()}
            >
              {checking ? 'Checking…' : 'Check now'}
            </Button>
          </>
        }
      />
      {error && (
        <Notice tone="error" onDismiss={() => setError(null)}>
          {error}
        </Notice>
      )}

      {entries.dialog}

      {sources === null || items === null ? null : sources.length === 0 && items.length === 0 ? (
        <EmptyState
          heading="Nothing watched yet"
          message="Add the pages and feeds you check by hand, and Watch tells you what is new."
        >
          <AllLink to="/settings" state={SETTINGS_WATCH}>
            Add source
          </AllLink>
        </EmptyState>
      ) : (
        <>
          {sections.saved.length > 0 && (
            <LandingSection id="watch-saved" label="Saved">
              <WatchList items={sections.saved} today={today} actions={actions} />
            </LandingSection>
          )}
          {section('training', sections.training)}
          {section('conference', sections.conference)}
          {section('event', sections.event)}
          {section('opportunity', sections.opportunity)}
        </>
      )}
    </LandingPage>
  )
}
