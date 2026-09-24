import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[SaberPontual] Atenção: VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY não foram definidos no ambiente. Configure seu arquivo .env com base em .env.example.'
  );
}

// Cliente inicializado com fallback seguro para não quebrar em tempo de build/SSR
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);
