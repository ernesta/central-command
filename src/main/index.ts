import { app, shell, BrowserWindow, Menu, clipboard, nativeTheme, screen } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { APP_NAME } from '@shared/app-info'
import { attachCloseGuard } from './close-guard'
import { getAppPaths } from './paths'
import { SettingsStore } from './settings'
import { registerSettingsIpc } from './ipc/settings'
import { registerDialogIpc } from './ipc/dialog'
import { registerBuildIpc } from './ipc/build'
import { openDatabase } from './db/connection'
import { runMigrations } from './db/migrate'
import { mainModules } from '@modules/main-registry'
import { defaultSettings } from '@shared/settings'
import { buildContextMenu } from './context-menu'
import { restoreBounds } from './window-bounds'
import { isSafeExternalUrl } from './urls'
import icon from '../../resources/icon.png?asset'

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

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('app.centralcommand.desktop')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const paths = getAppPaths()
  const settings = new SettingsStore(paths.settings, defaultSettings(paths.defaultBibExport))
  await settings.load()
  // The chosen theme decides light or dark for the whole window: the page's `prefers-color-scheme`, scrollbars and form controls follow it.
  nativeTheme.themeSource = settings.get().theme
  settings.onChange((next, previous) => {
    if (next.theme !== previous.theme) nativeTheme.themeSource = next.theme
  })
  registerSettingsIpc(settings)
  registerDialogIpc()
  registerBuildIpc(settings)

  const db = openDatabase(paths.database)
  runMigrations(
    db,
    mainModules.flatMap((m) => m.migrations)
  )
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
