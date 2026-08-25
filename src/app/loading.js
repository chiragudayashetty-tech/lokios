'use client'

export default function Loading() {
  return (
    <div className="flex items-center justify-center h-screen bg-[#0a0a0a] flex-col gap-4">
      <div className="w-16 h-16 border-4 border-t-primary border-r-transparent border-b-info border-l-transparent rounded-full animate-spin"></div>
      <div className="font-mono text-sm tracking-widest text-primary animate-pulse">LOKI OS // INITIALIZING...</div>
      <div className="font-mono text-xs tracking-widest text-cyan-400 font-bold uppercase animate-pulse flex items-center gap-2">
        <span>❄️</span>
        <span>WINTER IS COMING</span>
        <span>❄️</span>
      </div>
    </div>
  )
}
