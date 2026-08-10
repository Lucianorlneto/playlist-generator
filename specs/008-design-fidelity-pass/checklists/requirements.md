# Specification Quality Checklist: Correções de fidelidade ao design oficial

**Purpose**: Validar a completude e a qualidade da especificação antes de planejar
**Created**: 2026-08-09
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] Sem detalhe de implementação (linguagem, framework, API)
- [x] Focada em valor para quem usa e na necessidade do produto
- [x] Escrita para quem não é desenvolvedor
- [x] Todas as seções obrigatórias preenchidas

## Requirement Completeness

- [x] Nenhum marcador [NEEDS CLARIFICATION] restante
- [x] Requisitos testáveis e sem ambiguidade
- [x] Critérios de sucesso mensuráveis
- [x] Critérios de sucesso independentes de tecnologia
- [x] Todos os cenários de aceitação definidos
- [x] Casos de borda identificados
- [x] Escopo delimitado
- [x] Dependências e premissas identificadas

## Feature Readiness

- [x] Todo requisito funcional tem critério de aceitação claro
- [x] As histórias cobrem os fluxos principais
- [x] A feature atende aos resultados mensuráveis da seção de sucesso
- [x] Nenhum detalhe de implementação vazou para a especificação

## Notes

- As **oito** decisões que mudariam materialmente o escopo foram resolvidas com o autor
  na sessão de 2026-08-09 e estão registradas no topo da spec: nome e assinatura do
  produto, alcance da linha de contexto do cabeçalho, conteúdo do painel lateral, estado
  vazio do painel, regra de derivação da trilha, linha secundária do cartão sem sessão,
  natureza da permissão de cor de marca, e forma de verificar a fidelidade textual.
- A resposta sobre a linha de contexto corrigiu uma leitura errada da primeira passada:
  o arquivo **não** repete a saudação em todas as telas. A tabela de FR-009 foi
  construída conferindo o arquivo tela a tela depois da correção, e não a partir das
  duas capturas do pedido.
- Três blocos alteram decisões da feature 007, e a alteração é deliberada, com o motivo
  escrito onde ela acontece. Os três precisam ser reavaliados contra a constituição no
  Constitution Check do plano:
  - **FR-003 e FR-004** abrem uma **exceção nomeada** ao uso da cor de marca: um
    substrato de identidade por provedor, usável só no distintivo do cartão de destino.
    Fora dali, preenchimento com cor de marca continua barrado, e a verificação recusa o
    uso indevido em vez de afrouxar para um limiar de opacidade.
  - **FR-014 a FR-020** revogam a decisão de manter o painel lateral sem texto. A
    exigência que sobrevive, e que a substitui, é FR-018: a informação do painel
    permanece completa sem as imagens.
  - **FR-028** troca a regra de derivação da trilha por uma só — deriva quando há valor,
    é neutra quando não há, sem olhar o estado do degrau. Não afrouxa o FR-066 da 007: a
    proibição de afirmar uma escolha que o usuário não fez continua literal e é
    reafirmada em FR-029.
- **FR-030a e FR-030b** substituem a conferência manual de textos por um inventário
  versionado com verificação executável. É uma resposta direta à causa desta feature: a
  conferência a olho da 007 é o que deixou estas divergências passarem. A conferência
  manual permanece só para o que é forma.
- O inventário em si ainda não existe; produzi-lo é trabalho do planejamento, não da
  especificação. O que a spec fixa é a obrigação de cobrir todas as telas, o desfecho
  exigido de cada item e o fato de o artefato ser versionado.
