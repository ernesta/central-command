import { createElement } from 'react'
import type { LiveModuleManifest } from '../types'
import { TrainingCard } from './renderer/TrainingCard'
import { TrainingEntryPage } from './renderer/TrainingEntryPage'
import { TrainingPage } from './renderer/TrainingPage'

/** Training: the formal training log, with notes and linked files per entry and hours towards a yearly aim. */
export const trainingModule: LiveModuleManifest = {
  id: 'training',
  workspace: 'research',
  label: 'Training',
  status: 'live',
  routes: [
    { path: '', element: createElement(TrainingPage) },
    { path: 't/:id', element: createElement(TrainingEntryPage) }
  ],
  landingCard: TrainingCard
}
