import { useState, useEffect } from 'react'

/**
 * useLocalStorage — state synced to localStorage.
 *
 * @param {string} key      storage key
 * @param {*}      initial  default value when nothing is stored
 */
export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key)
      return stored !== null ? JSON.parse(stored) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // ignore write errors (private mode / quota)
    }
  }, [key, value])

  return [value, setValue]
}
