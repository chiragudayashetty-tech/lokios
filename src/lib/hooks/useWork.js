'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { workService } from '@/lib/services/work/workService'
import { formulaEngine } from '@/lib/services/work/formulaEngine'
import { insightsEngine } from '@/lib/services/work/insightsEngine'
import { eventLoggerService as eventLogger } from '@/lib/services/work/eventLoggerService'

const WorkContext = createContext(null)

export const WorkProvider = ({ children, userId }) => {
  const [currentWorkspace, setCurrentWorkspace] = useState(null)
  const [workspaces, setWorkspaces] = useState([])
  const [categories, setCategories] = useState([])
  const [metrics, setMetrics] = useState([])
  const [projects, setProjects] = useState([])
  const [sessions, setSessions] = useState([])
  const [entities, setEntities] = useState([])
  const [tags, setTags] = useState([])
  const [notifications, setNotifications] = useState([])
  const [targets, setTargets] = useState([])
  const [dashboards, setDashboards] = useState([])
  const [formulas, setFormulas] = useState([])
  const [deepWorkLogs, setDeepWorkLogs] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchBaseData = useCallback(async () => {
    if (!userId) return
    try {
      setLoading(true)
      const userWorkspaces = await workService.getWorkspaces(userId)
      setWorkspaces(userWorkspaces)
      
      if (userWorkspaces.length > 0 && !currentWorkspace) {
        setCurrentWorkspace(userWorkspaces[0])
      }
    } catch (error) {
      console.error('Error fetching workspaces:', error)
    } finally {
      setLoading(false)
    }
  }, [userId, currentWorkspace])

  const fetchWorkspaceData = useCallback(async () => {
    if (!currentWorkspace?.id) return
    try {
      setLoading(true)
      const workspaceId = currentWorkspace.id
      
      const [
        fetchedCategories,
        fetchedMetrics,
        fetchedProjects,
        fetchedSessions,
        fetchedEntities,
        fetchedTags,
        fetchedTargets,
        fetchedDashboards,
        fetchedFormulas
      ] = await Promise.all([
        workService.getCategories(workspaceId),
        workService.getMetrics(workspaceId),
        workService.getProjects(workspaceId),
        workService.getSessions(workspaceId),
        workService.getEntities(workspaceId),
        workService.getTags(workspaceId),
        workService.getTargets(workspaceId),
        workService.getDashboards(workspaceId),
        workService.getFormulas(workspaceId)
      ])

      setCategories(fetchedCategories || [])
      setMetrics(fetchedMetrics || [])
      setProjects(fetchedProjects || [])
      setSessions(fetchedSessions || [])
      setEntities(fetchedEntities || [])
      setTags(fetchedTags || [])
      setTargets(fetchedTargets || [])
      setDashboards(fetchedDashboards || [])
      setFormulas(fetchedFormulas || [])
      
    } catch (error) {
      console.error('Error fetching workspace data:', error)
    } finally {
      setLoading(false)
    }
  }, [currentWorkspace])

  useEffect(() => {
    fetchBaseData()
  }, [fetchBaseData])

  useEffect(() => {
    if (currentWorkspace) {
      fetchWorkspaceData()
    }
  }, [currentWorkspace, fetchWorkspaceData])

  const refreshData = async () => {
    await fetchWorkspaceData()
  }

  // Workspace Actions
  const switchWorkspace = (workspace) => {
    setCurrentWorkspace(workspace)
  }

  const createWorkspace = async (workspaceData) => {
    const result = await workService.createWorkspace({ ...workspaceData, owner_id: userId })
    await fetchBaseData()
    return result
  }

  const updateWorkspace = async (id, data) => {
    const result = await workService.updateWorkspace(id, data)
    await fetchBaseData()
    if (currentWorkspace?.id === id) setCurrentWorkspace({ ...currentWorkspace, ...data })
    return result
  }

  const deleteWorkspace = async (id) => {
    const result = await workService.deleteWorkspace(id)
    if (currentWorkspace?.id === id) setCurrentWorkspace(null)
    await fetchBaseData()
    return result
  }

  // Category Actions
  const createCategory = async (data) => {
    const result = await workService.createCategory({ ...data, workspace_id: currentWorkspace.id })
    await fetchWorkspaceData()
    return result
  }

  const updateCategory = async (id, data) => {
    const result = await workService.updateCategory(id, data)
    await fetchWorkspaceData()
    return result
  }

  const deleteCategory = async (id) => {
    const result = await workService.deleteCategory(id)
    await fetchWorkspaceData()
    return result
  }

  // Metric Actions
  const createMetric = async (data) => {
    const result = await workService.createMetric({ ...data, workspace_id: currentWorkspace.id })
    await fetchWorkspaceData()
    return result
  }

  const updateMetric = async (id, data) => {
    const result = await workService.updateMetric(id, data)
    await fetchWorkspaceData()
    return result
  }

  const deleteMetric = async (id) => {
    const result = await workService.deleteMetric(id)
    await fetchWorkspaceData()
    return result
  }

  // Project Actions
  const createProject = async (data) => {
    const result = await workService.createProject({ ...data, workspace_id: currentWorkspace.id })
    await fetchWorkspaceData()
    return result
  }

  const updateProject = async (id, data) => {
    const result = await workService.updateProject(id, data)
    await fetchWorkspaceData()
    return result
  }

  const deleteProject = async (id) => {
    const result = await workService.deleteProject(id)
    await fetchWorkspaceData()
    return result
  }

  // Milestone Actions
  const createMilestone = async (data) => {
    return await workService.createMilestone(data)
  }

  const updateMilestone = async (id, data) => {
    return await workService.updateMilestone(id, data)
  }

  const deleteMilestone = async (id) => {
    return await workService.deleteMilestone(id)
  }

  const getMilestones = async (projectId) => {
    return await workService.getMilestones(projectId)
  }

  // Session Actions
  const updateSessionTimeline = (session, event) => {
    const timeline = session.timeline || []
    return [...timeline, { event, timestamp: new Date().toISOString() }]
  }

  const createSession = async (data) => {
    const result = await workService.createSession({ ...data, workspace_id: currentWorkspace.id })
    await fetchWorkspaceData()
    return result
  }

  const updateSession = async (id, data) => {
    const result = await workService.updateSession(id, data)
    await fetchWorkspaceData()
    return result
  }

  const startSession = async (id) => {
    const session = sessions.find(s => s.id === id)
    if (!session) return
    const timeline = updateSessionTimeline(session, 'started')
    const result = await workService.updateSession(id, { status: 'in_progress', actual_start_time: new Date().toISOString(), timeline })
    await eventLogger.logSessionEvent(id, 'started')
    await fetchWorkspaceData()
    return result
  }

  const pauseSession = async (id) => {
    const session = sessions.find(s => s.id === id)
    if (!session) return
    const timeline = updateSessionTimeline(session, 'paused')
    const result = await workService.updateSession(id, { status: 'paused', timeline })
    await eventLogger.logSessionEvent(id, 'paused')
    await fetchWorkspaceData()
    return result
  }

  const resumeSession = async (id) => {
    const session = sessions.find(s => s.id === id)
    if (!session) return
    const timeline = updateSessionTimeline(session, 'resumed')
    const result = await workService.updateSession(id, { status: 'in_progress', timeline })
    await eventLogger.logSessionEvent(id, 'resumed')
    await fetchWorkspaceData()
    return result
  }

  const completeSession = async (id) => {
    const session = sessions.find(s => s.id === id)
    if (!session) return
    
    let planning_accuracy_pct = 100
    let time_variance_minutes = 0
    
    if (session.planned_duration && session.actual_start_time) {
      const start = new Date(session.actual_start_time).getTime()
      const end = new Date().getTime()
      const actualDurationMinutes = (end - start) / (1000 * 60)
      
      time_variance_minutes = actualDurationMinutes - session.planned_duration
      planning_accuracy_pct = Math.max(0, 100 - (Math.abs(time_variance_minutes) / session.planned_duration * 100))
    }
    
    const timeline = updateSessionTimeline(session, 'completed')
    const result = await workService.updateSession(id, { 
      status: 'completed', 
      actual_end_time: new Date().toISOString(),
      timeline,
      planning_accuracy_pct,
      time_variance_minutes
    })
    
    await eventLogger.logSessionEvent(id, 'completed')
    await fetchWorkspaceData()
    return result
  }

  const cancelSession = async (id) => {
    const session = sessions.find(s => s.id === id)
    if (!session) return
    const timeline = updateSessionTimeline(session, 'cancelled')
    const result = await workService.updateSession(id, { status: 'cancelled', timeline })
    await eventLogger.logSessionEvent(id, 'cancelled')
    await fetchWorkspaceData()
    return result
  }

  const saveSessionMetric = async (data) => {
    return await workService.saveSessionMetric(data)
  }

  const saveReflection = async (sessionId, reflection) => {
    return await workService.updateSession(sessionId, { reflection })
  }

  // Entity Actions
  const createEntity = async (data) => {
    const result = await workService.createEntity({ ...data, workspace_id: currentWorkspace.id })
    await fetchWorkspaceData()
    return result
  }

  const updateEntity = async (id, data) => {
    const result = await workService.updateEntity(id, data)
    await fetchWorkspaceData()
    return result
  }

  const deleteEntity = async (id) => {
    const result = await workService.deleteEntity(id)
    await fetchWorkspaceData()
    return result
  }

  const linkEntityToSession = async (sessionId, entityId) => {
    return await workService.linkEntityToSession(sessionId, entityId)
  }

  // Tag Actions
  const createTag = async (data) => {
    const result = await workService.createTag({ ...data, workspace_id: currentWorkspace.id })
    await fetchWorkspaceData()
    return result
  }

  const updateTag = async (id, data) => {
    const result = await workService.updateTag(id, data)
    await fetchWorkspaceData()
    return result
  }

  const deleteTag = async (id) => {
    const result = await workService.deleteTag(id)
    await fetchWorkspaceData()
    return result
  }

  // Target Actions
  const createTarget = async (data) => {
    const result = await workService.createTarget({ ...data, workspace_id: currentWorkspace.id })
    await fetchWorkspaceData()
    return result
  }

  const updateTarget = async (id, data) => {
    const result = await workService.updateTarget(id, data)
    await fetchWorkspaceData()
    return result
  }

  const deleteTarget = async (id) => {
    const result = await workService.deleteTarget(id)
    await fetchWorkspaceData()
    return result
  }

  // Dashboard Actions
  const createDashboard = async (data) => {
    const result = await workService.createDashboard({ ...data, workspace_id: currentWorkspace.id })
    await fetchWorkspaceData()
    return result
  }

  const updateDashboard = async (id, data) => {
    const result = await workService.updateDashboard(id, data)
    await fetchWorkspaceData()
    return result
  }

  const deleteDashboard = async (id) => {
    const result = await workService.deleteDashboard(id)
    await fetchWorkspaceData()
    return result
  }

  // Formula Actions
  const createFormula = async (data) => {
    const result = await workService.createFormula({ ...data, workspace_id: currentWorkspace.id })
    await fetchWorkspaceData()
    return result
  }

  const updateFormula = async (id, data) => {
    const result = await workService.updateFormula(id, data)
    await fetchWorkspaceData()
    return result
  }

  const deleteFormula = async (id) => {
    const result = await workService.deleteFormula(id)
    await fetchWorkspaceData()
    return result
  }

  const evaluateFormula = async (formulaId, contextData) => {
    const formula = formulas.find(f => f.id === formulaId)
    if (!formula) return null
    return formulaEngine.evaluate(formula.expression, contextData)
  }

  // Attachment Actions
  const createAttachment = async (data) => {
    return await workService.createAttachment(data)
  }

  const deleteAttachment = async (id) => {
    return await workService.deleteAttachment(id)
  }

  const getAttachments = async (entityId, entityType) => {
    return await workService.getAttachments(entityId, entityType)
  }

  // Other Actions
  const logDeepWork = async (data) => {
    const result = await workService.logDeepWork({ ...data, workspace_id: currentWorkspace.id })
    setDeepWorkLogs(prev => [...prev, result])
    return result
  }

  const universalSearch = async (query) => {
    return await workService.universalSearch(currentWorkspace.id, query)
  }

  const markNotificationRead = async (id) => {
    const result = await workService.markNotificationRead(id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    return result
  }

  const markAllNotificationsRead = async () => {
    const result = await workService.markAllNotificationsRead(userId)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    return result
  }

  const getEventLogs = async (entityId, entityType) => {
    return await eventLogger.getEventLogs(entityId, entityType)
  }

  const getInsights = async () => {
    return await insightsEngine.generateInsights(currentWorkspace.id)
  }

  const getTemplates = () => {
    return [
      {
        id: 'saas_founder',
        name: 'SaaS Founder',
        description: 'For building and scaling software businesses',
        categories: [
          { name: 'Development', description: 'Product engineering', color: '#3B82F6', icon: '💻' },
          { name: 'Sales', description: 'Revenue generation', color: '#10B981', icon: '🤝' },
          { name: 'Marketing', description: 'Growth and acquisition', color: '#F59E0B', icon: '📈' },
          { name: 'Operations', description: 'Business management', color: '#8B5CF6', icon: '⚙️' }
        ],
        metrics: [
          { name: 'Lines of Code', key: 'loc', metric_type: 'Number', metric_group: 'Output', categoryIndex: 0 },
          { name: 'Calls Made', key: 'calls_made', metric_type: 'Number', metric_group: 'Input', categoryIndex: 1 },
          { name: 'Revenue', key: 'revenue', metric_type: 'Currency', metric_group: 'Outcome', categoryIndex: 1 },
          { name: 'MRR', key: 'mrr', metric_type: 'Currency', metric_group: 'Outcome', categoryIndex: 1 }
        ]
      },
      {
        id: 'content_creator',
        name: 'Content Creator',
        description: 'For producing digital content and building audience',
        categories: [
          { name: 'Filming', description: 'Recording video content', color: '#EF4444', icon: '🎥' },
          { name: 'Editing', description: 'Post-production', color: '#8B5CF6', icon: '✂️' },
          { name: 'Writing', description: 'Scripts and copy', color: '#3B82F6', icon: '✍️' },
          { name: 'Outreach', description: 'Sponsorships and collabs', color: '#10B981', icon: '✉️' }
        ],
        metrics: [
          { name: 'Videos Produced', key: 'videos_produced', metric_type: 'Number', metric_group: 'Output', categoryIndex: 1 },
          { name: 'Words Written', key: 'words_written', metric_type: 'Number', metric_group: 'Output', categoryIndex: 2 },
          { name: 'Engagement Rate', key: 'engagement_rate', metric_type: 'Percentage', metric_group: 'Outcome', categoryIndex: 2 }
        ]
      },
      {
        id: 'sales_executive',
        name: 'Sales Executive',
        description: 'For managing pipelines and closing deals',
        categories: [
          { name: 'Prospecting', description: 'Finding new leads', color: '#3B82F6', icon: '🔍' },
          { name: 'Meetings', description: 'Client calls and demos', color: '#10B981', icon: '📅' },
          { name: 'Follow-ups', description: 'Nurturing relationships', color: '#F59E0B', icon: '🔄' },
          { name: 'Closing', description: 'Finalizing deals', color: '#EF4444', icon: '🎯' }
        ],
        metrics: [
          { name: 'Calls', key: 'calls', metric_type: 'Number', metric_group: 'Input', categoryIndex: 0 },
          { name: 'Meetings Booked', key: 'meetings_booked', metric_type: 'Number', metric_group: 'Output', categoryIndex: 1 },
          { name: 'Deals Closed', key: 'deals_closed', metric_type: 'Number', metric_group: 'Outcome', categoryIndex: 3 },
          { name: 'Revenue', key: 'sales_revenue', metric_type: 'Currency', metric_group: 'Outcome', categoryIndex: 3 }
        ]
      },
      {
        id: 'freelance_consultant',
        name: 'Freelance Consultant',
        description: 'For independent professionals managing clients',
        categories: [
          { name: 'Client Work', description: 'Billable delivery', color: '#10B981', icon: '💼' },
          { name: 'Admin', description: 'Invoicing and management', color: '#6B7280', icon: '📋' },
          { name: 'Learning', description: 'Skill development', color: '#3B82F6', icon: '📚' },
          { name: 'Networking', description: 'Building connections', color: '#8B5CF6', icon: '🌐' }
        ],
        metrics: [
          { name: 'Billable Hours', key: 'billable_hours', metric_type: 'Duration', metric_group: 'Output', categoryIndex: 0 },
          { name: 'Projects Delivered', key: 'projects_delivered', metric_type: 'Number', metric_group: 'Outcome', categoryIndex: 0 },
          { name: 'Client Satisfaction', key: 'csat', metric_type: 'Rating', metric_group: 'Quality', categoryIndex: 0 }
        ]
      }
    ]
  }

  const applyTemplate = async (template) => {
    for (const [index, cat] of template.categories.entries()) {
      const createdCat = await createCategory(cat)
      const catMetrics = template.metrics.filter(m => m.categoryIndex === index)
      for (const met of catMetrics) {
        await createMetric({
          category_id: createdCat.id,
          name: met.name,
          key: met.key,
          metric_type: met.metric_type,
          metric_group: met.metric_group,
          is_required: false
        })
      }
    }
    await fetchWorkspaceData()
  }

  const value = {
    currentWorkspace,
    workspaces,
    categories,
    metrics,
    projects,
    sessions,
    entities,
    tags,
    notifications,
    targets,
    dashboards,
    formulas,
    deepWorkLogs,
    loading,
    switchWorkspace,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    createCategory,
    updateCategory,
    deleteCategory,
    createMetric,
    updateMetric,
    deleteMetric,
    createProject,
    updateProject,
    deleteProject,
    createMilestone,
    updateMilestone,
    deleteMilestone,
    getMilestones,
    createSession,
    updateSession,
    startSession,
    pauseSession,
    resumeSession,
    completeSession,
    cancelSession,
    saveSessionMetric,
    saveReflection,
    createEntity,
    updateEntity,
    deleteEntity,
    linkEntityToSession,
    createTag,
    updateTag,
    deleteTag,
    createTarget,
    updateTarget,
    deleteTarget,
    createDashboard,
    updateDashboard,
    deleteDashboard,
    createFormula,
    updateFormula,
    deleteFormula,
    evaluateFormula,
    createAttachment,
    deleteAttachment,
    getAttachments,
    logDeepWork,
    universalSearch,
    markNotificationRead,
    markAllNotificationsRead,
    getEventLogs,
    getInsights,
    getTemplates,
    applyTemplate,
    refreshData
  }

  return (
    <WorkContext.Provider value={value}>
      {children}
    </WorkContext.Provider>
  )
}

export function useWork() {
  const context = useContext(WorkContext)
  if (!context) {
    throw new Error('useWork must be used within a WorkProvider')
  }
  return context
}

export default useWork
