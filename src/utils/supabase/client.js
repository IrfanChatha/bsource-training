import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseConfig } from "./config";

export const createClient = () => {
  const { url, key } = requireSupabaseConfig();
  return createBrowserClient(url, key);
};
