import { createClient } from '@supabase/supabase-js';

export function sanitizarSupabaseUrl(url?: string): string {
  if (!url) return '';
  return url
    .trim()
    .replace(/\/rest\/v1\/?$/, '')
    .replace(/\/+$/, '');
}

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseUrl = sanitizarSupabaseUrl(rawUrl);

export const isSupabaseConfigurado = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('your-project-id') &&
    !supabaseAnonKey.includes('your-anon-key')
);

if (!isSupabaseConfigurado) {
  console.warn(
    '[SaberPontual] Atenção: VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY não foram definidos no ambiente. Configure seu arquivo .env com base em .env.example.'
  );
}

// Cliente inicializado com fallback seguro para não quebrar em tempo de build/SSR/testes
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);
