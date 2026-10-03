'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useIsPhone, useIsClient } from '@/lib/hooks/useMediaQuery'

/**
 * Side drawer on desktop, bottom sheet on phone. Rendered in a portal so page
 * transforms never clip it. Escape / backdrop tap closes it.
 */
export default function Sheet({ open, onClose, title, subtitle, children, footer, width = 440 }) {
  const phone = useIsPhone()
  const client = useIsClient()

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])

  if (!client) return null

  const motionProps = phone
    ? { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' }, drag: 'y', dragConstraints: { top: 0, bottom: 0 }, dragElastic: { top: 0, bottom: 0.6 }, onDragEnd: (_, info) => { if (info.offset.y > 120 || info.velocity.y > 600) onClose?.() } }
    : { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } }

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="sheet-root" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
          <motion.div className="sheet-backdrop" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.aside
            className={`sheet-panel ${phone ? 'is-phone' : 'is-side'}`}
            style={phone ? undefined : { width: `min(${width}px, 100vw)` }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            {...motionProps}
          >
            {phone && <div className="sheet-grip" aria-hidden />}
            <header className="sheet-head">
              <div className="sheet-head-text">
                {title && <h2 className="sheet-title">{title}</h2>}
                {subtitle && <p className="sheet-sub">{subtitle}</p>}
              </div>
              <button type="button" className="sheet-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
            </header>
            <div className="sheet-body" onPointerDownCapture={(e) => e.stopPropagation()}>{children}</div>
            {footer && <footer className="sheet-foot">{footer}</footer>}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
