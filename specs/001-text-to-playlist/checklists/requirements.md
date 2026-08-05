# Specification Quality Checklist: Importador de Playlist por Texto (Text-to-Playlist)

**Purpose**: Validar completude e qualidade da especificação antes de avançar para o planejamento
**Created**: 2026-08-05
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

Iteração 1 — correções aplicadas antes de marcar os itens acima:

1. **Vazamento de implementação nos requisitos**: FR-006 citava "PKCE", FR-002 citava `localStorage`, e vários requisitos citavam "Web API", "token" e "429". Reescritos em termos de capacidade e comportamento observável ("fluxo com prova de posse que não exija segredo de cliente nem servidor próprio", "armazenamento local do navegador", "autorização expirada", "limitação de requisições"). A escolha do fluxo concreto passa a ser decisão de `/speckit-plan`.
2. **SC-008 não era verificável pelo usuário**: dizia "funciona sem nenhum componente de servidor próprio — pode ser servida como arquivos estáticos", uma afirmação de arquitetura. Reescrito como resultado observável: o usuário consegue executar a aplicação a partir de hospedagem estática sem operar serviço próprio.
3. **Lacuna de cobertura**: o edge case "todas as linhas sem correspondência → criação bloqueada" não tinha requisito correspondente. Adicionado o requisito correspondente (hoje FR-035, após as renumerações da sessão de clarificação).
4. **Lacuna de critério de sucesso**: FR-030 (resiliência a falha parcial) e o cenário 7 da User Story 3 não tinham métrica associada. Adicionado **SC-009**.
5. **Termo indefinido**: os limiares que separam "Confiante" de "Incerta" não estavam especificados. Registrado explicitamente na seção Assumptions como decisão de planejamento — a spec exige apenas que as três classes existam e sejam distinguíveis, o que é testável.
6. **Checklist embutido removido**: a seção "Review & Acceptance Checklist" que estava dentro da spec original foi movida para este arquivo, conforme a convenção do Spec Kit.

Iteração 2 — revalidação após `/speckit-clarify` (2026-08-05): 16/16 itens continuam passando. Cinco clarificações foram integradas (rascunho persistido, vazão de busca, nome duplicado, rebusca por linha, telas estreitas), acrescentando FR-017, FR-027, FR-029, FR-043 a FR-045, FR-047 e SC-010 a SC-012. Nenhum item regrediu; a numeração de FR foi reordenada e verificada sem lacunas nem duplicatas.

Iteração 3 — adoção do Tailwind CSS (2026-08-05): a spec ganhou a subseção "Decisões técnicas registradas (não são requisitos)" dentro de Assumptions, nomeando o Tailwind. O item **"No implementation details"** continua marcado, e a justificativa é a seguinte: nenhum requisito (FR) nem critério de sucesso (SC) foi alterado, e a menção está explicitamente rotulada como registro de rastreabilidade, fora do corpo normativo. Apagar aquela subseção inteira não muda o que o produto deve fazer — que é o teste prático de "isto é requisito ou é implementação?". Se a subseção começar a acumular decisões que **condicionem** requisitos, ela deixa de ser inócua e deve ser movida para o `plan.md`.

Observações que **não** são falhas:

- As menções a "Spotify", "Client ID", "Client Secret", "Redirect URI" e "Developer Dashboard" são restrições de domínio do produto — o usuário precisa obter e informar esses valores. Não são escolhas técnicas de implementação e devem permanecer.
- A seção "Premissas Corrigidas" descreve limitações reais da plataforma que invalidam duas premissas do pedido original. É contexto de negócio necessário, não detalhe de implementação.
