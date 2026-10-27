import type { MouseEvent } from 'react'

/**
 * Stops a mouse click from moving focus to the button clicked. Otherwise the
 * clicked button keeps focus, and pressing Enter (which should mean "=")
 * presses that button again. Keyboard users still move focus with Tab, and
 * Enter presses whatever they have focused.
 *
 * A click also releases focus that Tab left on another button, so that Enter
 * goes back to meaning "=".
 */
export function keepFocus(event: MouseEvent) {
  event.preventDefault()
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
}
