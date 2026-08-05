# Feature Specification: Destinos Múltiplos — Spotify e YouTube (Multi-Service Playlists)

**Feature Directory**: `specs/002-multi-service-playlists`

**Feature Branch**: `main` (nenhum hook de criação de branch configurado neste projeto)

**Created**: 2026-08-05

**Status**: Draft — esclarecimentos resolvidos; bloqueada por emenda constitucional antes de `/speckit-plan`

**Input**: User description: "Agora precisamos adicionar a funcionalidade de criar também uma playlist no youtube. Primeiro deve ser feito um seletor múltipla escolha (com apenas os serviços que tiveram ids cadastrados selecionados por default). Após isso, dependendo com quais serviços foram escolhidos, o fluxo deve seguir para esse serviços escolhidos. Primeiro deve ser criada a playlist do primeiro, depois pro segundo, seguindo o fluxo completo para ambos os serviços. A sessão inicial de configuração também deve pedir as credenciais no youtube como opcionais, liberando o seletor do youtube apenas se as credenciais estiverem adicionadas, igualmente como o spotify. O spotify deve ser selecionável apenas se o Client ID estiver 'cadastrado'"

**Convenção de referência**: requisitos da feature anterior aparecem como `001/FR-xxx` e `001/SC-xxx`. Requisitos sem prefixo pertencem a este documento.

---

## ⚠️ Premissas Corrigidas e Gate Constitucional (ler antes de `/speckit-plan`)

### Gate constitucional — exige emenda antes do planejamento

O Princípio II da [constituição](../../.specify/memory/constitution.md) fixa uma lista fechada de três destinos de rede (`accounts.spotify.com`, `api.spotify.com`, `i.scdn.co`) e diz textualmente: _"Ampliar essa lista é uma emenda a esta constituição, não uma decisão de implementação."_

Esta feature **não é implementável** sem ampliar essa lista para incluir os destinos oficiais do serviço de vídeo (autorização, API de dados e miniaturas). Portanto:

- **Ação requerida**: emenda MINOR da constituição (v1.0.0 → v1.1.0) via `/speckit-constitution`, ampliando a lista autorizada e generalizando o Princípio II de "Spotify" para "os provedores que o usuário selecionou".
- **A emenda DEVE ser ratificada antes de `/speckit-plan`**, não depois. O Princípio II é NÃO NEGOCIÁVEL e a governança exige emenda ratificada _antes_ do código que a violaria.
- O Princípio I (sem servidor próprio) **não** é violado por esta feature e permanece intacto.

#### Segundo ponto para a mesma emenda: alcance do Princípio V

A decisão registrada em Clarifications — esgotamento de cota **não** gera trabalho retomável em outro dia — colide com dois trechos do Princípio V:

| Trecho do Princípio V                                                                     | Colisão                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _"Falha parcial DEVE ser retomável sem duplicar nem perder faixas"_                       | O esgotamento de cota no meio da adição é uma falha parcial, e FR-031 encerra a execução sem oferecer retomada.                                                                                        |
| _"O trabalho em andamento DEVE ser apagado apenas após sucesso ou por ação explícita"_     | FR-038 apaga o rascunho quando todos os serviços terminam, e uma execução encerrada por cota conta como terminada — logo o rascunho seria apagado sem sucesso e sem ação explícita do usuário.          |

A emenda DEVE resolver isso explicitamente, de uma das duas formas: **(a)** delimitar o alcance do Princípio V à retomada _dentro de uma execução_ (rede, limitação de requisições, reautorização), classificando o esgotamento de cota como desfecho terminal legítimo; ou **(b)** manter o rascunho após encerramento por cota e exigir descarte explícito, preservando a segunda cláusula ao custo de um rascunho que não retoma nada.

O restante do Princípio V — nenhuma escrita sem confirmação humana explícita — permanece intacto e é reforçado por FR-019.

### Premissas corrigidas

Três premissas implícitas no pedido não se realizam como descritas. As decisões abaixo estão refletidas nos requisitos.

| Premissa implícita                                                            | Realidade da plataforma de vídeo                                                                                                                                                                                                                                                                                                                                                                             | Decisão adotada                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "credenciais do YouTube" (plural, análogas às do Spotify)                     | A credencial utilizável por uma aplicação que roda só no navegador é **apenas o Client ID** de um app registrado pelo próprio usuário; o segredo de cliente não pode ser usado no navegador. A contrapartida é que a autorização obtida **não é renovável em silêncio**: expira em cerca de uma hora e exige reautorização explícita — diferente do Spotify, que renova sozinho (`001/FR-008`).                 | Um único campo por serviço (Client ID), tratado com o mesmo cuidado de segredo. A expiração vira comportamento visível e previsto (FR-034), não um erro.                                                                            |
| "criar uma playlist no YouTube" (entendido como playlist do YouTube Music)    | A API cria **playlists do YouTube**, não do YouTube Music, e não permite escrever em "Músicas curtidas" nem em bibliotecas do YouTube Music. O catálogo pesquisável é de **vídeos**, não de faixas: não há álbum, não há ISRC, e o mesmo título aparece como clipe oficial, áudio oficial, ao vivo, cover, remix e versão acelerada.                                                                            | O produto cria e nomeia playlists do YouTube, sem prometer YouTube Music. A revisão exibe canal e duração em vez de álbum, e sinaliza indícios de versão diferente. A meta de acerto automático é menor que a do Spotify (SC-006).   |
| "seguir o fluxo completo para ambos os serviços" (com o mesmo custo em ambos) | A API de dados de vídeo opera sob **orçamento diário de cota**, não apenas limite de requisições por segundo. No orçamento padrão de 10.000 unidades/dia, cada busca custa 100 unidades e cada faixa adicionada custa 50 — uma lista de 50 linhas consome cerca de **7.600 unidades, ~76% do dia inteiro**. Duas listas de 50 linhas no mesmo dia não cabem; uma de 250 linhas excede o orçamento em ~4 vezes.   | A cota é tratada como restrição de primeira classe: a estimativa **bloqueia** listas que não couberem (FR-029), e o esgotamento durante a execução encerra a execução com relato preciso, sem prometer retomada em outro dia (FR-031).                     |

O Spotify **não** tem orçamento diário equivalente. A consequência de produto é que os dois destinos não são simétricos em capacidade, e a interface não pode fingir que são.

### Herança da feature 001

Toda garantia da feature 001 continua valendo e passa a valer **por serviço**, salvo onde este documento diz o contrário: entrada de credencial só pela interface e mascarada (`001/FR-001`–`001/FR-004`), nenhum segredo de cliente (`001/FR-005`), sem servidor próprio (`001/FR-006`), revisão obrigatória antes de qualquer escrita (`001/FR-031`), resiliência a falha parcial sem duplicar (`001/FR-033`), rascunho no dispositivo (`001/FR-043`–`001/FR-045`), acessibilidade (`001/FR-046`), telas estreitas (`001/FR-047`) e interface em pt-BR (`001/FR-048`).

Três pontos da 001 são **alterados** por esta feature: `001/FR-010` (destinos de rede, agora por provedor selecionado), `001/FR-041` (fluxo de quatro etapas, agora com seletor de destinos e ciclo por serviço) e a obrigatoriedade implícita do Client ID do Spotify (agora opcional, desde que haja ao menos uma credencial).

---

## Clarifications

### Session 2026-08-05

- **Q**: O trabalho interrompido pelo esgotamento da cota diária fica retomável quando o orçamento renova? → **A**: Não. A estimativa **bloqueia** listas que não couberem no orçamento disponível, e o esgotamento durante a execução encerra a execução relatando com precisão o que entrou e o que faltou. Não há retomada entre dias. Consequência aceita: o YouTube fica limitado ao que couber em um orçamento diário — na prática, uma lista da ordem de 50 linhas por dia no orçamento padrão.
- **Q**: As correções de linha feitas na revisão do primeiro serviço se propagam para a busca do segundo? → **A**: Sim, mas apenas as correções de **texto** da linha. As escolhas de faixa ou vídeo não se propagam, porque são específicas do catálogo de cada serviço. Corrigir a grafia de um artista uma vez basta para os dois destinos; escolher qual gravação usar é decisão por serviço.
- **Q**: Quem define a ordem dos serviços quando ambos são selecionados? → **A**: Ordem fixa definida pelo produto: **Spotify primeiro, YouTube depois**. Não há controle de ordenação na interface. Além de eliminar configuração, a ordem garante que o serviço sem limite de cota conclua antes, de modo que um bloqueio de cota nunca comprometa o resultado do Spotify.
- **Q**: Como o sistema decide que uma lista não cabe no orçamento diário, se o provedor não informa quanto da cota já foi consumida? → **A**: Assumindo sempre o **orçamento padrão do provedor** e descontando apenas o consumo que a própria aplicação registrou naquele dia, no dispositivo. Nenhum campo de configuração pede o orçamento ao usuário. Consequência aceita: quem tiver ampliado a cota junto ao provedor continua limitado ao cálculo conservador da aplicação, e as mensagens precisam dizer que o cálculo parte do orçamento padrão.
- **Q**: Depois de a playlist do primeiro serviço já ter sido criada, o usuário pode encurtar a lista para caber na cota do segundo? → **A**: Sim. A divergência entre destinos é resultado normal, e o resumo final DEVE declarar explicitamente que cada serviço recebeu uma lista diferente. Restrição adotada para manter o relato verdadeiro: a lista de um destino posterior só pode ser **reduzida** — remoção de linhas —, nunca alterada nem ampliada, de modo que ela seja sempre um subconjunto da lista usada pelos destinos anteriores.
- **Q**: Um rascunho gravado pela versão anterior, sem informação de destinos, é restaurado ou descartado? → **A**: Restaurado como fluxo de destino único com o Spotify selecionado, retomando na etapa em que parou. Nenhum aviso adicional além do banner de recuperação já existente — para o usuário, é a mesma recuperação de sempre.
- **Q**: O que separa "parcial" de "falhou" no resumo final? → **A**: A existência ou não de playlist na conta. **Falhou** = nenhuma playlist chegou a ser criada. **Parcial** = playlist criada, mas nem todas as faixas confirmadas entraram. **Concluído** = playlist criada com todas as faixas confirmadas dentro. Sem limiar percentual: o que muda o próximo passo do usuário é ter ou não uma playlist para conferir.
- **Q**: Na revisão do YouTube, correspondências "Confiante" vêm marcadas por padrão como no Spotify? → **A**: Sim, mesmo comportamento nos dois serviços — "Confiante" marcado, "Incerta" desmarcado. A menor precisão do catálogo de vídeo é absorvida por um limiar de "Confiante" mais exigente no YouTube e pela sinalização de versão diferente, não por obrigar confirmação linha a linha.
- **Q**: Uma execução encerrada por cota no meio da adição deixa uma playlist incompleta na conta. Como isso é tratado? → **A**: A playlist incompleta **não** é removida pelo sistema. O relato de encerramento informa que ela existe, quais linhas entraram e quais faltaram, e adverte que uma nova tentativa com o mesmo nome será bloqueada pela checagem de nome duplicado — o usuário escolhe outro nome ou apaga a playlist parcial no aplicativo do provedor.

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Cadastrar credenciais opcionais e escolher os destinos (Priority: P1)

O usuário abre a aplicação e encontra, na etapa de configuração, um campo de credencial para cada serviço suportado — nenhum deles obrigatório isoladamente. Ele cadastra o que tiver: só o Spotify, só o YouTube, ou os dois. Cada campo mostra as instruções e o Redirect URI daquele serviço, com botão de copiar. Ao avançar, ele vê um seletor de múltipla escolha com os dois destinos: os que têm credencial cadastrada aparecem habilitados e **já marcados**; os que não têm aparecem desabilitados, com o motivo escrito e um atalho para voltar e cadastrar.

**Why this priority**: é a fundação de tudo. Sem ela não existe escolha de destino, e ela sozinha já entrega valor — torna explícito para o usuário o que está configurado e para onde a playlist vai. Entregue isoladamente, o fluxo Spotify da 001 continua funcionando, agora com o destino visível e confirmado.

**Independent Test**: cadastrar apenas o Client ID do YouTube e verificar que o seletor habilita YouTube e mantém Spotify desabilitado com motivo visível; depois cadastrar o do Spotify e verificar que ambos aparecem marcados por padrão; remover um dos dois e verificar que ele volta a ficar desabilitado e desmarcado, sem afetar o outro.

**Acceptance Scenarios**:

1. **Given** nenhuma credencial cadastrada, **When** o usuário tenta avançar da configuração, **Then** o avanço é bloqueado com explicação de que é preciso cadastrar ao menos um serviço.
2. **Given** apenas o Client ID do Spotify cadastrado, **When** o usuário chega ao seletor, **Then** Spotify está habilitado e marcado, e YouTube está desabilitado com o motivo "credencial não cadastrada" e um atalho para cadastrá-la.
3. **Given** os dois Client IDs cadastrados, **When** o usuário chega ao seletor, **Then** os dois destinos estão marcados por padrão.
4. **Given** os dois cadastrados e ambos marcados, **When** o usuário desmarca um, **Then** o avanço continua permitido com um único destino.
5. **Given** ambos marcados, **When** o usuário desmarca os dois, **Then** o avanço é bloqueado com a explicação de que é preciso escolher ao menos um destino.
6. **Given** credencial do YouTube cadastrada e destino marcado, **When** o usuário remove essa credencial, **Then** o destino é desmarcado e desabilitado, e a credencial e a seleção do Spotify permanecem intactas.
7. **Given** qualquer credencial cadastrada, **When** exibida na tela, **Then** aparece mascarada por padrão, revelável apenas enquanto o controle de revelar está acionado.

---

### User Story 2 — Criar a playlist no YouTube a partir da mesma lista (Priority: P2)

Com apenas o YouTube selecionado, o usuário cola a lista `música - artista`, informa nome e visibilidade, e o sistema busca cada linha no catálogo de vídeos. A revisão mostra, por linha, o vídeo escolhido com **canal e duração** (não álbum), até cinco alternativas, e sinalização quando o candidato parece ser uma versão diferente (ao vivo, cover, remix, acelerada). Antes de iniciar a busca, o sistema informa quanto da cota diária a lista deve consumir. Confirmada a revisão, a playlist é criada e o resultado traz link direto, totais e as linhas não encontradas.

**Why this priority**: é o valor central do pedido. Independentemente do fluxo de dois destinos, um usuário que só usa YouTube passa a ser atendido.

**Independent Test**: com apenas o YouTube selecionado, executar o fluxo inteiro com uma lista de 50 linhas e verificar a playlist criada na conta, com ordem preservada, e o consumo de cota informado antes de começar.

**Acceptance Scenarios**:

1. **Given** apenas YouTube selecionado e lista de 50 linhas colada, **When** o usuário avança para a busca, **Then** o sistema exibe a estimativa de consumo da cota diária e o quanto isso representa do orçamento antes de disparar qualquer requisição.
2. **Given** a busca concluída, **When** a revisão é exibida, **Then** cada item mostra título do vídeo, canal, duração e miniatura, e nenhum campo de álbum é prometido.
3. **Given** um candidato cujo título contenha indício de versão diferente, **When** exibido na revisão, **Then** o indício está sinalizado de forma visível.
4. **Given** a revisão confirmada, **When** a criação termina, **Then** o resultado traz link direto para a playlist, total adicionado, total ignorado e as linhas não encontradas, copiáveis em bloco.
5. **Given** já existir na conta uma playlist com o mesmo nome, **When** o usuário tenta criar, **Then** a criação é bloqueada exigindo nome diferente, ignorando maiúsculas/minúsculas e espaços nas bordas.
6. **Given** a criação bem-sucedida, **When** o resultado é exibido, **Then** o sistema informa o caminho efetivo da playlist e que pastas não são gerenciáveis pela aplicação.

---

### User Story 3 — Criar nos dois serviços, um depois do outro (Priority: P3)

Com os dois destinos selecionados, o usuário cola a lista e informa nome e visibilidade **uma única vez**. O sistema então executa o ciclo completo do primeiro serviço — autorizar, buscar, revisar, criar, ver resultado — e só depois começa o do segundo, indicando sempre em qual serviço ele está e quantos faltam ("Spotify — 1 de 2"). A autorização de cada serviço é pedida apenas quando a etapa dele começa. Ao final, um resumo consolidado mostra o desfecho de cada destino.

**Why this priority**: é a composição das duas anteriores. Depende delas, e entrega o cenário completo pedido.

**Independent Test**: selecionar os dois destinos, executar o fluxo inteiro com a mesma lista e verificar duas playlists criadas — uma em cada conta — com a ordem original preservada, mais um resumo final por serviço.

**Acceptance Scenarios**:

1. **Given** dois destinos selecionados, **When** o usuário informa texto, nome e visibilidade, **Then** o sistema pede esses dados uma única vez e os aplica aos dois destinos.
2. **Given** o ciclo do primeiro serviço em andamento, **When** o usuário observa a interface, **Then** o serviço atual e a posição dele na fila estão visíveis em todas as telas do ciclo.
3. **Given** dois destinos selecionados, **When** o ciclo do primeiro começa, **Then** nenhuma autorização foi solicitada ao segundo serviço.
4. **Given** o primeiro serviço concluído, **When** o ciclo do segundo começa, **Then** a revisão do segundo é obrigatória e independente — nada é escrito nele sem confirmação explícita.
5. **Given** o primeiro serviço concluído, **When** o usuário decide encerrar sem fazer o segundo, **Then** o encerramento é permitido e a playlist já criada permanece intacta e reportada no resumo.
6. **Given** o segundo serviço falhar por completo, **When** o resumo final é exibido, **Then** o sucesso do primeiro é reportado como tal e a falha do segundo aparece com causa provável e próximo passo.
7. **Given** o nome escolhido já existir em um dos serviços mas não no outro, **When** o ciclo do serviço em conflito começa, **Then** o sistema exige nome diferente apenas para aquele serviço, sem invalidar o que já foi criado.

---

### User Story 4 — Saber de antemão o que não cabe, e não perder trabalho por expiração (Priority: P4)

Antes de buscar qualquer coisa no YouTube, o usuário vê quanto do orçamento diário a lista deve consumir. Se não couber, o destino é **barrado** ali mesmo, com as saídas à mão: reduzir a lista, pular o YouTube ou ampliar o orçamento junto ao provedor. Nada é iniciado para falhar no meio. Já a autorização do YouTube, que não se renova em silêncio, pode expirar durante o uso — e aí nada do trabalho revisado é perdido: o sistema pede reautorização e retoma no mesmo ponto.

**Why this priority**: é a rede de segurança dos dois limites que o serviço de vídeo impõe e o Spotify não. Sem ela o produto quebra de forma opaca justamente no caso comum de listas maiores.

**Independent Test**: com uma lista maior do que o orçamento disponível, verificar que o destino é barrado antes de qualquer requisição, com as três saídas oferecidas; separadamente, simular expiração da autorização durante a revisão e verificar que nenhuma decisão de revisão é perdida.

**Acceptance Scenarios**:

1. **Given** a lista estimada excede o orçamento diário disponível, **When** a estimativa é exibida antes da busca, **Then** o destino é bloqueado com o motivo, e as saídas oferecidas são reduzir a lista, pular o destino ou ampliar o orçamento junto ao provedor.
2. **Given** a lista cabe no orçamento, **When** a estimativa é exibida, **Then** ela informa o consumo previsto e o quanto isso representa do orçamento, e a busca só começa após o usuário prosseguir.
3. **Given** a cota se esgota durante a adição de faixas apesar da estimativa, **When** o sistema detecta o esgotamento, **Then** ele encerra a execução daquele serviço sem tentar de novo em laço e relata quais linhas entraram e quais faltaram.
4. **Given** uma execução encerrada por cota deixou playlist incompleta na conta, **When** o relato é exibido, **Then** ele informa que a playlist existe incompleta e adverte que uma nova tentativa com o mesmo nome será bloqueada pela checagem de nome duplicado.
5. **Given** a autorização do YouTube expira durante a revisão, **When** o usuário confirma a criação, **Then** o sistema pede reautorização, preserva integralmente a revisão e retoma no mesmo ponto.
6. **Given** a autorização expira no meio da adição de faixas, **When** o usuário reautoriza, **Then** a adição continua de onde parou, sem nenhuma faixa duplicada nem faltante.
7. **Given** um serviço foi concluído e o outro ficou pendente, **When** o usuário reabre a aplicação, **Then** o rascunho não é apagado e a retomada oferece continuar apenas o pendente.

---

### Edge Cases

- **Nenhuma credencial cadastrada**: avanço bloqueado com explicação, não com campo obrigatório silencioso.
- **Credencial cadastrada mas inválida**: a validade só é conhecida na autorização; o erro precisa apontar o serviço, a causa provável e o caminho para corrigir a credencial.
- **Credencial removida no meio do fluxo**: o destino correspondente é desmarcado; se o ciclo dele já tiver começado, o comportamento é o de falha daquele serviço, sem afetar o outro.
- **App do YouTube em modo de teste**: a conta do usuário precisa estar na lista de testadores do projeto dele, e a tela de consentimento exibe aviso de app não verificado. O erro de autorização precisa dizer isso.
- **Usuário recusa o consentimento em um dos serviços**: aquele destino falha, o outro continua.
- **Contas diferentes entre serviços**: são autorizações independentes; o resumo precisa deixar claro em qual conta cada playlist foi criada.
- **Nome duplicado em um serviço e livre no outro**: resolução local ao serviço em conflito.
- **Zero faixas selecionadas na revisão de um serviço**: criação bloqueada naquele serviço, com explicação; o outro serviço não é afetado.
- **Linha inválida ou não encontrada em um serviço e encontrada no outro**: normal e esperado; os resultados por serviço divergem e o resumo mostra isso sem sugerir erro.
- **Cota insuficiente antes de começar**: o destino é bloqueado na estimativa, com as saídas de reduzir a lista, pular o destino ou ampliar o orçamento — nunca iniciado para falhar no meio.
- **Cota esgota na fase de busca** (antes de qualquer escrita): nada foi criado na conta; a execução daquele serviço encerra relatando até onde a busca chegou, sem promessa de retomada em outro dia.
- **Cota esgota no meio da adição**: a playlist fica incompleta na conta e não é removida. O relato precisa dizer quais linhas entraram, quais faltaram, e que repetir com o mesmo nome será bloqueado pela checagem de nome duplicado.
- **Cota esgota mesmo tendo passado pela estimativa**: possível e esperado, porque o Registro de Consumo Diário só conhece o consumo desta aplicação neste dispositivo — cota gasta em outro navegador, outro dispositivo ou outra aplicação do mesmo projeto do usuário é invisível para o cálculo. É tratado como o caso acima, não como defeito.
- **Usuário ampliou a cota junto ao provedor**: a aplicação continua calculando pelo orçamento padrão, então o bloqueio prévio permanece conservador. A mensagem de bloqueio precisa declarar essa premissa para que o usuário entenda por que foi barrado.
- **Registro de Consumo Diário ausente ou corrompido**: tratado como consumo zero no dia, o que torna a estimativa otimista; o esgotamento durante a execução continua sendo a rede de proteção.
- **Correção de texto propagada gera correspondência pior no segundo serviço**: a revisão do segundo serviço é independente e sempre editável, então a correção herdada nunca é definitiva.
- **Autorização expira exatamente entre duas requisições de adição**: a retomada dentro da execução precisa ser idempotente pelo índice de confirmação persistido, não por contagem otimista.
- **Recarregamento da página no meio do ciclo do segundo serviço**: retoma no segundo serviço, com o resultado do primeiro preservado.
- **Seleção alterada depois de a primeira criação ter começado**: bloqueada; alterar destino exige descarte explícito do rascunho.
- **Lista reduzida depois de um serviço já ter concluído**: permitida, mas só por remoção de linhas, e o resumo final precisa declarar que os destinos receberam listas diferentes. Acrescentar ou editar linhas nesse ponto é bloqueado.
- **Redução que deixa a lista de um destino vazia**: equivale a pular aquele destino, e precisa ser apresentada como tal em vez de iniciar uma execução sem nada a criar.
- **Um único serviço selecionado**: nenhuma tela de fila, nenhum "1 de 1" ruidoso, nenhum resumo consolidado redundante.
- **Rascunho gravado por versão anterior da aplicação, sem informação de destinos**: restaurado como fluxo de destino único com Spotify selecionado, na etapa em que parou, com o banner de recuperação de sempre. Nunca descartado, nunca interpretado como multi-serviço.
- **Rascunho antigo cujo Client ID do Spotify foi removido desde então**: a restauração acontece, mas o destino aparece não selecionável até a credencial ser recadastrada — o mesmo tratamento de qualquer serviço sem credencial.

---

## Requirements _(mandatory)_

### Functional Requirements

#### Credenciais por serviço

- **FR-001**: A etapa de configuração DEVE aceitar a credencial de cada serviço suportado de forma independente, tratando cada uma como **opcional**.
- **FR-002**: O sistema DEVE exigir ao menos uma credencial cadastrada para avançar da configuração, e DEVE explicar o motivo quando nenhuma houver.
- **FR-003**: Cada credencial DEVE receber as mesmas garantias já vigentes: entrada exclusivamente pela interface, persistência no dispositivo, exibição mascarada por padrão e ação explícita de remoção individual (`001/FR-001`–`001/FR-004`).
- **FR-004**: O sistema NÃO DEVE solicitar, aceitar ou armazenar segredo de cliente de nenhum serviço, em nenhuma circunstância (`001/FR-005`).
- **FR-005**: O sistema DEVE exibir, por serviço, o Redirect URI exato a cadastrar, com botão de copiar, e as instruções de obtenção da credencial específicas daquele serviço.
- **FR-006**: Remover a credencial de um serviço DEVE desmarcá-lo e desabilitá-lo no seletor, sem afetar a credencial, a seleção ou o progresso de qualquer outro serviço.
- **FR-007**: O sistema DEVE tratar "credencial cadastrada" como a existência de um valor não vazio informado pelo usuário, sem depender de validação remota — a validade só é conhecida na autorização.

#### Seletor de destinos

- **FR-008**: O sistema DEVE apresentar um seletor de múltipla escolha com todos os serviços suportados, imediatamente após a configuração.
- **FR-009**: Um serviço só DEVE ser selecionável se tiver credencial cadastrada. Sem credencial, ele DEVE aparecer desabilitado, com o motivo escrito e um atalho para cadastrá-la.
- **FR-010**: Por padrão, o seletor DEVE vir com exatamente o conjunto de serviços que têm credencial cadastrada marcado.
- **FR-011**: O sistema DEVE exigir ao menos um serviço selecionado para avançar, explicando o motivo quando nenhum estiver.
- **FR-012**: O sistema DEVE permitir alterar a seleção enquanto nenhuma criação tiver começado, e DEVE bloquear a alteração depois disso, oferecendo o descarte explícito do rascunho como caminho para recomeçar com outra seleção.

#### Fluxo sequencial por serviço

- **FR-013**: O texto de entrada, o nome, a descrição e a visibilidade da playlist DEVEM ser informados uma única vez e aplicados a todos os serviços selecionados. Depois de um serviço já ter criado sua playlist, o texto DEVE permanecer editável apenas por **remoção de linhas** para os serviços seguintes: a lista de um destino posterior DEVE ser sempre um subconjunto da lista usada pelos anteriores, e o sistema NÃO DEVE permitir acrescentar nem alterar linhas nesse ponto. Nome, descrição e visibilidade permanecem compartilhados e imutáveis, salvo a resolução de nome duplicado (FR-022).
- **FR-014**: As correções de **texto** de uma linha feitas na revisão de um serviço DEVEM se propagar para a busca dos serviços seguintes, de modo que o usuário nunca corrija a mesma grafia duas vezes. As escolhas de candidata (qual faixa ou vídeo usar), a seleção e a exclusão de itens NÃO DEVEM se propagar, por serem específicas do catálogo de cada serviço.
- **FR-015**: A ordem de execução DEVE ser fixa e definida pelo produto — **Spotify primeiro, YouTube depois** — e o sistema NÃO DEVE oferecer controle de ordenação na interface. Serviços sem limite diário de cota DEVEM vir antes dos que têm, para que um bloqueio de cota não comprometa o resultado dos demais.
- **FR-016**: O sistema DEVE executar o ciclo completo de um serviço por vez — autorizar, buscar, revisar, criar, apresentar resultado — começando o ciclo do próximo apenas depois de o anterior ter sido concluído, pulado ou encerrado pelo usuário.
- **FR-017**: O sistema DEVE solicitar a autorização de um serviço apenas quando o ciclo dele começar, e NÃO DEVE pedir autorização de serviço que o usuário talvez não chegue a usar.
- **FR-018**: O sistema DEVE indicar, em todas as telas do ciclo, qual serviço está em andamento e a posição dele na fila (por exemplo, "Spotify — 1 de 2"), omitindo essa indicação quando houver apenas um destino selecionado.
- **FR-019**: A etapa de revisão DEVE ser obrigatória e independente **por serviço**: nada é escrito em um serviço sem confirmação explícita da revisão daquele serviço (`001/FR-031`).
- **FR-020**: O sistema DEVE permitir pular ou encerrar um serviço pendente sem desfazer, invalidar ou ocultar o que já foi criado em outro.
- **FR-021**: Falha total em um serviço NÃO DEVE impedir, cancelar ou degradar o ciclo de outro serviço.
- **FR-022**: O sistema DEVE resolver a checagem de nome duplicado (`001/FR-029`) localmente a cada serviço, exigindo nome diferente apenas onde houver conflito.

#### Correspondência no catálogo de vídeos

- **FR-023**: O sistema DEVE buscar cada linha no catálogo oficial do serviço de vídeo e classificar cada item nas mesmas três categorias já usadas: **Confiante**, **Incerta** e **Não encontrada** (`001/FR-022`). O padrão de seleção DEVE ser o mesmo dos demais serviços — **Confiante** marcado, **Incerta** desmarcado (`001/FR-025`) —, e o limiar de **Confiante** do catálogo de vídeo DEVE ser calibrado de forma mais exigente que o do catálogo musical, para compensar a existência de múltiplas versões da mesma faixa.
- **FR-024**: Nas alternativas do serviço de vídeo, o sistema DEVE exibir título, canal, duração e miniatura, e NÃO DEVE exibir nem prometer campo de álbum, que não existe nesse catálogo.
- **FR-025**: O sistema DEVE sinalizar de forma visível, na revisão, indícios de que o candidato é uma versão diferente da faixa pedida — ao vivo, cover, remix, versão acelerada, trecho — para que o usuário decida com essa informação à vista.
- **FR-026**: O sistema DEVE mapear a visibilidade escolhida para o equivalente de cada serviço, mantendo "privada" como padrão em todos eles (`001/FR-030`).
- **FR-027**: O sistema DEVE exibir o caminho efetivo da playlist criada em cada serviço e DEVE informar que a aplicação não gerencia pastas em nenhum deles (`001/FR-036`–`001/FR-038`).
- **FR-028**: O sistema DEVE deixar explícito que a playlist criada no serviço de vídeo é uma playlist do YouTube, e NÃO DEVE afirmar nem sugerir que ela é uma playlist do YouTube Music.

#### Orçamento diário de cota

- **FR-029**: Antes de iniciar a busca no serviço de vídeo, o sistema DEVE estimar o consumo previsto do orçamento diário e exibi-lo ao usuário. O saldo usado na comparação DEVE ser o **orçamento padrão do provedor** menos o consumo que a própria aplicação registrou naquele dia no dispositivo. O sistema NÃO DEVE pedir ao usuário que informe o orçamento dele. Quando a estimativa exceder esse saldo, o sistema DEVE **bloquear** o início daquele destino, oferecendo como saídas reduzir a lista ou pular o destino, e DEVE declarar na mensagem que o cálculo parte do orçamento padrão.
- **FR-030**: O registro local de consumo DEVE ser zerado no mesmo instante em que o provedor renova a cota diária, e NÃO no fuso local do usuário, de modo que o saldo calculado não divirja do saldo real por diferença de fuso.
- **FR-031**: Ao detectar o esgotamento do orçamento diário durante a execução, o sistema DEVE encerrar a execução daquele serviço de forma limpa — sem repetição em laço — relatando quais linhas entraram e quais faltaram. O sistema NÃO DEVE prometer nem oferecer retomada do trabalho em outro dia.
- **FR-032**: Quando o encerramento por cota deixar uma playlist incompleta na conta do usuário, o sistema NÃO DEVE removê-la, DEVE informar que ela existe incompleta e DEVE advertir que uma nova tentativa com o mesmo nome será bloqueada pela checagem de nome duplicado (FR-022).
- **FR-033**: O rascunho DEVE preservar o progresso de adição de faixas com granularidade suficiente para que qualquer retomada dentro da mesma execução — após erro de rede, limitação de requisições ou reautorização — não duplique nem omita nenhuma faixa (`001/FR-033`).
- **FR-034**: O sistema DEVE oferecer, na mensagem de esgotamento durante a execução, orientação acionável sobre como ampliar o orçamento diário junto ao provedor. O sistema NÃO DEVE oferecer essa orientação como saída da mensagem de bloqueio prévio (FR-029), porque ampliar a cota no provedor não altera o saldo que a aplicação calcula.

#### Sessão por serviço

- **FR-035**: Quando a autorização de um serviço não puder ser renovada em silêncio, o sistema DEVE detectar a expiração, preservar integralmente o rascunho e pedir reautorização informando exatamente de onde o trabalho será retomado.
- **FR-036**: O sistema DEVE manter as sessões dos serviços independentes: exibir a conta conectada de cada um, permitir desconectar de um sem afetar o outro (`001/FR-009`) e deixar claro em qual conta cada playlist foi criada.

#### Rascunho e resultado consolidado

- **FR-037**: O rascunho DEVE registrar a seleção de destinos, o serviço em andamento, a etapa dentro do ciclo dele, a lista efetivamente usada por cada serviço e o desfecho de cada serviço já finalizado. O registro da lista usada por um serviço já concluído DEVE ser imutável, para que uma redução posterior não altere retroativamente o relato dele.
- **FR-038**: O sistema DEVE apagar o rascunho somente quando todos os serviços selecionados tiverem terminado — concluídos, pulados ou encerrados — e DEVE manter a ação explícita de descartar rascunho (`001/FR-045`).
- **FR-039**: A recuperação do rascunho DEVE retomar no serviço e na etapa exatos em que o trabalho parou (`001/FR-044`).
- **FR-040**: Ao final do fluxo, quando houver mais de um destino, o sistema DEVE exibir um resumo por serviço com estado, link da playlist, total adicionado, total ignorado e as linhas não encontradas. Os estados DEVEM ser atribuídos por estes critérios, sem limiar percentual: **concluído** quando a playlist foi criada com todas as faixas confirmadas dentro; **parcial** quando a playlist foi criada mas nem todas as faixas confirmadas entraram; **falhou** quando nenhuma playlist chegou a ser criada; **pulado** quando o usuário encerrou o serviço antes de confirmar a criação. Quando os destinos tiverem recebido listas diferentes, o resumo DEVE declarar isso explicitamente, informando quantas linhas cada serviço recebeu e quais foram removidas para os destinos posteriores.
- **FR-041**: O sistema DEVE permitir copiar em bloco as linhas não encontradas de cada serviço separadamente (`001/FR-040`).
- **FR-042**: O sistema DEVE ler rascunhos gravados por versões anteriores da aplicação como fluxo de destino único com o Spotify selecionado, retomando na etapa em que o trabalho parou, sem exibir aviso adicional além do banner de recuperação já existente (`001/FR-044`). O sistema NÃO DEVE descartá-los nem interpretá-los como fluxo multi-serviço.

#### Interface e privacidade

- **FR-043**: A interface DEVE seguir um fluxo linear atualizado: Configuração → Destinos → Entrada → (por serviço: Revisão → Resultado) → Resumo, substituindo o fluxo de quatro etapas de `001/FR-041`.
- **FR-044**: O sistema NÃO DEVE transmitir credenciais, dados de sessão ou conteúdo do usuário a qualquer destino que não seja um serviço oficial de um dos provedores suportados, substituindo `001/FR-010`. A lista de destinos autorizados permanece fechada e verificável.
- **FR-045**: O sistema DEVE solicitar de cada provedor apenas as permissões mínimas necessárias para criar playlists e ler a lista de playlists existentes do usuário (`001/FR-007`).
- **FR-046**: Toda mensagem de erro DEVE identificar o serviço a que se refere, a causa provável e o próximo passo (`001/FR-042`).
- **FR-047**: Todas as telas novas — seletor de destinos, indicação de fila, estimativa de cota e resumo consolidado — DEVEM ser operáveis por teclado, ter rótulos acessíveis, permanecer utilizáveis em telas estreitas sem rolagem horizontal da página, e ter todo o texto em português do Brasil (`001/FR-046`–`001/FR-048`).

### Key Entities _(include if feature involves data)_

- **Serviço de Destino**: Provedor onde uma playlist pode ser criada. Tem nome de exibição, estado de credencial (cadastrada ou não), estado de sessão, capacidade de renovação silenciosa da autorização e presença ou ausência de orçamento diário de cota.
- **Credencial de Serviço**: Client ID informado pelo usuário para um serviço específico. Persistida no dispositivo, exibida mascarada, removível individualmente. Relaciona-se a exatamente um Serviço de Destino.
- **Seleção de Destinos**: Conjunto de serviços escolhidos para esta execução. Inicializado com os serviços que têm credencial cadastrada. Imutável após o início da primeira criação.
- **Fila de Execução**: Sequência ordenada dos serviços selecionados, com o índice do serviço em andamento e o estado de cada um (pendente, em andamento, concluído, parcial, pulado, falhou).
- **Execução por Serviço**: Ciclo completo de um serviço — sessão usada, **lista efetivamente recebida**, correspondências obtidas, decisões de revisão, progresso de adição e resultado. Uma por serviço selecionado, independente das demais. A lista recebida por uma execução posterior é sempre um subconjunto da recebida pelas anteriores, e o registro de uma execução concluída é imutável.
- **Estimativa de Orçamento**: Consumo previsto do orçamento diário de um serviço para a lista atual, comparado ao saldo calculado (orçamento padrão do provedor menos o Registro de Consumo Diário). Existe apenas para serviços que impõem esse limite.
- **Registro de Consumo Diário**: Contagem, mantida no dispositivo, do consumo de orçamento que a própria aplicação provocou em um serviço no dia corrente. Zerada na virada do dia do provedor, não na virada local. Conhece apenas o consumo feito por esta aplicação neste dispositivo.
- **Rascunho de Trabalho** (estendido): Além do que a 001 já grava, passa a registrar a Seleção de Destinos, a Fila de Execução e o resultado de cada serviço finalizado.
- **Resumo Consolidado**: Desfecho de todas as Execuções por Serviço, exibido ao final quando há mais de um destino.

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Um usuário com os dois Client IDs em mãos cadastra ambos e chega ao seletor de destinos em menos de 2 minutos.
- **SC-002**: Em 100% dos casos, um serviço sem credencial cadastrada aparece não selecionável, com o motivo visível na tela e um atalho para cadastrá-la.
- **SC-003**: Em 100% dos casos, o conjunto marcado por padrão no seletor é exatamente o conjunto de serviços com credencial cadastrada.
- **SC-004**: Com os dois destinos selecionados, uma lista de 50 linhas resulta em duas playlists — uma em cada conta — com a ordem original preservada e sem faixas duplicadas em nenhuma delas.
- **SC-005**: Em 100% das execuções, nenhuma autorização é solicitada a um serviço não selecionado, e a autorização de um serviço selecionado só é pedida quando o ciclo dele começa.
- **SC-006**: Para a mesma lista de referência de 50 faixas populares usada na 001, ao menos 75% recebem correspondência **Confiante** correta no serviço de vídeo sem intervenção manual. O patamar é inferior aos 90% do `001/SC-002` porque o catálogo é de vídeos e admite múltiplas versões da mesma faixa.
- **SC-007**: Em 100% dos casos, a falha total de um serviço não impede a conclusão do outro, e o resumo final reporta os dois desfechos sem ambiguidade.
- **SC-008**: Em 100% dos casos em que a lista não cabe no orçamento diário disponível, o destino é bloqueado antes de qualquer requisição, e as três saídas — reduzir a lista, pular o destino, ampliar o orçamento — estão visíveis na mesma tela.
- **SC-009**: Ao esgotar o orçamento diário no meio da adição, o sistema encerra em uma única mensagem que identifica exatamente quais linhas entraram e quais faltaram, sem repetições em laço, e informa que a playlist ficou incompleta na conta.
- **SC-010**: Uma retomada após reautorização, erro de rede ou limitação de requisições, dentro da mesma execução, conclui a playlist sem nenhuma faixa duplicada nem faltante, em 100% das simulações.
- **SC-011**: A estimativa de consumo do orçamento diário é exibida antes de qualquer requisição de busca ao serviço de vídeo, em 100% das execuções que o incluem.
- **SC-012**: Com os dois destinos selecionados, o Spotify é sempre executado antes do YouTube, e uma execução do YouTube bloqueada ou encerrada por cota nunca altera nem invalida o resultado já obtido no Spotify.
- **SC-013**: Uma correção de texto feita na revisão do primeiro serviço aparece aplicada na busca do segundo em 100% dos casos, sem que nenhuma escolha de candidata seja transferida entre serviços.
- **SC-014**: Recarregamento da página, expiração de sessão ou fechamento do navegador em qualquer ponto do fluxo não causam perda do texto, do nome, da seleção de destinos, das correspondências revisadas nem do resultado de serviços já concluídos, em 100% dos casos.
- **SC-015**: Com dois destinos selecionados, o processamento de uma lista de 50 linhas nos dois serviços conclui em até 2 minutos somados, sem contar o tempo de revisão humana.
- **SC-016**: O fluxo completo com dois destinos pode ser concluído em uma tela de 375 px de largura sem rolagem horizontal da página e sem controles inacessíveis.
- **SC-017**: A aplicação continua executável a partir de hospedagem de arquivos estáticos, sem instalar, configurar ou operar qualquer serviço próprio (`001/SC-008` preservado).
- **SC-018**: Quando a lista é reduzida para um destino posterior, o resumo final declara a divergência em 100% dos casos, e o relato do serviço já concluído permanece idêntico ao que foi exibido no momento da conclusão dele.

---

## Assumptions

- O usuário possui conta nos serviços que pretende usar e é capaz de registrar um app próprio em cada provedor para obter o Client ID e cadastrar o Redirect URI. Isso já era verdade para o Spotify e passa a valer também para o serviço de vídeo.
- O usuário do serviço de vídeo precisa habilitar a API de dados no projeto dele e, enquanto o app estiver em modo de teste, incluir a própria conta como testadora — a tela de consentimento exibirá aviso de app não verificado. O produto orienta, não contorna.
- O orçamento diário de cota é **por projeto do usuário**, não compartilhado entre usuários da aplicação. Cada pessoa administra o seu e pode solicitar ampliação ao provedor.
- Os números de cota usados nas estimativas (10.000 unidades/dia, 100 por busca, 50 por faixa adicionada) são o orçamento padrão do provedor na data desta spec. A estimativa é uma previsão informativa, não uma garantia: o provedor é a fonte da verdade e pode alterar os valores.
- O provedor **não expõe** quanto da cota diária já foi consumida. O saldo é sempre inferido, nunca consultado, e o cálculo assume o orçamento padrão (FR-029). Duas consequências aceitas: quem ampliou a cota fica limitado ao cálculo conservador da aplicação, e cota consumida fora deste dispositivo torna a estimativa otimista. Por isso o bloqueio prévio não substitui o tratamento de esgotamento em execução (FR-031).
- Apenas dois serviços entram nesta feature: Spotify e YouTube. O desenho é extensível a outros, mas nenhum terceiro provedor está no escopo.
- Uma conta por serviço por navegador. Não há suporte a múltiplas contas simultâneas no mesmo serviço.
- Nome, descrição e visibilidade da playlist são compartilhados entre os destinos. Nomes distintos por serviço só entram em cena para resolver conflito de nome duplicado.
- A visibilidade permanece binária (privada por padrão, pública opcional). O estado "não listada", que existe apenas no serviço de vídeo, fica fora do escopo para manter a configuração única.
- A ordem de exibição dos serviços no seletor é a mesma da execução — Spotify, depois YouTube — em toda a interface, para que "1 de 2" seja previsível.
- Com a cota tratada por bloqueio prévio (FR-029), listas maiores do que um orçamento diário são um caso **não suportado** e explicitamente barrado, não um fluxo de vários dias. Quem precisar de listas maiores amplia o orçamento junto ao provedor.
- Uma correção de texto propagada entre serviços é sempre revisável no serviço de destino, então a propagação não pode produzir escrita não confirmada.
- As três classes de confiança já existem; esta feature exige que os limiares sejam calibrados separadamente por serviço, com o de **Confiante** do catálogo de vídeo mais exigente que o do catálogo musical (FR-023). Os valores são fixados no planejamento, e SC-006 é o critério que os valida.
- O caso de uso real continua girando em torno de listas de até 50 linhas. Para o serviço de vídeo, essa é também a fronteira prática imposta pelo orçamento diário padrão.

### Dependência de governança (não é requisito)

- Esta feature depende de uma emenda MINOR da constituição, com **dois** pontos: ampliar a lista fechada de destinos de rede do Princípio II, e delimitar o alcance da retomabilidade do Princípio V diante do encerramento por cota. Ambos estão detalhados no topo deste documento. Registrado aqui para rastreabilidade; a emenda é pré-requisito de `/speckit-plan`, não deste documento.

---

## Out of Scope

- Qualquer provedor além de Spotify e YouTube.
- Playlists do **YouTube Music**, escrita em "Músicas curtidas" ou em qualquer biblioteca específica do YouTube Music — a plataforma não expõe isso a aplicações de terceiros.
- Criação, leitura ou seleção de **pastas de playlist** em qualquer serviço.
- Execução dos serviços em paralelo. O pedido é explicitamente sequencial, e o orçamento diário de cota torna o paralelismo pouco útil.
- Escolha da ordem de execução pelo usuário. A ordem é fixa: Spotify, depois YouTube.
- **Retomada de trabalho entre dias** após esgotamento da cota diária. Listas que não couberem em um orçamento são barradas antes de começar; não há fluxo de continuação no dia seguinte.
- Remoção automática de playlist incompleta deixada por um encerramento por cota. A limpeza é decisão e ação do usuário no aplicativo do provedor.
- Propagação, entre serviços, de escolhas de candidata, seleções ou exclusões de itens. Apenas correções de texto se propagam.
- Sincronização entre as playlists criadas nos dois serviços, ou manutenção de equivalência depois da criação.
- Espelhamento de correções: editar a playlist em um serviço não altera a do outro.
- Configuração separada de nome, descrição ou visibilidade por serviço, exceto para resolver conflito de nome duplicado.
- Visibilidade "não listada" do serviço de vídeo.
- Solicitação automatizada de ampliação de cota junto ao provedor.
- Servidor próprio, banco de dados, proxy ou contas de usuário da própria aplicação — continua vedado pelo Princípio I.
- Importação de arquivos ou de URLs de playlists existentes.
- Suporte a idiomas além de pt-BR.
