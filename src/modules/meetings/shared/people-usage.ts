import type { Person } from '@shared/people'

/** How many notes mention a person: meetings (as an attendee or a TODO owner) and trainings (as a lead). */
export interface PersonUsage {
  name: string
  meetings: number
  trainings: number
  /** Meetings that name them as an attendee (a new name changes these). */
  attended: number
  /** TODOs they own, and the meetings those are in (new initials change these). */
  todos: number
  todoMeetings: number
}

interface MeetingLike {
  attendees: readonly string[]
  todos: readonly { owners: readonly string[] }[]
}

interface TrainingLike {
  leads: readonly string[]
}

/** The usage of everyone in `people`, in the same order, worked out from the indexed notes. */
export function personUsage(
  people: readonly Person[],
  meetings: readonly MeetingLike[],
  trainings: readonly TrainingLike[]
): PersonUsage[] {
  return people.map((person) => {
    const initials = person.initials.toUpperCase()
    const owned = (m: MeetingLike): number =>
      m.todos.filter((t) => t.owners.includes(initials)).length
    const attended = meetings.filter((m) => m.attendees.includes(person.name)).length
    return {
      name: person.name,
      meetings: meetings.filter((m) => m.attendees.includes(person.name) || owned(m) > 0).length,
      trainings: trainings.filter((t) => t.leads.includes(person.name)).length,
      attended,
      todos: meetings.reduce((sum, m) => sum + owned(m), 0),
      todoMeetings: meetings.filter((m) => owned(m) > 0).length
    }
  })
}
