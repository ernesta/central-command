import { Link } from 'react-router'
import { Check, GraduationCap, Plane, Users } from 'lucide-react'
import { addDays } from '@shared/year'
import { Panel } from '@renderer/components/Panel'
import { Tooltip } from '@renderer/components/Tooltip'
import { LateChip } from '../../tasks/renderer/LateChip'
import { PriorityBadge } from '../../tasks/renderer/TaskIcons'
import { StudyIcon } from '../../tasks/renderer/TaskName'
import { SubtaskLine } from '../../tasks/renderer/SubtaskLine'
import { dueText } from '../../tasks/shared/query'
import { tasksAllRoute } from '../../tasks/renderer/tasks-paths'
import type { HomeEvent, HomeTask, HomeWorkspace } from '../shared/types'
import {
  COMING_UP_DAYS,
  eventDetail,
  groupTasks,
  homeView,
  type TaskGroup,
  whenLabel,
  type HomeView
} from './home-model'
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
  'time-off': Plane
} as const

/** Today's date, for the page heading ("Thursday 15 October"). */
export function HomeDate(): React.JSX.Element {
  return (
    <span className={styles.date}>
      {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
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
  kid = false,
  end = false,
  hasKids = false
}: {
  task: HomeTask
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
      line={kid ? null : <SubtaskLine parent={task.parent} list={task.list} />}
      trailing={
        <>
          <LateChip days={task.daysLate} />
          <PriorityBadge priority={task.priority} />
        </>
      }
    />
  )
}

function EventRow({
  event,
  initialsOf,
  showDue = false
}: {
  event: HomeEvent
  initialsOf: (name: string) => string | null
  /** Coming up names the date of a task's event; Today's section already says it. */
  showDue?: boolean
}): React.JSX.Element {
  const { task } = event
  const Icon = KIND_ICON[event.kind as keyof typeof KIND_ICON] ?? Check
  const when = whenLabel(event.inDays, event.time, event.end)
  return (
    <Row
      to={event.route}
      titleText={event.title}
      lead={
        task ? (
          <StatusButton uid={task.uid} status={task.status} locked />
        ) : (
          <Icon size={16} strokeWidth={1.75} className={styles.icon} aria-hidden />
        )
      }
      title={
        <>
          {task?.study && <StudyIcon />}
          {event.title}
        </>
      }
      line={
        task ? (
          <SubtaskLine
            parent={task.parent}
            list={event.detail}
            due={showDue && dueText(event.date, addDays(event.date, -event.inDays))}
          />
        ) : (
          eventDetail(event, initialsOf)
        )
      }
      trailing={
        task ? (
          <PriorityBadge priority={task.priority} />
        ) : (
          <span className={styles.when}>{when}</span>
        )
      }
    />
  )
}

/** A task with its due subtasks hung under it, as in the Tasks table; a parent that is not due is its own row all the same. */
function TaskGroupRows({ group }: { group: TaskGroup }): React.JSX.Element {
  const { head, context, kids } = group
  const parent = head ?? context
  return (
    <>
      {parent && <TaskRow task={parent} hasKids={kids.length > 0} />}
      {kids.map((k, i) => (
        <TaskRow key={k.uid} task={k} kid end={i === kids.length - 1} />
      ))}
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
          {(cut || overdue.length + today.length > 0) && (
            <StyledLink to={tasksAllRoute(workspace, { view: 'open' })}>See all</StyledLink>
          )}
        </span>
      }
    >
      {empty ? (
        <None>Nothing today.</None>
      ) : (
        <ul className={styles.list}>
          {todayEvents.map((e) => (
            <EventRow key={e.id} event={e} initialsOf={initialsOf} />
          ))}
          {groupTasks([...overdue, ...today]).map((g) => (
            <TaskGroupRows key={g.head?.uid ?? g.context?.uid} group={g} />
          ))}
        </ul>
      )}
    </Panel>
  )
}

function ComingUpCard({
  view,
  initialsOf
}: {
  view: HomeView
  initialsOf: (name: string) => string | null
}): React.JSX.Element {
  return (
    <Panel
      label="Coming up"
      actions={<span className={styles.small}>Next {COMING_UP_DAYS} days</span>}
    >
      {view.comingUp.length === 0 ? (
        <None>Nothing in the next {COMING_UP_DAYS} days.</None>
      ) : (
        <ul className={styles.list}>
          {view.comingUp.map((e) => (
            <EventRow key={e.id} event={e} initialsOf={initialsOf} showDue />
          ))}
        </ul>
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
          <ComingUpCard view={view} initialsOf={initialsOf} />
        </div>
        <div className={styles.stack}>
          <HomeHours workspace={workspace} />
        </div>
      </div>
    </section>
  )
}
