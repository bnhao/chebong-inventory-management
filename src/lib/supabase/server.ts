import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function getCleanUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  return url.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '')
}

export async function createClient() {
  const cookieStore = await cookies()
  const url = getCleanUrl()
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
          }
        },
      },
    }
  )
}
