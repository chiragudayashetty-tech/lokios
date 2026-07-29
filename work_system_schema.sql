-- Work Intelligence System v3.0 Schema

-- 1. Workspaces
CREATE TABLE IF NOT EXISTS work_workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    icon TEXT,
    color TEXT,
    owner_id UUID NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Workspace Members
CREATE TABLE IF NOT EXISTS work_workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES work_workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role TEXT CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
    invited_by UUID,
    joined_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_workspace_members_workspace ON work_workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user ON work_workspace_members(user_id);

-- 3. Categories (Config)
CREATE TABLE IF NOT EXISTS work_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES work_workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    color TEXT,
    display_order INT DEFAULT 0,
    version INT DEFAULT 1,
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_categories_workspace ON work_categories(workspace_id);

-- 4. Metrics (Config)
CREATE TABLE IF NOT EXISTS work_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES work_workspaces(id) ON DELETE CASCADE,
    category_id UUID REFERENCES work_categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    key TEXT NOT NULL,
    metric_type TEXT CHECK (metric_type IN ('number', 'decimal', 'currency', 'percentage', 'duration', 'time', 'date', 'distance', 'rating', 'boolean')),
    metric_group TEXT CHECK (metric_group IN ('input', 'output', 'outcome', 'quality')),
    unit TEXT,
    display_unit TEXT,
    options JSONB DEFAULT '{}',
    required BOOLEAN DEFAULT false,
    display_order INT DEFAULT 0,
    version INT DEFAULT 1,
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_metrics_workspace ON work_metrics(workspace_id);
CREATE INDEX idx_metrics_category ON work_metrics(category_id);

-- 5. Formulas (Config)
CREATE TABLE IF NOT EXISTS work_formulas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES work_workspaces(id) ON DELETE CASCADE,
    category_id UUID REFERENCES work_categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    expression_json JSONB NOT NULL,
    result_unit TEXT,
    description TEXT,
    version INT DEFAULT 1,
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_formulas_workspace ON work_formulas(workspace_id);

-- 6. Targets (Config)
CREATE TABLE IF NOT EXISTS work_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES work_workspaces(id) ON DELETE CASCADE,
    metric_id UUID REFERENCES work_metrics(id) ON DELETE CASCADE,
    period TEXT CHECK (period IN ('daily', 'weekly', 'monthly')),
    target_value NUMERIC NOT NULL,
    comparison TEXT DEFAULT 'gte' CHECK (comparison IN ('gte', 'lte', 'eq')),
    notify_on_achieve BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_targets_workspace ON work_targets(workspace_id);
CREATE INDEX idx_targets_metric ON work_targets(metric_id);

-- 7. Dashboards (Config)
CREATE TABLE IF NOT EXISTS work_dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES work_workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    layout_config JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_dashboards_workspace ON work_dashboards(workspace_id);

-- 8. Tags
CREATE TABLE IF NOT EXISTS work_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES work_workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(workspace_id, name)
);
CREATE INDEX idx_tags_workspace ON work_tags(workspace_id);

-- 9. Entities (Operational)
CREATE TABLE IF NOT EXISTS work_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES work_workspaces(id) ON DELETE CASCADE,
    entity_type TEXT CHECK (entity_type IN ('school', 'client', 'company', 'person', 'location', 'vendor', 'partner', 'custom')),
    name TEXT NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    tags UUID[] DEFAULT '{}',
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_entities_workspace ON work_entities(workspace_id);

-- 10. Projects (Operational)
CREATE TABLE IF NOT EXISTS work_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES work_workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    lifecycle_type TEXT CHECK (lifecycle_type IN ('one_time', 'recurring', 'continuous')),
    recurrence_rule JSONB,
    start_date DATE,
    deadline DATE,
    status TEXT DEFAULT 'active' CHECK (status IN ('planning', 'active', 'paused', 'completed', 'cancelled')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    completion_percentage NUMERIC DEFAULT 0,
    linked_category_ids UUID[] DEFAULT '{}',
    tags UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_projects_workspace ON work_projects(workspace_id);
CREATE INDEX idx_projects_status ON work_projects(status);

-- 11. Milestones
CREATE TABLE IF NOT EXISTS work_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES work_workspaces(id) ON DELETE CASCADE,
    project_id UUID REFERENCES work_projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    target_date DATE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'missed')),
    progress NUMERIC DEFAULT 0,
    notes TEXT,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_milestones_workspace ON work_milestones(workspace_id);
CREATE INDEX idx_milestones_project ON work_milestones(project_id);

-- 12. Sessions (Operational)
CREATE TABLE IF NOT EXISTS work_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES work_workspaces(id) ON DELETE CASCADE,
    category_id UUID REFERENCES work_categories(id) ON DELETE SET NULL,
    project_id UUID REFERENCES work_projects(id) ON DELETE SET NULL,
    milestone_id UUID REFERENCES work_milestones(id) ON DELETE SET NULL,
    planned_start_time TIMESTAMPTZ,
    planned_duration_minutes INT,
    planned_output_text TEXT,
    planned_goal TEXT,
    actual_start_time TIMESTAMPTZ,
    actual_end_time TIMESTAMPTZ,
    actual_duration_minutes INT,
    actual_output_text TEXT,
    notes TEXT,
    energy_score INT CHECK (energy_score BETWEEN 1 AND 5),
    focus_score INT CHECK (focus_score BETWEEN 1 AND 5),
    difficulty_score INT CHECK (difficulty_score BETWEEN 1 AND 5),
    mood TEXT,
    confidence INT CHECK (confidence BETWEEN 1 AND 5),
    planning_accuracy_pct NUMERIC,
    time_variance_minutes NUMERIC,
    status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'paused', 'completed', 'cancelled')),
    timeline JSONB DEFAULT '[]',
    tags UUID[] DEFAULT '{}',
    date DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_sessions_workspace ON work_sessions(workspace_id);
CREATE INDEX idx_sessions_category ON work_sessions(category_id);
CREATE INDEX idx_sessions_project ON work_sessions(project_id);
CREATE INDEX idx_sessions_date ON work_sessions(date);
CREATE INDEX idx_sessions_status ON work_sessions(status);

-- 13. Session Reflections
CREATE TABLE IF NOT EXISTS work_session_reflections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES work_sessions(id) ON DELETE CASCADE UNIQUE,
    what_went_well TEXT,
    what_went_wrong TEXT,
    next_improvement TEXT,
    sentiment_score NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 14. Session Entities
CREATE TABLE IF NOT EXISTS work_session_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES work_sessions(id) ON DELETE CASCADE,
    entity_id UUID REFERENCES work_entities(id) ON DELETE CASCADE,
    role_notes TEXT,
    UNIQUE(session_id, entity_id)
);
CREATE INDEX idx_session_entities_session ON work_session_entities(session_id);
CREATE INDEX idx_session_entities_entity ON work_session_entities(entity_id);

-- 15. Session Metrics
CREATE TABLE IF NOT EXISTS work_session_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES work_sessions(id) ON DELETE CASCADE,
    metric_id UUID REFERENCES work_metrics(id) ON DELETE CASCADE,
    value_number NUMERIC,
    value_text TEXT,
    value_json JSONB,
    unit TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(session_id, metric_id)
);
CREATE INDEX idx_session_metrics_session ON work_session_metrics(session_id);
CREATE INDEX idx_session_metrics_metric ON work_session_metrics(metric_id);

-- 16. Attachments
CREATE TABLE IF NOT EXISTS work_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES work_workspaces(id) ON DELETE CASCADE,
    attachable_type TEXT CHECK (attachable_type IN ('session', 'project', 'milestone', 'entity')),
    attachable_id UUID NOT NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size BIGINT,
    uploaded_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_attachments_workspace ON work_attachments(workspace_id);
CREATE INDEX idx_attachments_attachable ON work_attachments(attachable_type, attachable_id);

-- 17. Event Logs
CREATE TABLE IF NOT EXISTS work_event_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES work_workspaces(id) ON DELETE CASCADE,
    actor_id UUID,
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    payload JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_event_logs_workspace_date ON work_event_logs(workspace_id, created_at DESC);

-- 18. Notifications
CREATE TABLE IF NOT EXISTS work_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES work_workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    type TEXT,
    link TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_notifications_workspace ON work_notifications(workspace_id);
CREATE INDEX idx_notifications_user ON work_notifications(user_id);

-- 19. Deep Work Logs
CREATE TABLE IF NOT EXISTS work_deep_work_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES work_workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    date DATE NOT NULL,
    deep_work_minutes INT DEFAULT 0,
    shallow_work_minutes INT DEFAULT 0,
    session_count INT DEFAULT 0,
    longest_block_minutes INT DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(workspace_id, user_id, date)
);
CREATE INDEX idx_deep_work_logs_workspace_user ON work_deep_work_logs(workspace_id, user_id);

-- Enable RLS (Stub Policies)
ALTER TABLE work_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_formulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_session_reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_session_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_session_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_event_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_deep_work_logs ENABLE ROW LEVEL SECURITY;

-- Creating dummy policies for development (replace with actual auth policies later)
CREATE POLICY "Allow all operations for authenticated users" ON work_workspaces FOR ALL USING (true);
CREATE POLICY "Allow all operations for authenticated users" ON work_workspace_members FOR ALL USING (true);
CREATE POLICY "Allow all operations for authenticated users" ON work_categories FOR ALL USING (true);
CREATE POLICY "Allow all operations for authenticated users" ON work_metrics FOR ALL USING (true);
CREATE POLICY "Allow all operations for authenticated users" ON work_formulas FOR ALL USING (true);
CREATE POLICY "Allow all operations for authenticated users" ON work_targets FOR ALL USING (true);
CREATE POLICY "Allow all operations for authenticated users" ON work_dashboards FOR ALL USING (true);
CREATE POLICY "Allow all operations for authenticated users" ON work_tags FOR ALL USING (true);
CREATE POLICY "Allow all operations for authenticated users" ON work_entities FOR ALL USING (true);
CREATE POLICY "Allow all operations for authenticated users" ON work_projects FOR ALL USING (true);
CREATE POLICY "Allow all operations for authenticated users" ON work_milestones FOR ALL USING (true);
CREATE POLICY "Allow all operations for authenticated users" ON work_sessions FOR ALL USING (true);
CREATE POLICY "Allow all operations for authenticated users" ON work_session_reflections FOR ALL USING (true);
CREATE POLICY "Allow all operations for authenticated users" ON work_session_entities FOR ALL USING (true);
CREATE POLICY "Allow all operations for authenticated users" ON work_session_metrics FOR ALL USING (true);
CREATE POLICY "Allow all operations for authenticated users" ON work_attachments FOR ALL USING (true);
CREATE POLICY "Allow all operations for authenticated users" ON work_event_logs FOR ALL USING (true);
CREATE POLICY "Allow all operations for authenticated users" ON work_notifications FOR ALL USING (true);
CREATE POLICY "Allow all operations for authenticated users" ON work_deep_work_logs FOR ALL USING (true);
