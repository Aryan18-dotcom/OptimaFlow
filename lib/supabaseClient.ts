import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';

// 1. Standard Client (Use this for your API routes, RLS, and Auth)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 2. Direct Connection (Use this ONLY for server-side heavy lifting or migrations)
// Ensure DATABASE_URL is only available on the server
export const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });