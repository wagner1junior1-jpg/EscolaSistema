# Auditoria 03 — Autorização e proteção de dados (commit e2c3bb7)

Data: 24/09/2026 · Pasta do projeto: SISTEMA ESCOLAR/Escola

## Veredito: aprovado, com 1 bug crítico e 3 falhas a corrigir

Pontos confirmados no código:
- Todos os métodos de Gestão e Relatório exigem o papel certo; atualizarEscola, períodos e desativarProfessor são só da direção.
- Professor: leitura liberada para dono, direção e coordenação; escrita só para o dono. A cadeia questão → atividade → oferta é verificada.
- O fallback 'usr-prof-ana' foi removido. Os contratos derivam autor, escola e turma da sessão.
- AlunoPublico está aplicado, ids.ts usa getRandomValues, e o fallback SHA-256 foi feito em JS puro.
- Transições rascunho → publicada → encerrada estão implementadas; publicar exige questões válidas.
- Frequência valida se o aluno é da turma e bloqueia data futura.

## Problemas encontrados

1. **CRÍTICO: publicar e encerrar não salvam no navegador.** A atividade é lida em um getDatabase() e o db salvo vem de outro getDatabase(). No navegador, cada chamada faz um JSON.parse novo do localStorage, então o status muda num objeto que é descartado. Os testes passam porque rodam sem `window` (o cache em memória é compartilhado). É preciso corrigir o db.ts para usar uma instância única e rodar os testes com um localStorage simulado.
2. **Invasão via salvarQuestoes**: se o payload trouxer o id de uma questão de OUTRA atividade (de outro professor), o serviço edita essa questão e troca as alternativas dela. Falta validar que questao.atividade_id === atividadeId e que o id de cada alternativa pertence à questão.
3. Adicionar ou excluir questões em atividade já publicada muda o status de quem já concluiu. Mudanças estruturais devem ser permitidas só em rascunho.
4. A data "hoje" usa UTC (toISOString). Depois das 21h no Brasil ela já é "amanhã". É preciso usar a data local.
5. Faltam validações de texto vazio (enunciado e alternativas).
6. A pasta .git antiga continua em SISTEMA ESCOLAR/.

## Sugestões do Antigravity
- Zerar a contagem de erros de PIN após um login correto: concordo, entra no Comando 6.
- Histórico de versão do enunciado editado após respostas: fica para depois do MVP.
