import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { APP_NAME } from '@shared/app-info'
import { getAppPaths } from './paths'
import { SettingsStore } from './settings'
import { registerSettingsIpc } from './ipc/settings'
import { registerDialogIpc } from './ipc/dialog'
import { registerBuildIpc } from './ipc/build'
import { openDatabase } from './db/connection'
import { runMigrations } from './db/migrate'
import { mainModules } from '@modules/main-registry'
import { defaultSettings } from '@shared/settings'
import icon from '../../resources/icon.png?asset'

function isSafeExternalUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: APP_NAME,
    backgroundColor: '#EDEFF2',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  // The app is a single page: never navigate away, and open web links in the browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) shell.openExternal(url)
    return { action: 'deny' }
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
  electronApp.setAppUserModelId('app.controlcenter.desktop')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const paths = getAppPaths()
  const settings = new SettingsStore(paths.settings, defaultSettings(paths.defaultBibExport))
  await settings.load()
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

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
