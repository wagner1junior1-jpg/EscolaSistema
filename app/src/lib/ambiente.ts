/**
 * SaberPontual — Configuração do ambiente
 *
 * `MODO_TESTE` é a ÚNICA chave que liga o ambiente de demonstração: faixa
 * "AMBIENTE DE TESTE", atalhos de login demo e "Restaurar dados de demonstração".
 * Controlada por VITE_MODO_TESTE; ligado por padrão. Para produção, definir
 * VITE_MODO_TESTE=false.
 */
export const MODO_TESTE: boolean = import.meta.env.VITE_MODO_TESTE !== 'false';

/**
 * Com Supabase a IA roda na Edge Function (a chave do Gemini fica no servidor); no mock a
 * demonstração usa uma chave colada no navegador ou as questões de exemplo.
 */
export const IA_NO_SERVIDOR: boolean = (import.meta.env.VITE_DATA_SOURCE || 'mock') === 'supabase';
