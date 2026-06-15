import { useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

/**
 * useModalA11y — accessibility behaviour for dialogs.
 *
 * - closes on Escape
 * - moves focus into the dialog on open
 * - traps Tab focus within the dialog
 * - restores focus to the previously focused element on close
 *
 * @param {() => void} onClose  close callback
 * @returns {React.RefObject} ref to attach to the dialog container
 */
export function useModalA11y(onClose) {
  const ref = useRef(null)

  useEffect(() => {
    const node = ref.current
    const previouslyFocused = document.activeElement

    // Move focus into the dialog.
    const focusables = node?.querySelectorAll(FOCUSABLE)
    if (focusables && focusables.length > 0) {
      focusables[0].focus()
    } else {
      node?.focus()
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !node) return

      const items = Array.from(node.querySelectorAll(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null
      )
      if (items.length === 0) return

      const first = items[0]
      const last = items[items.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [onClose])

  return ref
}
