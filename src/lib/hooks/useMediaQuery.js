'use client'

import { useSyncExternalStore } from 'react'

/**
 * True while the media query matches. Server render / hydration use false;
 * components mounted later read the real value on their first render.
 */
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false
  )
}

export const useIsPhone = () => useMediaQuery('(max-width: 640px)')

const noop = () => () => {}
/** False during server render and hydration, true afterwards (safe portal guard). */
export const useIsClient = () => useSyncExternalStore(noop, () => true, () => false)
