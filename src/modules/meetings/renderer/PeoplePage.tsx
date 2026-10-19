import { useState } from 'react'
import { useLocation } from 'react-router'
import { sortPeople } from '@shared/people'
import { Button } from '@renderer/components/Button'
import { EmptyState } from '@renderer/components/EmptyState'
import { LandingHeader, LandingPage } from '@renderer/components/Landing'
import { Notice } from '@renderer/components/Notice'
import { pushUndo, pushUndoWithToast } from '@renderer/components/undo-store'
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

  const removingUsage = removing ? usage.find((u) => u.name === removing.name) : undefined
  const current = sortPeople((people ?? []).filter((p) => !p.archived))
  const archived = sortPeople((people ?? []).filter((p) => p.archived))
  // Opened from a search hit for this person ("?person=Name"): scroll to their row and tint it.
  const highlighted = new URLSearchParams(useLocation().search).get('person')

  // Nobody mentioned goes at once, with an Undo that adds them back as they were; someone mentioned still asks (archive or merge).
  const removeUnmentioned = async (person: Person): Promise<void> => {
    const result = await run(window.api.meetings.people.remove(person.name, { how: 'delete' }))
    if (result.error !== null) return setError(result.error)
    pushUndoWithToast(`Deleted ${person.name}.`, {
      label: `deletion of ${person.name}`,
      undo: async () => {
        const back = await run(
          window.api.meetings.people.add({
            name: person.name,
            initials: person.initials,
            me: person.me
          })
        )
        if (back.error !== null) return setError(back.error)
        if (person.links?.length) {
          await run(window.api.meetings.people.update(person.name, { links: person.links }))
        }
      }
    })
  }

  const report = (result: PeopleActionResult): string | null => {
    // A refusal (taken initials, a blank name) is shown beside the field by the row; only a partial result goes up here.
    setError(result.skipped.length > 0 ? skippedText(result.skipped) : null)
    return result.error
  }

  return (
    <LandingPage>
      <LandingHeader
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
            highlighted={highlighted}
            onAdd={async (name, initials) =>
              report(
                await run(window.api.meetings.people.add({ name, initials: initials || undefined }))
              )
            }
            onAddDone={() => setAdding(false)}
            onSave={async (name: string, patch: PersonPatch) => {
              const refused = report(await run(window.api.meetings.people.update(name, patch)))
              // Only "which one is me" is undone here: a name or initials change rewrites notes and keeps its dialog.
              if (refused === null && patch.me !== undefined && Object.keys(patch).length === 1) {
                const before = people.find((p) => p.me)
                pushUndo({
                  label: 'change of who is you',
                  undo: async () => {
                    // Setting someone as me cleared the one who was; unsetting is put back on the same person.
                    const back = patch.me
                      ? before
                        ? { who: before.name, me: true }
                        : { who: name, me: false }
                      : { who: name, me: true }
                    report(await run(window.api.meetings.people.update(back.who, { me: back.me })))
                  }
                })
              }
              return refused
            }}
            onRemove={(person) => {
              const used = usage.find((u) => u.name === person.name)
              if (!used || used.meetings + used.trainings === 0) void removeUnmentioned(person)
              else setRemoving(person)
            }}
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
            onSave={async () => null}
            onRestore={async (person) =>
              void report(await run(window.api.meetings.people.restore(person.name)))
            }
          />
        </details>
      )}
      {removing && people && removingUsage && (
        <RemoveDialog
          person={removing}
          usage={removingUsage}
          everyone={people}
          onCancel={() => setRemoving(null)}
          onConfirm={(how: RemoveHow) => {
            const name = removing.name
            setRemoving(null)
            void run(window.api.meetings.people.remove(name, how)).then((result) => {
              report(result)
              if (how.how !== 'archive' || result.error !== null) return
              pushUndoWithToast(`Archived ${name}.`, {
                label: `archiving of ${name}`,
                undo: async () => void report(await run(window.api.meetings.people.restore(name)))
              })
            })
          }}
        />
      )}
    </LandingPage>
  )
}
