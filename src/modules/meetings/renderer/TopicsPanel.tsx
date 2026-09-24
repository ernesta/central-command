import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@renderer/components/Button'
import type { Topic } from '../shared/topics'
import styles from './TopicsPanel.module.css'

interface TopicsPanelProps {
  topics: Topic[]
  onToggle: (text: string) => void
  /** Jump to a topic's heading in the note. `occurrence` counts headings with the same text. */
  onJump: (topic: Topic, occurrence: number) => void
  onAdd: (title: string) => void
}

/** The topics of this meeting, built from the headings in the note: the agenda, the outline and the discussed tracker in one. */
export function TopicsPanel({
  topics,
  onToggle,
  onJump,
  onAdd
}: TopicsPanelProps): React.JSX.Element {
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const done = topics.filter((t) => t.discussed).length
  const seen = new Map<string, number>()

  const submit = (): void => {
    if (title.trim() === '') return
    onAdd(title)
    setTitle('')
    setAdding(false)
  }

  return (
    <aside className={styles.panel} aria-label="Topics">
      <h2 className={styles.label}>
        Topics{topics.length > 0 ? ` · ${done} of ${topics.length} discussed` : ''}
      </h2>
      {topics.length === 0 ? (
        <p className={styles.empty}>
          No topics yet. Add a <code>###</code> heading under Notes for each thing to cover.
        </p>
      ) : (
        <ul className={styles.list}>
          {topics.map((topic, index) => {
            const occurrence = seen.get(topic.text) ?? 0
            seen.set(topic.text, occurrence + 1)
            return (
              <li key={`${index}-${topic.text}`} className={styles.row}>
                <input
                  type="checkbox"
                  className={styles.box}
                  checked={topic.discussed}
                  aria-label={`Discussed: ${topic.text}`}
                  onChange={() => onToggle(topic.text)}
                />
                <button
                  type="button"
                  className={[styles.jump, topic.discussed && styles.done]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => onJump(topic, occurrence)}
                >
                  {topic.text}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {adding ? (
        <form
          className={styles.addForm}
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <input
            className={styles.input}
            value={title}
            autoFocus
            aria-label="New topic"
            placeholder="Topic heading"
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setAdding(false)
                setTitle('')
              }
            }}
          />
          <div className={styles.addActions}>
            <Button size="small" variant="primary" type="submit" disabled={title.trim() === ''}>
              Add
            </Button>
            <Button
              size="small"
              onClick={() => {
                setAdding(false)
                setTitle('')
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button
          size="small"
          className={styles.addButton}
          icon={<Plus size={14} strokeWidth={1.75} aria-hidden />}
          onClick={() => setAdding(true)}
        >
          Add topic
        </Button>
      )}
      <p className={styles.hint}>
        Built from the headings in your notes. Click one to jump to it; tick it when it has been
        discussed. Unticked topics are what is left to cover or read up on.
      </p>
    </aside>
  )
}
