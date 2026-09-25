import { useState } from 'react'
import { Button } from '@renderer/components/Button'
import { EmptyState } from '@renderer/components/EmptyState'
import { LandingHeader, LandingPage } from '@renderer/components/Landing'
import { Notice } from '@renderer/components/Notice'
import type { PersonPatch } from '../shared/people'
import { PeopleTable } from './PeopleTable'
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

  const report = (result: PeopleActionResult): string | null => {
    setError(result.error ?? (result.skipped.length > 0 ? skippedText(result.skipped) : null))
    return result.error
  }

  return (
    <LandingPage>
      <LandingHeader
        backTo="/research"
        backLabel="Research"
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
            people={people}
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
          />
        </div>
      )}
    </LandingPage>
  )
}
