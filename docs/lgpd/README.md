# LGPD — SaberPontual (Fase 8.2)

Redigido em 27/10/2026. **Não é parecer jurídico:** revisar com um advogado antes de assinar com a escola.

## Papéis
- **Escola:** controladora (decide finalidade e base legal; atende os titulares).
- **Wagner (pessoa física, marca WTJ Soluções Tecnológicas):** operador.
- **Canal de privacidade:** wagner1junior1@gmail.com (e a secretaria da escola).

## Documentos
| Documento | Para quem | Onde |
|---|---|---|
| Política de privacidade | Qualquer pessoa (famílias, equipe) | Página pública `/privacidade` do app (`app/src/features/home/PrivacidadePage.tsx`; dados em `app/src/lib/privacidade.ts`) |
| Acordo de tratamento de dados | Escola × Wagner, assinado junto com o contrato | [acordo-tratamento-de-dados.md](acordo-tratamento-de-dados.md) |
| Autorização do responsável | A escola entrega às famílias | [autorizacao-responsavel.md](autorizacao-responsavel.md) |

## No sistema
- Gestão > Alunos e PINs > **Dados** (em cada aluno): baixar o arquivo com os dados (direção e coordenação) e apagar tudo de vez (só a direção, digitando o nome completo). Migration `0010_lgpd_aluno.sql`; cada pedido fica em `lgpd_registros`.
- Guarda: enquanto durar o contrato; no fim, cópia para a escola e eliminação em até 30 dias.

## Antes do primeiro dado real (checklist)
1. Preencher os campos entre colchetes (nome completo, CPF, dados da escola, cidade) e revisar com advogado.
2. Assinar o acordo com a escola.
3. A escola colher as autorizações das famílias antes de cadastrar os alunos.
4. O banco fica em **Oregon, EUA (us-west-2)**, decisão de 27/10/2026 de manter o projeto atual. A política e o acordo já declaram a transferência internacional (art. 33); o advogado deve conferir esse ponto.
5. Combinar com a escola que observações e comentários não devem conter dados sensíveis (saúde, família) além do necessário.
