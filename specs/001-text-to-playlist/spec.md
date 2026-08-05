# Feature Specification: Importador de Playlist por Texto (Text-to-Playlist)

**Feature Directory**: `specs/001-text-to-playlist`

**Feature Branch**: `main` (nenhum hook de criação de branch configurado neste projeto)

**Created**: 2026-08-05

**Status**: Draft

**Input**: User description: "Software web que recebe um texto no formato `nome da música - nome do artista` (uma por linha) e cria uma playlist no Spotify com as músicas corretas. Interface simples. Credencial informada na interface (não em `.env`), armazenada, oculta até o usuário clicar para revelar. Nome da playlist obrigatório. Informar o caminho onde a playlist será criada."

---

## ⚠️ Premissas Corrigidas (ler antes de `/speckit-plan`)

Duas premissas do pedido original não são realizáveis como descritas. As decisões abaixo estão refletidas nos requisitos.

| Premissa original                                   | Realidade da plataforma Spotify                                                                                                                                                                                                                                                            | Decisão adotada                                                                                                                                                                                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "API key do Spotify"                                | O Spotify não usa API key. Escrever na biblioteca de um usuário exige consentimento explícito dele. Para uma aplicação que roda inteiramente no navegador, o único fluxo suportado exige apenas o **Client ID** — um valor público. O _Client Secret_ **não** pode ser usado no navegador. | O campo da interface recebe o **Client ID**. É tratado com o mesmo cuidado de um segredo (mascarado + botão revelar), conforme pedido.                                                                                           |
| "Informar o path/pasta onde a playlist será criada" | A plataforma **não expõe pastas de playlist** para aplicações de terceiros. Não há como criar, listar ou mover playlists entre pastas — é recurso exclusivo dos clientes oficiais.                                                                                                         | O sistema exibe o **caminho efetivo real**: `Sua Biblioteca / {nome de exibição do usuário} / {nome da playlist}` (raiz), com aviso explícito de que a movimentação para pastas precisa ser feita manualmente no app do Spotify. |

---

## Clarifications

### Session 2026-08-05

- **Q**: Qual credencial o usuário informa na interface? → **A**: O Client ID de um app registrado por ele no Spotify Developer Dashboard. Nenhum Client Secret é solicitado, aceito ou armazenado.
- **Q**: A playlist pode ser criada dentro de uma pasta? → **A**: Não. A plataforma não suporta. O sistema exibe o caminho real (raiz da biblioteca) e um aviso.
- **Q**: O que acontece quando uma música não é encontrada? → **A**: A criação prossegue com as encontradas; as não encontradas são listadas ao final, com opção de copiar a lista das falhas.
- **Q**: O usuário confirma as correspondências antes da criação? → **A**: Sim. Etapa de revisão obrigatória entre a busca e a criação — o sistema nunca escreve na conta sem confirmação explícita.
- **Q**: Onde a credencial fica armazenada? → **A**: No armazenamento local do navegador, apenas no dispositivo do usuário. Nenhum servidor próprio, nenhuma telemetria, nenhum envio a terceiros.
- **Q**: Playlist pública ou privada? → **A**: Privada por padrão, com alternância na interface.
- **Q**: O trabalho em andamento sobrevive a um recarregamento ou a uma reconexão que descarrega a página? → **A**: Sim. Texto, nome, configuração da playlist e correspondências já revisadas são gravados no dispositivo como rascunho e restaurados automaticamente. O rascunho é apagado após a criação bem-sucedida ou por ação explícita de "descartar rascunho".
- **Q**: Qual o tempo aceitável para conferir uma lista longa? → **A**: Vazão mínima de cerca de 2 linhas por segundo — 250 linhas em até 2 minutos — com progresso e cancelamento visíveis o tempo todo. O caso de uso real é de listas de até 50 linhas, que devem concluir em até 30 segundos.
- **Q**: O que acontece se já existir uma playlist com o mesmo nome na conta? → **A**: A criação é bloqueada e o sistema exige um nome diferente. A comparação ignora diferenças de maiúsculas/minúsculas e espaços nas bordas. Isso exige permissão para ler a lista de playlists do usuário.
- **Q**: Editar o texto de uma linha na revisão dispara nova busca? → **A**: Sim, apenas daquela linha e apenas quando o usuário confirma a edição (Enter ou saída do campo). Não há busca a cada tecla digitada, e o restante da revisão permanece intacto.
- **Q**: O app precisa funcionar em celular? → **A**: Desktop é o alvo principal. Em telas estreitas todo o fluxo deve permanecer utilizável — sem rolagem horizontal da página e com todos os controles alcançáveis — mas não há layout dedicado a mobile.

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Configurar credencial e conectar a conta (Priority: P1)

Como usuário, quero informar meu Client ID na própria interface e autorizar minha conta Spotify, para que o app possa criar playlists em meu nome sem que eu precise editar arquivos de configuração.

**Why this priority**: Sem credencial e sessão autorizada nenhuma outra funcionalidade existe. É o primeiro incremento entregável.

**Independent Test**: Abrir o app sem credencial salva, colar um Client ID válido, salvar, autorizar no Spotify, retornar ao app e ver o nome de usuário conectado.

**Acceptance Scenarios**:

1. **Given** o app aberto pela primeira vez, **When** o usuário acessa a tela de configuração, **Then** o campo de credencial está vazio e há instruções de como obter o Client ID e qual Redirect URI cadastrar.
2. **Given** um Client ID salvo, **When** a tela é exibida, **Then** o valor aparece mascarado (ex.: `••••••••••••••1a2b`) e há um botão de revelar.
3. **Given** o valor mascarado, **When** o usuário pressiona o botão revelar, **Then** o valor completo é exibido em texto claro; **When** pressiona novamente, **Then** volta a ficar mascarado.
4. **Given** um Client ID salvo, **When** o usuário recarrega a página, **Then** a credencial permanece salva e mascarada.
5. **Given** um Client ID salvo, **When** o usuário inicia a conexão, **Then** é redirecionado ao consentimento do Spotify e, ao retornar, o app exibe o nome de exibição da conta conectada.
6. **Given** uma sessão ativa, **When** o usuário aciona "Desconectar", **Then** a sessão é encerrada e os dados de autorização são apagados; a credencial só é apagada se o usuário acionar "Remover credencial".

---

### User Story 2 — Colar a lista e obter correspondências (Priority: P1)

Como usuário, quero colar um bloco de texto com uma música por linha e ver quais faixas do Spotify correspondem a cada linha, para conferir se o resultado está correto antes de qualquer coisa ser criada.

**Why this priority**: É o núcleo de valor do produto — transformar texto solto em faixas identificadas. Testável de forma independente da criação da playlist.

**Independent Test**: Colar 10 linhas, acionar a busca e ver uma tabela com linha original → faixa encontrada (título, artista, álbum, duração, capa) e status de cada uma.

**Acceptance Scenarios**:

1. **Given** o texto colado com linhas no formato `Música - Artista`, **When** o usuário aciona a análise, **Then** cada linha vira um item com música e artista separados corretamente.
2. **Given** linhas em branco ou apenas com espaços, **When** o texto é analisado, **Then** elas são ignoradas sem gerar erro.
3. **Given** linhas com separadores variantes (`-`, `–`, `—`, `by`), **When** o texto é analisado, **Then** todas são interpretadas corretamente.
4. **Given** uma linha sem separador reconhecível, **When** o texto é analisado, **Then** a linha é marcada como "formato não reconhecido" e o usuário pode corrigi-la sem refazer todo o processo.
5. **Given** a busca concluída, **When** a revisão é exibida, **Then** cada item mostra um dos status: **Confiante**, **Incerta** (exige confirmação visual) ou **Não encontrada**.
6. **Given** um item com correspondência incerta, **When** o usuário abre as alternativas, **Then** vê até 5 candidatas e pode escolher outra ou descartar o item.
7. **Given** itens duplicados na lista, **When** a análise ocorre, **Then** as duplicatas são sinalizadas e desmarcadas por padrão.
8. **Given** um item **Não encontrado** por erro de digitação, **When** o usuário corrige o texto da linha e confirma a edição, **Then** apenas aquela linha é buscada de novo e recebe novo status, sem alterar as demais.

---

### User Story 3 — Criar a playlist e ver o resultado (Priority: P1)

Como usuário, quero nomear a playlist, confirmar e receber o link e o caminho onde ela foi criada, para acessá-la imediatamente no Spotify.

**Why this priority**: Fecha o ciclo de valor. Sem isso as duas histórias anteriores não entregam resultado utilizável.

**Independent Test**: Com correspondências revisadas e um nome preenchido, acionar a criação e receber link, caminho e resumo de sucessos/falhas.

**Acceptance Scenarios**:

1. **Given** o campo de nome vazio, **When** o usuário tenta criar, **Then** a ação é bloqueada com mensagem indicando que o nome é obrigatório.
2. **Given** um nome que já pertence a outra playlist da conta (mesmo com caixa ou espaços nas bordas diferentes), **When** o usuário tenta criar, **Then** a ação é bloqueada com mensagem indicando que o nome já está em uso e pedindo outro.
3. **Given** nome preenchido e ao menos uma faixa selecionada, **When** o usuário confirma, **Then** a playlist é criada e as faixas selecionadas são adicionadas na mesma ordem do texto original.
4. **Given** a criação concluída, **When** o resultado é exibido, **Then** o app mostra: nome, quantidade adicionada, link para abrir no Spotify e o caminho efetivo `Sua Biblioteca / {nome de exibição} / {nome da playlist}`.
5. **Given** a criação concluída, **When** o resultado é exibido, **Then** um aviso informa que a plataforma não permite criar a playlist dentro de pastas e que a movimentação deve ser feita no app do Spotify.
6. **Given** itens não encontrados, **When** o resultado é exibido, **Then** eles são listados com botão para copiar as linhas que falharam.
7. **Given** a lista tem mais de 100 faixas, **When** a criação ocorre, **Then** todas são adicionadas corretamente, em ordem, sem que o usuário precise fazer nada.
8. **Given** uma falha no meio da adição de faixas, **When** o erro ocorre, **Then** o app informa quantas faixas entraram e oferece "tentar novamente" apenas para as restantes, sem duplicar as já adicionadas.

---

### User Story 4 — Recuperação de erros e limites (Priority: P2)

Como usuário, quero mensagens claras e recuperação automática quando a sessão expira ou o serviço limita as requisições, para não perder o trabalho já feito.

**Why this priority**: Aumenta a taxa de conclusão em listas longas e sessões demoradas, mas o fluxo principal já entrega valor sem ela.

**Independent Test**: Simular sessão expirada e resposta de limitação de requisições durante a busca; verificar que o app se recupera e conclui sem perder o estado.

**Acceptance Scenarios**:

1. **Given** a autorização de acesso expirada, **When** uma operação é acionada, **Then** o app renova a sessão silenciosamente e conclui a operação sem perder o texto digitado.
2. **Given** a renovação falha, **When** o erro ocorre, **Then** o app pede reconexão e, ao retornar do consentimento, restaura texto, nome da playlist e correspondências já revisadas na mesma etapa em que o usuário estava.
3. **Given** o serviço responde com limitação de requisições, **When** isso ocorre, **Then** o app aguarda o intervalo indicado e repete automaticamente, exibindo o estado de espera.
4. **Given** um Client ID inválido ou Redirect URI não cadastrada, **When** a autorização falha, **Then** a mensagem indica a causa provável e o Redirect URI exato que deve ser cadastrado no Developer Dashboard.
5. **Given** perda de conexão, **When** uma operação é acionada, **Then** o app informa o problema e permite repetir sem recomeçar.
6. **Given** um rascunho gravado de uma sessão anterior, **When** o usuário reabre a aplicação, **Then** o app informa que recuperou um trabalho em andamento e oferece continuar ou descartar.

---

### Edge Cases

- Texto com numeração (`1. Música - Artista`, `- Música - Artista`) → prefixo removido na análise.
- Nome da música contendo hífen (`Song - Remix - Artist`) → o **último** separador delimita o artista; a interface permite corrigir manualmente.
- Sufixos ruidosos (`(feat. X)`, `(Official Video)`, `[Lyrics]`, `HD`) → normalizados antes da busca, preservando `feat.` como sinal de artista secundário.
- Múltiplos artistas (`Música - A & B`, `A, B`) → busca pelo artista principal, demais usados como reforço de pontuação.
- Acentuação e diferenças de caixa → comparação insensível a acentos e a maiúsculas/minúsculas.
- Texto vazio ou só com espaços → ação de análise desabilitada.
- Lista muito grande (> 500 linhas) → aviso sobre duração do processo e possibilidade de cancelar.
- Nome de playlist só com espaços → tratado como vazio (criação bloqueada).
- Usuário conectado a uma conta diferente da esperada → nome da conta sempre visível antes da confirmação.
- Todas as linhas sem correspondência → criação bloqueada com explicação.
- Nome já usado por outra playlist da conta (ignorando caixa e espaços nas bordas) → criação bloqueada; o usuário precisa escolher outro nome.
- Falha ao consultar as playlists existentes para a checagem de nome → o app informa que não conseguiu verificar e permite tentar de novo, sem criar às cegas.

---

## Requirements _(mandatory)_

### Functional Requirements

#### Credencial e Sessão

- **FR-001**: O sistema DEVE receber a credencial (Client ID) exclusivamente por um campo da interface. O sistema NÃO DEVE ler credenciais de arquivos de ambiente nem embuti-las no pacote distribuído.
- **FR-002**: O sistema DEVE persistir a credencial no armazenamento local do navegador, sobrevivendo a recarregamentos e ao fechamento do navegador.
- **FR-003**: O sistema DEVE exibir a credencial mascarada por padrão, revelando o valor completo apenas enquanto o usuário aciona o controle de revelar.
- **FR-004**: O sistema DEVE oferecer ação explícita para remover a credencial armazenada.
- **FR-005**: O sistema NÃO DEVE solicitar, aceitar ou armazenar Client Secret.
- **FR-006**: O sistema DEVE autorizar por um fluxo com prova de posse, que não exija segredo de cliente nem qualquer componente de servidor próprio.
- **FR-007**: O sistema DEVE solicitar apenas as permissões mínimas necessárias para: criar playlists privadas e públicas na conta do usuário, ler a lista de playlists existentes dele (para a checagem de nome duplicado exigida pela FR-029) e ler seu perfil básico.
- **FR-008**: O sistema DEVE renovar a sessão automaticamente quando a autorização expirar, sem perda do estado da interface.
- **FR-009**: O sistema DEVE exibir o nome da conta conectada sempre que houver sessão ativa e permitir desconectar.
- **FR-010**: O sistema NÃO DEVE transmitir credenciais, dados de sessão ou conteúdo do usuário a qualquer destino que não seja o serviço oficial do Spotify.
- **FR-011**: O sistema DEVE exibir, na tela de configuração, o Redirect URI exato que o usuário precisa cadastrar no Developer Dashboard, com botão de copiar.

#### Entrada e Análise

- **FR-012**: O sistema DEVE aceitar texto multilinha, uma faixa por linha, no formato `música - artista`.
- **FR-013**: O sistema DEVE reconhecer os separadores `-`, `–`, `—` e `by`.
- **FR-014**: O sistema DEVE ignorar linhas vazias e remover espaços nas bordas e prefixos de numeração.
- **FR-015**: O sistema DEVE marcar linhas sem separador reconhecível como inválidas, sem interromper o processamento das demais.
- **FR-016**: O sistema DEVE permitir editar ou remover linhas individuais após a análise, sem exigir recomeço.
- **FR-017**: O sistema DEVE refazer a busca apenas da linha editada, disparada na confirmação da edição (Enter ou saída do campo) e não a cada tecla digitada, preservando o estado de revisão de todas as demais linhas.
- **FR-018**: O sistema DEVE identificar linhas duplicadas e desmarcá-las por padrão.
- **FR-019**: O sistema DEVE preservar a ordem original das linhas em todas as etapas, da entrada ao resultado.

#### Correspondência de Faixas

- **FR-020**: O sistema DEVE buscar cada linha no catálogo oficial do Spotify usando busca por campos (título e artista separadamente), e não apenas texto livre.
- **FR-021**: O sistema DEVE calcular um grau de confiança por item, comparando título e artista normalizados (sem acentos, sem diferença de caixa, sem sufixos promocionais).
- **FR-022**: O sistema DEVE classificar cada item como **Confiante**, **Incerta** ou **Não encontrada**.
- **FR-023**: O sistema DEVE oferecer até 5 candidatas alternativas por item, com título, artista, álbum, duração e capa.
- **FR-024**: O sistema DEVE permitir ao usuário trocar a faixa escolhida ou excluir o item da playlist.
- **FR-025**: O sistema DEVE marcar itens **Confiantes** como selecionados por padrão e itens **Incertos** como não selecionados até confirmação visual do usuário.
- **FR-026**: O sistema DEVE exibir progresso durante a busca e permitir cancelamento a qualquer momento, inclusive enquanto aguarda por limitação de requisições.
- **FR-027**: O sistema DEVE sustentar uma vazão de busca de ao menos 2 linhas por segundo, dimensionando as consultas simultâneas ao catálogo de forma a não provocar limitação sistemática de requisições.

#### Criação da Playlist

- **FR-028**: O sistema DEVE exigir nome de playlist não vazio (após remoção de espaços nas bordas) antes de permitir a criação.
- **FR-029**: O sistema DEVE verificar, antes de criar, se já existe playlist com o mesmo nome na conta do usuário e DEVE bloquear a criação exigindo um nome diferente. A comparação ignora diferenças de maiúsculas/minúsculas e espaços nas bordas.
- **FR-030**: O sistema DEVE oferecer descrição opcional e alternância entre privada (padrão) e pública.
- **FR-031**: O sistema NÃO DEVE criar nada na conta do usuário sem confirmação explícita na etapa de revisão.
- **FR-032**: O sistema DEVE adicionar as faixas selecionadas preservando a ordem, respeitando o limite de itens por requisição do serviço sem expor esse detalhe ao usuário.
- **FR-033**: O sistema DEVE ser resiliente a falhas parciais: em caso de erro no meio da adição, informar quantas faixas entraram e repetir apenas as faltantes, sem duplicar as já adicionadas.
- **FR-034**: O sistema DEVE aplicar espera e nova tentativa automática quando o serviço sinalizar limitação de requisições.
- **FR-035**: O sistema DEVE bloquear a criação quando nenhuma faixa estiver selecionada, exibindo a explicação do motivo.

#### Caminho e Resultado

- **FR-036**: O sistema DEVE exibir, antes e depois da criação, o caminho efetivo da playlist no formato `Sua Biblioteca / {nome de exibição} / {nome da playlist}`.
- **FR-037**: O sistema DEVE informar explicitamente que a plataforma não permite criar ou selecionar pastas de playlist, e que mover a playlist para uma pasta precisa ser feito manualmente no aplicativo Spotify.
- **FR-038**: O sistema NÃO DEVE oferecer campo de seleção de pasta nem simular tal funcionalidade.
- **FR-039**: O sistema DEVE exibir, ao final, link direto para a playlist, total adicionado, total ignorado e a lista de linhas não encontradas.
- **FR-040**: O sistema DEVE permitir copiar as linhas não encontradas em bloco.

#### Interface e Qualidade

- **FR-041**: A interface DEVE seguir um fluxo linear de quatro etapas: Credencial → Entrada → Revisão → Resultado.
- **FR-042**: O sistema DEVE apresentar mensagens de erro acionáveis, indicando causa provável e próximo passo.
- **FR-043**: O sistema DEVE gravar no dispositivo do usuário, como rascunho, o texto de entrada, o nome e a configuração da playlist e as correspondências já revisadas, de modo que sobrevivam a erros, a recarregamentos da página e a reconexões que descarreguem a aplicação.
- **FR-044**: O sistema DEVE restaurar o rascunho automaticamente quando o usuário reabrir a aplicação, retomando a etapa em que ele parou e informando que um trabalho anterior foi recuperado.
- **FR-045**: O sistema DEVE apagar o rascunho após uma criação bem-sucedida e DEVE oferecer ação explícita de "descartar rascunho" para começar do zero.
- **FR-046**: A interface DEVE ser operável por teclado e ter rótulos acessíveis em todos os controles, incluindo o botão de revelar credencial.
- **FR-047**: A interface DEVE permanecer utilizável em telas estreitas: nenhuma etapa do fluxo pode exigir rolagem horizontal da página e todos os controles devem ser alcançáveis. Desktop é o alvo principal e não há layout dedicado a mobile.
- **FR-048**: Todo o texto da interface DEVE estar em português do Brasil.

### Key Entities _(include if feature involves data)_

- **Credencial**: Client ID informado pelo usuário. Persistido localmente no dispositivo. Exibido mascarado por padrão.
- **Sessão**: Autorização ativa com a conta do usuário — inclui identificador do usuário, nome de exibição e validade. Renovável.
- **Linha de Entrada**: Texto bruto original, posição na lista, título e artista extraídos, estado de validade.
- **Candidata**: Faixa retornada pela busca — identificador, título, artistas, álbum, duração, capa, grau de confiança.
- **Correspondência**: Vínculo entre uma Linha de Entrada e a Candidata escolhida, com status (Confiante / Incerta / Não encontrada / Descartada) e indicador de seleção.
- **Configuração da Playlist**: Nome (obrigatório), descrição (opcional), visibilidade (privada por padrão).
- **Rascunho de Trabalho**: Estado de trabalho gravado no dispositivo — texto de entrada, etapa atual, configuração da playlist e correspondências já revisadas. Restaurado ao reabrir; descartado após criação bem-sucedida ou por ação do usuário.
- **Resultado**: Identificador e link da playlist criada, caminho efetivo, totais de sucesso e falha, lista de linhas que falharam.

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Um usuário com Client ID em mãos conclui o fluxo do zero — configurar, conectar, colar e criar — em menos de 3 minutos.
- **SC-002**: Para uma lista de referência de 50 faixas populares bem formatadas, ao menos 90% recebem correspondência **Confiante** correta sem intervenção manual.
- **SC-003**: 100% dos itens classificados como **Incertos** ou **Não encontrados** são visíveis ao usuário antes da criação — nenhuma faixa entra na playlist sem ter sido exibida na revisão.
- **SC-004**: Nenhuma credencial ou dado de sessão aparece em texto legível na tela enquanto o controle de revelar não é acionado.
- **SC-005**: Uma lista de 250 linhas é processada e criada com a ordem original preservada e sem faixas duplicadas.
- **SC-006**: Sessão expirada, recarregamento da página ou reconexão durante o uso não causam perda do texto de entrada, do nome da playlist nem das correspondências já revisadas em 100% dos casos.
- **SC-007**: O caminho efetivo da playlist e o aviso sobre pastas são exibidos em 100% das criações bem-sucedidas.
- **SC-008**: O usuário consegue executar a aplicação a partir de uma hospedagem de arquivos estáticos, sem instalar, configurar ou operar qualquer serviço próprio.
- **SC-009**: Em uma interrupção simulada no meio da adição de faixas, a retomada conclui a playlist sem nenhuma faixa duplicada nem faltante.
- **SC-010**: A busca de correspondências sustenta ao menos 2 linhas por segundo: uma lista típica de 50 linhas conclui em até 30 segundos e uma lista de 250 linhas em até 2 minutos, sem que o usuário precise intervir.
- **SC-011**: Durante toda a busca o usuário vê o progresso avançar e consegue cancelar a qualquer momento, inclusive enquanto o app aguarda por limitação de requisições.
- **SC-012**: O fluxo completo — das quatro etapas até a criação — pode ser concluído em uma tela de 375 px de largura sem rolagem horizontal da página e sem controles inacessíveis.

---

## Assumptions

- O usuário possui conta Spotify e é capaz de registrar um app no Developer Dashboard para obter o Client ID e cadastrar o Redirect URI.
- Contas gratuitas podem criar playlists e adicionar faixas; nenhum recurso exigindo Premium é usado.
- Apps em modo de desenvolvimento no Spotify exigem que a conta esteja na lista de usuários permitidos — o app orienta sobre isso na mensagem de erro de autorização.
- Um único usuário por navegador; não há suporte a múltiplas contas simultâneas.
- O conteúdo do usuário (texto colado) não é enviado a nenhum destino além da busca no serviço oficial do Spotify.
- O usuário está em um navegador moderno com armazenamento local habilitado. Desktop é o alvo principal; telas estreitas são suportadas em nível de usabilidade (FR-047), sem layout dedicado.
- O uso real gira em torno de listas de até 50 linhas. Os limites maiores citados na spec (250 linhas em SC-005/SC-010, aviso acima de 500 linhas) são margens de robustez, não o caso comum a otimizar.
- "Confiante", "Incerta" e "Não encontrada" são definidas por limiares de similaridade a serem fixados no planejamento; a spec exige apenas que as três classes existam e sejam distinguíveis pelo usuário.

### Decisões técnicas registradas (não são requisitos)

Anotadas aqui apenas para rastreabilidade. **Não restringem nem ampliam nenhum requisito** — a spec permanece agnóstica de tecnologia, e removê-las não muda nada do que o produto deve fazer.

- **Estilo da interface: Tailwind CSS** (decidido em [plan.md](./plan.md), justificado em [research.md §14](./research.md)). A camada visual continua governada por FR-046 (operável por teclado, rótulos acessíveis), FR-047 (utilizável em telas estreitas, sem rolagem horizontal) e SC-012 — todos verificáveis sem saber qual ferramenta de CSS foi usada.

## Out of Scope

- Criação, leitura ou seleção de **pastas de playlist** (não suportado pela plataforma).
- Servidor próprio, banco de dados ou contas de usuário do próprio aplicativo.
- Importação de arquivos (CSV, TXT) ou de URLs de outros serviços.
- Edição de playlists existentes, remoção de faixas ou sincronização contínua.
- Reprodução de áudio ou pré-escuta.
- Suporte a múltiplos idiomas além de pt-BR.
- Layout dedicado a mobile. Telas estreitas são suportadas apenas em nível de usabilidade (FR-047).
