import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import type { Backlink, EntityKind } from '@shared/entities'
import { sourceTarget } from './source-routes'
import styles from './MentionedIn.module.css'

/**
 * Where something is mentioned: the notes, meetings and other pages that link to it with `@`, each with the line the
 * mention is on. Nothing is shown until there is at least one. `entityKey` is null while the key is not known
 * (a note or meeting that nothing has linked to yet has no `uid`, so nothing mentions it).
 */
export function MentionedIn({
  kind,
  entityKey,
  exclude
}: {
  kind: EntityKind
  entityKey: string | null
  /** A page mentioning itself is not worth listing (a note that links to its own heading, say). */
  exclude?: { kind: Backlink['source']['kind']; workspace: string; id: string }
}): React.JSX.Element | null {
  const [found, setFound] = useState<{ key: string; links: Backlink[] } | null>(null)

  useEffect(() => {
    if (!entityKey) return
    let cancelled = false
    void window.api.entities
      .backlinks({ kind, key: entityKey })
      .then((links) => {
        if (!cancelled) setFound({ key: entityKey, links })
      })
      .catch((error: unknown) => console.error('Could not look up the mentions:', error))
    return () => {
      cancelled = true
    }
  }, [kind, entityKey])

  const links = (found?.key === entityKey ? found.links : []).filter(
    (l) =>
      !(
        exclude &&
        l.source.kind === exclude.kind &&
        l.source.workspace === exclude.workspace &&
        l.source.id === exclude.id
      )
  )
  if (links.length === 0) return null
  return (
    <section className={styles.panel} aria-label="Mentioned in">
      <h2 className={styles.label}>Mentioned in</h2>
      <ul className={styles.list}>
        {links.map((link) => {
          const { route, icon: Icon } = sourceTarget(link.source)
          return (
            <li key={`${link.source.kind}/${link.source.workspace}/${link.source.id}`}>
              <Link className={styles.row} to={route}>
                <Icon className={styles.icon} size={14} strokeWidth={1.75} aria-hidden />
                <span className={styles.title}>{link.title}</span>
                {link.context && <span className={styles.context}>{link.context}</span>}
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
