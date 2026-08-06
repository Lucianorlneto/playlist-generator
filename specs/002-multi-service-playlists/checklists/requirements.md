# Specification Quality Checklist: Destinos Múltiplos — Spotify e YouTube

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-05
**Updated**: 2026-08-05 — após `/speckit-clarify` (5 perguntas adicionais)
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

**16 de 16 itens aprovados.** A spec está completa quanto à qualidade. Resta um bloqueio de **governança**, externo a esta checklist.

### Esclarecimentos resolvidos

As três perguntas foram respondidas e incorporadas; nenhum marcador `[NEEDS CLARIFICATION]` restou. Registrado em _Clarifications › Session 2026-08-05_.

| Pergunta                                     | Decisão                                                                | Onde ficou                                                     |
| -------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| Esgotamento da cota diária                   | Bloqueio prévio na estimativa; sem retomada entre dias                 | FR-029, FR-030, FR-031, FR-033 · US4 · SC-008, SC-009 · Out of Scope |
| Propagação de correções entre serviços       | Só correções de texto; escolhas de candidata não se propagam           | FR-014 · SC-013 · Out of Scope                                 |
| Ordem dos serviços                           | Fixa: Spotify primeiro, YouTube depois                                 | FR-015 · SC-012 · Out of Scope                                 |

A decisão de cota gerou uma pergunta derivada, também registrada: playlists incompletas deixadas por encerramento por cota não são removidas pelo sistema (FR-032).

### Esclarecimentos da sessão `/speckit-clarify`

Cinco perguntas adicionais, todas respondidas e integradas na mesma seção `### Session 2026-08-05` (total de 9 registros).

| Pergunta                                          | Decisão                                                                                          | Onde ficou                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| Base de cálculo do saldo de cota                  | Orçamento padrão do provedor menos consumo registrado localmente; nenhum campo pedido ao usuário | FR-029, FR-030, FR-034 · Key Entities · Assumptions |
| Reduzir a lista após um destino já ter concluído  | Permitido, só por remoção de linhas; resumo declara a divergência                                | FR-013, FR-037, FR-040 · SC-018 · Edge Cases  |
| Rascunho de versão anterior                       | Restaurado como fluxo Spotify de destino único, sem aviso extra                                  | FR-042 · Edge Cases                           |
| Fronteira entre "parcial" e "falhou"              | Existência de playlist na conta, sem limiar percentual                                           | FR-040                                        |
| Seleção padrão na revisão do YouTube              | Mesma do Spotify; limiar de "Confiante" mais exigente no catálogo de vídeo                       | FR-023 · Assumptions                          |

Estrutura final: **47 requisitos funcionais**, **18 critérios de sucesso**, 4 user stories priorizadas, 24 edge cases.

### Observações sobre itens aprovados

- **"No implementation details"**: a seção _Premissas Corrigidas_ e a seção _Assumptions_ citam números concretos de cota do provedor (10.000 unidades/dia, 100 por busca, 50 por faixa). São **fatos de plataforma**, não escolhas de implementação, e sem eles FR-029 e FR-031 seriam inverificáveis. É o mesmo padrão editorial da feature 001, que documenta as limitações do Spotify da mesma forma. Nenhum requisito nomeia endpoint, método, biblioteca ou linguagem.
- **"Success criteria are technology-agnostic"**: SC-017 menciona "hospedagem de arquivos estáticos". É restrição de produto herdada de `001/SC-008` e do Princípio I da constituição — define onde o produto pode rodar e é verificável sem conhecer a implementação.
- **"Scope is clearly bounded"**: _Out of Scope_ cresceu com as decisões — exclui explicitamente YouTube Music, paralelismo, escolha de ordem pelo usuário, retomada entre dias, limpeza automática de playlist incompleta, propagação de escolhas de candidata e qualquer terceiro provedor.

### Bloqueio de governança (não é defeito da spec)

A feature exige uma **emenda MINOR da constituição** (v1.0.0 → v1.1.0) ratificada **antes** de `/speckit-plan`, com dois pontos:

1. **Princípio II** — ampliar a lista fechada de destinos de rede para incluir os hosts oficiais do provedor de vídeo. A constituição diz textualmente que ampliar essa lista é emenda, não decisão de implementação.
2. **Princípio V** — delimitar o alcance da retomabilidade. A decisão de não haver retomada entre dias colide com _"falha parcial DEVE ser retomável"_ e com _"o trabalho em andamento DEVE ser apagado apenas após sucesso ou por ação explícita"_. As duas saídas possíveis estão descritas no topo do spec.md.

O gate não mudou com a sessão de clarificação: continua sendo pré-requisito de `/speckit-plan`, e nenhuma das cinco decisões desta sessão o afeta.

Nenhum dos dois afeta os itens desta checklist, mas ambos bloqueiam a fase de planejamento.

---

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`
