// Supabase project for cloud saves and login. Paste the values from Supabase → Project Settings → API.
// Both are safe to ship in the client: the anon key only does what the row-level security policies allow.
// Leave URL empty to run without cloud saves (local only).
export const CLOUD = {
  url: 'https://oinddhybjopaueeukjev.supabase.co',          // e.g. 'https://abcdefghijkl.supabase.co'
  anonKey: 'sb_publishable_BdX7Psb3rdo_m6KPMVC5PQ_Tvi_hdiZ',      // the long 'anon public' key
  table: 'saves',
  sdk: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js',
  syncDebounceMs: 4000,   // local saves are pushed at most this often
};
