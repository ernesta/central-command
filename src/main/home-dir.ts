import { isAbsolute } from 'path'

/**
 * The folder that holds `CentralCommand/`. A relative value (typically the literal text
 * "undefined/home" from an unset variable in a test driver) would create a stray library
 * inside whatever folder the process started in, so refuse it.
 */
export function assertAbsoluteHome(home: string): string {
  if (!isAbsolute(home)) {
    throw new Error(`The data home must be an absolute path, got "${home}".`)
  }
  return home
}
