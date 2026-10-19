import { Search } from 'lucide-react'
import { useLayoutEffect, useRef, type RefObject } from 'react'
import { backspaceRemovesChip, chipLabel, insertPaste } from '@shared/search-chips'
import { ModifierChip } from './ModifierChip'
import type { ChipTextOptions } from './useChipQuery'
import styles from './ChipInput.module.css'

/**
 * The search field: finished modifiers as chips, then a plain text input (so the caret, selection and input methods are the
 * browser's own), with the one remaining completion as grey text after what is typed. The state and the rules are in
 * `useChipQuery` and `@shared/search-chips`; this only draws them and passes the keys.
 */
export function ChipInput({
  chips,
  text,
  ghost,
  caret,
  inputRef,
  placeholder,
  onText,
  onRemove,
  onKeyDown,
  onCaret,
  inputProps
}: {
  chips: readonly string[]
  text: string
  ghost: string
  /** Where to put the caret after `text` changed, or null. */
  caret: number | null
  inputRef: RefObject<HTMLInputElement | null>
  placeholder: string
  onText: (text: string, options?: ChipTextOptions) => number
  onRemove: (index: number) => void
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void
  onCaret: (caret: number | null) => void
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>
}): React.JSX.Element {
  const composing = useRef(false)

  useLayoutEffect(() => {
    if (caret !== null && !composing.current) inputRef.current?.setSelectionRange(caret, caret)
  }, [caret, text, inputRef])

  return (
    <div className={styles.field}>
      <Search size={16} strokeWidth={1.75} className={styles.icon} aria-hidden />
      <span className={styles.chips} role="list" aria-label="Filters in use">
        {chips.map((chip, index) => (
          <span key={`${chip}-${index}`} role="listitem">
            <ModifierChip label={chipLabel(chip)} onRemove={() => onRemove(index)} />
          </span>
        ))}
      </span>
      <span className={styles.inputWrap}>
        <span className={styles.mirror} aria-hidden>
          <span>{text}</span>
          <span className={styles.ghost}>{ghost}</span>
        </span>
        <input
          {...inputProps}
          ref={inputRef}
          className={styles.input}
          type="text"
          autoFocus
          placeholder={chips.length === 0 ? placeholder : ''}
          value={text}
          onChange={(event) => {
            const value = event.target.value
            const at = event.target.selectionStart ?? value.length
            onCaret(onText(value, { caret: at, raw: composing.current }))
          }}
          onCompositionStart={() => {
            composing.current = true
          }}
          onCompositionEnd={(event) => {
            composing.current = false
            const value = event.currentTarget.value
            const at = event.currentTarget.selectionStart ?? value.length
            onCaret(onText(value, { caret: at }))
          }}
          onSelect={(event) => onCaret(event.currentTarget.selectionStart)}
          onPaste={(event) => {
            const pasted = event.clipboardData.getData('text')
            if (!pasted.includes(':')) return
            event.preventDefault()
            const input = event.currentTarget
            const start = input.selectionStart ?? text.length
            const end = input.selectionEnd ?? text.length
            const next = insertPaste(text, start, end, pasted)
            onCaret(
              onText(next.text, { complete: next.caret === next.text.length, caret: next.caret })
            )
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || composing.current) return
            const input = event.currentTarget
            if (
              event.key === 'Backspace' &&
              backspaceRemovesChip({
                chips: chips.length,
                selectionStart: input.selectionStart,
                selectionEnd: input.selectionEnd,
                composing: false
              })
            ) {
              event.preventDefault()
              onRemove(chips.length - 1)
              return
            }
            onKeyDown(event)
          }}
        />
      </span>
    </div>
  )
}
