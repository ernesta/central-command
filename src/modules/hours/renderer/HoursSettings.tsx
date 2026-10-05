import { useState } from 'react'
import { Input } from '@renderer/components/Input'
import { formatHours } from '@shared/tracking/format'
import type { Plan } from '@shared/tracking/types'
import { parseAllowance, parseWeekHours, toggleWorkDay, WEEKDAYS } from '../shared/plan-settings'
import { useTrackingYear } from '@renderer/state/use-tracking-year'
import { hasContracts } from '@shared/tracking/workspace-weeks'
import { WORKSPACE_LABELS } from '@renderer/shell/workspaces'
import { HOURS_WORKSPACES, TIME_OFF_WORKSPACES, type HoursWorkspace } from '../shared/workspaces'
import { ContractFields } from './ContractFields'
import styles from './HoursSettings.module.css'

/** A field that shows what is saved until it is edited, saves a valid value on Enter or leaving it, and drops anything else. */
function PlanField({
  id,
  label,
  value,
  format,
  parse,
  onCommit
}: {
  id: string
  label: string
  value: number
  format: (value: number) => string
  parse: (text: string) => number | null
  onCommit: (value: number) => void
}): React.JSX.Element {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? format(value)
  const invalid = draft !== null && parse(draft) === null

  const commit = (): void => {
    if (draft === null) return
    const typed = parse(draft)
    setDraft(null)
    if (typed !== null && typed !== value) onCommit(typed)
  }

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <Input
        id={id}
        className={styles.input}
        inputMode="numeric"
        aria-invalid={invalid || undefined}
        value={shown}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
      />
    </div>
  )
}

/** One workspace's plan: the hours a week, the days worked and, where the workspace has time off, the days off a year. */
function PlanBlock({ workspace }: { workspace: HoursWorkspace }): React.JSX.Element {
  const { data } = useTrackingYear(workspace)
  const save = (patch: Partial<Plan>): void => {
    if (data) void window.api.tracking.setPlan(workspace, data.start, patch)
  }
  const id = `hours-${workspace}`

  return (
    <div className={styles.block} role="group" aria-labelledby={`${id}-heading`}>
      <h3 id={`${id}-heading`} className={styles.subheading}>
        {WORKSPACE_LABELS[workspace]}
      </h3>
      {hasContracts(workspace) && <ContractFields workspace={workspace} />}
      {data && (
        <>
          <PlanField
            id={`${id}-per-week`}
            label="Hours per week"
            value={data.plan.hoursPerWeek}
            format={formatHours}
            parse={parseWeekHours}
            onCommit={(hoursPerWeek) => save({ hoursPerWeek })}
          />
          {!data.plan.weekAim && (
            <div className={styles.field}>
              <span className={styles.label} id={`${id}-days-label`}>
                Days worked
              </span>
              <div role="group" aria-labelledby={`${id}-days-label`} className={styles.days}>
                {WEEKDAYS.map(({ day, label }) => {
                  const on = data.plan.workDays.includes(day)
                  const next = toggleWorkDay(data.plan.workDays, day)
                  return (
                    <button
                      key={day}
                      type="button"
                      className={styles.day}
                      aria-pressed={on}
                      disabled={next === null}
                      onClick={() => next && save({ workDays: next })}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {TIME_OFF_WORKSPACES.includes(workspace) && (
            <PlanField
              id={`${id}-days-off`}
              label="Days off a year"
              value={data.plan.allowanceDays}
              format={String}
              parse={parseAllowance}
              onCommit={(allowanceDays) => save({ allowanceDays })}
            />
          )}
        </>
      )}
    </div>
  )
}

/** Hours' settings: a plan block for every workspace that tracks hours. They are the plan of the current year (a new year starts from the previous one's). */
export function HoursSettings(): React.JSX.Element {
  return (
    <section className={styles.section} aria-labelledby="hours-settings">
      <h2 id="hours-settings" className={styles.heading}>
        Hours
      </h2>
      {HOURS_WORKSPACES.map((workspace) => (
        <PlanBlock key={workspace} workspace={workspace} />
      ))}
    </section>
  )
}
