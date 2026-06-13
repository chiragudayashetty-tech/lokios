import { useOS } from '@/lib/context/OSContext'
export function useCharacterStats() { return useOS().characterStats }
