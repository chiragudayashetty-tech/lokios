import { useOS } from '@/lib/context/OSContext'
export function useHabits() { return useOS().habits }
