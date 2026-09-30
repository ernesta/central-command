import { createContext } from 'react'
import type { FindBridge } from './find-types'

/** Where the editor inside an `EditorCard` reaches that card's find bar. */
export const FindContext = createContext<FindBridge | undefined>(undefined)
