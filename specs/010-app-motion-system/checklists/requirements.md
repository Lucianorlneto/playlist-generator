# Specification Quality Checklist: Sistema de movimento do aplicativo

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-16
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

### Iteração 1 — 2026-08-16

Três marcadores `[NEEDS CLARIFICATION]` permanecem, todos por decisão que não tem
padrão razoável e que muda materialmente o trabalho:

| Marcador | Requisito | Por que não tem padrão |
| --- | --- | --- |
| Q1 | FR-035 | Escopo. O inventário identifica dez superfícies; a spec adota quatro. A fronteira entre P1–P2 e P3–P4 dobra ou reduz pela metade o tamanho da feature. |
| Q2 | FR-010 | `009/FR-010b` proíbe categoricamente animação de posição e dimensão. US2 e US3 pedem exatamente isso. Levantar ou manter a proibição decide se a lista de revisão pode reordenar. |
| Q3 | FR-034 | Movimento ocioso contínuo contraria o significado que a 009 fixou — movimento contínuo = trabalho em curso. É decisão de identidade do produto, não de implementação. |

Os demais itens passam. Notas de conformidade sobre os que passaram com ressalva:

- **"No implementation details"**: a spec nomeia nós do arquivo de design (`wv9Cp`,
  `Cards Column`) e artefatos existentes do projeto (`tp/no-raw-visual-values`, o projeto
  Playwright de movimento reduzido). É a prática da casa — a 009 faz o mesmo — e serve à
  rastreabilidade que a constituição exige, sem prescrever como implementar.
- **"Scope is clearly bounded"**: a fronteira negativa é explícita (FR-028, FR-036,
  FR-037, FR-038 e o item 10 do inventário). O que resta em aberto é a **extensão** da
  fronteira positiva, capturada em Q1.

### Iteração 2 — 2026-08-16

Q1, Q2 e Q3 respondidos pelo autor e gravados na spec (seção Clarifications). Os três
marcadores foram substituídos por requisitos afirmativos: FR-010/FR-010a (fronteira da
animação de posição), FR-034 (movimento ocioso), FR-035 (escopo por fatia). Checklist
completo.

### Iteração 3 — 2026-08-16, após o plano

Segunda rodada de `/speckit-clarify`, rodada **depois** de `/speckit-plan` — fora da ordem
recomendada, e por isso as respostas foram propagadas para `plan.md`, `data-model.md` e os
contratos no mesmo passo.

Cinco perguntas, todas respondidas. Requisitos novos: FR-018a (semântica da interrupção),
FR-021a (fases do ciclo não animam), FR-021b (aviso de rascunho), FR-031 reescrito (cartão
de destino sem transformação), FR-032a (adesivos uma vez por sessão). Critérios novos:
SC-016, SC-017.

Também foram removidas **sete contradições obsoletas** que sobreviviam do texto original,
todas descendentes da premissa de que as linhas chegavam em fluxo durante a busca, mais a
justificativa de CSP que a Fase 0 derrubou. Os itens de "Requirement Completeness" que
dependiam de ausência de contradição continuam passando — agora por verificação, não por
falta de conferência.

Contagem: 46 requisitos funcionais, 17 critérios de sucesso, 8 clarificações registradas.
