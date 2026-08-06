import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { NextResponse } from 'next/server';

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const writeAction = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const env = (name) => {
  const val = process.env[name] || (name === 'SUPABASE_URL' ? process.env.NEXT_PUBLIC_SUPABASE_URL : name === 'SUPABASE_SERVICE_ROLE_KEY' ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : null);
  if (!val) throw new Error(`Missing server environment variable: ${name}`);
  return val;
};
const uid = () => process.env.LOKIOS_USER_ID || '';
const db = () => createClient(env('SUPABASE_URL'), process.env.SUPABASE_SERVICE_ROLE_KEY || env('NEXT_PUBLIC_SUPABASE_ANON_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: process.env.LOKIOS_TIMEZONE || 'Asia/Kolkata' }).format(new Date());

const range = (args = {}) => {
  const to = args.to || today();
  const from = args.from || new Date(Date.parse(`${to}T00:00:00Z`) - 30 * 86400000).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new Error('from and to must be YYYY-MM-DD dates');
  return { from, to, limit: Math.min(Math.max(Number(args.limit || 30), 1), 100) };
};

const out = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: data });

async function rows(client, table, args = {}, dateColumn) {
  const r = range(args);
  let query = client.from(table).select('*');
  if (uid()) query = query.eq('user_id', uid());
  if (dateColumn) query = query.gte(dateColumn, r.from).lte(dateColumn, r.to);
  const result = await query.order(dateColumn || 'created_at', { ascending: false }).limit(r.limit);
  if (result.error) throw new Error(`${table}: ${result.error.message}`);
  return result.data || [];
}

async function optional(client, table, args, dateColumn) {
  try {
    return await rows(client, table, args, dateColumn);
  } catch (error) {
    return { unavailable: true, reason: error.message };
  }
}

function register(server, client) {
  const common = { from: date.optional(), to: date.optional(), limit: z.number().int().min(1).max(100).optional() };
  const tool = (name, title, description, inputSchema, fn, annotations = readOnly) => server.registerTool(name, { title, description, inputSchema, annotations }, fn);

  tool('get_loki_snapshot', 'Loki OS State Snapshot', 'Read the current operating picture across progression, journals, habits, missions, operations, work, intel, screen usage, and wellness.', common, async (args) => {
    const r = range(args);
    let profileQuery = client.from('profiles').select('id,username,full_name,current_rank,current_level,total_xp,streak_days,longest_streak,last_active_date');
    if (uid()) profileQuery = profileQuery.eq('id', uid());
    const profile = await profileQuery.limit(1).maybeSingle();
    
    const [character, journals, habits, habitLogs, missions, operations, work, intel, screen, weight, sleep] = await Promise.all([
      optional(client, 'character_stats', { limit: 1 }),
      rows(client, 'journal_entries', args, 'date'),
      rows(client, 'habits', args),
      rows(client, 'habit_logs', args, 'date'),
      rows(client, 'goals', args),
      rows(client, 'tasks', args, 'due_date'),
      rows(client, 'work_logs', args, 'date'),
      rows(client, 'brain_dump', args),
      rows(client, 'screen_time_logs', args, 'date'),
      optional(client, 'weight_logs', args, 'date'),
      optional(client, 'sleep_logs', args, 'date')
    ]);
    return out({ range: r, profile: profile?.data || null, character_stats: character, journals, habits, habit_logs: habitLogs, missions, operations, work_logs: work, intel_drops: intel, screen_intel: screen, weight_logs: weight, sleep_logs: sleep });
  });

  tool('search_journals', 'Search Journals', 'Retrieve journal entries for reflection, emotional context, recurring themes, and decision history.', { ...common, query: z.string().optional() }, async (args) => {
    const data = await rows(client, 'journal_entries', args, 'date');
    const q = String(args.query || '').trim().toLowerCase();
    return out(q ? data.filter((row) => JSON.stringify(row).toLowerCase().includes(q)) : data);
  });

  tool('get_daily_habits', 'Get Daily Habits', 'Retrieve active habits and completion logs over a bounded date range.', common, async (args) => out({ habits: await rows(client, 'habits', args), logs: await rows(client, 'habit_logs', args, 'date') }));
  tool('get_missions', 'Get Missions', 'Retrieve goals and mission progress, deadlines, status, category, and XP rewards.', common, async (args) => out(await rows(client, 'goals', args)));
  tool('get_operations', 'Get Operations', 'Retrieve tasks and operations, including due dates, completion state, priority, category, and XP reward.', common, async (args) => out(await rows(client, 'tasks', args, 'due_date')));
  tool('get_work_logs', 'Get Work Logs', 'Retrieve work logs and output history for execution analysis.', common, async (args) => out(await rows(client, 'work_logs', args, 'date')));
  tool('search_intel_drops', 'Search Intel Drops', 'Retrieve brain dump items for idea capture and triage.', { ...common, query: z.string().optional() }, async (args) => {
    const data = await rows(client, 'brain_dump', args);
    const q = String(args.query || '').trim().toLowerCase();
    return out(q ? data.filter((row) => JSON.stringify(row).toLowerCase().includes(q)) : data);
  });
  tool('get_screen_intel', 'Get Screen Intel', 'Retrieve screen time logs for distraction, focus, and digital discipline analysis.', common, async (args) => out(await rows(client, 'screen_time_logs', args, 'date')));
  tool('get_wellness', 'Get Wellness', 'Retrieve weight and sleep data when those tables are installed.', common, async (args) => out({ weight_logs: await optional(client, 'weight_logs', args, 'date'), sleep_logs: await optional(client, 'sleep_logs', args, 'date') }));
  
  tool('analyze_loki_patterns', 'Analyze Loki OS Patterns', 'Compute bounded trend signals from habits, operations, journals, work logs, screen intel, and wellness.', { from: date.optional(), to: date.optional() }, async (args) => {
    const [journals, logs, operations, work, screen] = await Promise.all([
      rows(client, 'journal_entries', args, 'date'),
      rows(client, 'habit_logs', args, 'date'),
      rows(client, 'tasks', args, 'due_date'),
      rows(client, 'work_logs', args, 'date'),
      rows(client, 'screen_time_logs', args, 'date')
    ]);
    const completed = logs.filter((row) => row.status === 'completed').length;
    const activeOps = operations.filter((row) => row.status !== 'cancelled');
    const done = activeOps.filter((row) => row.status === 'completed').length;
    const focus = screen.reduce((sum, row) => sum + Number(row.focus_hours || 0), 0);
    const total = screen.reduce((sum, row) => sum + Number(row.total_hours || 0), 0);
    const hours = work.reduce((sum, row) => sum + Number(row.total_hours || row.hours || 0), 0);
    return out({ range: range(args), signals: { habit_completion_pct: logs.length ? Math.round(completed / logs.length * 100) : null, operation_completion_pct: activeOps.length ? Math.round(done / activeOps.length * 100) : null, journal_entries: journals.length, work_hours: Number(hours.toFixed(2)), screen_hours: Number(total.toFixed(2)), focus_hours: Number(focus.toFixed(2)), focus_ratio_pct: total ? Math.round(focus / total * 100) : null }, evidence: { recent_journals: journals.slice(0, 5), recent_operations: operations.slice(0, 10) } });
  });

  tool('complete_operation', 'Complete Operation', 'Mark one task completed and award its configured XP. Use only after explicit user intent.', { operation_id: z.string().uuid(), completion_note: z.string().max(500).optional() }, async (args) => {
    let q = client.from('tasks').select('*').eq('id', args.operation_id);
    if (uid()) q = q.eq('user_id', uid());
    const existing = await q.single();
    if (existing.error) throw new Error(`tasks: ${existing.error.message}`);
    if (existing.data.status === 'completed') return out({ already_completed: true, operation: existing.data });
    
    let u = client.from('tasks').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', args.operation_id);
    if (uid()) u = u.eq('user_id', uid());
    const update = await u.select().single();
    if (update.error) throw new Error(`tasks update: ${update.error.message}`);
    
    const xp = Number(update.data.xp_reward || 0);
    if (xp && uid()) {
      const awarded = await client.rpc('award_xp', { p_user_id: uid(), p_amount: xp, p_source_type: 'task', p_source_id: args.operation_id, p_description: args.completion_note || `Completed operation: ${update.data.title}`, p_stat_category: update.data.stat_category || 'discipline', p_multiplier: 1 });
      if (awarded.error) throw new Error(`award_xp: ${awarded.error.message}`);
    }
    return out({ completed: true, xp_awarded: xp, operation: update.data });
  }, writeAction);

  tool('create_mission', 'Create Mission', 'Create a Loki OS goal after explicit user intent.', { title: z.string().min(1).max(200), description: z.string().max(2000).optional(), type: z.enum(['main_quest', 'side_quest', 'long_term', 'weekly', 'daily']).default('side_quest'), category: z.string().default('personal'), xp_reward: z.number().int().min(1).max(10000).default(100), deadline: date.optional() }, async (args) => {
    const result = await client.from('goals').insert({ user_id: uid() || null, title: args.title, description: args.description || null, type: args.type, category: args.category, xp_reward: args.xp_reward, deadline: args.deadline || null, status: 'active', progress: 0 }).select().single();
    if (result.error) throw new Error(`goals insert: ${result.error.message}`);
    return out({ created: true, mission: result.data });
  }, writeAction);

  tool('create_intel_drop', 'Create Intel Drop', 'Capture a thought or idea after explicit user intent.', { content: z.string().min(1).max(5000), type: z.enum(['note', 'idea', 'task', 'goal', 'random']).default('note') }, async (args) => {
    const result = await client.from('brain_dump').insert({ user_id: uid() || null, content: args.content, type: args.type }).select().single();
    if (result.error) throw new Error(`brain_dump insert: ${result.error.message}`);
    return out({ created: true, intel_drop: result.data });
  }, writeAction);

  tool('save_journal_entry', 'Save Journal Entry', 'Write or update a journal entry after explicit user intent.', { date, what_did_i_do: z.string().max(5000).optional(), what_did_i_learn: z.string().max(5000).optional(), what_went_well: z.string().max(5000).optional(), needs_improvement: z.string().max(5000).optional(), mood: z.number().int().min(1).max(5).optional() }, async (args) => {
    const payload = { user_id: uid() || null, date: args.date, what_did_i_do: args.what_did_i_do || null, what_did_i_learn: args.what_did_i_learn || null, what_went_well: args.what_went_well || null, needs_improvement: args.needs_improvement || null, mood: args.mood || null };
    const inserted = await client.from('journal_entries').insert(payload).select().single();
    if (!inserted.error) return out({ saved: true, journal: inserted.data });
    
    let q = client.from('journal_entries').select('*').eq('date', args.date);
    if (uid()) q = q.eq('user_id', uid());
    const existing = await q.maybeSingle();
    if (existing.error || !existing.data) throw new Error(`journal save: ${inserted.error.message}`);
    
    let u = client.from('journal_entries').update(payload).eq('id', existing.data.id);
    if (uid()) u = u.eq('user_id', uid());
    const updated = await u.select().single();
    if (updated.error) throw new Error(`journal update: ${updated.error.message}`);
    return out({ saved: true, journal: updated.data });
  }, writeAction);
}

function authorized(request) {
  const token = process.env.LOKIOS_MCP_TOKEN;
  if (!token) return true;
  const expected = Buffer.from(token);
  const authHeader = request.headers.get('authorization') || '';
  const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const actual = Buffer.from(provided);
  return actual.length === expected.length && actual.length > 0 && crypto.timingSafeEqual(actual, expected);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID',
      'Access-Control-Allow-Methods': 'OPTIONS, POST',
    }
  });
}

export async function POST(request) {
  if (!authorized(request)) {
    return new Response('Unauthorized', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Bearer' }
    });
  }

  try {
    const body = await request.json();
    const server = new McpServer(
      { name: 'lokios', version: '1.0.0' },
      { instructions: 'You are connected to the user-owned Loki OS. Read tools are safe for analysis. Write tools change private data and require explicit user intent.' }
    );
    register(server, db());
    
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    
    let responseBody = null;
    let statusCode = 200;
    const mockRes = {
      status: (code) => { statusCode = code; return mockRes; },
      setHeader: () => mockRes,
      json: (data) => { responseBody = JSON.stringify(data); return mockRes; },
      end: (data) => { responseBody = data; return mockRes; },
      headersSent: false
    };

    await server.connect(transport);
    await transport.handleRequest(request, mockRes, body);

    return new Response(responseBody, {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
