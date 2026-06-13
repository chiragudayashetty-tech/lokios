import { useOS } from '@/lib/context/OSContext'
export function useBrainDump() { return useOS().brainDump }
