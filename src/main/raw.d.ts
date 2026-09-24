// Lets main-process code import bundled text files (e.g. SQL migrations) with Vite's ?raw suffix.
declare module '*.sql?raw' {
  const contents: string
  export default contents
}
