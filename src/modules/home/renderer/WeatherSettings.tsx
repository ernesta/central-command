import { useId, useState } from 'react'
import { Button } from '@renderer/components/Button'
import { Input } from '@renderer/components/Input'
import { Segmented } from '@renderer/components/Segmented'
import { ipcErrorMessage } from '@renderer/lib/ipc-error'
import { useSettings } from '@renderer/state/settings-context'
import type { WeatherSettings as Weather } from '@shared/home-settings'
import type { PlaceCandidate } from '../shared/types'
import styles from './WeatherSettings.module.css'

const UNITS = [
  { value: 'celsius', label: '°C' },
  { value: 'fahrenheit', label: '°F' }
] as const

const candidateLabel = (c: PlaceCandidate): string =>
  [c.name, c.region, c.country].filter(Boolean).join(', ')

/**
 * Settings → Weather: off until a place is chosen. Looking a place up sends its name; the weather then sends only the
 * town's rounded position (`home-settings.ts`).
 */
export function WeatherSettings(): React.JSX.Element {
  const { settings, update } = useSettings()
  const weather = settings.home.weather
  const id = useId()
  const [name, setName] = useState(weather.place)
  const [found, setFound] = useState<PlaceCandidate[] | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const change = (patch: Partial<Weather>): void => void update({ home: { weather: patch } })

  const find = async (): Promise<void> => {
    if (!name.trim()) return
    try {
      const places = await window.api.home.findPlace(name)
      setFound(places)
      setMessage(places.length === 0 ? 'No place found.' : null)
    } catch (e) {
      setFound(null)
      setMessage(`Couldn’t look it up: ${ipcErrorMessage(e)}`)
    }
  }
  const choose = (c: PlaceCandidate): void => {
    setName(c.name)
    setFound(null)
    change({ enabled: true, place: c.name, latitude: c.latitude, longitude: c.longitude })
  }

  return (
    <section className={styles.section} aria-labelledby="weather-settings">
      <h2 id="weather-settings" className={styles.heading}>
        Weather
      </h2>
      <div className={styles.field}>
        <label htmlFor={id} className={styles.label}>
          Place
        </label>
        <p className={styles.help}>
          {weather.enabled
            ? `Shown beside the date. Only ${weather.place}’s rounded position is sent to open-meteo.com.`
            : 'Off until you choose a place. Nothing is sent before then.'}
        </p>
        <form
          className={styles.row}
          onSubmit={(e) => {
            e.preventDefault()
            void find()
          }}
        >
          <Input
            id={id}
            value={name}
            placeholder="Egham"
            onChange={(e) => setName(e.target.value)}
            className={styles.input}
          />
          <Button type="submit" disabled={!name.trim()}>
            Find
          </Button>
          {weather.enabled && <Button onClick={() => change({ enabled: false })}>Turn off</Button>}
        </form>
        {found && found.length > 0 && (
          <ul className={styles.places}>
            {found.map((c) => (
              <li key={`${c.latitude},${c.longitude}`}>
                <button type="button" className={styles.place} onClick={() => choose(c)}>
                  {candidateLabel(c)}
                </button>
              </li>
            ))}
          </ul>
        )}
        {message && (
          <p role="status" className={styles.help}>
            {message}
          </p>
        )}
      </div>
      <div className={styles.field}>
        <span className={styles.label}>Unit</span>
        <div>
          <Segmented
            label="Unit"
            value={weather.unit}
            options={UNITS}
            onChange={(unit) => change({ unit })}
          />
        </div>
      </div>
    </section>
  )
}
