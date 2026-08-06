<!--
Sync Impact Report
==================
Mudança de versão: (template não ratificado) → 1.0.0

Ratificação inicial. O arquivo era o template não preenchido — todos os
princípios eram placeholders e o plano da feature 001 registrou explicitamente
a ausência de gates ratificados ("Constitution Check" em plan.md). Esta versão
converte em regras verificáveis as restrições que a spec 001-text-to-playlist
já impunha de fato e que o código já verifica por teste e por lint.

Princípios definidos (todos novos — antes eram [PRINCIPLE_N_NAME]):
- [PRINCIPLE_1_NAME] → I. Sem Servidor Próprio (NÃO NEGOCIÁVEL)
- [PRINCIPLE_2_NAME] → II. Nenhum Segredo, Superfície de Rede Fechada (NÃO NEGOCIÁVEL)
- [PRINCIPLE_3_NAME] → III. Domínio Puro, I/O Isolado
- [PRINCIPLE_4_NAME] → IV. Invariante Sem Teste Não É Invariante
- [PRINCIPLE_5_NAME] → V. Nenhuma Escrita Sem Confirmação Explícita (NÃO NEGOCIÁVEL)

Seções renomeadas:
- [SECTION_2_NAME] → Restrições de Plataforma e Produto
- [SECTION_3_NAME] → Fluxo de Desenvolvimento e Portões de Qualidade

Seções adicionadas: nenhuma além das acima.
Seções removidas: nenhuma.

Follow-up TODOs: nenhum. Nenhum placeholder foi deferido.

Reavaliação pendente: plan.md da feature 001 diz "se o projeto adotar uma
constituição depois, este plano deve ser reavaliado contra ela". A reavaliação
não foi feita por este comando (fora de escopo) e continua em aberto.

==================================================================
Sync Impact Report — emenda 1.1.0
==================================================================
Mudança de versão: 1.0.0 → 1.1.0 (MINOR)

Justificativa do salto: ampliação material de uma regra existente
(a lista fechada de destinos de rede do Princípio II passa a cobrir
mais de um provedor). Nenhum princípio foi removido nem redefinido,
e nenhuma regra marcada NÃO NEGOCIÁVEL foi afrouxada — o que
excluiria MAJOR pela política da própria seção Governance.

Origem: specs/002-multi-service-playlists exige destinos de rede de
um segundo provedor, e o Princípio II diz textualmente que ampliar
essa lista é emenda, não decisão de implementação.

Princípios modificados (nenhum renomeado):
- I. Sem Servidor Próprio — consequências generalizadas de "o fluxo
  do Spotify" para "o fluxo de cada provedor", com a limitação de
  sessão não renovável em silêncio aceita explicitamente.
- II. Nenhum Segredo, Superfície de Rede Fechada — lista fechada
  passa a ser por provedor, com tabela explícita; acrescentada a
  regra de que provedor não selecionado não recebe requisição.
- IV. Invariante Sem Teste Não É Invariante — verificação de hosts
  descrita por provedor; mock de ponta a ponta deixa de citar só o
  Spotify.

Princípios intocados: III e V.

Decisão registrada sobre o Princípio V: a spec 002 apontou colisão
entre o encerramento por esgotamento de cota e a cláusula "o
trabalho em andamento MUST ser apagado apenas após sucesso ou por
ação explícita de descarte". A colisão foi resolvida **na spec, não
na constituição**: a execução encerrada por cota preserva o
rascunho até descarte explícito. O Princípio V permanece literal.

Seções modificadas: Restrições de Plataforma e Produto (honestidade
sobre limites passa a cobrir assimetria entre provedores; storage
ganha regra de isolamento por provedor). Orientação de execução na
Governance passa a listar as duas features.

Seções adicionadas: nenhuma. Seções removidas: nenhuma.

Follow-up obrigatório (fora do escopo deste comando):
- specs/002-multi-service-playlists/spec.md — FR-038 precisa deixar
  de apagar o rascunho quando a execução termina por cota, e o gate
  constitucional no topo do documento precisa registrar que o
  Princípio V não foi emendado. Ver Next Actions no relatório.
-->

<!--
  Histórico: v1.0.0 (2026-08-05) ratificação inicial — relatório
  logo acima. v1.1.0 (2026-08-05) ampliação da superfície de rede.
-->

# Importador de Playlist por Texto — Constituição

## Core Principles

### I. Sem Servidor Próprio (NÃO NEGOCIÁVEL)

O artefato de produção MUST ser um conjunto de arquivos estáticos servível de
qualquer diretório, inclusive de subpasta, sem processo, variável de ambiente ou
regra de rewrite. Nenhum endpoint próprio, banco de dados, proxy ou função
serverless pode ser introduzido — nem "só para desenvolvimento", nem como
conveniência para contornar uma limitação da plataforma.

Consequências que MUST ser aceitas em vez de contornadas: para cada provedor, o
fluxo de autorização adotado MUST ser aquele que dispensa segredo de cliente e
componente de servidor, mesmo quando for o menos confortável dos disponíveis; o
retorno da autorização acontece na URL raiz, não em rota dedicada; e a
persistência é o armazenamento do próprio navegador.

Quando o fluxo sem segredo de um provedor não permitir renovar a sessão em
silêncio, a reautorização explícita MUST ser tratada como comportamento previsto
da interface — nunca como erro, e nunca como motivo para introduzir um backend
que guardasse o segredo.

_Razão_: é a restrição que define o produto. Ela é o que torna o app publicável
por qualquer pessoa em qualquer hospedagem estática e o que garante que nenhum
dado do usuário transite por infraestrutura de terceiros. Qualquer servidor
próprio destruiria as duas propriedades de uma vez.

### II. Nenhum Segredo, Superfície de Rede Fechada (NÃO NEGOCIÁVEL)

O Client Secret de qualquer provedor MUST NOT ser solicitado, aceito, transmitido
ou armazenado em nenhuma circunstância. Nenhuma credencial pode ser lida de
arquivo de ambiente — a entrada é sempre a interface, e o valor é exibido
mascarado por padrão.

Todo destino de rede MUST constar da lista fechada abaixo, mantida em um único
módulo de hosts autorizados e verificada por teste:

| Provedor | Destinos autorizados                                       |
| -------- | ---------------------------------------------------------- |
| Spotify  | `accounts.spotify.com`, `api.spotify.com`, `i.scdn.co`     |
| YouTube  | `accounts.google.com`, `www.googleapis.com`, `i.ytimg.com` |

A lista é exaustiva: cada entrada existe porque um fluxo de autorização, uma API
de dados ou a exibição de capas exige exatamente aquele host. Acrescentar host,
provedor ou entrada "por precaução" é emenda a esta constituição, não decisão de
implementação — e vale igualmente para hosts do mesmo provedor que já figura na
tabela.

Nenhuma requisição MUST ser emitida a um provedor que o usuário não selecionou,
nem a um provedor cuja credencial não esteja cadastrada. Não há telemetria,
analytics, fonte remota, CDN ou relatório de erro para terceiros. Os escopos
solicitados a cada provedor MUST ser o mínimo que o fluxo exige; adicionar escopo
requer justificativa registrada na spec.

Riscos aceitos MUST ser registrados por escrito com a mitigação adotada, como
já está feito para o token de renovação no armazenamento local (README §6).

_Razão_: a promessa de privacidade do produto é literal e auditável. Uma lista
fechada de hosts é verificável por máquina; "temos cuidado com dados" não é.

### III. Domínio Puro, I/O Isolado

`src/domain/` MUST permanecer puro: sem rede, sem DOM, sem armazenamento, sem
relógio ambiente e sem aleatoriedade não injetada. Toda regra de negócio —
análise de linhas, normalização, pontuação de similaridade, deduplicação,
particionamento em lotes, validação — MUST viver ali, como função determinística
de entrada para saída.

Todo I/O MUST estar em `src/services/`, atrás de interfaces mockáveis. Componentes
de `src/features/` e `src/app/` orquestram; eles MUST NOT conter regra de negócio
nem chamar `fetch` diretamente.

_Razão_: é o que permite testar as regras que realmente importam sem navegador,
sem rede e sem flakiness, e o que mantém o custo de mudar a camada de I/O baixo.

### IV. Invariante Sem Teste Não É Invariante

Toda regra desta constituição e todo requisito funcional com consequência
observável MUST ter verificação executável — teste automatizado ou regra de lint —
e não apenas prosa em documento. Convenção que só existe em revisão de código MUST
ser convertida em regra de lint ou abandonada.

O padrão já estabelecido MUST ser mantido: `tests/unit/no-secrets.spec.ts` falha se
`src/` mencionar segredo de cliente de qualquer provedor ou se alguma URL escapar
da tabela de hosts do Princípio II; `tests/unit/throughput.spec.ts` mede a vazão
contratada; `tests/a11y/` audita as etapas com axe-core; `eslint-rules/` impede
literal de texto de interface fora de `src/i18n/` e `className` montado em tempo
de execução.

A verificação de hosts MUST cobrir a tabela inteira, provedor a provedor, e MUST
falhar tanto por host ausente quanto por host excedente — uma lista que aceita
mais do que a constituição autoriza não é uma lista fechada.

Nenhum teste MUST tocar a rede real. Integração usa MSW; ponta a ponta usa
Playwright com todos os provedores mockados.

_Razão_: a única diferença entre um princípio e uma intenção é alguém conseguir
provar que ele foi violado antes do merge.

### V. Nenhuma Escrita Sem Confirmação Explícita (NÃO NEGOCIÁVEL)

O sistema MUST NOT criar, alterar ou remover qualquer coisa na conta do usuário
antes de uma confirmação humana explícita na etapa de revisão. A revisão MUST
mostrar o que será escrito, permitir corrigir linha a linha e permitir desistir.

Falha parcial MUST ser retomável sem duplicar nem perder faixas: a adição é feita
em lotes sequenciais com índice de confirmação persistido. O trabalho em andamento
MUST sobreviver a recarga, expiração de sessão e reconexão, e MUST ser apagado
apenas após sucesso ou por ação explícita de descarte. O rascunho MUST NOT conter
token nem credencial.

_Razão_: o app escreve na biblioteca pessoal de alguém a partir de correspondências
aproximadas. Confirmação humana é o que separa uma ferramenta útil de uma que
polui a conta do usuário com música errada.

## Restrições de Plataforma e Produto

**Honestidade sobre os limites da plataforma**: o que a API de um provedor não
oferece MUST NOT ser simulado. Pastas de playlist são o caso de referência — não
há campo de pasta, e o sistema exibe o caminho efetivo real com aviso de que
mover para pasta é ação manual no aplicativo oficial. Toda premissa do pedido que
colidir com a realidade da plataforma MUST ser corrigida na spec, com a decisão
adotada registrada, antes de virar código.

**Assimetria entre provedores**: provedores não têm as mesmas capacidades nem os
mesmos limites — orçamento diário de cota, renovação de sessão, natureza do
catálogo. A interface MUST expor a diferença onde ela muda o que o usuário pode
fazer, e MUST NOT aparentar simetria que não existe. Uma limitação que só afeta
um provedor MUST ser dita no contexto daquele provedor, não diluída em um aviso
genérico.

**Idioma**: toda a interface MUST estar em pt-BR, e todo texto visível ao usuário
MUST vir de `src/i18n/`. A regra `tp/no-ui-text-literals` é o mecanismo de
verificação.

**Acessibilidade**: o fluxo completo MUST ser operável por teclado, com foco
visível, rótulos associados, estados anunciados a leitor de tela e nenhuma
violação séria ou crítica no axe-core. Em telas estreitas o fluxo MUST permanecer
utilizável, sem rolagem horizontal da página.

**Desempenho**: a busca MUST sustentar pelo menos 2 linhas por segundo, com
progresso visível e cancelamento responsivo em qualquer momento — inclusive
durante espera por limitação de taxa. Limitação (HTTP 429) MUST respeitar
`Retry-After`.

**Simplicidade proporcional**: dependência nova MUST ser justificada por escrito
contra a alternativa de escrever o necessário à mão. O projeto não usa biblioteca
de componentes de UI nem SDK de provedor — nem sequer os oficiais —, e essa é a
posição padrão: o ônus da prova é de quem quer adicionar, não de quem quer manter.

**Armazenamento**: as chaves do navegador MUST ser versionadas e tipadas, com
esquema documentado. Mudança incompatível de formato MUST incluir migração ou
descarte seguro, nunca leitura de dado com formato antigo como se fosse novo.
Credencial e sessão MUST ser isoladas por provedor: remover ou expirar uma
MUST NOT afetar a de outro provedor.

## Fluxo de Desenvolvimento e Portões de Qualidade

**Portão local**: `npm run lint`, `npm run typecheck` e `npm test` MUST passar
antes de qualquer commit. `npm run test:e2e` MUST passar antes de publicar uma
mudança que altere o fluxo do assistente, a autorização ou a criação de playlist.
TypeScript roda em modo `strict`; suprimir erro de tipo com `any` ou
`@ts-expect-error` MUST vir acompanhado de comentário explicando por quê.

**Fluxo Spec Kit**: mudanças de comportamento MUST passar por spec antes de
código (`/speckit-specify` → `/speckit-plan` → `/speckit-tasks` →
`/speckit-implement`). Correção de defeito, ajuste de texto e refatoração sem
mudança observável estão dispensados.

**Constitution Check**: todo `plan.md` MUST conter a verificação contra esta
constituição antes da Fase 0 e reavaliá-la após a Fase 1. Violação sem
justificativa registrada bloqueia o planejamento.

**Complexidade justificada**: toda exceção a um princípio MUST ser registrada na
seção Complexity Tracking do plano, com a alternativa mais simples que foi
descartada e o motivo. Exceção não registrada é violação.

**Rastreabilidade**: teste que existe para garantir um requisito MUST citá-lo
(`FR-xxx`, `SC-xxx`) em nome ou comentário, como já é praticado.

## Governance

Esta constituição prevalece sobre qualquer outra prática, convenção ou preferência
do projeto. Em conflito entre um documento de feature e esta constituição, a
constituição vence, e o documento de feature MUST ser corrigido.

**Emendas**: qualquer alteração MUST ser feita por `/speckit-constitution`, em
commit próprio que não misture mudança de governança com mudança de código. A
emenda MUST declarar o que muda, por que muda e o impacto sobre o que já existe.
Emenda que invalide código existente MUST vir com plano de migração.

**Versionamento** (semântico, sobre a própria constituição):

- **MAJOR** — remoção ou redefinição incompatível de princípio; afrouxamento de
  regra marcada NÃO NEGOCIÁVEL.
- **MINOR** — novo princípio ou nova seção; ampliação material de uma regra.
- **PATCH** — esclarecimento, correção de redação, ajuste sem efeito semântico.

**Conformidade**: toda revisão de mudança MUST verificar aderência aos princípios.
Os três NÃO NEGOCIÁVEIS (I, II, V) não admitem exceção por conveniência,
urgência ou escopo de protótipo — mudá-los exige emenda MAJOR ratificada antes,
não depois, do código que os viola.

**Orientação de execução**: `README.md` para operação e privacidade;
`specs/001-text-to-playlist/` e `specs/002-multi-service-playlists/` para
requisitos, decisões técnicas e contratos.

**Version**: 1.1.0 | **Ratified**: 2026-08-05 | **Last Amended**: 2026-08-05
