import { useEffect } from 'react'
import { keyForShortcut } from './keys'
import type { CalculatorEvent } from './reducer'

/** Drives the calculator from the physical keyboard and the clipboard. */
export function useKeyboardInput(onEvent: (event: CalculatorEvent) => void) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Leave browser and OS shortcuts such as Cmd+R or Ctrl+V alone.
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const key = keyForShortcut(event.key)
      if (!key) return
      // Also stops Enter from clicking whichever key button has focus,
      // which would apply that key a second time.
      event.preventDefault()
      onEvent(key.event)
    }

    function handlePaste(event: ClipboardEvent) {
      const text = event.clipboardData?.getData('text/plain')
      if (text === undefined) return
      event.preventDefault()
      onEvent({ type: 'paste', text })
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('paste', handlePaste)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('paste', handlePaste)
    }
  }, [onEvent])
}
