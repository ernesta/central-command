import { useState } from 'react'
import { Button } from '@renderer/components/Button'
import { DatePicker } from '@renderer/components/DatePicker'
import { Dialog } from '@renderer/components/Dialog'
import { Input } from '@renderer/components/Input'
import { Select } from '@renderer/components/Select'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { SECTION_NOUN } from '../shared/rows'
import {
  WATCH_SECTIONS,
  type EntryLinkRead,
  type WatchItem,
  type WatchSection,
  type WatchWorkspace
} from '../shared/types'
import styles from './WatchSettings.module.css'

/**
 * New entry, or Edit for one added by hand: a link (Enter reads the page once and fills the rest, every field can be
 * overwritten), a title, the section, the event's dates, a deadline with its words, and one line about it.
 */
export function EntryDialog({
  item,
  workspace,
  today,
  onDone,
  onCancel
}: {
  /** The entry being edited; absent for a new one. */
  item?: WatchItem
  workspace: WatchWorkspace
  today: string
  onDone: (saved: WatchItem) => void
  onCancel: () => void
}): React.JSX.Element {
  const [url, setUrl] = useState(item?.url ?? '')
  const [title, setTitle] = useState(item?.title ?? '')
  const [section, setSection] = useState<WatchSection>(item?.section ?? 'conference')
  const [eventDate, setEventDate] = useState<string | null>(item?.eventDate ?? null)
  const [eventEnd, setEventEnd] = useState<string | null>(item?.eventEnd ?? null)
  const [deadline, setDeadline] = useState<string | null>(item?.deadline ?? null)
  const [deadlineLabel, setDeadlineLabel] = useState(item?.deadlineLabel ?? '')
  const [summary, setSummary] = useState(item?.summary ?? '')
  const [readUrl, setReadUrl] = useState(item?.url ?? '')
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [reading, setReading] = useState(false)

  const fill = (read: EntryLinkRead): void => {
    if (read.title) setTitle(read.title)
    if (read.summary) setSummary(read.summary)
    if (read.title) setSection(read.section)
    if (read.eventDate) {
      setEventDate(read.eventDate)
      setEventEnd(read.eventEnd)
    }
    if (read.deadline) {
      setDeadline(read.deadline)
      setDeadlineLabel(read.deadlineLabel ?? '')
    }
    setNotice(read.notice)
  }

  const readLink = async (): Promise<void> => {
    setReading(true)
    setError(null)
    setNotice(null)
    try {
      const read = await window.api.watch.items.readLink(url)
      setUrl(read.url)
      setReadUrl(read.url)
      fill(read)
    } catch (e) {
      setError(ipcErrorMessage(e))
    } finally {
      setReading(false)
    }
  }

  const save = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    const input = {
      workspace,
      title,
      section,
      url,
      summary,
      eventDate,
      eventEnd,
      deadline,
      deadlineLabel: deadline ? deadlineLabel : null
    }
    try {
      const saved = item
        ? await window.api.watch.items.updateManual(item.id, input)
        : await window.api.watch.items.createManual(input)
      onDone(saved)
    } catch (e) {
      setError(ipcErrorMessage(e))
      setBusy(false)
    }
  }

  const ready = title.trim() !== ''
  const working = busy || reading
  return (
    <Dialog
      title={item ? 'Edit entry' : 'New entry'}
      onCancel={onCancel}
      busy={working}
      actions={
        <>
          <Button autoFocus onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={working || !ready}>
            {item ? 'Save' : 'Add'}
          </Button>
        </>
      }
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          if (working) return
          // Enter in the link field reads a link not read yet; otherwise it saves.
          if (url.trim() && url.trim() !== readUrl) void readLink()
          else if (ready) void save()
        }}
      >
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Link</span>
          <Input
            inputMode="url"
            placeholder="https://"
            value={url}
            disabled={reading}
            onChange={(event) => setUrl(event.target.value)}
          />
        </label>
        {notice && <p className={styles.help}>{notice}</p>}
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Title</span>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Section</span>
          <Select
            label="Section"
            value={section}
            options={WATCH_SECTIONS.map((s) => ({ value: s, label: SECTION_NOUN[s].one }))}
            onChange={setSection}
          />
        </div>
        <div className={styles.row2}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Starts</span>
            <DatePicker
              label="Event date"
              value={eventDate}
              today={today}
              placeholder="No date"
              full
              onChange={(day) => {
                setEventDate(day)
                if (!day) setEventEnd(null)
              }}
            />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Ends</span>
            <DatePicker
              label="Event end"
              value={eventEnd}
              today={today}
              placeholder="No date"
              full
              isDisabled={(day) => !eventDate || day <= eventDate}
              onChange={setEventEnd}
            />
          </div>
        </div>
        <div className={styles.row2}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Deadline</span>
            <DatePicker
              label="Deadline"
              value={deadline}
              today={today}
              placeholder="No date"
              full
              onChange={setDeadline}
            />
          </div>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Deadline label</span>
            <Input
              placeholder="Apply by"
              value={deadlineLabel}
              disabled={!deadline}
              onChange={(event) => setDeadlineLabel(event.target.value)}
            />
          </label>
        </div>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Summary</span>
          <Input value={summary} onChange={(event) => setSummary(event.target.value)} />
        </label>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}
