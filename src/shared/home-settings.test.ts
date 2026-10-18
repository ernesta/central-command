import { describe, expect, it } from 'vitest'
import { DEFAULT_HOME_SETTINGS, applyHomePatch, normaliseHome } from './home-settings'

describe('normaliseHome', () => {
  it('is all off by default', () => {
    const h = normaliseHome(undefined)
    expect(h).toEqual(DEFAULT_HOME_SETTINGS)
    expect([h.weather.enabled, h.notifications.enabled, h.widget.enabled]).toEqual([
      false,
      false,
      false
    ])
  })

  it('drops the place and unit an older settings file kept: they come from the Mac now', () => {
    const w = normaliseHome({
      weather: {
        enabled: true,
        place: 'Egham',
        latitude: 51.4,
        longitude: -0.5,
        unit: 'fahrenheit'
      }
    }).weather
    expect(w).toEqual({ enabled: true })
  })

  it('drops impossible values', () => {
    const h = normaliseHome({
      weather: { enabled: 'yes' },
      notifications: {
        digestAt: '25:99',
        meetingMinutesBefore: -5,
        timerRunningHours: 2.5,
        watchDeadlineDays: 'x'
      }
    })
    expect(h.weather).toEqual({ enabled: false })
    expect(h.notifications).toMatchObject({
      digestAt: '08:30',
      meetingMinutesBefore: 10,
      timerRunningHours: 0,
      watchDeadlineDays: 7
    })
  })

  it('lets the digest be turned off with an empty time', () => {
    expect(normaliseHome({ notifications: { digestAt: '' } }).notifications.digestAt).toBe('')
  })
})

describe('applyHomePatch', () => {
  it('changes one flag and keeps the rest', () => {
    const next = applyHomePatch(DEFAULT_HOME_SETTINGS, {
      notifications: { enabled: true, digestAt: '09:00' }
    })
    expect(next.notifications).toMatchObject({
      enabled: true,
      digestAt: '09:00',
      meetingMinutesBefore: 10
    })
    expect(next.weather).toEqual(DEFAULT_HOME_SETTINGS.weather)
  })

  it('returns the settings unchanged for no patch', () => {
    expect(applyHomePatch(DEFAULT_HOME_SETTINGS, undefined)).toBe(DEFAULT_HOME_SETTINGS)
  })
})
