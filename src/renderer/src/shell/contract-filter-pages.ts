/** The Work pages whose content follows the contract filter: Home, Hours, Time off, and the Meetings and Tasks lists. */
const FILTERED = /^\/work(\/(hours|time-off|(meetings|tasks)(\/all)?))?\/?$/

export function showsContractFilter(pathname: string): boolean {
  return FILTERED.test(pathname)
}
