// Same connector with the key in the URL, for clients that only take a URL (claude.ai custom connectors).
import { handleMcp } from '../route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const withKey = async (request, { params }) => handleMcp(request, (await params).key)
export { OPTIONS } from '../route'
export const POST = withKey
export const GET = withKey
export const DELETE = withKey
