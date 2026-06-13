import { useOS } from '@/lib/context/OSContext'
export function useTasks() { return useOS().tasks }
