import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Layout cannot be measured under jsdom, so this guards how the Hours rows get theirs: the lead icon, the name and the
 * time sit at the same x in Today and a week's day, for a task, a meeting or a training, and the Add row and the forms
 * start at the rows' content edge, only while every one of them takes its grid and inset from `TaskList.module.css`
 * (one `--hours-pad`) and its control height from `HoursForm.module.css`. The measured version is the one in
 * `docs/POLISH_ROUND_3_PLAN.md`, step 6 (lead 101, name 131, time 546 in a 590px card).
 */
const dir = __dirname
const read = (file: string): string => readFileSync(join(dir, file), 'utf8')
const rule = (css: string, selector: string): string => {
  const at = css.indexOf(`${selector} {`)
  if (at < 0) return ''
  return css.slice(at, css.indexOf('}', at))
}

describe('Hours rows share one grid', () => {
  const tasks = read('TaskList.module.css')

  it('takes the row inset from the card padding, once', () => {
    expect(rule(tasks, '.row')).toContain('padding: 10px calc(var(--hours-pad) + 12px)')
    expect(rule(tasks, '.list')).toContain('margin-inline: calc(var(--hours-pad) * -1)')
    expect(rule(tasks, '.row')).toContain('grid-template-columns: 32px minmax(0, 1fr) auto')
  })

  it('has the card and a day detail pad by the same value', () => {
    expect(read('TodayCard.module.css')).toContain('padding: 20px var(--hours-pad)')
    expect(rule(read('WeekCard.module.css'), '.detail td')).toContain('var(--hours-pad)')
  })

  it('draws meetings and trainings with the task rows own classes, and none of its own', () => {
    const tsx = read('MeetingRows.tsx')
    for (const name of ['row', 'lead', 'end', 'time', 'delete']) {
      expect(tsx).toContain(`listStyles.${name}`)
    }
    const css = read('MeetingRows.module.css')
    for (const selector of ['.row', '.time', '.end', '.lead']) {
      expect(css).not.toMatch(new RegExp(`${selector.replace('.', '\\.')}\\s*[,{]`))
    }
    expect(css).not.toMatch(/padding(-inline)?:\s*[^;]*\d+px[^;]*\d+px/)
  })

  it('puts the Add row on the rows inset and gives the forms one module', () => {
    expect(rule(read('AddTime.module.css'), '.quiet')).toContain('padding: 7px 12px')
    expect(read('AddTime.tsx')).toContain('formStyles.form')
    expect(read('TodayCard.tsx')).toContain('formStyles.form')
    expect(read('AddTime.module.css')).not.toContain('.form')
    expect(read('TodayCard.module.css')).not.toContain('.start')
  })

  it('gives the form controls one height and one alignment', () => {
    const form = read('HoursForm.module.css')
    expect(rule(form, '.form')).toContain('--field-h: var(--hours-control-h)')
    expect(rule(form, '.form')).toContain('align-items: center')
    expect(rule(form, '.form')).toContain('padding-inline: 12px')
    expect(rule(form, '.form > button')).toContain('height: var(--field-h)')
    expect(rule(read('TaskPicker.module.css'), '.input')).toContain('height: var(--field-h, auto)')
    expect(rule(read('DurationField.module.css'), '.field')).toContain(
      'height: var(--field-h, 32px)'
    )
  })
})
