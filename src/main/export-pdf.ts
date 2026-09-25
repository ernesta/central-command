import { writeFile } from 'fs/promises'
import { join } from 'path'
import { BrowserWindow, app, dialog } from 'electron'

export type PdfExportResult = { status: 'saved'; path: string } | { status: 'cancelled' }

/**
 * Asks where to save, then prints a finished HTML page to an A4 landscape PDF there. The page is
 * printed in a hidden window with no scripts, so nothing leaves the machine. Shared by every
 * module's Export so they all behave the same.
 */
export async function exportHtmlAsPdf(
  sender: Electron.WebContents,
  options: { html: string; dialogTitle: string; fileName: string }
): Promise<PdfExportResult> {
  const dialogOptions = {
    title: options.dialogTitle,
    defaultPath: join(app.getPath('documents'), options.fileName),
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  }
  const parent = BrowserWindow.fromWebContents(sender)
  const chosen = parent
    ? await dialog.showSaveDialog(parent, dialogOptions)
    : await dialog.showSaveDialog(dialogOptions)
  if (chosen.canceled || !chosen.filePath) return { status: 'cancelled' }

  const printer = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, javascript: false }
  })
  try {
    await printer.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(options.html)}`)
    const pdf = await printer.webContents.printToPDF({
      pageSize: 'A4',
      landscape: true,
      printBackground: false
    })
    await writeFile(chosen.filePath, pdf)
  } finally {
    printer.destroy()
  }
  return { status: 'saved', path: chosen.filePath }
}
