import { useOS } from '@/lib/context/OSContext'
export function useXP() { return useOS().xp }
