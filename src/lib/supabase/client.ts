import { createBrowserClient } from '@supabase/ssr'

function getCleanUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const cleaned = url.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '')
  return cleaned || 'https://placeholder.supabase.co'
}

export function createClient() {
  const url = getCleanUrl()
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
  return createBrowserClient(url, key)
}

