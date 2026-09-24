import type { PlannedModuleManifest } from './types'

/** Modules on the roadmap. Declaring them here is all it takes to show them as "Coming soon". */
export const plannedModules: PlannedModuleManifest[] = [
  { id: 'meetings', workspace: 'research', label: 'Meetings', status: 'planned' },
  { id: 'studies', workspace: 'research', label: 'Studies', status: 'planned' },
  { id: 'training', workspace: 'research', label: 'Training', status: 'planned' },
  { id: 'ideas', workspace: 'research', label: 'Ideas', status: 'planned' }
]
