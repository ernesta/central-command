import { describe, expect, it } from 'vitest'
import { DEFAULT_HOME_SETTINGS, applyHomePatch, normaliseHome } from './home-settings'

describe('normaliseHome', () => {
  it('is all off by default, with nothing located', () => {
    const h = normaliseHome(undefined)
    expect(h).toEqual(DEFAULT_HOME_SETTINGS)
    expect([h.weather.enabled, h.notifications.enabled, h.widget.enabled]).toEqual([
      false,
      false,
      false
    ])
  })

  it('keeps weather off without a place, whatever the file says', () => {
    expect(normaliseHome({ weather: { enabled: true } }).weather.enabled).toBe(false)
    expect(normaliseHome({ weather: { enabled: true, latitude: 51.4 } }).weather.enabled).toBe(
      false
    )
    expect(
      normaliseHome({ weather: { enabled: true, latitude: 51.43, longitude: -0.55 } }).weather
    ).toMatchObject({
      enabled: true,
      latitude: 51.4,
      longitude: -0.5
    })
  })

  it('rounds coordinates to a town, never a street', () => {
    const w = normaliseHome({ weather: { latitude: 51.4312345, longitude: -0.5598765 } }).weather
    expect([w.latitude, w.longitude]).toEqual([51.4, -0.6])
  })

  it('drops impossible values', () => {
    const h = normaliseHome({
      weather: { latitude: 200, longitude: 0, unit: 'kelvin', place: 7 },
      notifications: {
        digestAt: '25:99',
        meetingMinutesBefore: -5,
        timerRunningHours: 2.5,
        watchDeadlineDays: 'x'
      }
    })
    expect(h.weather).toMatchObject({ latitude: null, unit: 'celsius', place: '' })
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
