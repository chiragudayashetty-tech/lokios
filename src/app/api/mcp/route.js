// Loki OS connector for Claude (remote MCP, streamable HTTP, stateless).
// Add it in Claude as a custom connector: https://<your-domain>/api/mcp/<LOKIOS_MCP_TOKEN>
// (or send the token as "Authorization: Bearer <token>" to /api/mcp).
// Needs LOKIOS_MCP_TOKEN, LOKIOS_USER_ID and SUPABASE_SERVICE_ROLE_KEY on the server.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { asOwner, keyMatches, missingConfig } from '@/lib/mcp/session'
import { registerTools } from '@/lib/mcp/tools'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
}

const INSTRUCTIONS = `You are connected to Loki OS, the owner's personal operating system (habits, tasks, missions, sleep, budget, journal, XP).
Call get_today first to see today's habits and tasks with their names and ids.
Write tools (set_habit_status, complete_task, add_task, log_sleep, log_screen_time, log_expense, save_journal_entry, add_brain_dump) change real data and XP: use them only when the owner asks, and say what changed (including the XP change) afterwards.
Dates are YYYY-MM-DD in the owner's local time; times are 24h HH:MM.
When the owner sends an iPhone Screen Time screenshot, read the total and per-app times and call log_screen_time.`

/** Handles one MCP request; `key` comes from the URL path or the Authorization header. */
export async function handleMcp(request, key) {
  const missing = missingConfig()
  if (missing.length) return Response.json({ error: `Loki OS connector is not configured. Set: ${missing.join(', ')}` }, { status: 503, headers: CORS })
  const bearer = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!keyMatches(key || bearer)) return new Response('Unauthorized', { status: 401, headers: { ...CORS, 'WWW-Authenticate': 'Bearer' } })

  const server = new McpServer({ name: 'lokios', version: '2.0.0' }, { instructions: INSTRUCTIONS })
  registerTools(server, asOwner)
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  await server.connect(transport)
  try {
    const res = await transport.handleRequest(request)
    const headers = new Headers(res.headers)
    for (const [k, v] of Object.entries(CORS)) headers.set(k, v)
    return new Response(res.body, { status: res.status, headers })
  } catch (e) {
    return Response.json({ error: e.message || 'Internal error' }, { status: 500, headers: CORS })
  }
}

export const OPTIONS = () => new Response(null, { status: 204, headers: CORS })
export const POST = (request) => handleMcp(request, null)
export const GET = (request) => handleMcp(request, null)
export const DELETE = (request) => handleMcp(request, null)
