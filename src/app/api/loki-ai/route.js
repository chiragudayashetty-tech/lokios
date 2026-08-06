import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const READ_TOOLS = [
  'get_loki_snapshot',
  'search_journals',
  'get_daily_habits',
  'get_missions',
  'get_operations',
  'get_work_logs',
  'search_intel_drops',
  'get_screen_intel',
  'get_wellness',
  'analyze_loki_patterns',
]

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing server environment variable: ${name}`)
  return value
}

export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sign in to use Loki AI.' }, { status: 401 })
    if (process.env.LOKIOS_USER_ID && user.id !== process.env.LOKIOS_USER_ID) {
      return NextResponse.json({ error: 'This Loki AI instance is not configured for this user.' }, { status: 403 })
    }

    const body = await request.json()
    const message = String(body.message || '').trim()
    if (!message || message.length > 4000) {
      return NextResponse.json({ error: 'Message must be between 1 and 4000 characters.' }, { status: 400 })
    }

    const history = Array.isArray(body.history)
      ? body.history
        .filter((item) => ['user', 'assistant'].includes(item?.role) && typeof item.content === 'string')
        .slice(-10)
      : []

    const origin = request.headers.get('origin') || request.nextUrl.origin
    const mcpUrl = process.env.LOKIOS_MCP_URL || `${origin}/api/mcp`
    const openai = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${required('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5',
        store: false,
        instructions: 'You are Loki AI, a read-only strategic operating system. Review the user-owned Loki OS through the connected MCP tools. Never create, edit, complete, delete, or claim to have changed anything. Prefer get_loki_snapshot first, then analyze_loki_patterns or focused read tools. Give direct, evidence-based observations and name the relevant dates or modules.',
        input: [...history, { role: 'user', content: message }],
        tools: [{
          type: 'mcp',
          server_label: 'loki_os',
          server_description: 'Read-only access to the user-owned Loki OS journals, habits, missions, operations, work, intel, screen usage, and wellness data.',
          server_url: mcpUrl,
          headers: { Authorization: `Bearer ${required('LOKIOS_MCP_TOKEN')}` },
          allowed_tools: READ_TOOLS,
          require_approval: 'never',
        }],
      }),
    })

    const result = await openai.json()
    if (!openai.ok) return NextResponse.json({ error: result.error?.message || 'OpenAI request failed.' }, { status: openai.status })
    return NextResponse.json({ response: result.output_text || 'Loki AI returned no text.' })
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Loki AI request failed.' }, { status: 500 })
  }
}
