/**
 * SaberPontual — Configuração do ambiente
 *
 * `MODO_TESTE` é a ÚNICA chave que liga o ambiente de demonstração: faixa
 * "AMBIENTE DE TESTE", atalhos de login demo e "Restaurar dados de demonstração".
 * Controlada por VITE_MODO_TESTE; ligado por padrão. Para produção, definir
 * VITE_MODO_TESTE=false.
 */
export const MODO_TESTE: boolean = import.meta.env.VITE_MODO_TESTE !== 'false';
