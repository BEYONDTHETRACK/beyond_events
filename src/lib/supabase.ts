import { isNative, WEB_URL } from './native'
import { createClient } from '@supabase/supabase-js'

// Clé publique (publishable) : elle peut figurer dans le code, la sécurité repose sur les règles RLS de la base.
const url = import.meta.env.VITE_SUPABASE_URL ?? 'https://qfheafbqrlmvnfgpjmwu.supabase.co'
const key = import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_0an4urV__p-bgDgiX65Zig_7lzPuSvH'

export const supabase = createClient(url, key, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

// Dans l'app mobile, les liens (e-mails de connexion, liens « rejoindre ») pointent vers la web app publique.
export function appUrl() {
  return isNative ? WEB_URL : `${window.location.origin}${window.location.pathname}`
}
