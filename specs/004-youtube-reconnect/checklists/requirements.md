# Specification Quality Checklist: Reconexão Sem Descartar o Trabalho (YouTube Reconnect)

**Purpose**: Validar completude e qualidade da especificação antes do planejamento
**Created**: 2026-08-07
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

### Iteração 1 — 2026-08-07

**Falhas corrigidas antes de registrar a checklist**:

- *No implementation details*: o rascunho inicial da seção "Contexto" citava arquivos e nomes de função e de símbolo interno. Reescrita para descrever apenas comportamento observável — "a execução daquele destino termina com desfecho falhou", "o serviço some da lista de contas". As referências que restaram (`002/FR-035`, `002` invariante R2) são a documentos de spec anteriores, não a código, e a convenção de prefixo está declarada no cabeçalho.
- *Success criteria technology-agnostic*: SC-007 dizia "nenhuma chamada HTTP"; passou a "nenhuma requisição é emitida ao serviço afetado", verificável sem citar protocolo.
- *Scope clearly bounded*: a fase de criação estava implícita; virou pergunta de escopo explícita (Q2) em vez de omissão.

**Esclarecimentos**: 2 marcadores foram levantados, ambos resolvidos na mesma sessão. Nenhum permanece.

### Iteração 2 — 2026-08-07, após as respostas

**Q1 = preservar o parcial, refazer só o restante.** Resposta contrária ao literal do pedido ("as buscas devem ser feitas novamente"), pelo custo em cota. Efeito na spec:

- FR-013 passou a calcular o custo exibido **apenas sobre as linhas não resolvidas**;
- nova subseção FR-013a a FR-013e — preservação, retomada parcial, teto de consumo, ordem e recálculo de duplicidade, e não-regressão do caminho sem interrupção;
- FR-014 reescrito para cobrir retomada nas duas fases;
- SC-009 acrescentado (consumo total igual ao da execução ininterrupta);
- dois casos de borda novos: zero linhas resolvidas e todas resolvidas.

**Q2 = cobrir busca e criação.** Efeito na spec:

- User Story 2 nova (P2), com 5 cenários de aceitação sobre escrita parcial;
- FR-027 a FR-032 substituem o marcador: aviso durante a criação, retomada a partir do lote confirmado, playlist não removida, desfecho parcial honesto, conta diferente tratada, e nenhuma nova confirmação de revisão exigida;
- SC-010 e SC-011 acrescentados (zero duplicação/ausência; nenhuma escrita antes da reconexão);
- entidade "Progresso de criação" acrescentada;
- assunção registrada sobre por que o Princípio V é atendido pela confirmação original.

**Renumeração**: as histórias passaram a 4 (P1, P2, P2, P3) e a seção de texto/verificação foi para FR-033/FR-034. Numeração conferida: FR-001 a FR-034 (com sufixos `a`–`e` em FR-013 e `a` em FR-016), SC-001 a SC-012, sem lacuna nem duplicata. Referências cruzadas a histórias e requisitos conferidas.

**Ponto de atenção para `/speckit-plan`, não bloqueante**: Q1 exige que a busca entregue resultado incremental, o que hoje não acontece — a lista é resolvida inteira e só então devolvida. É a maior mudança estrutural desta feature, cai no caminho compartilhado pelos dois provedores, e precisa de decisão explícita no plano sobre onde o parcial é acumulado e persistido sem violar o Princípio III (domínio puro).

**Resultado**: 16 de 16 itens aprovados. Pronta para `/speckit-plan`.

### Iteração 3 — 2026-08-07, durante `/speckit-plan`

A Fase 0 **refutou por execução** o diagnóstico da seção "Contexto". A spec afirmava que a perda de sessão encerrava a execução com desfecho "falhou"; medido com MSW, `runMatching` não lança, `handleSessionLoss` nunca roda no YouTube, a sessão não é encerrada e `authError` nunca é registrado. O erro é capturado **linha por linha** e vira "Não encontrada".

A seção "Contexto" foi reescrita (pontos 1 e 3, mais o parágrafo sobre o Spotify), conforme a exigência da constituição de corrigir na spec toda premissa que colida com a realidade verificada, antes de virar código. **Os requisitos não mudaram** — FR-001 e FR-002 já pediam o comportamento certo; apenas o relato de *como* a promessa era quebrada estava errado.

A checklist permanece 16/16: o item "No implementation details" continua atendido (a descrição nova é de comportamento observável) e nenhum requisito perdeu testabilidade. Detalhamento em [research §1](../research.md).

**Ponto de atenção da Iteração 2 resolvido**: a preocupação registrada — "Q1 exige resultado incremental, a maior mudança estrutural desta feature" — foi verificada e é **falsa**. `runProviderSearch` já produz item para toda linha e `ServiceRun.items` já é persistido. Ver [research §3](../research.md).
