import { createElement } from 'react'
import type { LiveModuleManifest } from '../types'
import { TrainingCard } from './renderer/TrainingCard'
import { TrainingEntryPage } from './renderer/TrainingEntryPage'
import { TrainingLanding } from './renderer/TrainingLanding'
import { TrainingPage } from './renderer/TrainingPage'
import { TrainingPlanPage } from './renderer/TrainingPlanPage'
import { searchTraining } from './renderer/search'
import { TrainingSettings } from './renderer/TrainingSettings'
import type { TrainingWorkspace } from './shared/types'

/**
 * Training: the formal training log, with notes and linked files per entry and hours towards a yearly aim. Registered once per
 * workspace (`src/modules/index.ts`). Research's is the Inkpath log (types, skills, the aim, the plan and the PDF); Life's is a
 * plain log of what the user learns, with the same entries, series, leads, files and notes.
 */
export function createTrainingModule(workspace: TrainingWorkspace): LiveModuleManifest {
  return {
    id: 'training',
    workspace,
    label: 'Training',
    status: 'live',
    routes: [
      { path: '', element: createElement(TrainingLanding) },
      { path: 'all', element: createElement(TrainingPage) },
      ...(workspace === 'research'
        ? [{ path: 'plan', element: createElement(TrainingPlanPage) }]
        : []),
      { path: 't/:id', element: createElement(TrainingEntryPage) }
    ],
    landingCard: TrainingCard,
    search: searchTraining(workspace),
    settingsSection: workspace === 'research' ? TrainingSettings : undefined
  }
}
