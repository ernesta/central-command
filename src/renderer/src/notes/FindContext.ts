import { createContext } from 'react'
import type { FindBridge } from './find-types'

/**
 * Where the live editor inside an `EditorCard` reaches that card's find bar. (Milkdown gets the same bridge through
 * the `findSetup` the card hands to its children; the live editor needs no plugin, so it reads it from here.)
 */
export const FindContext = createContext<FindBridge | undefined>(undefined)
