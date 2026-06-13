import { useOS } from '@/lib/context/OSContext'
export function useUserConfig() { return useOS().userConfig }
