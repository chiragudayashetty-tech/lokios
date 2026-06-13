import { useOS } from '@/lib/context/OSContext'
export function useCalendar() { return useOS().calendar }
