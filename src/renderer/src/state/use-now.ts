import { useEffect, useState } from 'react'
import { trackingMoment } from '@shared/time'
import type { Moment } from '@shared/tracking/types'

/**
 * The tracking day's date and time (the day ends at 04:00; see `trackingMoment`), kept current: every second while `ticking` (a timer runs), else every 30 seconds so a
 * page left open still notices midnight.
 */
export function useNow(ticking: boolean): Moment {
  const [now, setNow] = useState(() => trackingMoment())
  useEffect(() => {
    const id = setInterval(() => setNow(trackingMoment()), ticking ? 1000 : 30_000)
    return () => clearInterval(id)
  }, [ticking])
  return now
}
