import { useToday } from '@renderer/state/use-today'
import { Link } from 'react-router'
import { Bookmark, Check, GraduationCap, Plane, Users } from 'lucide-react'
import { Panel } from '@renderer/components/Panel'
import { Tooltip } from '@renderer/components/Tooltip'
import { LateChip } from '../../tasks/renderer/LateChip'
import { PriorityBadge } from '../../tasks/renderer/TaskIcons'
import { StudyIcon } from '../../tasks/renderer/TaskName'
import { SubtaskLine } from '../../tasks/renderer/SubtaskLine'
import { lineDue } from '../../tasks/shared/query'
import { tasksAllRoute, tasksBase } from '../../tasks/renderer/tasks-paths'
import type { HomeEvent, HomeTask, HomeWorkspace } from '../shared/types'
import {
  COMING_UP_DAYS,
  comingUpRows,
  eventDetail,
  homeView,
  isKidRow,
  todayRows,
  type HomeRow,
  whenLabel,
  type HomeView
} from './home-model'
import { SHOWN_ROWS, capRows } from '../shared/cap'
import { HomeHours } from './HomeHours'
import { usePeople } from '../../meetings/renderer/usePeople'
import { initialsFor } from '../../meetings/shared/query'
import { StatusButton } from '../../tasks/renderer/StatusButton'
import { None, StyledLink } from './HomeParts'
import { useHomeSummary } from './useHomeSummary'
import styles from './Home.module.css'

const KIND_ICON = {
  task: Check,
  meeting: Users,
  training: GraduationCap,
  'time-off': Plane,
  // A saved Watch item: the same bookmark as on the Watch page.
  deadline: Bookmark,
  event: Bookmark
} as const

/** Today's date, for the page heading ("Thursday 15 October"). */
export function HomeDate(): React.JSX.Element {
  const today = useToday()
  return (
    <span className={styles.date}>
      {new Date(`${today}T12:00`).toLocaleDateString(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      })}
    </span>
  )
}

/** The one row of Home: a leading mark, a title with a quiet line under it, and what sits at the right. */
function Row({
  to,
  lead,
  title,
  titleText,
  line,
  trailing,
  kid = false,
  end = false,
  hasKids = false
}: {
  to: string
  lead: React.ReactNode
  title: React.ReactNode
  /** The title as text, for the tooltip shown when it is cut. */
  titleText: string
  line: React.ReactNode
  trailing: React.ReactNode
  /** A subtask under its task, hung off a rail as in the Tasks table; `end` for the last one. */
  kid?: boolean
  end?: boolean
  hasKids?: boolean
}): React.JSX.Element {
  return (
    <li
      className={[hasKids && styles.hasKids, kid && styles.kid, kid && end && styles.end]
        .filter(Boolean)
        .join(' ')}
    >
      <Link className={styles.row} to={to}>
        {lead}
        <span className={styles.grow}>
          <Tooltip text={titleText} whenCut>
            <span className={styles.title}>{title}</span>
          </Tooltip>
          {line && <span className={styles.small}>{line}</span>}
        </span>
        {trailing}
      </Link>
    </li>
  )
}

function TaskRow({
  task,
  due = '',
  kid = false,
  end = false,
  hasKids = false
}: {
  task: HomeTask
  /** The date as `dueText` words it, where the row should say it. */
  due?: string
  kid?: boolean
  end?: boolean
  hasKids?: boolean
}): React.JSX.Element {
  return (
    <Row
      kid={kid}
      end={end}
      hasKids={hasKids}
      to={task.route}
      lead={<StatusButton uid={task.uid} status={task.status} />}
      titleText={task.title}
      title={
        <>
          {task.study && <StudyIcon />}
          {task.title}
        </>
      }
      line={kid ? null : <SubtaskLine parent={task.parent} list={task.list} due={due} />}
      trailing={
        <>
          <LateChip days={task.daysLate} />
          {/* A subtask shows no priority, as in the Tasks table; its space stays so the late chips line up. */}
          {task.parent === null ? (
            <PriorityBadge priority={task.priority} />
          ) : (
            <span className={styles.badgeGap} aria-hidden />
          )}
        </>
      }
    />
  )
}

/** A meeting, training or day off: its time at the right, its day ("in 2 days") at the end of the second line. */
function EventRow({
  event,
  initialsOf
}: {
  event: HomeEvent
  initialsOf: (name: string) => string | null
}): React.JSX.Element {
  const Icon = KIND_ICON[event.kind as keyof typeof KIND_ICON] ?? Check
  return (
    <Row
      to={event.route}
      titleText={event.title}
      lead={<Icon size={16} strokeWidth={1.75} className={styles.icon} aria-hidden />}
      title={event.title}
      line={eventDetail(event, initialsOf)}
      trailing={<span className={styles.when}>{whenLabel(event.time, event.end)}</span>}
    />
  )
}

/** The rows of a card: a task's subtasks hang under it (the rail ends at the last one shown). */
function Rows({
  rows,
  today,
  initialsOf
}: {
  rows: HomeRow[]
  today: string
  initialsOf: (name: string) => string | null
}): React.JSX.Element {
  return (
    <ul className={styles.list}>
      {rows.map((row, i) => {
        if (row.kind === 'event')
          return <EventRow key={row.event.id} event={row.event} initialsOf={initialsOf} />
        const next = rows[i + 1]
        const nextIsKid = next?.kind === 'task' && next.kid
        return (
          <TaskRow
            key={`${row.kid ? 'kid' : 'task'}:${row.task.uid}`}
            task={row.task}
            due={row.showDue ? lineDue(row.task, today) : ''}
            kid={row.kid}
            end={row.kid && !nextIsKid}
            hasKids={!row.kid && nextIsKid}
          />
        )
      })}
    </ul>
  )
}

/** "+22 more ·", the rows a card leaves out, in front of its "See all". */
function MoreCount({ more }: { more: number }): React.JSX.Element {
  return (
    <>
      <span className={styles.small}>+{more} more</span>
      <span className={styles.small} aria-hidden>
        ·
      </span>
    </>
  )
}

function TodayCard({
  view,
  workspace,
  initialsOf
}: {
  view: HomeView
  workspace: HomeWorkspace
  initialsOf: (name: string) => string | null
}): React.JSX.Element {
  const { overdue, today, cut } = view.tasks
  const { todayEvents } = view
  const empty = todayEvents.length + overdue.length + today.length === 0
  const { shown, more } = capRows(todayRows(view), view.tasks.hidden, SHOWN_ROWS, isKidRow)
  const count = empty
    ? 'Clear'
    : [
        todayEvents.length > 0 &&
          `${todayEvents.length} ${todayEvents.length === 1 ? 'event' : 'events'}`,
        today.length > 0 && `${today.length} due`,
        overdue.length > 0 && `${overdue.length} overdue`
      ]
        .filter(Boolean)
        .join(' · ')
  return (
    <Panel
      label="Today"
      actions={
        <span className={styles.actions}>
          {!cut && <span className={styles.small}>{count}</span>}
          {(cut || more > 0 || overdue.length + today.length > 0) && (
            <span className={styles.seeAll}>
              {more > 0 && <MoreCount more={more} />}
              <StyledLink to={tasksAllRoute(workspace, { view: 'open' })}>See all</StyledLink>
            </span>
          )}
        </span>
      }
    >
      {empty ? (
        <None>Nothing today.</None>
      ) : (
        <Rows rows={shown} today={view.today} initialsOf={initialsOf} />
      )}
    </Panel>
  )
}

function ComingUpCard({
  view,
  workspace,
  initialsOf
}: {
  view: HomeView
  workspace: HomeWorkspace
  initialsOf: (name: string) => string | null
}): React.JSX.Element {
  const { shown, more } = capRows(
    comingUpRows(view, workspace),
    view.comingUpHidden,
    SHOWN_ROWS,
    isKidRow
  )
  return (
    <Panel
      label="Coming up"
      heading={
        <span className={styles.subHeading}>
          Coming up
          <span className={styles.subLabel} aria-hidden>
            ·
          </span>
          <span className={styles.subLabel}>next {COMING_UP_DAYS} days</span>
        </span>
      }
      actions={
        shown.length > 0 && (
          <span className={styles.seeAll}>
            {more > 0 && <MoreCount more={more} />}
            <StyledLink to={tasksBase(workspace)}>See all</StyledLink>
          </span>
        )
      }
    >
      {shown.length === 0 ? (
        <None>Nothing in the next {COMING_UP_DAYS} days.</None>
      ) : (
        <Rows rows={shown} today={view.today} initialsOf={initialsOf} />
      )}
    </Panel>
  )
}

/** What a workspace opens on: today's tasks, what is dated in the next 3 days, and the hours so far. */
export function HomePage({ workspace }: { workspace: HomeWorkspace }): React.JSX.Element | null {
  const summary = useHomeSummary()
  const { people } = usePeople()
  if (!summary) return null
  // Initials as the Meetings table shows them; the user themselves is left out ("with" is the others).
  const initialsOf = (name: string): string | null =>
    people?.find((p) => p.me && p.name === name) ? null : initialsFor(name, people ?? [])
  const view = homeView(summary, workspace)
  return (
    <section className={styles.home} aria-label="Home">
      <div className={styles.cols}>
        <div className={styles.stack}>
          <TodayCard view={view} workspace={workspace} initialsOf={initialsOf} />
          <ComingUpCard view={view} workspace={workspace} initialsOf={initialsOf} />
        </div>
        <div className={styles.stack}>
          <HomeHours workspace={workspace} />
        </div>
      </div>
    </section>
  )
}
