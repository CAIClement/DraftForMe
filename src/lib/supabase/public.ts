import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// A cookie-free Supabase client for anonymous reads of public, patch-stable data.
//
// Why this exists rather than reusing `./server`: `createClient()` there awaits
// `cookies()`, and `unstable_cache` cannot contain a `cookies()` call -- the
// request-scoped store makes the work uncacheable by definition. This client
// holds no session and reads no cookie, which is precisely what makes reads made
// through it cacheable across requests and across visitors.
//
// For the same reason it must NEVER be used for anything user-scoped: it cannot
// see the signed-in user, and any row it returned would be cached and handed to
// every other visitor. Anything that depends on the session goes through
// `./server` instead.
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false }
  });
}
