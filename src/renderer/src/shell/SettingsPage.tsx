import type { ComponentType } from 'react'
import { moduleSettingsSections } from '@modules/index'
import { useModuleState } from '../state/use-module-state'
import { AboutSettings } from './AboutSettings'
import { GeneralSettings } from './GeneralSettings'
import { normaliseSettingsTab } from './settings-tabs'
import { ShortcutsSettings } from './ShortcutsSettings'
import styles from './SettingsPage.module.css'

interface SettingsTab {
  id: string
  label: string
  Section: ComponentType
}

/** General first, then one tab per module that has something to configure (named after the module), then Shortcuts and About. */
function tabs(): SettingsTab[] {
  return [
    { id: 'general', label: 'General', Section: GeneralSettings },
    ...moduleSettingsSections(),
    { id: 'shortcuts', label: 'Shortcuts', Section: ShortcutsSettings },
    { id: 'about', label: 'About', Section: AboutSettings }
  ]
}

/**
 * Categories down the left, the chosen one's fields on the right: the same layout as the Training plan's
 * outline, so settings do not read as one long scroll. The category is remembered between visits.
 */
export function SettingsPage(): React.JSX.Element {
  const all = tabs()
  const { value, update } = useModuleState('settings', (raw) =>
    normaliseSettingsTab(
      raw,
      all.map((t) => t.id)
    )
  )
  const current = all.find((t) => t.id === value.tab) ?? all[0]
  const Section = current.Section

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Settings</h1>
      <div className={styles.layout}>
        <div
          className={styles.nav}
          role="tablist"
          aria-orientation="vertical"
          aria-label="Settings categories"
        >
          {all.map((tab) => (
            <button
              key={tab.id}
              id={`settings-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={tab.id === current.id}
              aria-controls={`settings-panel-${tab.id}`}
              className={[styles.tab, tab.id === current.id && styles.active]
                .filter(Boolean)
                .join(' ')}
              onClick={() => update({ tab: tab.id })}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div
          key={current.id}
          id={`settings-panel-${current.id}`}
          role="tabpanel"
          aria-labelledby={`settings-tab-${current.id}`}
          className={styles.panel}
        >
          <Section />
        </div>
      </div>
    </div>
  )
}
