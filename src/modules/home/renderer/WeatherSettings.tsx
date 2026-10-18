import { useState } from 'react'
import { Segmented } from '@renderer/components/Segmented'
import { useSettings } from '@renderer/state/settings-context'
import type { WeatherAccess } from '../shared/types'
import styles from './WeatherSettings.module.css'

const CHOICES = [
  { value: 'off', label: 'Off' },
  { value: 'on', label: 'On' }
] as const

const PROBLEMS: Record<Exclude<WeatherAccess, 'ok'>, string> = {
  denied:
    'Central Command may not use your location. Allow it in System Settings → Privacy & Security → Location Services.',
  unavailable: 'Couldn’t find where this Mac is.'
}

/**
 * Settings → Weather: one switch. The place is where this Mac is (Location Services, which asks once) and the unit is the
 * one the Mac uses; only the town's rounded position is sent to open-meteo.com.
 */
export function WeatherSettings(): React.JSX.Element {
  const { settings, update } = useSettings()
  const enabled = settings.home.weather.enabled
  const [problem, setProblem] = useState<WeatherAccess | null>(null)

  const choose = async (value: 'off' | 'on'): Promise<void> => {
    if (value === 'off') {
      setProblem(null)
      await update({ home: { weather: { enabled: false } } })
      return
    }
    await update({ home: { weather: { enabled: true } } })
    setProblem(await window.api.home.locate())
  }

  return (
    <section className={styles.section} aria-labelledby="weather-settings">
      <h2 id="weather-settings" className={styles.heading}>
        Weather
      </h2>
      <div className={styles.field}>
        <span className={styles.label}>Show the weather beside the date</span>
        <p className={styles.help}>
          Where this Mac is, in the unit it uses. Only the town’s rounded position is sent to
          open-meteo.com. Off until you turn it on.
        </p>
        <div>
          <Segmented
            label="Weather"
            value={enabled ? 'on' : 'off'}
            options={CHOICES}
            onChange={(value) => void choose(value)}
          />
        </div>
        {enabled && problem && problem !== 'ok' && (
          <p role="status" className={styles.help}>
            {PROBLEMS[problem]}
          </p>
        )}
      </div>
    </section>
  )
}
