'use client'

import { useEffect, useState } from 'react'
import { useOSSlice } from '@/lib/context/OSContext'
import { subscribeMilestones, milestoneSnapshot, ensureMilestones } from '@/lib/stores/milestoneStore'

export { addMilestone, updateMilestone, deleteMilestone, reorderMilestones, setMilestoneDone, getMilestones } from '@/lib/stores/milestoneStore'

/** { list, loaded, missing } for the signed-in user; loads once and stays shared. */
export function useMilestones() {
  const { user } = useOSSlice('auth')
  const [snap, setSnap] = useState(milestoneSnapshot)
  useEffect(() => {
    const off = subscribeMilestones(setSnap)
    ensureMilestones(user?.id)
    return off
  }, [user?.id])
  return snap.userId === user?.id ? snap : { list: [], loaded: false, missing: false }
}
