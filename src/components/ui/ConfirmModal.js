'use client'
import { motion, AnimatePresence } from 'framer-motion'
import HudPanel from './HudPanel'

export default function ConfirmModal({ 
  isOpen, 
  title, 
  message, 
  confirmText = "CONFIRM", 
  cancelText = "CANCEL", 
  onConfirm, 
  onCancel, 
  danger = false 
}) {
  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 640 : false

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="modal-overlay bottom-sheet-mobile z-50">
          <motion.div 
            drag dragConstraints={{ left: -1000, right: 1000, top: -1000, bottom: 1000 }} dragElastic={0} dragMomentum={false}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-sm mx-auto"
          >
            <HudPanel className={`modal-content bottom-sheet-content cursor-move ${danger ? 'border-danger' : 'border-amber'}`} style={{ width: '400px', maxWidth: '100%' }}>
              <div className="flex-between mb-5 border-b border-border-color pb-3">
                <span className={`font-display text-xl uppercase tracking-widest ${danger ? 'text-danger' : 'text-amber'}`}>
                  {title}
                </span>
              </div>
              
              <div className="font-mono text-sm mb-6 text-secondary whitespace-pre-wrap leading-relaxed">
                {message}
              </div>
              
              <div className="flex gap-3 mt-3">
                <button 
                  type="button" 
                  className={`btn flex-1 py-3 ${danger ? 'btn-danger' : 'btn-primary'}`} 
                  onClick={onConfirm}
                >
                  {confirmText}
                </button>
                <button 
                  type="button" 
                  className="btn btn-ghost flex-1 py-3" 
                  onClick={onCancel}
                >
                  {cancelText}
                </button>
              </div>
            </HudPanel>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
