import { Fragment } from 'react'
import { moduleShortcutGroups } from '@modules/index'
import {
  formatChord,
  GENERAL_SHORTCUTS,
  LIST_SHORTCUTS,
  type Shortcut,
  type ShortcutGroup
} from '@shared/shortcuts'
import { NOTES_EDITOR_SHORTCUTS } from '../notes/notes-shortcuts'
import styles from './ShortcutsSettings.module.css'

const isMac = (): boolean => /Mac/i.test(navigator.platform || navigator.userAgent)

/** The short groups first, then the ones each module contributes; the long editor list comes last. */
function shortcutGroups(): ShortcutGroup[] {
  return [GENERAL_SHORTCUTS, LIST_SHORTCUTS, ...moduleShortcutGroups(), NOTES_EDITOR_SHORTCUTS]
}

function Keys({ shortcut, mac }: { shortcut: Shortcut; mac: boolean }): React.JSX.Element {
  return (
    <>
      {shortcut.keys.map((chord, i) => (
        <Fragment key={chord}>
          {i > 0 && <span className={styles.or}>or</span>}
          <span className={styles.chord}>
            {formatChord(chord, mac).map((part, j) => (
              <kbd key={j} className={styles.key}>
                {part}
              </kbd>
            ))}
          </span>
        </Fragment>
      ))}
    </>
  )
}

/** Every keyboard shortcut in the app. Modules add theirs through their manifest (`shortcuts`). */
export function ShortcutsSettings(): React.JSX.Element {
  const mac = isMac()
  return (
    <section className={styles.card} aria-labelledby="shortcuts-title">
      <h2 id="shortcuts-title" className={styles.title}>
        Keyboard shortcuts
      </h2>
      <p className={styles.help}>
        {mac ? 'Shown for a Mac.' : 'Shown for Windows and Linux.'} The notes editor’s shortcuts
        work in Readings notes and in meeting notes.
      </p>
      {shortcutGroups().map((group) => (
        <div key={group.title} className={styles.group}>
          <h3 className={styles.groupTitle}>{group.title}</h3>
          <dl className={styles.list}>
            {group.shortcuts.map((shortcut) => (
              <div key={shortcut.action} className={styles.row}>
                <dt className={styles.action}>
                  {shortcut.action}
                  {shortcut.note && <span className={styles.note}>{shortcut.note}</span>}
                </dt>
                <dd className={styles.keys}>
                  <Keys shortcut={shortcut} mac={mac} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </section>
  )
}
