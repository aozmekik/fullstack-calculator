import { useLayoutEffect } from 'react'
import { keyForShortcut } from './keys'
import type { CalculatorEvent } from './reducer'

/** Drives the calculator from the physical keyboard and the clipboard. */
export function useKeyboardInput(onEvent: (event: CalculatorEvent) => void) {
  // A layout effect attaches the listeners before the first paint, so keys
  // typed as soon as the calculator appears are never lost. (A passive
  // effect runs a task later, and browsers may handle input before it.)
  useLayoutEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Leave browser and OS shortcuts such as Cmd+R or Ctrl+V alone.
      if (event.ctrlKey || event.metaKey || event.altKey) return
      // Enter presses a button the user focused with Tab, as anywhere else.
      // (Clicks do not focus buttons here; see keepFocus.)
      if (event.key === 'Enter' && event.target instanceof HTMLButtonElement) {
        return
      }
      const key = keyForShortcut(event.key)
      if (!key) return
      event.preventDefault() // e.g. "/" would open Firefox's quick find
      // Typing moves on from a button pressed with Tab and Enter, so that the
      // next Enter means "=" instead of pressing that button again.
      if (event.target instanceof HTMLButtonElement) event.target.blur()
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
