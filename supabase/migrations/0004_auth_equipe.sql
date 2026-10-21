-- =============================================================================
-- SABERPONTUAL — AUTENTICAÇÃO DA EQUIPE (Fase 3 do plano do back end)
--
-- Roda DEPOIS da 0003. Não apaga dados.
--
-- O que faz:
--   * public.concluir_troca_senha(): o usuário logado encerra a "troca obrigatória de
--     senha" (perfis.trocar_senha = false). `perfis` não tem política de UPDATE (só a Edge
--     Function admin-usuarios, com service role, escreve nela), então a troca passa por
--     esta função SECURITY DEFINER, que só mexe na linha do próprio auth.uid().
--
-- A flag trocar_senha é de experiência de uso (leva o usuário à tela de troca); não é uma
-- barreira de segurança: quem tem a senha provisória já é o dono legítimo da conta.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.concluir_troca_senha()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.perfis SET trocar_senha = false WHERE id = auth.uid() AND ativo
$$;

REVOKE ALL ON FUNCTION public.concluir_troca_senha() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.concluir_troca_senha() TO authenticated;
