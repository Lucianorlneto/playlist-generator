# Specification Quality Checklist: Estado de carregamento da criação de playlist

**Purpose**: Validar completude e qualidade da especificação antes do planejamento
**Created**: 2026-08-10
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] Sem detalhes de implementação (linguagens, frameworks, APIs)
- [x] Focada em valor para o usuário e necessidade de produto
- [x] Escrita para quem decide, não só para quem implementa
- [x] Todas as seções obrigatórias preenchidas

## Requirement Completeness

- [x] Nenhum marcador [NEEDS CLARIFICATION] restante
- [x] Requisitos testáveis e não ambíguos
- [x] Critérios de sucesso mensuráveis
- [x] Critérios de sucesso agnósticos de tecnologia
- [x] Todos os cenários de aceitação definidos
- [x] Casos de borda identificados
- [x] Escopo claramente delimitado
- [x] Dependências e premissas identificadas

## Feature Readiness

- [x] Todo requisito funcional tem critério de aceitação claro
- [x] As histórias cobrem os fluxos principais
- [x] A feature atende aos resultados mensuráveis definidos em Success Criteria
- [x] Nenhum detalhe de implementação vaza para a especificação

## Notas da validação

Uma passada, sem item reprovado. O que foi conferido explicitamente, além da leitura
item a item:

1. **Nenhum identificador de nó do arquivo de design dentro dos FR**, salvo a cauda de
   rastreabilidade de FR-001 e a de SC-001 — mesmo uso que a 008 faz. Os requisitos
   descrevem o que a pessoa vê; os nós ficam no Contexto e em Dependencies.
2. **`motion` não aparece em nenhum FR.** Os requisitos de movimento (FR-014 a FR-018b)
   descrevem comportamento; a biblioteca vive em Assumptions e Dependencies, onde o
   pedido do usuário a fixa. A justificativa que a constituição exige é material do
   Complexity Tracking do plano.
3. **Nenhum valor visual cru nos FR** — sem medida em pixels de componente e sem hex.
   O que os requisitos fixam é a relação (FR-008: um só tom, distinção por dimensão;
   FR-008a: perceptível contra o substrato; FR-019: tokens verificados nos dois temas),
   porque os valores do arquivo são do tema escuro e não sobrevivem ao claro. As duas
   medidas que restaram são a faixa de viewport de FR-029 e o orçamento de 200 ms de
   FR-010a — uma é requisito de responsividade, a outra reusa um limite já vigente no
   guia de estilo.

## Revalidação após `/speckit-clarify` — 2026-08-10

Quatro clarificações integradas. Checkboxes: **16/16 → 16/16**, nenhuma mudança de
estado e nenhuma regressão. As quatro respostas fecharam ambiguidade sem abrir nova, e
três das quatro observações abertas abaixo saíram resolvidas.

### Observações que não bloqueiam, mas o plano precisa endereçar

- **Dependência nova exige justificativa escrita** (constituição, "Simplicidade
  proporcional"): `motion` foi instalada pelo usuário e nomeada no pedido, o que
  resolve a decisão, mas não dispensa o registro no Complexity Tracking com a
  alternativa descartada.
- ~~**Duas tintas novas de esqueleto**~~ → **resolvido (Q2)**: é **um** token de papel
  próprio, mesmo tom nas duas barras, porque no arquivo elas dão 1,02:1 entre si e a
  distinção real é dimensional. Resta ao plano apenas escolher o valor do tema claro e
  registrá-lo em `approvedPairs.ts` e `tests/unit/contrast.spec.ts`, junto com o
  substrato do disco.
- ~~**FR-012 e FR-013 se tensionam com a linha viva atual**~~ → **resolvido**: FR-013
  passou a admitir duas regiões vivas no máximo — o rodapé e o aviso de espera — e
  FR-013a proíbe que digam a mesma coisa.
- ~~**FR-018 depende de `RateLimitWaiting`**~~ → **resolvido (Q1)**: o aviso passa a
  aparecer também na criação inicial e **perde** o ícone giratório; o disco do cartão é
  o único **giro** (FR-018a) — o esqueleto segue pulsando. FR-018b fecha a porta para o
  botão de cancelar migrar junto.
- **Aberto, de baixo impacto:** a feature cria componentes de animação — o plano decide
  se eles nascem em `src/ui/` como primitivos reutilizáveis ou locais à tela. É
  decomposição, não comportamento, e por isso não virou pergunta.
