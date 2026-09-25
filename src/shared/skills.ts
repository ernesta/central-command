/**
 * The skills an activity can build, as they appear in the user's Inkpath log. The app shows them in
 * sentence case; `inkpath` is the original spelling, kept so an import can match it and an export can
 * restore it. The tag says which group a skill belongs to (GS General Skills, RP Research in
 * Practice, SS Specialist Skills); it also tells apart skills with the same name.
 */
export interface Skill {
  name: string
  inkpath: string
  tag: 'GS' | 'RP' | 'SS'
}

const skill = (base: string, tag: Skill['tag'], inkpathBase = base): Skill => ({
  name: `${base[0].toUpperCase()}${base.slice(1).toLowerCase()} (${tag})`,
  inkpath: `${inkpathBase} (${tag})`,
  tag
})

export const SKILLS: readonly Skill[] = [
  skill('Quantitative skills', 'GS', 'Quantitative Skills'),
  skill('Quantitative skills', 'SS', 'Quantitative Skills'),
  skill('Qualitative skills', 'GS', 'Qualitative Skills'),
  skill('Qualitative skills', 'SS', 'Qualitative Skills'),
  skill('Data management and analysis', 'GS', 'Data Management and analysis'),
  skill('Digital and bibliographic skills', 'GS'),
  skill('Ethical and legal issues', 'GS'),
  skill('Impact of research', 'GS', 'Impact of Research'),
  skill('Intellectual property rights', 'GS', 'Intellectual Property Rights'),
  skill('Language skills', 'GS', 'Language Skills'),
  skill('Project management', 'GS'),
  skill('Career development', 'RP', 'Career Development'),
  skill('Personal development', 'RP', 'Personal Development'),
  skill('Stress management', 'RP', 'Stress Management'),
  skill('Cultural understanding', 'RP', 'Cultural Understanding'),
  skill('Impact', 'RP'),
  skill('Leadership', 'RP'),
  skill('Negotiations', 'RP'),
  skill('Networking', 'RP')
]

export const SKILL_TAG_LABELS: Record<Skill['tag'], string> = {
  GS: 'General Skills',
  RP: 'Research in Practice',
  SS: 'Specialist Skills'
}

/** An entry carries at most this many skills. */
export const MAX_SKILLS = 3

export const SKILL_NAMES: readonly string[] = SKILLS.map((s) => s.name)

/** The app's skill for a name as the app or Inkpath spells it (case-insensitive); null if unknown. */
export function findSkill(name: string): Skill | null {
  const key = name.trim().toLowerCase()
  return SKILLS.find((s) => s.name.toLowerCase() === key || s.inkpath.toLowerCase() === key) ?? null
}

/** Whole and part hours as "1.5 h" or "12 h"; no more than one decimal. */
export function formatHours(totalMinutes: number): string {
  const hours = Math.round((totalMinutes / 60) * 10) / 10
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} h`
}

/**
 * Minutes per skill. Each entry counts fully towards each of its skills, so the sum can be more than
 * the total. Largest first, then by name; entries without minutes add nothing.
 */
export function minutesPerSkill(
  entries: readonly { skills: readonly string[]; minutes: number | null }[]
): { skill: string; minutes: number }[] {
  const totals = new Map<string, number>()
  for (const e of entries) {
    if (!e.minutes) continue
    for (const s of new Set(e.skills)) totals.set(s, (totals.get(s) ?? 0) + e.minutes)
  }
  return [...totals]
    .map(([skill, minutes]) => ({ skill, minutes }))
    .sort((a, b) => b.minutes - a.minutes || a.skill.localeCompare(b.skill))
}
