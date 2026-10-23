import { Link } from 'react-router'
import { Check, GraduationCap, Plane, Users } from 'lucide-react'
import { Panel } from '@renderer/components/Panel'
import { PriorityBadge } from '../../tasks/renderer/TaskIcons'
import { taskLine } from '../../tasks/shared/query'
import { tasksAllRoute } from '../../tasks/renderer/tasks-paths'
import type { HomeEvent, HomeTask, HomeWorkspace } from '../shared/types'
import { COMING_UP_DAYS, detailText, homeView, whenLabel, type HomeView } from './home-model'
import { HomeHours } from './HomeHours'
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

function TaskRow({ task }: { task: HomeTask }): React.JSX.Element {
  return (
    <li>
      <Link className={styles.row} to={task.route}>
        <StatusButton uid={task.uid} status={task.status} />
        <span className={styles.grow}>
          <span className={styles.title}>{task.title}</span>
          {task.list && <span className={styles.small}>{task.list}</span>}
        </span>
        {task.daysLate > 0 && (
          <span className={`${styles.chip} ${styles.warn}`}>
            {task.daysLate === 1 ? '1 day late' : `${task.daysLate} days late`}
          </span>
        )}
        <PriorityBadge priority={task.priority} />
      </Link>
    </li>
  )
}

function TodayCard({
  view,
  workspace
}: {
  view: HomeView
  workspace: HomeWorkspace
}): React.JSX.Element {
  const { overdue, today, cut } = view.tasks
  const rows = [...overdue, ...today]
  const count =
    rows.length === 0
      ? 'Clear'
      : [
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
          {(cut || rows.length > 0) && (
            <StyledLink to={tasksAllRoute(workspace)}>See all</StyledLink>
          )}
        </span>
      }
    >
      {rows.length === 0 ? (
        <None>Nothing due today.</None>
      ) : (
        <ul className={styles.list}>
          {rows.map((t) => (
            <TaskRow key={t.uid} task={t} />
          ))}
        </ul>
      )}
    </Panel>
  )
}

function EventRow({ event }: { event: HomeEvent }): React.JSX.Element {
  const { task } = event
  const Icon = KIND_ICON[event.kind as keyof typeof KIND_ICON] ?? Check
  const when = whenLabel(event.inDays, event.time)
  return (
    <li>
      <Link className={styles.row} to={event.route}>
        {task ? (
          <StatusButton uid={task.uid} status={task.status} />
        ) : (
          <Icon size={16} strokeWidth={1.75} className={styles.icon} aria-hidden />
        )}
        <span className={styles.grow}>
          <span className={styles.title}>{event.title}</span>
          {task ? (
            <span className={styles.small}>
              {taskLine(event.detail, `due ${when.toLowerCase()}`)}
            </span>
          ) : (
            event.detail && <span className={styles.small}>{detailText(event.detail)}</span>
          )}
        </span>
        {task ? (
          <PriorityBadge priority={task.priority} />
        ) : (
          <span className={styles.when}>{when}</span>
        )}
      </Link>
    </li>
  )
}

function ComingUpCard({ view }: { view: HomeView }): React.JSX.Element {
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
            <EventRow key={e.id} event={e} />
          ))}
        </ul>
      )}
    </Panel>
  )
}

/** What a workspace opens on: today's tasks, what is dated in the next 7 days, and the hours so far. */
export function HomePage({ workspace }: { workspace: HomeWorkspace }): React.JSX.Element | null {
  const summary = useHomeSummary()
  if (!summary) return null
  const view = homeView(summary, workspace)
  return (
    <section className={styles.home} aria-label="Home">
      <div className={styles.cols}>
        <div className={styles.stack}>
          <TodayCard view={view} workspace={workspace} />
          <ComingUpCard view={view} />
        </div>
        <div className={styles.stack}>
          <HomeHours workspace={workspace} />
        </div>
      </div>
    </section>
  )
}
