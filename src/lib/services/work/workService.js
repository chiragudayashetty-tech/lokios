import { createClient } from '@/lib/supabase/client';

export const workService = {
  // --- Workspace ---
  async getWorkspaces(userId) {
    const supabase = createClient();
    return supabase.from('work_workspaces').select('*').eq('owner_id', userId);
  },
  async createWorkspace(data) {
    const supabase = createClient();
    return supabase.from('work_workspaces').insert(data).select().single();
  },
  async updateWorkspace(id, updates) {
    const supabase = createClient();
    return supabase.from('work_workspaces').update(updates).eq('id', id).select().single();
  },
  async deleteWorkspace(id) {
    const supabase = createClient();
    return supabase.from('work_workspaces').delete().eq('id', id);
  },
  async getWorkspaceMembers(workspaceId) {
    const supabase = createClient();
    return supabase.from('work_workspace_members').select('*').eq('workspace_id', workspaceId);
  },

  // --- Categories ---
  async getCategories(workspaceId) {
    const supabase = createClient();
    return supabase.from('work_categories').select('*').eq('workspace_id', workspaceId).order('display_order', { ascending: true });
  },
  async createCategory(data) {
    const supabase = createClient();
    return supabase.from('work_categories').insert(data).select().single();
  },
  async updateCategory(id, updates) {
    const supabase = createClient();
    return supabase.from('work_categories').update(updates).eq('id', id).select().single();
  },
  async deleteCategory(id) {
    const supabase = createClient();
    return supabase.from('work_categories').delete().eq('id', id);
  },

  // --- Metrics ---
  async getMetrics(workspaceId) {
    const supabase = createClient();
    return supabase.from('work_metrics').select('*').eq('workspace_id', workspaceId).order('display_order', { ascending: true });
  },
  async createMetric(data) {
    const supabase = createClient();
    return supabase.from('work_metrics').insert(data).select().single();
  },
  async updateMetric(id, updates) {
    const supabase = createClient();
    return supabase.from('work_metrics').update(updates).eq('id', id).select().single();
  },
  async deleteMetric(id) {
    const supabase = createClient();
    return supabase.from('work_metrics').delete().eq('id', id);
  },

  // --- Formulas ---
  async getFormulas(workspaceId) {
    const supabase = createClient();
    return supabase.from('work_formulas').select('*').eq('workspace_id', workspaceId);
  },
  async createFormula(data) {
    const supabase = createClient();
    return supabase.from('work_formulas').insert(data).select().single();
  },
  async updateFormula(id, updates) {
    const supabase = createClient();
    return supabase.from('work_formulas').update(updates).eq('id', id).select().single();
  },
  async deleteFormula(id) {
    const supabase = createClient();
    return supabase.from('work_formulas').delete().eq('id', id);
  },

  // --- Targets ---
  async getTargets(workspaceId) {
    const supabase = createClient();
    return supabase.from('work_targets').select('*').eq('workspace_id', workspaceId);
  },
  async createTarget(data) {
    const supabase = createClient();
    return supabase.from('work_targets').insert(data).select().single();
  },
  async updateTarget(id, updates) {
    const supabase = createClient();
    return supabase.from('work_targets').update(updates).eq('id', id).select().single();
  },
  async deleteTarget(id) {
    const supabase = createClient();
    return supabase.from('work_targets').delete().eq('id', id);
  },

  // --- Dashboards ---
  async getDashboards(workspaceId) {
    const supabase = createClient();
    return supabase.from('work_dashboards').select('*').eq('workspace_id', workspaceId);
  },
  async createDashboard(data) {
    const supabase = createClient();
    return supabase.from('work_dashboards').insert(data).select().single();
  },
  async updateDashboard(id, updates) {
    const supabase = createClient();
    return supabase.from('work_dashboards').update(updates).eq('id', id).select().single();
  },
  async deleteDashboard(id) {
    const supabase = createClient();
    return supabase.from('work_dashboards').delete().eq('id', id);
  },

  // --- Tags ---
  async getTags(workspaceId) {
    const supabase = createClient();
    return supabase.from('work_tags').select('*').eq('workspace_id', workspaceId);
  },
  async createTag(data) {
    const supabase = createClient();
    return supabase.from('work_tags').insert(data).select().single();
  },
  async updateTag(id, updates) {
    const supabase = createClient();
    return supabase.from('work_tags').update(updates).eq('id', id).select().single();
  },
  async deleteTag(id) {
    const supabase = createClient();
    return supabase.from('work_tags').delete().eq('id', id);
  },

  // --- Entities ---
  async getEntities(workspaceId) {
    const supabase = createClient();
    return supabase.from('work_entities').select('*').eq('workspace_id', workspaceId);
  },
  async createEntity(data) {
    const supabase = createClient();
    return supabase.from('work_entities').insert(data).select().single();
  },
  async updateEntity(id, updates) {
    const supabase = createClient();
    return supabase.from('work_entities').update(updates).eq('id', id).select().single();
  },
  async deleteEntity(id) {
    const supabase = createClient();
    return supabase.from('work_entities').delete().eq('id', id);
  },

  // --- Projects ---
  async getProjects(workspaceId) {
    const supabase = createClient();
    return supabase.from('work_projects').select('*').eq('workspace_id', workspaceId);
  },
  async createProject(data) {
    const supabase = createClient();
    return supabase.from('work_projects').insert(data).select().single();
  },
  async updateProject(id, updates) {
    const supabase = createClient();
    return supabase.from('work_projects').update(updates).eq('id', id).select().single();
  },
  async deleteProject(id) {
    const supabase = createClient();
    return supabase.from('work_projects').delete().eq('id', id);
  },

  // --- Milestones ---
  async getMilestones(projectId) {
    const supabase = createClient();
    return supabase.from('work_milestones').select('*').eq('project_id', projectId).order('display_order', { ascending: true });
  },
  async createMilestone(data) {
    const supabase = createClient();
    return supabase.from('work_milestones').insert(data).select().single();
  },
  async updateMilestone(id, updates) {
    const supabase = createClient();
    return supabase.from('work_milestones').update(updates).eq('id', id).select().single();
  },
  async deleteMilestone(id) {
    const supabase = createClient();
    return supabase.from('work_milestones').delete().eq('id', id);
  },

  // --- Sessions ---
  async getSessions(workspaceId, filters = {}) {
    const supabase = createClient();
    let query = supabase.from('work_sessions').select('*').eq('workspace_id', workspaceId);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.date) query = query.eq('date', filters.date);
    if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
    return query.order('created_at', { ascending: false });
  },
  async getSessionById(id) {
    const supabase = createClient();
    return supabase.from('work_sessions').select('*').eq('id', id).single();
  },
  async createSession(data) {
    const supabase = createClient();
    return supabase.from('work_sessions').insert(data).select().single();
  },
  async updateSession(id, updates) {
    const supabase = createClient();
    return supabase.from('work_sessions').update(updates).eq('id', id).select().single();
  },
  async deleteSession(id) {
    const supabase = createClient();
    return supabase.from('work_sessions').delete().eq('id', id);
  },

  // --- Session Reflections ---
  async getReflection(sessionId) {
    const supabase = createClient();
    return supabase.from('work_session_reflections').select('*').eq('session_id', sessionId).single();
  },
  async saveReflection(data) {
    const supabase = createClient();
    return supabase.from('work_session_reflections').upsert(data, { onConflict: 'session_id' }).select().single();
  },

  // --- Session Entities ---
  async getSessionEntities(sessionId) {
    const supabase = createClient();
    return supabase.from('work_session_entities').select('*, entity:work_entities(*)').eq('session_id', sessionId);
  },
  async linkEntity(data) {
    const supabase = createClient();
    return supabase.from('work_session_entities').insert(data).select().single();
  },
  async unlinkEntity(sessionId, entityId) {
    const supabase = createClient();
    return supabase.from('work_session_entities').delete().match({ session_id: sessionId, entity_id: entityId });
  },

  // --- Session Metrics ---
  async getSessionMetrics(sessionId) {
    const supabase = createClient();
    return supabase.from('work_session_metrics').select('*').eq('session_id', sessionId);
  },
  async saveSessionMetric(data) {
    const supabase = createClient();
    return supabase.from('work_session_metrics').upsert(data, { onConflict: 'session_id, metric_id' }).select().single();
  },
  async deleteSessionMetric(id) {
    const supabase = createClient();
    return supabase.from('work_session_metrics').delete().eq('id', id);
  },

  // --- Attachments ---
  async getAttachments(attachableType, attachableId) {
    const supabase = createClient();
    return supabase.from('work_attachments').select('*').eq('attachable_type', attachableType).eq('attachable_id', attachableId);
  },
  async createAttachment(data) {
    const supabase = createClient();
    return supabase.from('work_attachments').insert(data).select().single();
  },
  async deleteAttachment(id) {
    const supabase = createClient();
    return supabase.from('work_attachments').delete().eq('id', id);
  },

  // --- Event Logs ---
  async getEventLogs(workspaceId, { limit = 50, offset = 0, eventType } = {}) {
    const supabase = createClient();
    let query = supabase.from('work_event_logs').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (eventType) query = query.eq('event_type', eventType);
    return query;
  },
  async createEventLog(data) {
    const supabase = createClient();
    return supabase.from('work_event_logs').insert(data).select().single();
  },

  // --- Notifications ---
  async getNotifications(workspaceId, userId) {
    const supabase = createClient();
    return supabase.from('work_notifications').select('*').eq('workspace_id', workspaceId).eq('user_id', userId).order('created_at', { ascending: false });
  },
  async markRead(id) {
    const supabase = createClient();
    return supabase.from('work_notifications').update({ is_read: true }).eq('id', id);
  },
  async markAllRead(workspaceId, userId) {
    const supabase = createClient();
    return supabase.from('work_notifications').update({ is_read: true }).match({ workspace_id: workspaceId, user_id: userId, is_read: false });
  },
  async createNotification(data) {
    const supabase = createClient();
    return supabase.from('work_notifications').insert(data).select().single();
  },

  // --- Deep Work ---
  async getDeepWorkLogs(workspaceId, userId, dateRange) {
    const supabase = createClient();
    let query = supabase.from('work_deep_work_logs').select('*').eq('workspace_id', workspaceId).eq('user_id', userId);
    if (dateRange?.start) query = query.gte('date', dateRange.start);
    if (dateRange?.end) query = query.lte('date', dateRange.end);
    return query.order('date', { ascending: false });
  },
  async logDeepWork(data) {
    const supabase = createClient();
    return supabase.from('work_deep_work_logs').upsert(data, { onConflict: 'workspace_id, user_id, date' }).select().single();
  },

  // --- Search ---
  async universalSearch(workspaceId, query) {
    const supabase = createClient();
    const searchTerm = `%${query}%`;
    const [sessions, projects, entities, tags, categories] = await Promise.all([
      supabase.from('work_sessions').select('id, planned_goal').eq('workspace_id', workspaceId).ilike('planned_goal', searchTerm).limit(5),
      supabase.from('work_projects').select('id, name').eq('workspace_id', workspaceId).ilike('name', searchTerm).limit(5),
      supabase.from('work_entities').select('id, name').eq('workspace_id', workspaceId).ilike('name', searchTerm).limit(5),
      supabase.from('work_tags').select('id, name').eq('workspace_id', workspaceId).ilike('name', searchTerm).limit(5),
      supabase.from('work_categories').select('id, name').eq('workspace_id', workspaceId).ilike('name', searchTerm).limit(5)
    ]);
    return {
      sessions: sessions.data || [],
      projects: projects.data || [],
      entities: entities.data || [],
      tags: tags.data || [],
      categories: categories.data || []
    };
  }
};
