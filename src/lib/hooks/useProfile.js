import { useOS } from '@/lib/context/OSContext'
export function useProfile() { return useOS().profile }
