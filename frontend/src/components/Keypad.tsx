import { KEYPAD } from '../calculator/keys'
import type { CalculatorEvent } from '../calculator/reducer'
import styles from './Keypad.module.css'

interface KeypadProps {
  onPress: (event: CalculatorEvent) => void
}

export function Keypad({ onPress }: KeypadProps) {
  return (
    <div className={styles.keypad} role="group" aria-label="Keypad">
      {KEYPAD.map((key) => (
        <button
          key={key.name}
          type="button"
          className={styles.key}
          data-variant={key.variant}
          data-span={key.span}
          aria-label={key.name === key.label ? undefined : key.name}
          title={key.hint}
          aria-keyshortcuts={ariaShortcuts(key.shortcuts)}
          onClick={() => onPress(key.event)}
        >
          {key.label}
        </button>
      ))}
    </div>
  )
}

// "+" joins modifiers in aria-keyshortcuts ("Control+A"), so the plus key
// itself cannot be listed there.
function ariaShortcuts(shortcuts: readonly string[]): string | undefined {
  const listed = shortcuts.filter((shortcut) => shortcut !== '+')
  return listed.length > 0 ? listed.join(' ') : undefined
}
