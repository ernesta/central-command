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
import landing from '@renderer/components/Landing.module.css'
import { Notice } from '@renderer/components/Notice'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { KIND_NOUN, SHOWN_PER_SECTION, sectionsOf } from '../shared/rows'
import type { ShownKind } from '../shared/types'
import { todayIso, watchListRoute } from './watch-paths'
import { useWatchItems } from './useWatchItems'
import { useWatchSources } from './useWatchSources'
import { WatchList } from './WatchList'

const SETTINGS_WATCH = { settingsTab: 'watch' }

/** The Watch page: what the places the user watches have announced, saved items first, then trainings and conferences. */
export function WatchPage(): React.JSX.Element {
  const { items, ...actions } = useWatchItems()
  const { sources } = useWatchSources()
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const today = todayIso()
  const sections = sectionsOf(items ?? [])

  const checkNow = async (): Promise<void> => {
    setChecking(true)
    setError(null)
    try {
      await window.api.watch.checkNow()
    } catch (e) {
      setError(`Couldn’t check: ${ipcErrorMessage(e)}`)
    } finally {
      setChecking(false)
    }
  }

  const section = (kind: ShownKind, list: typeof sections.training): React.JSX.Element => (
    <LandingSection
      id={`watch-${kind}`}
      label={KIND_NOUN[kind].many}
      aside={
        <SeeAllLink to={watchListRoute(kind)}>
          See all {KIND_NOUN[kind].many.toLowerCase()}
          <ArrowRight size={14} strokeWidth={1.75} aria-hidden />
        </SeeAllLink>
      }
    >
      {list.length === 0 ? (
        <EmptyState
          heading={`Nothing new in ${KIND_NOUN[kind].many.toLowerCase()}`}
          message={`See all ${KIND_NOUN[kind].many.toLowerCase()} for the rest.`}
        />
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

      {sources === null || items === null ? null : sources.length === 0 ? (
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
            <LandingSection
              id="watch-saved"
              label="Saved"
              aside={
                <span className={landing.windowNote}>Their deadlines show in Home’s Coming up</span>
              }
            >
              <WatchList items={sections.saved} today={today} actions={actions} />
            </LandingSection>
          )}
          {section('training', sections.training)}
          {section('conference', sections.conference)}
        </>
      )}
    </LandingPage>
  )
}
