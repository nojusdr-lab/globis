// Supabase client for optional accounts. Null when the app is built without Supabase settings.
import {createClient} from '@supabase/supabase-js';
import {read,write,remove} from '../state/storage';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL, KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = URL && KEY ? createClient(URL, KEY, {
  auth: {
    storage: {getItem: read, setItem: write, removeItem: remove},
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
}) : null;
