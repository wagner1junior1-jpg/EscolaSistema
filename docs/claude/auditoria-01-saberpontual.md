# Auditoria 01 — SaberPontual (Sistema Escolar)

Data: 24/09/2026 · Auditor: Claude · Autor do código: Antigravity

## O que o sistema é hoje

SPA estática (index.html + Tailwind CDN + 6 arquivos JS), sem backend. Todos os dados ficam no `localStorage` do navegador (`sistema_escolar_db`). Três perfis alternados por botão no topo, sem login: Aluno & Família, Professora, Direção & Coordenação.

- `data.js`: dados de demonstração (4 turmas, 16 alunos, atividades, questões, avisos, frequências)
- `storage.js`: classe `SchoolStorage` (CRUD + cálculos de mapa de calor, frequência, conselho de classe)
- `student.js`: fluxo código da turma → escolhe nome → PIN → painel → resolver lista → resultado; "Espaço dos Pais"
- `teacher.js`: turmas, alunos/PINs, frequência P/F/J, atividades/questões, mural, mapa de calor, filipetas
- `management.js`: visão geral, professores, mural institucional, conselho de classe
- `app.js`: orquestra modos, toasts e todos os modais de formulário

Veredito: **bom protótipo de demonstração para apresentar à diretora. Não é um sistema que funcione com alunos de verdade ainda.** O README diz "100% funcional e pronto para piloto", o que não é verdade.

(Esta auditoria é do protótipo original, hoje em prototipo/. O app atual está em app/ e já foi refeito em React + TypeScript; muitos pontos abaixo viraram as auditorias 02 a 08.)

## Problemas críticos (bloqueiam um piloto real)

1. **Sem backend: os dados não saem do aparelho.** A professora cria a atividade no computador dela; o aluno abre no celular dele e não vê nada, porque cada navegador tem seu próprio `localStorage`. O piloto só funciona se todos usarem o mesmo aparelho.
2. **Nenhuma autenticação para professora e direção.** Qualquer pessoa clica em "Professora" e vê a lista de PINs de todos os alunos, apaga turmas etc.
3. **O PIN aparece na tela de login do aluno** (`student.js` ~linha 541, "Dica de Demonstração"). Qualquer um entra como qualquer aluno.
4. **XSS**: nomes, enunciados, avisos são injetados com `innerHTML` sem escapar. Um aluno chamado `<img src=x onerror=...>` executa código. Com backend isso vira falha séria.
5. **LGPD**: dados de menores (nome, frequência, desempenho) sem login, sem termo, sem controle de acesso. Antes do piloto real é preciso ao menos: acesso restrito por perfil, termo de consentimento da escola e política de privacidade simples.

## Bugs de lógica

- **Frequência**: aluno sem registro no dia conta como presente (`getAlunoFrequenciaStats`, "Default present if untracked"). Aluno cadastrado depois ganha presença retroativa; e "J" conta como presença (decisão pedagógica a confirmar).
- **"Por que errou?"**: o formulário de questão tem um só campo e copia o mesmo texto para as 3 alternativas erradas. O modelo de dados suporta uma explicação por alternativa, mas a tela não. É o principal diferencial pedagógico e está capado.
- **Não existe edição de questão** (só criar/excluir). Um erro de digitação obriga a excluir e perder as respostas.
- **Conselho de classe** conta atividades inativas no total e usa nota só de listas 100% concluídas; lista pela metade some da média.
- **Bimestre** existe só como texto de configuração; respostas e frequências não são filtradas por bimestre, então o "boletim bimestral" é, na verdade, o acumulado do ano.
- **Modelo turma × disciplina**: cada turma tem uma única disciplina e um `professor_nome` em texto livre. Na escola real, o "7º Ano A" tem várias disciplinas e professores. Hoje é preciso criar "MAT7A", "PORT7A"... como turmas diferentes, com alunos duplicados e PINs diferentes por matéria. Isso precisa ser decidido **antes** de criar o banco.
- Professor → turmas está duplicado e inconsistente (`turmas_ids` no professor e `professor_nome` string na turma).
- `saveResposta` e `saveData` releem e regravam o banco inteiro a cada clique, o que é OK agora mas vira gargalo e causa condição de corrida em várias abas.
- Mapa de calor e alternativas fixos em 4 opções (A–D), sem validação.
- `exportBackupJSON`/`importBackupJSON` existem, mas não há botão; o usuário perde tudo se limpar o navegador.
- Botão "Roteiro Diretora" (roteiro de venda) está dentro do produto, visível para todos.

## Qualidade de código

- Arquivos grandes (teacher.js com 1.462 linhas) misturando HTML em template string, regra de negócio e eventos.
- Re-render total a cada mudança (`innerHTML` do container inteiro); perde foco/scroll.
- Tailwind via CDN (`cdn.tailwindcss.com`) é só para desenvolvimento; em produção precisa de build.
- `maximum-scale=1, user-scalable=no` impede zoom: problema de acessibilidade.
- Sem testes, sem controle de versão (a pasta não é repositório git).

## Pontos positivos

- Fluxo do aluno (código + nome + PIN com teclado numérico) é simples e bem pensado para celular.
- Estrutura pedagógica da questão (dica, pegadinha, explicação) é o diferencial certo.
- Mapa de calor com "alternativa mais escolhida entre as erradas" é útil para a professora.
- `storage.js` concentra o acesso a dados: facilita trocar por um backend depois.

## Decisão pendente com o Wagner

Qual será o backend? Recomendação: **Supabase** (Postgres + Auth + Row Level Security, plano gratuito, funciona direto do front-end sem servidor próprio). Alternativa: Firebase. (Decidido depois: Supabase, só para testes por enquanto.)

## Plano de fases

- Fase 0 — Regras do projeto (AGENTS.md) + git.
- Fase 1 — Correções rápidas no protótipo (segurança de tela, XSS, pegadinha por alternativa, editar questão, frequência).
- Fase 2 — Redesenho do modelo de dados (turma × disciplina × professor, bimestre).
- Fase 3 — Migração para o backend escolhido + login de professora/direção + RLS.
- Fase 4 — Piloto com uma turma.
