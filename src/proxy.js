import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

// Reachable without a session. Each path (and everything under it) either serves
// public content or authenticates the caller itself with a token.
const PUBLIC_PATHS = [
  '/login',
  '/auth/callback',
  '/p',                       // public portfolio + résumé
  '/api/public',
  '/api/calendar',            // ICS feed, ?token=
  '/api/health',
  '/api/mcp',                 // Bearer LOKIOS_MCP_TOKEN
  '/api/screen-time/import',  // Bearer import token
  '/api/google/callback',     // checks the session itself and redirects with a readable error
]

const isUnder = (pathname, base) => pathname === base || pathname.startsWith(`${base}/`)

export async function proxy(request) {
  const { pathname } = request.nextUrl
  const isPublicRoute = PUBLIC_PATHS.some(base => isUnder(pathname, base))
  const profileSlug = pathname.match(/^\/p\/([^/]+)/)?.[1]

  // Public routes other than /login and /p/<slug> need neither the session nor a Supabase round trip.
  if (isPublicRoute && pathname !== '/login' && !profileSlug) return NextResponse.next()

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Any response other than supabaseResponse must carry over refreshed session cookies.
  const withCookies = (response) => {
    supabaseResponse.cookies.getAll().forEach(cookie => response.cookies.set(cookie))
    return response
  }
  const redirectTo = (path) => {
    const url = request.nextUrl.clone()
    url.pathname = path
    url.search = ''
    return withCookies(NextResponse.redirect(url))
  }

  if (profileSlug) {
    // The page streams, so notFound() there can only render the 404 UI with a 200 status.
    // Answer unknown slugs here instead; on a lookup error fall through and let the page decide.
    let slug
    try { slug = decodeURIComponent(profileSlug) } catch { return supabaseResponse }
    const { data, error } = await supabase
      .from('portfolio_summary')
      .select('id')
      .eq('public_portfolio_slug', slug)
      .maybeSingle()
    if (!error && !data) return withCookies(NextResponse.rewrite(new URL('/404', request.url)))
    return supabaseResponse
  }

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && !isPublicRoute) {
    // API callers get a status they can handle; a redirect would hand fetch() the login page.
    if (pathname.startsWith('/api/')) {
      return withCookies(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
    }
    return redirectTo('/login')
  }

  if (user && pathname === '/login') return redirectTo('/dashboard')

  return supabaseResponse
}

export const config = {
  // Static files (PWA manifest, service worker, icons, saga art) never need a session.
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico$|manifest\\.json$|sw\\.js$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
