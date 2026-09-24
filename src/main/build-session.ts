import { spawn } from 'child_process'
import { stat } from 'fs/promises'
import type { BuildResult } from '@shared/api'
import { TERMINALS, type TerminalId } from '@shared/settings'

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
 * The command that opens `terminal` in `repoPath` running `claude`, or null if this platform is
 * not supported yet. Pure, so quoting can be unit-tested. `shell` is the user's login shell.
 */
export function buildLaunchCommand(
  repoPath: string,
  platform: NodeJS.Platform,
  terminal: TerminalId = 'terminal',
  shell = '/bin/zsh'
): LaunchCommand | null {
  if (platform !== 'darwin') return null
  if (terminal === 'ghostty') {
    // Ghostty ignores --working-directory for a -e command, and a GUI-launched app has a minimal
    // PATH, so run an interactive login shell that cds explicitly and then stays open like Terminal.
    const shellLine = `cd ${shellQuote(repoPath)} && claude; exec ${shellQuote(shell)} -l`
    return {
      command: 'open',
      args: ['-na', 'Ghostty', '--args', '-e', shell, '-lic', shellLine]
    }
  }
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
  terminal: TerminalId = 'terminal',
  platform: NodeJS.Platform = process.platform,
  shell: string = process.env.SHELL || '/bin/zsh'
): Promise<BuildResult> {
  if (!repoPath.trim()) {
    return { ok: false, message: 'Set the Central Command repository path in Settings first.' }
  }
  try {
    if (!(await stat(repoPath)).isDirectory()) throw new Error('not a directory')
  } catch {
    return { ok: false, message: `The Central Command repository path doesn't exist: ${repoPath}` }
  }
  const launch = buildLaunchCommand(repoPath, platform, terminal, shell)
  if (!launch) {
    return {
      ok: false,
      message: 'Opening a Claude Code session from here is only supported on macOS for now.'
    }
  }
  const label = TERMINALS.find((t) => t.id === terminal)?.label ?? 'the terminal'
  return new Promise((resolve) => {
    const child = spawn(launch.command, launch.args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr?.on('data', (chunk: Buffer) => (stderr += chunk.toString()))
    child.once('error', (error) =>
      resolve({ ok: false, message: `Couldn't open ${label}: ${error.message}` })
    )
    child.once('exit', (code) => {
      if (code === 0) return resolve({ ok: true })
      const detail = stderr.trim().split('\n')[0]
      resolve({
        ok: false,
        message: `Couldn't open ${label}.${detail ? ` ${detail}` : ''} Check the terminal in Settings.`
      })
    })
  })
}
