import { describe, expect, it } from 'vitest'
import { personChange } from '@shared/people-rewrite'
import { rewriteTrainingPeople } from './people-rewrite'

const ENTRY = `---
date: 2026-01-28
title: Statistics with Kathy Rastle
leads: [Kathy Rastle, Robyn Muir]
institution: Kathy Rastle Institute
---

## Summary

Kathy Rastle taught it. TODO(KR): a note about it.
`

describe('rewriteTrainingPeople', () => {
  it('changes the lead by exact name and touches nothing else', () => {
    const out = rewriteTrainingPeople(
      ENTRY,
      personChange(
        { name: 'Kathy Rastle', initials: 'KR' },
        { name: 'Katherine Rastle', initials: 'KRa' }
      )
    )
    expect(out).toBe(ENTRY.replace('leads: [Kathy Rastle,', 'leads: [Katherine Rastle,'))
  })

  it('leaves the entry alone when only initials change, or nobody matches', () => {
    const initialsOnly = personChange(
      { name: 'Kathy Rastle', initials: 'KR' },
      { name: 'Kathy Rastle', initials: 'KRa' }
    )
    expect(rewriteTrainingPeople(ENTRY, initialsOnly)).toBe(ENTRY)
    const other = personChange({ name: 'X Y', initials: 'XY' }, { name: 'Z Y', initials: 'ZY' })
    expect(rewriteTrainingPeople(ENTRY, other)).toBe(ENTRY)
  })

  it('keeps a lead once when merged into someone already listed', () => {
    const out = rewriteTrainingPeople(
      ENTRY,
      personChange({ name: 'Robyn Muir', initials: 'RM' }, { name: 'Kathy Rastle', initials: 'KR' })
    )
    expect(out).toContain('leads: [Kathy Rastle]')
  })
})
