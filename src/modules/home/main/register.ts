import { readFileSync } from 'fs'
import { join } from 'path'
import { BrowserWindow, Notification, ipcMain, net, shell } from 'electron'
import { IPC } from '@shared/api'
import { trackingMoment } from '@shared/time'
import type { AppPaths } from '../../../main/paths'
import { writeFileAtomic } from '../../../main/atomic-write'
import type { SettingsStore } from '../../../main/settings'
import type { TrackingStore } from '../../../main/tracking/store'
import { makeNetFetcher } from '../../watch/main/net-fetcher'
import { HOME_IPC, type HomeSummary, type WeatherSummary } from '../shared/types'
import type { Database } from 'better-sqlite3'
import { collectHomeSummary } from './collect'
import { Notifier, type SentStore } from './notifier'
import { WeatherService } from './weather'
import { WidgetWriter } from './widget-writer'

interface HomeContext {
  db: Database
  paths: AppPaths
  settings: SettingsStore
  tracking: TrackingStore
}

function sentStore(file: string): SentStore {
  return {
    load: () => {
      try {
        const raw = JSON.parse(readFileSync(file, 'utf8')) as {
          sent?: Record<string, string>
          since?: string
        }
        return {
          sent: raw.sent && typeof raw.sent === 'object' ? raw.sent : {},
          since: typeof raw.since === 'string' ? raw.since : null
        }
      } catch {
        return { sent: {}, since: null }
      }
    },
    // Fire and forget: a lost write costs at worst one repeated notification.
    save: (value) =>
      void writeFileAtomic(file, JSON.stringify(value, null, 2) + '\n').catch(() => undefined)
  }
}

/** Opens what a notification points at: an in-app route in the window, or a web page in the browser. */
function openRoute(route: string): void {
  if (/^https:\/\//i.test(route)) {
    void shell.openExternal(route)
    return
  }
  if (!route.startsWith('/')) return
  const window = BrowserWindow.getAllWindows()[0]
  if (!window) return
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
  window.webContents.send(IPC.appOpenRoute, route)
}

/**
 * Home's main-process half: the summary the page reads, the weather, the Mac notifications and the widget's file.
 * Weather, notifications and the widget are each off until turned on in Settings; with all three off this only
 * answers the page's questions.
 */
export function registerHome({ db, paths, settings, tracking }: HomeContext): () => void {
  const weatherService = new WeatherService(makeNetFetcher((url, init) => net.fetch(url, init)))
  const now = (): ReturnType<typeof trackingMoment> => trackingMoment()

  async function weather(): Promise<WeatherSummary | null> {
    try {
      return await weatherService.read(settings.get().home.weather)
    } catch {
      return null
    }
  }
  const build = (weatherNow: WeatherSummary | null): HomeSummary =>
    collectHomeSummary({
      db,
      tracking,
      now: now(),
      generatedAt: new Date().toISOString(),
      weather: weatherNow,
      yearStarts: settings.get().yearStarts,
      watch: true
    })

  ipcMain.handle(HOME_IPC.summary, async () => build(await weather()))
  ipcMain.handle(HOME_IPC.weather, () => weather())
  ipcMain.handle(HOME_IPC.findPlace, (_e, name: unknown) => {
    if (typeof name !== 'string') throw new Error('Invalid place')
    return weatherService.findPlace(name)
  })

  const notifier = new Notifier({
    // Notifications do not need the weather, so they never wait for it.
    summary: () => build(null),
    settings: () => settings.get().home.notifications,
    store: sentStore(join(paths.data, 'notifications-sent.json')),
    show: (n) => {
      if (!Notification.isSupported()) return
      const shown = new Notification({ title: n.title, body: n.body, silent: true })
      shown.on('click', () => openRoute(n.route))
      shown.show()
    },
    now,
    nowIso: () => new Date().toISOString()
  })
  notifier.start()

  const widget = new WidgetWriter(join(paths.data, 'widget'))
  const widgetTimer = setInterval(() => {
    if (!settings.get().home.widget.enabled) return
    void widget.write(build(null)).catch(() => undefined)
  }, 60_000)
  widgetTimer.unref()

  return () => {
    notifier.stop()
    clearInterval(widgetTimer)
  }
}
