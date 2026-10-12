import { createBrowserClient } from "@supabase/ssr";

// Klien Supabase di browser (memakai sesi login yang sama), untuk unggah file besar langsung ke Storage
export const supabaseBrowser = () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
