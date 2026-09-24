import { describe, expect, it } from 'vitest'
import {
  appleScriptEscape,
  buildLaunchCommand,
  openBuildSession,
  shellQuote
} from './build-session'

describe('shellQuote', () => {
  it('wraps plain paths in single quotes', () => {
    expect(shellQuote('/Users/a/My Project')).toBe(`'/Users/a/My Project'`)
  })
  it('escapes embedded single quotes', () => {
    expect(shellQuote(`/a/it's`)).toBe(`'/a/it'\\''s'`)
  })
  it('leaves shell metacharacters inert', () => {
    expect(shellQuote('/a; rm -rf ~ $(x) `y`')).toBe(`'/a; rm -rf ~ $(x) \`y\`'`)
  })
})

describe('appleScriptEscape', () => {
  it('escapes backslashes and double quotes', () => {
    expect(appleScriptEscape('a"b\\c')).toBe('a\\"b\\\\c')
  })
})

describe('buildLaunchCommand', () => {
  it('opens Terminal with cd and claude on macOS', () => {
    const cmd = buildLaunchCommand('/Users/a/repo', 'darwin')
    expect(cmd?.command).toBe('osascript')
    expect(cmd?.args.join(' ')).toContain(`do script "cd '/Users/a/repo' && claude"`)
  })
  it('keeps a path containing quotes from breaking out of the AppleScript string', () => {
    const cmd = buildLaunchCommand('/a/"; do shell script "x', 'darwin')!
    const script = cmd.args[cmd.args.length - 1]
    expect(script).toContain('\\"; do shell script \\"x')
    expect(script.match(/(?<!\\)"/g)).toHaveLength(4)
  })
  it('is not supported off macOS', () => {
    expect(buildLaunchCommand('/a', 'linux')).toBeNull()
    expect(buildLaunchCommand('C:\\a', 'win32')).toBeNull()
  })
})

describe('openBuildSession', () => {
  it('asks for a project folder when none is set', async () => {
    expect(await openBuildSession('  ')).toEqual({
      ok: false,
      message: 'Set the project folder in Settings first.'
    })
  })
  it('reports a missing folder', async () => {
    const result = await openBuildSession('/definitely/not/here', 'darwin')
    expect(result.ok).toBe(false)
  })
  it('explains unsupported platforms', async () => {
    const result = await openBuildSession('/tmp', 'linux')
    expect(result).toMatchObject({ ok: false })
  })
})
