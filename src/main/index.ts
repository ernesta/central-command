import { app, shell, BrowserWindow, Menu, clipboard, nativeTheme, screen } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { APP_NAME } from '@shared/app-info'
import { IPC } from '@shared/api'
import { attachCloseGuard } from './close-guard'
import { getAppPaths } from './paths'
import { SettingsStore } from './settings'
import { registerSettingsIpc } from './ipc/settings'
import { broadcastTrackingChange, registerTrackingIpc } from './ipc/tracking'
import { TrackingStore } from './tracking/store'
import { registerDialogIpc } from './ipc/dialog'
import { registerAppIpc } from './ipc/app'
import { registerBuildIpc } from './ipc/build'
import { registerEntitiesIpc } from './ipc/entities'
import { openDatabase } from './db/connection'
import { runMigrations } from './db/migrate'
import { mainModules } from '@modules/main-registry'
import { createClientTasks } from '@modules/tasks/main/client-tasks'
import { TasksStore } from '@modules/tasks/main/tasks-store'
import { TASKS_IPC, type TasksChangedEvent } from '@modules/tasks/shared/api'
import { defaultSettings } from '@shared/settings'
import { todayIso, trackingMoment } from '@shared/time'
import { buildContextMenu } from './context-menu'
import { installDockMenu } from './dock-menu'
import { isPastePlainChord } from './paste-plain'
import { restoreBounds } from './window-bounds'
import { isSafeExternalUrl } from './urls'
import icon from '../../resources/icon.png?asset'

// Named early: macOS reads this for the Dock and the top menu bar (otherwise "Electron", the binary's own name).
app.setName(APP_NAME)

let isQuitting = false

const DEFAULT_SIZE = { width: 1280, height: 820 }
const MIN_SIZE = { width: 960, height: 600 }

function createWindow(settings: SettingsStore): void {
  const mainWindow = new BrowserWindow({
    ...restoreBounds(
      settings.get().ui.window,
      screen.getAllDisplays().map((d) => d.workArea),
      DEFAULT_SIZE,
      MIN_SIZE
    ),
    minWidth: MIN_SIZE.width,
    minHeight: MIN_SIZE.height,
    show: false,
    title: APP_NAME,
    // The page's own background (`--bg` in tokens.css) for the theme in use, so the window does not flash the wrong colour.
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#14181D' : '#EDEFF2',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    // Traffic lights inset into the app's own top bar (`TopBar.module.css` reserves the space and marks
    // it a drag region) rather than a separate native title-bar row. That row used to auto-hide and
    // reappear over the app's own top bar in full screen, covering it; this way only the dots themselves
    // do, sliding in over content that never moves.
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 20, y: 24 } }
      : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  // Let the renderer save pending edits before the window goes. If the app was quitting,
  // the guard's deferred close would otherwise cancel the quit, so quit again afterwards.
  attachCloseGuard(mainWindow, {
    onClosed: () => {
      if (isQuitting) app.quit()
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  // Remember where the window was left (a moment after it stops moving; not while maximised, full screen or minimised).
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  const rememberBounds = (): void => {
    if (mainWindow.isMaximized() || mainWindow.isFullScreen() || mainWindow.isMinimized()) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      if (mainWindow.isDestroyed()) return
      settings.update({ ui: { window: mainWindow.getBounds() } }).catch((error: unknown) => {
        console.error('Could not remember the window position:', error)
      })
    }, 500)
  }
  mainWindow.on('resize', rememberBounds)
  mainWindow.on('move', rememberBounds)

  // The app is a single page: never navigate away, and open web links in the browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  // Electron has no right-click menu of its own: spelling suggestions, the editing commands and links.
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const contents = mainWindow.webContents
    const template = buildContextMenu(params, {
      replaceMisspelling: (word) => contents.replaceMisspelling(word),
      addToDictionary: (word) => contents.session.addWordToSpellCheckerDictionary(word),
      openLink: (url) => void shell.openExternal(url),
      copyLink: (url) => clipboard.writeText(url)
    })
    if (template.length > 0) Menu.buildFromTemplate(template).popup({ window: mainWindow })
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow.webContents.getURL()) {
      event.preventDefault()
      if (isSafeExternalUrl(url)) shell.openExternal(url)
    }
  })

  // The renderer animates the top bar around the traffic lights differently in full screen (they are
  // hidden until the pointer is at the very top edge, the same as every full-screen Mac app).
  mainWindow.on('enter-full-screen', () =>
    mainWindow.webContents.send(IPC.appFullScreenChange, true)
  )
  mainWindow.on('leave-full-screen', () =>
    mainWindow.webContents.send(IPC.appFullScreenChange, false)
  )
  // A plain Escape (no modifiers) leaves full screen, the way most full-screen Mac apps behave; the
  // renderer's own Escape handling (closing a dialog, the find bar, …) still runs independently.
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (isPastePlainChord(input, process.platform)) {
      event.preventDefault()
      mainWindow.webContents.send(IPC.appPastePlain, clipboard.readText())
      return
    }
    if (
      input.type === 'keyDown' &&
      input.key === 'Escape' &&
      !input.meta &&
      !input.control &&
      !input.alt &&
      !input.shift &&
      mainWindow.isFullScreen()
    ) {
      mainWindow.setFullScreen(false)
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('app.centralcommand.desktop')
  app.setAboutPanelOptions({ applicationName: APP_NAME, applicationVersion: app.getVersion() })
  const setDockTimer = installDockMenu()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const paths = getAppPaths()
  const settings = new SettingsStore(paths.settings, defaultSettings(paths.defaultBibExport))
  await settings.load()
  await settings.rollOverYears(todayIso())
  // The chosen theme decides light or dark for the whole window: the page's `prefers-color-scheme`, scrollbars and form controls follow it.
  nativeTheme.themeSource = settings.get().theme
  settings.onChange((next, previous) => {
    if (next.theme !== previous.theme) nativeTheme.themeSource = next.theme
  })
  registerSettingsIpc(settings)
  registerDialogIpc()
  registerAppIpc(paths.root)
  registerBuildIpc(settings)
  const tracking: TrackingStore = new TrackingStore(paths.time, {
    starts: () => settings.get().yearStarts,
    now: trackingMoment,
    onChange: (event) => {
      broadcastTrackingChange(event)
      setDockTimer(tracking.running() !== null)
    }
  })
  registerTrackingIpc(tracking)
  // A timer stops by itself at the day end (04:00), also when the app was closed or asleep across it.
  tracking.closeFinishedDays()
  setInterval(() => tracking.closeFinishedDays(), 15_000).unref()
  setDockTimer(tracking.running() !== null)

  const db = openDatabase(paths.database)
  runMigrations(
    db,
    mainModules.flatMap((m) => m.migrations)
  )
  registerEntitiesIpc(paths, db)
  // Work's clients are Tasks lists: removing or renaming one in Hours looks after its tasks.
  tracking.setClientTasks(
    createClientTasks(db, () => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send(TASKS_IPC.changed, {
          workspace: 'work'
        } satisfies TasksChangedEvent)
      }
    })
  )
  // A timer started on a task marks it in progress (a task still to do; done ones stay done).
  const startedTasks = new TasksStore(db)
  tracking.setTaskStarted((uid) => {
    const task = startedTasks.get(uid)
    if (!task || task.status !== 'todo') return
    startedTasks.setStatus(uid, 'doing')
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(TASKS_IPC.changed, {
        workspace: task.workspace
      } satisfies TasksChangedEvent)
    }
  })
  const disposers = mainModules
    .map((m) => m.register({ db, paths, settings }))
    .filter((d): d is () => void => typeof d === 'function')
  app.on('will-quit', () => {
    disposers.forEach((dispose) => dispose())
    db.close()
  })

  createWindow(settings)

  app.on('before-quit', () => {
    isQuitting = true
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(settings)
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
