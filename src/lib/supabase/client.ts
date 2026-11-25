import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/constants";

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Browser Supabase client (single shared instance). Used for the csv_exports table. */
export function getSupabaseBrowserClient() {
  if (!client) {
    const { url, anonKey } = getSupabaseEnv();
    client = createBrowserClient(url, anonKey);
  }
  return client;
}
