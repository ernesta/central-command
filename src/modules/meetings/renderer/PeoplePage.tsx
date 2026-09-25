import { useState } from 'react'
import { useLocation } from 'react-router'
import { sortPeople } from '@shared/people'
import { Button } from '@renderer/components/Button'
import { EmptyState } from '@renderer/components/EmptyState'
import { LandingHeader, LandingPage } from '@renderer/components/Landing'
import { Notice } from '@renderer/components/Notice'
import type { RemoveHow } from '../shared/api'
import type { PersonPatch } from '../shared/people'
import type { Person } from '../shared/types'
import { PeopleTable } from './PeopleTable'
import { RemoveDialog } from './RemoveDialog'
import { usePeople, type PeopleActionResult } from './usePeople'
import styles from './PeoplePage.module.css'

/** Files that were left as they were are the only thing worth saying after a change; the rest is visible in the table. */
function skippedText(skipped: readonly string[]): string {
  return `Left as they are, because they changed meanwhile: ${skipped.join(', ')}.`
}

/**
 * The people you meet and train with: full name, unique initials (for attendees, leads and TODO owners), which
 * one is you, and how many notes mention each. Changing a name or initials updates the notes too.
 */
export function PeoplePage(): React.JSX.Element {
  const { people, usage, run } = usePeople()
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<Person | null>(null)

  const current = sortPeople((people ?? []).filter((p) => !p.archived))
  const archived = sortPeople((people ?? []).filter((p) => p.archived))
  // Back goes to where you came from: Settings links here, and so may other pages later.
  const fromSettings = (useLocation().state as { from?: string } | null)?.from === 'settings'

  const report = (result: PeopleActionResult): string | null => {
    setError(result.error ?? (result.skipped.length > 0 ? skippedText(result.skipped) : null))
    return result.error
  }

  return (
    <LandingPage>
      <LandingHeader
        backTo={fromSettings ? '/settings' : '/research'}
        backLabel={fromSettings ? 'Settings' : 'Research'}
        title="People"
        actions={
          <Button
            variant="primary"
            disabled={people === null || adding}
            onClick={() => setAdding(true)}
          >
            Add person
          </Button>
        }
      />
      {error && (
        <Notice tone="error" onDismiss={() => setError(null)}>
          {error}
        </Notice>
      )}
      {people !== null && people.length === 0 && !adding && (
        <EmptyState
          heading="Nobody yet"
          message="People you add to a meeting or a training appear here too."
        />
      )}
      {people !== null && (people.length > 0 || adding) && (
        <div className={styles.content}>
          <PeopleTable
            people={current}
            everyone={people}
            usage={usage}
            adding={adding}
            onAdd={async (name, initials) =>
              report(
                await run(window.api.meetings.people.add({ name, initials: initials || undefined }))
              )
            }
            onAddDone={() => setAdding(false)}
            onInvalid={setError}
            onSave={async (name: string, patch: PersonPatch) =>
              report(await run(window.api.meetings.people.update(name, patch)))
            }
            onRemove={setRemoving}
          />
        </div>
      )}
      {archived.length > 0 && people !== null && (
        <details className={styles.archived}>
          <summary className={styles.summary}>Archived ({archived.length})</summary>
          <PeopleTable
            people={archived}
            everyone={people}
            usage={usage}
            onInvalid={setError}
            onSave={async () => null}
            onRestore={async (person) =>
              void report(await run(window.api.meetings.people.restore(person.name)))
            }
          />
          <p className={styles.note}>
            Archived people are not offered when adding people to a note. Old notes still show them.
          </p>
        </details>
      )}
      {removing && people && (
        <RemoveDialog
          person={removing}
          usage={usage.find((u) => u.name === removing.name)}
          everyone={people}
          onCancel={() => setRemoving(null)}
          onConfirm={(how: RemoveHow) => {
            const name = removing.name
            setRemoving(null)
            void run(window.api.meetings.people.remove(name, how)).then(report)
          }}
        />
      )}
    </LandingPage>
  )
}
