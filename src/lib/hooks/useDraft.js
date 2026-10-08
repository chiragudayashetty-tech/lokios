'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * useState that survives leaving the page: the value is kept in localStorage under
 * `lokios_draft_<key>` and restored after mount (so server HTML still matches).
 * Setting it back to the initial value (e.g. after saving) clears the draft.
 */
export function useDraft(key, initial) {
  const storageKey = `lokios_draft_${key}`
  const [value, setValue] = useState(initial)
  const restored = useRef(false)
  const initialJson = useRef(JSON.stringify(initial))

  useEffect(() => {
    let cancelled = false
    Promise.resolve().then(() => {
      if (cancelled) return
      try {
        const raw = localStorage.getItem(storageKey)
        if (raw != null) setValue(JSON.parse(raw))
      } catch {}
      restored.current = true
    })
    return () => { cancelled = true }
  }, [storageKey])

  useEffect(() => {
    if (!restored.current) return
    try {
      const json = JSON.stringify(value)
      if (json === initialJson.current) localStorage.removeItem(storageKey)
      else localStorage.setItem(storageKey, json)
    } catch {}
  }, [storageKey, value])

  return [value, setValue]
}
