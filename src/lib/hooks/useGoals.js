import { useOS } from '@/lib/context/OSContext'
export function useGoals() { return useOS().goals }
