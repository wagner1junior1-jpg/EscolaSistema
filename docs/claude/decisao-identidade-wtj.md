# Decisão — identidade WTJ na tela de entrada (04/10/2026)

Status: IMPLEMENTADO e commitado localmente em af2ad3e ("feat: assinatura WTJ Soluções Tecnológicas na tela de entrada"). Branch main, 1 commit à frente da origin/main: FALTA O PUSH (Wagner decide quando). Build OK e 215 testes segundo o Antigravity. Visual ainda não conferido no navegador (principalmente 360px).

## O que foi escolhido (opção A)
Tela de entrada do SaberPontual (logo do Educandário Adão Mendes, "Sou aluno", "Sou professor ou da gestão") ganhou uma assinatura discreta no fim do cartão:

- Linha separada por filete claro (borda superior #ECEEF6), centralizada, 13px, cor #4A4E73.
- Marca WTJ pequena (22px) + texto "Desenvolvido por **WTJ Soluções Tecnológicas**" (nome em #14163F, negrito).
- O topo continua só com a escola; a WTJ nunca compete com o logo do Educandário.

## Onde está no código
- app/src/components/common/AssinaturaWtj.tsx (componente novo)
- app/src/components/common/__tests__/AssinaturaWtj.test.tsx
- app/src/features/home/HomePage.tsx (renderiza `<AssinaturaWtj />` dentro do CartaoVidro, abaixo do botão de professor/gestão)

## Marca WTJ (resumo)
- Quadrado arredondado #14163F (rx 13 em viewBox 48) com um "W" em traço branco (espessura 4.5, pontas arredondadas) que termina numa folha #12B58C.
  - W: `M9 14 L16 34 L24 18 L31 34 L37 21`
  - Folha: `M37 21 C33 15 37 9 43 9 C44 15 42 21 37 21 Z`
- Versão para fundo escuro: quadrado branco, W #14163F, mesma folha.
- Cores (Wagner deixou a escolha com o Claude; mantidas): Tinta #14163F, Verde Cuidado #067A60 (botões/links), Broto #12B58C, Índigo Saber #3B3FD8, Névoa #E6F6F1.
- Fontes: Outfit (títulos/logotipo) e Nunito (texto), as mesmas do portal.

## Contato (definido em 04/10)
- WhatsApp: (62) 99254-9588 (link wa.me/5562992549588).
- Sem e-mail e sem CNPJ: não aparecem na landing nem no rodapé.

## Pendências
- Push do af2ad3e.
- Conferir no navegador (localhost:5173) a assinatura em desktop e em 360px.
- Decidir se a landing comercial (mockup separado) entra no mesmo repositório ou num site à parte.
- Mockup completo: canvas "Landing SaberPontual - WTJ Soluções Tecnológicas" (pranchas: Landing, Identidade WTJ, Tela de entrada A/B). Esse mockup vive no claude.ai, não no repositório.
- Opcional: favicon com a marca WTJ (não feito).
