/**
 * Senha mínima das contas da equipe (direção, coordenação, professores), que veem dados de
 * menores. Vale nas telas, nos serviços do Supabase e na Edge Function admin-usuarios
 * (que tem a sua própria cópia, porque roda fora do app). No painel do Supabase Auth, a
 * "Minimum password length" também deve ser 8.
 */
export const SENHA_MINIMA_EQUIPE = 8;
