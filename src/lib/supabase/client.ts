import { createBrowserClient } from '@supabase/ssr'

function getCleanUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  return url.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '')
}

export function createClient() {
  return createBrowserClient(
    getCleanUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
