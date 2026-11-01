/// <reference types="vite/client" />

/** A font file imported as a data URI (`?inline`), for the activity log's PDF. */
declare module '*.woff2?inline' {
  const data: string
  export default data
}
