import { createClient } from '@/lib/supabase/client'
import { getLocalDateStr, getStartOfWeek } from '@/lib/utils/dates'
import { calculateLevel, getRankForXp } from '@/lib/utils/xp'

/**
 * Strips trailing XP notation like `(-38 XP, -1.5x)`, `(+25 XP)`, `(-10 XP)`
 */
export function cleanDescription(desc) {
  if (!desc || typeof desc !== 'string') return ''
  return desc.replace(/\s*\([-+]?\d+\s*xp[^)]*\)\s*$/i, '').trim()
}

/**
 * Extracts normalized routine name from habit description
 * Handles:
 * "Completed routine: 10k steps"
 * "Failed routine: 10k steps (-38 XP, -1.5x)"
 * "🚨 ESCALATING PENALTY (2 Days Missed): 10k steps (-38 XP, -1.5x)"
 * "Missed routine: 10k steps"
 */
export function extractRoutineName(desc) {
  if (!desc || typeof desc !== 'string') return null
  const cleaned = cleanDescription(desc)
  const m = cleaned.match(/^(?:🚨\s*)?(?:escalating penalty.*?|completed routine|failed routine|missed routine|completed habit|failed habit|routine|habit):\s*(.+)$/i)
  if (m && m[1]) {
    return m[1].trim().toLowerCase()
  }
  return null
}

/**
 * Extracts normalized goal title from priority goal description
 * Handles:
 * "Completed Priority Goal: Restore meditation, speaking..."
 * "Failed Priority Goal: Restore meditation, speaking... (-38 XP, -1.5x)"
 */
export function extractPriorityGoalName(desc) {
  if (!desc || typeof desc !== 'string') return null
  const cleaned = cleanDescription(desc)
  const m = cleaned.match(/^(?:completed priority goal|failed priority goal|priority goal completed|priority goal failed|priority goal #\d+|priority goal):\s*(.+)$/i)
  if (m && m[1]) {
    return m[1].trim().toLowerCase()
  }
  return null
}

/**
 * Extracts normalized task title from task description
 * Handles:
 * "Completed task: Finish shoot + start editing"
 * "Failed task: Finish shoot + start editing (-15 XP, -1.5x)"
 * "Procrastination: Pushed Finish shoot + start editing to tomorrow (-10 XP)"
 */
export function extractTaskName(desc) {
  if (!desc || typeof desc !== 'string') return null
  const cleaned = cleanDescription(desc)
  const m = cleaned.match(/^(?:🚨\s*)?(?:escalating penalty.*?|completed task|failed task|procrastination:\s*pushed|task):\s*(.+)$/i)
  if (m && m[1]) {
    let t = m[1].trim()
    t = t.replace(/\s+to tomorrow\s*$/i, '').trim()
    return t.toLowerCase()
  }
  return null
}

/**
 * Award XP with entity-level deduplication.
 * 
 * For habits, sourceId = `habit_${habitId}_${targetDate}` (e.g. `habit_abc123_2026-08-22`).
 * If a previous XP entry exists for the same entity or action on that date,
 * it is deleted and its amount deducted from profiles.total_xp BEFORE
 * the new entry is inserted. This ensures exactly 1 XP record per habit per day.
 */
export async function robustAwardXP(
  userId,
  amount,
  sourceType,
  sourceId,
  description,
  statCategory = 'discipline',
  customCreatedAt = null
) {
  const supabase = createClient()
  if (!userId) return false

  // Step 1: Find and remove previous / conflicting XP entries for this exact entity or action
  try {
    let matchedIds = []
    let oldXpTotal = 0

    // A. Match by sourceId across all source_types
    if (sourceId) {
      const { data: exact } = await supabase.from('xp_history')
        .select('id, amount')
        .eq('user_id', userId)
        .eq('source_id', sourceId)

      if (exact && exact.length > 0) {
        matchedIds.push(...exact.map(r => r.id))
        oldXpTotal += exact.reduce((sum, r) => sum + (r.amount || 0), 0)
      }
    }

    // B. Match by normalized routine / goal / task description on the same date
    const routineName = extractRoutineName(description)
    const priorityGoalName = extractPriorityGoalName(description)
    const taskName = extractTaskName(description)

    let entryDateStr = customCreatedAt ? getLocalDateStr(new Date(customCreatedAt)) : null
    if (!entryDateStr && sourceId) {
      const match = sourceId.match(/(\d{4}-\d{2}-\d{2})/)
      if (match) entryDateStr = match[1]
    }
    if (!entryDateStr) entryDateStr = getLocalDateStr(new Date())

    if (routineName || priorityGoalName || taskName) {
      const { data: dateRows } = await supabase.from('xp_history')
        .select('id, amount, description')
        .eq('user_id', userId)
        .gte('created_at', `${entryDateStr}T00:00:00.000Z`)
        .lte('created_at', `${entryDateStr}T23:59:59.999Z`)

      if (dateRows && dateRows.length > 0) {
        for (const row of dateRows) {
          if (matchedIds.includes(row.id)) continue
          let isMatch = false
          if (routineName && extractRoutineName(row.description) === routineName) {
            isMatch = true
          } else if (priorityGoalName && extractPriorityGoalName(row.description) === priorityGoalName) {
            isMatch = true
          } else if (taskName && extractTaskName(row.description) === taskName) {
            isMatch = true
          }
          if (isMatch) {
            matchedIds.push(row.id)
            oldXpTotal += (row.amount || 0)
          }
        }
      }
    }

    if (matchedIds.length > 0) {
      const { error: delErr } = await supabase.from('xp_history').delete().in('id', matchedIds).eq('user_id', userId)
      if (delErr) {
        for (const mid of matchedIds) {
          await supabase.from('xp_history').delete().eq('id', mid).eq('user_id', userId)
        }
      }

      if (oldXpTotal !== 0) {
        const { data: prof } = await supabase.from('profiles').select('total_xp').eq('id', userId).single()
        if (prof) {
          await supabase.from('profiles').update({
            total_xp: Math.max(0, (prof.total_xp || 0) - oldXpTotal)
          }).eq('id', userId)
        }
      }
    }
  } catch (err) {
    console.warn('XP cleanup failed (non-fatal):', err)
  }

  // Determine created_at timestamp
  let entryCreatedAt = customCreatedAt
  if (!entryCreatedAt && sourceId) {
    const match = sourceId.match(/(\d{4}-\d{2}-\d{2})/)
    if (match && match[1]) {
      const targetDateStr = match[1]
      const todayStr = getLocalDateStr(new Date())
      if (targetDateStr === todayStr) {
        entryCreatedAt = new Date().toISOString()
      } else {
        entryCreatedAt = `${targetDateStr}T12:00:00.000Z`
      }
    }
  }
  if (!entryCreatedAt) {
    entryCreatedAt = new Date().toISOString()
  }

  // Step 2: Insert into xp_history with progressive fallbacks for missing schema columns
  const fullPayload = {
    user_id: userId,
    amount,
    source_type: sourceType,
    source_id: sourceId || null,
    description: description || null,
    stat_category: statCategory || 'discipline',
    created_at: entryCreatedAt
  }

  let { error: insertErr } = await supabase.from('xp_history').insert(fullPayload)

  if (insertErr) {
    console.warn('Full payload XP insert failed, retrying without stat_category:', insertErr.message || insertErr)
    const payloadNoCat = { ...fullPayload }
    delete payloadNoCat.stat_category
    let { error: err2 } = await supabase.from('xp_history').insert(payloadNoCat)
    
    if (err2) {
      console.warn('Insert without stat_category failed, retrying minimal payload without source_id:', err2.message || err2)
      const payloadMinimal = { ...payloadNoCat }
      delete payloadMinimal.source_id
      let { error: err3 } = await supabase.from('xp_history').insert(payloadMinimal)
      if (err3) {
        console.error('All xp_history insert fallbacks failed:', err3.message || err3)
      }
    }
  }

  // Step 3: ALWAYS update profiles.total_xp so XP is NEVER lost!
  try {
    const { data: prof } = await supabase.from('profiles').select('total_xp').eq('id', userId).single()
    if (prof) {
      await supabase.from('profiles').update({
        total_xp: Math.max(0, (prof.total_xp || 0) + amount)
      }).eq('id', userId)
    }
  } catch (e) {
    console.error('Profile XP update failed:', e)
  }

  return true
}

/**
 * Remove an action's XP cleanly by deleting the original entry rather than polluting the timeline with duplicate reversal rows.
 */
export async function robustRemoveXP(userId, sourceType, sourceId, fixedAmount = null, description = null) {
  const supabase = createClient()
  if (!userId) return false

  let deductionAmount = 0
  let matchedIds = []

  // Step 1: Look for matching xp_history entries for sourceId, sourceType, or description
  try {
    if (sourceId) {
      const { data: items } = await supabase.from('xp_history')
        .select('id, amount')
        .eq('user_id', userId)
        .eq('source_id', sourceId)
      if (items && items.length > 0) {
        matchedIds.push(...items.map(r => r.id))
        deductionAmount += items.reduce((sum, r) => sum + (r.amount || 0), 0)
      }
    } else if (sourceType) {
      const { data: items } = await supabase.from('xp_history')
        .select('id, amount')
        .eq('user_id', userId)
        .eq('source_type', sourceType)
      if (items && items.length > 0) {
        matchedIds.push(...items.map(r => r.id))
        deductionAmount += items.reduce((sum, r) => sum + (r.amount || 0), 0)
      }
    }

    if (description && matchedIds.length === 0) {
      const routineName = extractRoutineName(description)
      const priorityGoalName = extractPriorityGoalName(description)
      const taskName = extractTaskName(description)

      const { data: allUserHistory } = await supabase.from('xp_history')
        .select('id, amount, description')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100)

      if (allUserHistory) {
        for (const row of allUserHistory) {
          let isMatch = false
          if (routineName && extractRoutineName(row.description) === routineName) isMatch = true
          else if (priorityGoalName && extractPriorityGoalName(row.description) === priorityGoalName) isMatch = true
          else if (taskName && extractTaskName(row.description) === taskName) isMatch = true
          else if (row.description && row.description.toLowerCase().includes(description.toLowerCase())) isMatch = true

          if (isMatch) {
            matchedIds.push(row.id)
            deductionAmount += (row.amount || 0)
          }
        }
      }
    }
  } catch (err) {
    console.warn('Failed to query xp_history during remove:', err)
  }

  // Step 2: If previous matching entries exist, delete them and adjust profile total_xp!
  if (matchedIds.length > 0) {
    try {
      const { error: delErr } = await supabase.from('xp_history').delete().in('id', matchedIds).eq('user_id', userId)
      if (delErr) {
        for (const mid of matchedIds) {
          await supabase.from('xp_history').delete().eq('id', mid).eq('user_id', userId)
        }
      }
      if (deductionAmount !== 0) {
        const { data: prof } = await supabase.from('profiles').select('total_xp').eq('id', userId).single()
        if (prof) {
          await supabase.from('profiles').update({
            total_xp: Math.max(0, (prof.total_xp || 0) - deductionAmount)
          }).eq('id', userId)
        }
      }
      return true
    } catch (delErr) {
      console.error('Failed to delete xp_history entries during remove:', delErr)
    }
  }

  // Step 3: Fallback if no prior record was found to delete, and fixedAmount provided
  if (deductionAmount === 0 && fixedAmount) {
    const finalNegativeAmount = -Math.abs(fixedAmount)
    const logDesc = description || `↩ Action Reversed: ${sourceType || 'XP Deduction'}`

    try {
      await supabase.from('xp_history').insert({
        user_id: userId,
        amount: finalNegativeAmount,
        source_type: sourceType ? `${sourceType}_reversed` : 'xp_deduction',
        source_id: sourceId || null,
        description: logDesc,
        created_at: new Date().toISOString()
      })
      const { data: prof } = await supabase.from('profiles').select('total_xp').eq('id', userId).single()
      if (prof) {
        await supabase.from('profiles').update({ total_xp: Math.max(0, (prof.total_xp || 0) + finalNegativeAmount) }).eq('id', userId)
      }
    } catch (e) {
      console.error('Failed to update profile total_xp during deduction:', e)
    }
  }

  return true
}

/**
 * Paginated fetch helper for xp_history to bypass PostgREST's default 1,000-row limit.
 * Fetches all matching rows across multiple pages of 1,000 until exhausted.
 */
export async function fetchAllXpHistory(supabase, userId, select = '*', orderAscending = false) {
  if (!supabase || !userId) return []
  const PAGE_SIZE = 1000
  let allRows = []
  let from = 0
  let hasMore = true

  while (hasMore) {
    const to = from + PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('xp_history')
      .select(select)
      .eq('user_id', userId)
      .order('created_at', { ascending: orderAscending })
      .range(from, to)

    if (error) {
      console.error('Error in fetchAllXpHistory:', error)
      break
    }

    if (!data || data.length === 0) {
      break
    }

    allRows.push(...data)

    if (data.length < PAGE_SIZE) {
      hasMore = false
    } else {
      from += PAGE_SIZE
    }
  }

  return allRows
}

/**
 * Multi-pass semantic deduplication engine for xp_history.
 * 
 * Accurately detects and removes:
 * 1. Routine conflicts (e.g. "Completed routine: 10k steps" vs "Failed routine: 10k steps (-38 XP)")
 *    -> If completed, retains the completion and permanently purges the failed penalty.
 * 2. Priority Goal conflicts (e.g. "Completed Priority Goal: ..." vs "Failed Priority Goal: ...")
 *    -> Retains completion and purges obsolete failure penalties.
 * 3. Task duplicates and obsolete penalties (by UUID or task title on same date).
 * 4. Screen time duplicates on the same date (keeps latest, purges older).
 * 5. Completed vs missed penalties for Journal, Speaking, and Weekly Debrief.
 * 6. Identical description and amount duplicates logged within the same date.
 * 
 * Finally, recalculates profiles.total_xp, current_level, and current_rank strictly from all unique surviving records.
 */
export async function cleanupAllDuplicateXP(userId) {
  const supabase = createClient()
  if (!userId) return { cleanedCount: 0, totalXp: 0, level: 1 }

  try {
    // 1. Fetch ALL records across all pages (sorted newest-first)
    const allHistory = await fetchAllXpHistory(supabase, userId, '*', false)

    if (!allHistory || allHistory.length === 0) {
      return { cleanedCount: 0, totalXp: 0, level: 1 }
    }

    const toDeleteIds = new Set()

    // Pass 1: Semantic Entity Grouping
    const habitMap = new Map()
    const priorityGoalMap = new Map()
    const taskUuidMap = new Map()
    const taskTitleMap = new Map()
    const screenTimeMap = new Map()
    const journalMap = new Map()
    const speakingMap = new Map()
    const debriefMap = new Map()
    const sourceIdMap = new Map()

    for (const entry of allHistory) {
      const srcType = (entry.source_type || '').toLowerCase().trim()
      const srcId = (entry.source_id || '').trim()
      const desc = (entry.description || '').trim()
      const createdAt = entry.created_at ? new Date(entry.created_at) : new Date()
      const localDateStr = getLocalDateStr(createdAt)

      if (srcId) {
        if (!sourceIdMap.has(srcId)) sourceIdMap.set(srcId, [])
        sourceIdMap.get(srcId).push(entry)
      }

      // Check Habit Routine
      const routineName = extractRoutineName(desc)
      const isHabit = srcType.startsWith('habit') || !!routineName || srcId.startsWith('habit_')
      if (isHabit) {
        let habitDate = localDateStr
        const dateMatch = srcId.match(/(\d{4}-\d{2}-\d{2})/) || desc.match(/(\d{4}-\d{2}-\d{2})/)
        if (dateMatch) habitDate = dateMatch[1]

        const cleanName = routineName || srcId.replace(/^habit_/, '').replace(/_\d{4}-\d{2}-\d{2}$/, '') || 'routine'
        const habitKey = `${cleanName.toLowerCase()}|${habitDate}`
        if (!habitMap.has(habitKey)) habitMap.set(habitKey, [])
        habitMap.get(habitKey).push(entry)
        continue
      }

      // Check Priority Goal
      const priorityGoalName = extractPriorityGoalName(desc)
      const isPriorityGoal = srcId.startsWith('debrief_p_') || !!priorityGoalName || (desc.toLowerCase().includes('priority goal') && !srcType.includes('screen_time'))
      if (isPriorityGoal) {
        const cleanGoal = priorityGoalName || srcId.replace(/^debrief_p_/, '').replace(/_/g, ' ') || 'priority_goal'
        const goalKey = cleanGoal.toLowerCase()
        if (!priorityGoalMap.has(goalKey)) priorityGoalMap.set(goalKey, [])
        priorityGoalMap.get(goalKey).push(entry)
        continue
      }

      // Check Regular Task
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(srcId) || srcId.startsWith('task_')
      const taskName = extractTaskName(desc)
      const isTask = srcType.startsWith('task') || isUuid || !!taskName
      if (isTask) {
        if (isUuid) {
          const uuidKey = srcId.replace(/^task_/, '')
          if (!taskUuidMap.has(uuidKey)) taskUuidMap.set(uuidKey, [])
          taskUuidMap.get(uuidKey).push(entry)
        } else if (taskName) {
          const taskKey = `${taskName.toLowerCase()}|${localDateStr}`
          if (!taskTitleMap.has(taskKey)) taskTitleMap.set(taskKey, [])
          taskTitleMap.get(taskKey).push(entry)
        }
        continue
      }

      // Check Screen Time
      const isScreenTime = srcType === 'screen_time' || srcId.startsWith('screen_time_') || (desc.toLowerCase().includes('total time:') && desc.toLowerCase().includes('doomscroll:'))
      if (isScreenTime) {
        let stDate = localDateStr
        const dateMatch = srcId.match(/(\d{4}-\d{2}-\d{2})/)
        if (dateMatch) stDate = dateMatch[1]
        if (!screenTimeMap.has(stDate)) screenTimeMap.set(stDate, [])
        screenTimeMap.get(stDate).push(entry)
        continue
      }

      // Check Journal
      const isJournal = srcType.includes('journal') || desc.toLowerCase().includes('daily journal') || desc.toLowerCase().includes('journal entry')
      if (isJournal) {
        let jDate = localDateStr
        const dateMatch = srcId.match(/(\d{4}-\d{2}-\d{2})/) || desc.match(/(\d{4}-\d{2}-\d{2})/)
        if (dateMatch) jDate = dateMatch[1]
        if (!journalMap.has(jDate)) journalMap.set(jDate, [])
        journalMap.get(jDate).push(entry)
        continue
      }

      // Check Speaking
      const isSpeaking = srcType.includes('speaking') || desc.toLowerCase().includes('speaking practice')
      if (isSpeaking) {
        let sDate = localDateStr
        const dateMatch = srcId.match(/(\d{4}-\d{2}-\d{2})/) || desc.match(/(\d{4}-\d{2}-\d{2})/)
        if (dateMatch) sDate = dateMatch[1]
        if (!speakingMap.has(sDate)) speakingMap.set(sDate, [])
        speakingMap.get(sDate).push(entry)
        continue
      }

      // Check Debrief
      const isDebrief = srcType.includes('debrief') || desc.toLowerCase().includes('weekly debrief')
      if (isDebrief) {
        const weekMonday = getLocalDateStr(getStartOfWeek(createdAt))
        if (!debriefMap.has(weekMonday)) debriefMap.set(weekMonday, [])
        debriefMap.get(weekMonday).push(entry)
        continue
      }
    }

    // Pass 2: Deduplication resolution per semantic domain
    habitMap.forEach((entries) => {
      if (entries.length <= 1) return
      const completedEntries = entries.filter(e => 
        (e.amount || 0) > 0 || 
        e.source_type === 'habit_complete' || 
        (e.description && e.description.toLowerCase().startsWith('completed'))
      )
      if (completedEntries.length > 0) {
        const keepId = completedEntries[0].id
        entries.forEach(e => {
          if (e.id !== keepId) toDeleteIds.add(e.id)
        })
      } else {
        const keepId = entries[0].id
        entries.slice(1).forEach(e => toDeleteIds.add(e.id))
      }
    })

    priorityGoalMap.forEach((entries) => {
      if (entries.length <= 1) return
      const completedEntries = entries.filter(e => 
        (e.amount || 0) > 0 || 
        e.source_type === 'task_complete' || 
        (e.description && e.description.toLowerCase().startsWith('completed'))
      )
      if (completedEntries.length > 0) {
        const keepId = completedEntries[0].id
        entries.forEach(e => {
          if (e.id !== keepId) toDeleteIds.add(e.id)
        })
      } else {
        const keepId = entries[0].id
        entries.slice(1).forEach(e => toDeleteIds.add(e.id))
      }
    })

    const processTaskGroup = (entries) => {
      if (entries.length <= 1) return
      const completedEntries = entries.filter(e => 
        (e.amount || 0) > 0 || 
        e.source_type === 'task_complete' || 
        (e.description && e.description.toLowerCase().startsWith('completed'))
      )
      if (completedEntries.length > 0) {
        const keepId = completedEntries[0].id
        entries.forEach(e => {
          if (e.id !== keepId) toDeleteIds.add(e.id)
        })
      } else {
        const keepId = entries[0].id
        entries.slice(1).forEach(e => toDeleteIds.add(e.id))
      }
    }
    taskUuidMap.forEach(processTaskGroup)
    taskTitleMap.forEach(processTaskGroup)

    screenTimeMap.forEach((entries) => {
      if (entries.length <= 1) return
      const keepId = entries[0].id
      entries.slice(1).forEach(e => toDeleteIds.add(e.id))
    })

    journalMap.forEach((entries) => {
      if (entries.length <= 1) return
      const completed = entries.filter(e => (e.amount || 0) > 0 || e.source_type === 'journal_complete')
      if (completed.length > 0) {
        const keepId = completed[0].id
        entries.forEach(e => { if (e.id !== keepId) toDeleteIds.add(e.id) })
      } else {
        const keepId = entries[0].id
        entries.slice(1).forEach(e => toDeleteIds.add(e.id))
      }
    })

    speakingMap.forEach((entries) => {
      if (entries.length <= 1) return
      const completed = entries.filter(e => (e.amount || 0) >= 0 || e.source_type === 'speaking_practice' || e.source_type === 'speaking_rest_day')
      if (completed.length > 0) {
        const keepId = completed[0].id
        entries.forEach(e => { if (e.id !== keepId) toDeleteIds.add(e.id) })
      } else {
        const keepId = entries[0].id
        entries.slice(1).forEach(e => toDeleteIds.add(e.id))
      }
    })

    debriefMap.forEach((entries) => {
      if (entries.length <= 1) return
      const completed = entries.filter(e => (e.amount || 0) > 0 || e.source_type === 'debrief_submission')
      if (completed.length > 0) {
        const keepId = completed[0].id
        entries.forEach(e => { if (e.id !== keepId) toDeleteIds.add(e.id) })
      } else {
        const keepId = entries[0].id
        entries.slice(1).forEach(e => toDeleteIds.add(e.id))
      }
    })

    sourceIdMap.forEach((entries) => {
      if (entries.length <= 1) return
      const unflagged = entries.filter(e => !toDeleteIds.has(e.id))
      if (unflagged.length > 1) {
        const keepId = unflagged[0].id
        unflagged.slice(1).forEach(e => toDeleteIds.add(e.id))
      }
    })

    // Pass 3: Exact description + amount duplicates on the same date
    const exactSeen = new Map()
    for (const entry of allHistory) {
      if (toDeleteIds.has(entry.id)) continue
      const desc = cleanDescription(entry.description || '').toLowerCase()
      const amount = Number(entry.amount) || 0
      const localDateStr = getLocalDateStr(entry.created_at ? new Date(entry.created_at) : new Date())
      const key = `${desc}|${amount}|${localDateStr}`
      if (exactSeen.has(key)) {
        toDeleteIds.add(entry.id)
      } else {
        exactSeen.set(key, entry.id)
      }
    }

    // Execute deletions in batches
    const deleteList = Array.from(toDeleteIds)
    if (deleteList.length > 0) {
      for (let i = 0; i < deleteList.length; i += 50) {
        const batch = deleteList.slice(i, i + 50)
        const { error: delErr } = await supabase.from('xp_history').delete().in('id', batch).eq('user_id', userId)
        if (delErr) {
          console.warn('[XP Cleanup] Batch delete failed, falling back to individual deletes:', delErr)
          for (const singleId of batch) {
            await supabase.from('xp_history').delete().eq('id', singleId).eq('user_id', userId)
          }
        }
      }
    }

    // Recalculate true total_xp strictly from all remaining records
    const remaining = await fetchAllXpHistory(supabase, userId, 'amount', false)
    const trueTotalXp = (remaining || []).reduce((sum, r) => sum + (r.amount || 0), 0)
    const safeXp = Math.max(0, trueTotalXp)
    const newLevel = calculateLevel(safeXp)
    const newRank = getRankForXp(safeXp).code

    try {
      await supabase
        .from('profiles')
        .update({
          total_xp: safeXp,
          current_level: newLevel,
          current_rank: newRank
        })
        .eq('id', userId)
    } catch (profErr) {
      await supabase
        .from('profiles')
        .update({ total_xp: safeXp })
        .eq('id', userId)
    }

    return {
      cleanedCount: deleteList.length,
      totalXp: safeXp,
      level: newLevel
    }
  } catch (err) {
    console.error('Error during cleanupAllDuplicateXP:', err)
    return { cleanedCount: 0, totalXp: 0, level: 1 }
  }
}
