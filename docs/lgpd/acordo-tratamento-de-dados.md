# Acordo de Tratamento de Dados Pessoais — SaberPontual

> Modelo para revisão por advogado antes de assinar. Preencha os campos entre colchetes.

**CONTROLADORA:** [NOME DA ESCOLA], inscrita no CNPJ [CNPJ DA ESCOLA], com sede em [ENDEREÇO], neste ato representada por [NOME E CARGO DO REPRESENTANTE], doravante **ESCOLA**.

**OPERADOR:** [NOME COMPLETO DE WAGNER], pessoa física, inscrito no CPF [CPF], que atua sob a marca WTJ Soluções Tecnológicas, e-mail wagner1junior1@gmail.com, doravante **OPERADOR**.

As partes, considerando a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados, LGPD), firmam este acordo, que complementa o contrato de uso do sistema SaberPontual.

## 1. Objeto
1.1. O OPERADOR trata dados pessoais em nome da ESCOLA exclusivamente para disponibilizar o SaberPontual: atividades e provas dos alunos, correção, acompanhamento pedagógico e relatórios para a equipe escolar.
1.2. A ESCOLA define as finalidades e a base legal do tratamento e responde perante os titulares e a ANPD como controladora.

## 2. Dados tratados
2.1. **Alunos:** nome completo, número de chamada, turma, PIN de acesso (armazenado apenas como hash), respostas, notas, comentários e observações dos professores, registros de acesso.
2.2. **Equipe:** nome, e-mail, função, senha (armazenada apenas como hash pelo provedor de autenticação), registros de uso da geração de questões.
2.3. O sistema não coleta CPF, endereço, telefone, foto, data de nascimento, dados de saúde nem dados dos responsáveis. A ESCOLA se compromete a não registrar dados sensíveis nos campos de texto livre (observações e comentários) além do estritamente necessário ao acompanhamento pedagógico.

## 3. Obrigações do OPERADOR
3.1. Tratar os dados somente conforme as instruções documentadas da ESCOLA e para as finalidades do item 1, nunca para fins próprios, publicidade, venda ou criação de perfis comerciais.
3.2. Manter medidas de segurança adequadas, entre elas: conexão criptografada; controle de acesso por função aplicado no banco de dados; hash de PINs e senhas; bloqueio após tentativas erradas; chave de inteligência artificial apenas no servidor; registro das exportações e exclusões de dados de alunos; cópias de segurança.
3.3. Guardar sigilo e exigir sigilo de qualquer pessoa autorizada a acessar os dados.
3.4. Usar apenas os suboperadores do item 5 e avisar a ESCOLA com antecedência de pelo menos 30 dias antes de incluir ou trocar algum, permitindo que ela se oponha.
3.5. Apoiar a ESCOLA no atendimento aos direitos dos titulares (LGPD, art. 18), encaminhando em até 2 dias úteis qualquer pedido recebido diretamente.
3.6. Comunicar à ESCOLA qualquer incidente de segurança que possa acarretar risco ou dano relevante aos titulares em até 24 horas da ciência, com as informações disponíveis sobre natureza, dados e titulares afetados e medidas adotadas.
3.7. Disponibilizar à ESCOLA as informações necessárias para demonstrar o cumprimento deste acordo.

## 4. Obrigações da ESCOLA
4.1. Informar as famílias sobre o uso do sistema e colher a autorização de pelo menos um dos pais ou responsável legal quando exigida (LGPD, art. 14), guardando os comprovantes.
4.2. Cadastrar apenas os dados necessários e manter atualizados os acessos da equipe (desativar quem sair da escola).
4.3. Orientar a equipe a guardar senhas e não fotografar, para a geração de questões por IA, material que contenha dados de alunos.
4.4. Atender os pedidos dos titulares, usando as funções do sistema para exportar ou apagar os dados de um aluno.

## 5. Suboperadores autorizados
| Serviço | Finalidade | Dados |
|---|---|---|
| Supabase (infraestrutura Amazon Web Services, região São Paulo) | Banco de dados, login e cópias de segurança | Todos os dados do item 2 |
| Vercel | Entrega das telas do site | Nenhum dado de aluno é armazenado |
| Google (Gemini) | Geração de questões | Apenas material pedagógico enviado pelo professor; nunca dados de alunos. Pode processar fora do Brasil |

## 6. Guarda e eliminação
6.1. Os dados ficam guardados enquanto vigorar o contrato de uso.
6.2. A pedido do titular ou responsável, a ESCOLA pode apagar a qualquer momento os dados de um aluno, de forma definitiva, pela função própria do sistema.
6.3. No fim do contrato, o OPERADOR entrega à ESCOLA, se ela pedir, uma cópia dos dados em formato legível por máquina e elimina todos os dados em até 30 dias, inclusive as cópias de segurança ao fim do ciclo de substituição delas, salvo obrigação legal de guarda.

## 7. Responsabilidade
7.1. Cada parte responde pelos danos a que der causa por descumprir a LGPD ou este acordo, nos termos dos arts. 42 a 45 da LGPD.

## 8. Vigência e foro
8.1. Este acordo vigora enquanto houver tratamento de dados pela ESCOLA no SaberPontual e sobrevive ao contrato no que for necessário à eliminação dos dados.
8.2. Fica eleito o foro da comarca de [CIDADE/UF].

[CIDADE], [DATA].

______________________________________
[NOME DA ESCOLA] — representante

______________________________________
[NOME COMPLETO DE WAGNER] — operador
