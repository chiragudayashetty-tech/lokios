import { createClient } from '@/lib/supabase/client';

export const workService = {
  // --- Workspace ---
  async getWorkspaces(userId) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_workspaces').select('*').eq('owner_id', userId);
    if (error) throw error;
    return data;
  },
  async createWorkspace(payload) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_workspaces').insert(payload).select().single();
    if (error) throw error;
    return data;
  },
  async updateWorkspace(id, updates) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_workspaces').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async deleteWorkspace(id) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_workspaces').delete().eq('id', id);
    if (error) throw error;
    return data;
  },
  async getWorkspaceMembers(workspaceId) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_workspace_members').select('*').eq('workspace_id', workspaceId);
    if (error) throw error;
    return data;
  },

  // --- Categories ---
  async getCategories(workspaceId) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_categories').select('*').eq('workspace_id', workspaceId).order('display_order', { ascending: true });
    if (error) throw error;
    return data;
  },
  async createCategory(payload) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_categories').insert(payload).select().single();
    if (error) throw error;
    return data;
  },
  async updateCategory(id, updates) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_categories').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async deleteCategory(id) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_categories').delete().eq('id', id);
    if (error) throw error;
    return data;
  },

  // --- Metrics ---
  async getMetrics(workspaceId) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_metrics').select('*').eq('workspace_id', workspaceId).order('display_order', { ascending: true });
    if (error) throw error;
    return data;
  },
  async createMetric(payload) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_metrics').insert(payload).select().single();
    if (error) throw error;
    return data;
  },
  async updateMetric(id, updates) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_metrics').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async deleteMetric(id) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_metrics').delete().eq('id', id);
    if (error) throw error;
    return data;
  },

  // --- Formulas ---
  async getFormulas(workspaceId) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_formulas').select('*').eq('workspace_id', workspaceId);
    if (error) throw error;
    return data;
  },
  async createFormula(payload) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_formulas').insert(payload).select().single();
    if (error) throw error;
    return data;
  },
  async updateFormula(id, updates) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_formulas').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async deleteFormula(id) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_formulas').delete().eq('id', id);
    if (error) throw error;
    return data;
  },

  // --- Targets ---
  async getTargets(workspaceId) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_targets').select('*').eq('workspace_id', workspaceId);
    if (error) throw error;
    return data;
  },
  async createTarget(payload) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_targets').insert(payload).select().single();
    if (error) throw error;
    return data;
  },
  async updateTarget(id, updates) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_targets').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async deleteTarget(id) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_targets').delete().eq('id', id);
    if (error) throw error;
    return data;
  },

  // --- Dashboards ---
  async getDashboards(workspaceId) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_dashboards').select('*').eq('workspace_id', workspaceId);
    if (error) throw error;
    return data;
  },
  async createDashboard(payload) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_dashboards').insert(payload).select().single();
    if (error) throw error;
    return data;
  },
  async updateDashboard(id, updates) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_dashboards').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async deleteDashboard(id) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_dashboards').delete().eq('id', id);
    if (error) throw error;
    return data;
  },

  // --- Tags ---
  async getTags(workspaceId) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_tags').select('*').eq('workspace_id', workspaceId);
    if (error) throw error;
    return data;
  },
  async createTag(payload) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_tags').insert(payload).select().single();
    if (error) throw error;
    return data;
  },
  async updateTag(id, updates) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_tags').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async deleteTag(id) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_tags').delete().eq('id', id);
    if (error) throw error;
    return data;
  },

  // --- Entities ---
  async getEntities(workspaceId) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_entities').select('*').eq('workspace_id', workspaceId);
    if (error) throw error;
    return data;
  },
  async createEntity(payload) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_entities').insert(payload).select().single();
    if (error) throw error;
    return data;
  },
  async updateEntity(id, updates) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_entities').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async deleteEntity(id) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_entities').delete().eq('id', id);
    if (error) throw error;
    return data;
  },

  // --- Projects ---
  async getProjects(workspaceId) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_projects').select('*').eq('workspace_id', workspaceId);
    if (error) throw error;
    return data;
  },
  async createProject(payload) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_projects').insert(payload).select().single();
    if (error) throw error;
    return data;
  },
  async updateProject(id, updates) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_projects').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async deleteProject(id) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_projects').delete().eq('id', id);
    if (error) throw error;
    return data;
  },

  // --- Milestones ---
  async getMilestones(projectId) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_milestones').select('*').eq('project_id', projectId).order('display_order', { ascending: true });
    if (error) throw error;
    return data;
  },
  async createMilestone(payload) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_milestones').insert(payload).select().single();
    if (error) throw error;
    return data;
  },
  async updateMilestone(id, updates) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_milestones').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async deleteMilestone(id) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_milestones').delete().eq('id', id);
    if (error) throw error;
    return data;
  },

  // --- Sessions ---
  async getSessions(workspaceId, filters = {}) {
    const supabase = createClient();
    let query = supabase.from('work_sessions').select('*').eq('workspace_id', workspaceId);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.date) query = query.eq('date', filters.date);
    if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  async getSessionById(id) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_sessions').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },
  async createSession(payload) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_sessions').insert(payload).select().single();
    if (error) throw error;
    return data;
  },
  async updateSession(id, updates) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_sessions').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async deleteSession(id) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_sessions').delete().eq('id', id);
    if (error) throw error;
    return data;
  },

  // --- Session Reflections ---
  async getReflection(sessionId) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_session_reflections').select('*').eq('session_id', sessionId).single();
    if (error) throw error;
    return data;
  },
  async saveReflection(payload) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_session_reflections').upsert(payload, { onConflict: 'session_id' }).select().single();
    if (error) throw error;
    return data;
  },

  // --- Session Entities ---
  async getSessionEntities(sessionId) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_session_entities').select('*, entity:work_entities(*)').eq('session_id', sessionId);
    if (error) throw error;
    return data;
  },
  async linkEntity(payload) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_session_entities').insert(payload).select().single();
    if (error) throw error;
    return data;
  },
  async unlinkEntity(sessionId, entityId) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_session_entities').delete().match({ session_id: sessionId, entity_id: entityId });
    if (error) throw error;
    return data;
  },

  // --- Session Metrics ---
  async getSessionMetrics(sessionId) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_session_metrics').select('*').eq('session_id', sessionId);
    if (error) throw error;
    return data;
  },
  async saveSessionMetric(payload) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_session_metrics').insert(payload).select().single();
    if (error) throw error;
    return data;
  },
  async deleteSessionMetric(id) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_session_metrics').delete().eq('id', id);
    if (error) throw error;
    return data;
  },

  // --- Attachments ---
  async getAttachments(attachableType, attachableId) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_attachments').select('*').eq('attachable_type', attachableType).eq('attachable_id', attachableId);
    if (error) throw error;
    return data;
  },
  async createAttachment(payload) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_attachments').insert(payload).select().single();
    if (error) throw error;
    return data;
  },
  async deleteAttachment(id) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_attachments').delete().eq('id', id);
    if (error) throw error;
    return data;
  },

  // --- Event Logs ---
  async getEventLogs(workspaceId, { limit = 50, offset = 0, eventType } = {}) {
    const supabase = createClient();
    let query = supabase.from('work_event_logs').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (eventType) query = query.eq('event_type', eventType);
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },
  async createEventLog(payload) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_event_logs').insert(payload).select().single();
    if (error) throw error;
    return data;
  },

  // --- Notifications ---
  async getNotifications(workspaceId, userId) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_notifications').select('*').eq('workspace_id', workspaceId).eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  async markRead(id) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_notifications').update({ is_read: true }).eq('id', id);
    if (error) throw error;
    return data;
  },
  async markAllRead(workspaceId, userId) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_notifications').update({ is_read: true }).match({ workspace_id: workspaceId, user_id: userId, is_read: false });
    if (error) throw error;
    return data;
  },
  async createNotification(payload) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_notifications').insert(payload).select().single();
    if (error) throw error;
    return data;
  },

  // --- Deep Work ---
  async getDeepWorkLogs(workspaceId, userId, dateRange) {
    const supabase = createClient();
    let query = supabase.from('work_deep_work_logs').select('*').eq('workspace_id', workspaceId).eq('user_id', userId);
    if (dateRange?.start) query = query.gte('date', dateRange.start);
    if (dateRange?.end) query = query.lte('date', dateRange.end);
    
    const { data, error } = await query.order('date', { ascending: false });
    if (error) throw error;
    return data;
  },
  async logDeepWork(payload) {
    const supabase = createClient();
    const { data, error } = await supabase.from('work_deep_work_logs').upsert(payload, { onConflict: 'workspace_id, user_id, date' }).select().single();
    if (error) throw error;
    return data;
  },

  // --- Search ---
  async universalSearch(workspaceId, query) {
    const supabase = createClient();
    const searchTerm = `%${query}%`;
    try {
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
    } catch (error) {
      throw error;
    }
  }
};
