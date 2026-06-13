import { useOS } from '@/lib/context/OSContext'
export function useJournal() { return useOS().journal }
