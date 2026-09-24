import { spawn } from 'child_process'
import { stat } from 'fs/promises'
import type { BuildResult } from '@shared/api'

export interface LaunchCommand {
  command: string
  args: string[]
}

/** Quote for a POSIX shell: wrap in single quotes, escaping embedded single quotes. */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

/** Escape for inclusion inside an AppleScript double-quoted string. */
export function appleScriptEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/**
 * The command that opens a terminal in `repoPath` running `claude`, or null if
 * this platform is not supported yet. Pure, so quoting can be unit-tested.
 */
export function buildLaunchCommand(
  repoPath: string,
  platform: NodeJS.Platform
): LaunchCommand | null {
  if (platform !== 'darwin') return null
  const shellLine = `cd ${shellQuote(repoPath)} && claude`
  return {
    command: 'osascript',
    args: [
      '-e',
      'tell application "Terminal" to activate',
      '-e',
      `tell application "Terminal" to do script "${appleScriptEscape(shellLine)}"`
    ]
  }
}

export async function openBuildSession(
  repoPath: string,
  platform: NodeJS.Platform = process.platform
): Promise<BuildResult> {
  if (!repoPath.trim()) {
    return { ok: false, message: 'Set the project folder in Settings first.' }
  }
  try {
    if (!(await stat(repoPath)).isDirectory()) throw new Error('not a directory')
  } catch {
    return { ok: false, message: `The project folder doesn't exist: ${repoPath}` }
  }
  const launch = buildLaunchCommand(repoPath, platform)
  if (!launch) {
    return {
      ok: false,
      message: 'Opening a Claude Code session from here is only supported on macOS for now.'
    }
  }
  return new Promise((resolve) => {
    const child = spawn(launch.command, launch.args, { stdio: 'ignore' })
    child.once('error', (error) =>
      resolve({ ok: false, message: `Couldn't open a terminal: ${error.message}` })
    )
    child.once('exit', (code) =>
      resolve(code === 0 ? { ok: true } : { ok: false, message: "Couldn't open a terminal." })
    )
  })
}
