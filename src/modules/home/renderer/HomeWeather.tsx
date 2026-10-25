import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun
} from 'lucide-react'
import { Tooltip } from '@renderer/components/Tooltip'
import { weatherIcon, weatherLine, type WeatherIcon } from './weather-model'
import { useWeather } from './useWeather'
import styles from './Home.module.css'

const ICONS = {
  sun: Sun,
  'cloud-sun': CloudSun,
  cloud: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning
} satisfies Record<WeatherIcon, unknown>

/** The weather beside the date in a workspace's heading; nothing at all until it is turned on in Settings. */
export function HomeWeather(): React.JSX.Element | null {
  const weather = useWeather()
  if (!weather) return null
  const Icon = ICONS[weatherIcon(weather.now.code)]
  const { temperature, text } = weatherLine(weather)
  return (
    <Tooltip text={`Feels like ${weather.now.feelsLike}°`}>
      <span className={styles.weather}>
        <span aria-hidden>·</span>
        <Icon className={styles.weatherIcon} size={16} strokeWidth={1.75} aria-hidden />
        <span className={styles.temperature}>{temperature}</span>
        <span>{text}</span>
      </span>
    </Tooltip>
  )
}
