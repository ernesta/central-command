/**
 * The Research pages whose content follows the academic year filter: Home, Hours, Time off, and the Meetings, Training and Tasks
 * landings and lists, and the Training plan. Not a single meeting, entry, task or person, and not Notes, Readings or People.
 */
const FILTERED =
  /^\/research(\/(hours|time-off|(meetings|tasks|training)(\/all)?|training\/plan))?\/?$/

export function showsYearFilter(pathname: string): boolean {
  return FILTERED.test(pathname)
}
