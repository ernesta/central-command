import styles from './GroupRow.module.css'

/** A header row between groups of rows in a table ("Upcoming", "Earlier"): not a keyboard row, read as a row group. */
export function GroupRow({
  label,
  colSpan
}: {
  label: string
  colSpan: number
}): React.JSX.Element {
  return (
    <tr>
      <th scope="rowgroup" colSpan={colSpan} className={styles.cell}>
        {label}
      </th>
    </tr>
  )
}
