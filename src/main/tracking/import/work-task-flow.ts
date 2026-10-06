/**
 * Spread entries over tasks in 15-minute units so that as much as possible of both sides is accounted for, preferring pairs
 * whose words and dates fit. It handles what exact sets cannot: one entry feeding several tasks, and several entries added
 * together across tasks. A minimum-cost flow: entries supply, tasks demand, and a unit is left out rather than placed at a
 * poor fit. Pure.
 */
import { dayNumber, makeSimilarity, type LinkEntry, type LinkTask } from './work-task-links'

export interface Allocation {
  entry: LinkEntry
  task: LinkTask
  minutes: number
}

const UNIT = 15
const MIN_SIMILARITY = 0.25
// Placing a unit costs at most this much; a worse fit stays unplaced (both sides together would cost twice the leave-out price).
const LEAVE_OUT = 30

interface Edge {
  to: number
  cap: number
  cost: number
}

/** Cost of a pair, or null when they cannot belong together: too different, or the entry is far from the due date. */
function pairCost(sim: number, gap: number): number | null {
  // Task dates are moved to the hours later, so an entry may follow its task's due date by weeks (a small cost per day).
  if (sim < MIN_SIMILARITY || gap < -45 || gap > 75) return null
  return Math.round(((1 - sim) * 10 + Math.max(gap, 0) * 0.08 + Math.max(-gap, 0) * 0.1) * 100)
}

export function allocateByFlow(
  tasks: readonly LinkTask[],
  entries: readonly LinkEntry[]
): Allocation[] {
  const similarity = makeSimilarity([...entries.map((e) => e.label), ...tasks.map((t) => t.title)])
  const source = 0
  const sink = 1
  const node = (kind: 'e' | 't', i: number): number => 2 + (kind === 'e' ? i : entries.length + i)
  const graph: Edge[][] = Array.from({ length: 2 + entries.length + tasks.length }, () => [])
  const edges: Edge[] = []
  const add = (from: number, to: number, cap: number, cost: number): number => {
    const forward = { to, cap, cost }
    const back = { to: from, cap: 0, cost: -cost }
    graph[from].push(forward)
    graph[to].push(back)
    edges.push(forward, back)
    return edges.length - 2
  }
  entries.forEach((e, i) => add(source, node('e', i), Math.floor(e.minutes / UNIT), 0))
  tasks.forEach((t, j) => add(node('t', j), sink, Math.floor(t.minutes / UNIT), 0))
  const pairs: { i: number; j: number; edge: number }[] = []
  entries.forEach((e, i) =>
    tasks.forEach((t, j) => {
      const cost = pairCost(similarity(t.title, e.label), dayNumber(t.date) - dayNumber(e.date))
      if (cost !== null)
        pairs.push({ i, j, edge: add(node('e', i), node('t', j), 1_000_000, cost) })
    })
  )

  // Successive shortest paths (queue-based Bellman-Ford), stopping when a path costs more than leaving both ends out.
  for (;;) {
    const dist = new Array<number>(graph.length).fill(Infinity)
    const via = new Array<{ from: number; index: number } | null>(graph.length).fill(null)
    const queued = new Array<boolean>(graph.length).fill(false)
    dist[source] = 0
    const queue = [source]
    while (queue.length > 0) {
      const u = queue.shift() as number
      queued[u] = false
      graph[u].forEach((edge, index) => {
        if (edge.cap > 0 && dist[u] + edge.cost < dist[edge.to]) {
          dist[edge.to] = dist[u] + edge.cost
          via[edge.to] = { from: u, index }
          if (!queued[edge.to]) {
            queued[edge.to] = true
            queue.push(edge.to)
          }
        }
      })
    }
    if (dist[sink] === Infinity || dist[sink] >= 2 * LEAVE_OUT * 100) break
    let push = Infinity
    for (let v = sink; v !== source;) {
      const step = via[v] as { from: number; index: number }
      push = Math.min(push, graph[step.from][step.index].cap)
      v = step.from
    }
    for (let v = sink; v !== source;) {
      const step = via[v] as { from: number; index: number }
      const edge = graph[step.from][step.index]
      edge.cap -= push
      const back = graph[edge.to].find((b) => b.to === step.from && b.cost === -edge.cost) as Edge
      back.cap += push
      v = step.from
    }
  }

  return pairs.flatMap(({ i, j, edge }) => {
    const units = edges[edge + 1].cap
    return units > 0 ? [{ entry: entries[i], task: tasks[j], minutes: units * UNIT }] : []
  })
}
