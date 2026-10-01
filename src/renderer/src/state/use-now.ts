import { useEffect, useState } from 'react'
import { nowMoment } from '@shared/time'
import type { Moment } from '@shared/tracking/types'

/**
 * The local date and time, kept current: every second while `ticking` (a timer runs), else every 30 seconds so a
 * page left open still notices midnight.
 */
export function useNow(ticking: boolean): Moment {
  const [now, setNow] = useState(() => nowMoment())
  useEffect(() => {
    const id = setInterval(() => setNow(nowMoment()), ticking ? 1000 : 30_000)
    return () => clearInterval(id)
  }, [ticking])
  return now
}
