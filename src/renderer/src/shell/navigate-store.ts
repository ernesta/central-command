/** The router's `navigate`, for code outside React (a toast's button). Set by `RouteOpener`. */
let navigator: ((route: string) => void) | null = null

export function setNavigator(fn: ((route: string) => void) | null): void {
  navigator = fn
}

/** Go to an in-app route; nothing happens before the shell has mounted. */
export function openRoute(route: string): void {
  if (route.startsWith('/') && !route.startsWith('//')) navigator?.(route)
}
