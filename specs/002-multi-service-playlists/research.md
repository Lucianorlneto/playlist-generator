# Fase 0 — Pesquisa e Decisões Técnicas

**Feature**: 002-multi-service-playlists · **Data**: 2026-08-05

Cada seção registra **Decisão**, **Justificativa** e **Alternativas consideradas**. Nenhum item permanece como `NEEDS CLARIFICATION`.

---

## §1 — Autorização do YouTube sem componente de servidor

**Decisão**: **OAuth 2.0 Implicit Flow** (`response_type=token`) por redirecionamento de página inteira para `https://accounts.google.com/o/oauth2/v2/auth`, com `state` aleatório para proteção contra CSRF. O token volta no **fragmento** da URL (`#access_token=…&expires_in=3600&state=…`), é lido, o fragmento é imediatamente limpo com `history.replaceState`, e o token é guardado como sessão do provedor. **Não há `refresh_token`**: a sessão do YouTube expira em ~1 hora e a reautorização é explícita.

**Justificativa**: é o único fluxo que o Google oferece a um cliente que roda só no navegador sem segredo e sem backend.

- Verificado: para clientes do tipo **Web application**, o endpoint de token do Google **exige `client_secret` mesmo com PKCE** — a Google reconhece publicamente que "não suporta aplicações públicas sob o perfil Web Application". Portanto `authorization_code + PKCE`, que resolve o Spotify, **não é aplicável aqui** sem guardar um segredo no navegador (proibido pelo Princípio II) ou introduzir um servidor de troca (proibido pelo Princípio I).
- O tipo de cliente **Desktop/Installed** aceita PKCE sem segredo, mas só admite `redirect_uri` de loopback (`http://127.0.0.1:porta`) — inútil para um artefato publicado em hospedagem estática.
- O Princípio I já antecipa exatamente este caso: "para cada provedor, o fluxo adotado MUST ser aquele que dispensa segredo e componente de servidor, **mesmo quando for o menos confortável dos disponíveis**"; e "quando o fluxo sem segredo de um provedor não permitir renovar a sessão em silêncio, a reautorização explícita MUST ser tratada como comportamento previsto da interface".

**Alternativas consideradas**:

| Alternativa | Rejeitada porque |
| --- | --- |
| `authorization_code` + PKCE (cliente Web) | O token endpoint do Google recusa sem `client_secret`. Colocar o segredo no bundle viola o Princípio II de forma literal. |
| Cliente "Desktop" + loopback | `redirect_uri` de loopback não existe em hospedagem estática pública. |
| Google Identity Services (`accounts.google.com/gsi/client`) | Exige carregar script de terceiro em tempo de execução: quebra `script-src 'self'` da CSP e contraria "o projeto não usa SDK de provedor — nem sequer os oficiais". O host é autorizado, o *script remoto* não. |
| Renovação silenciosa por iframe oculto com `prompt=none` | Depende de cookie de terceiro no iframe, que os navegadores já bloqueiam por padrão; produziria falha intermitente disfarçada de erro. A spec já decidiu por reautorização explícita (FR-035). |
| Proxy próprio para guardar o segredo | Princípio I, não negociável. |

**Riscos registrados**: o Google marca o implicit flow como desencorajado. Se ele for removido para novos clientes, **não existe substituto compatível com o Princípio I** — a consequência seria descontinuar o destino YouTube, não introduzir backend. O risco entra no README junto ao já registrado para o token de renovação do Spotify.

**Parâmetros da requisição de autorização**:

```text
https://accounts.google.com/o/oauth2/v2/auth
  ?client_id={clientId}
  &redirect_uri={redirectUri}      # mesma raiz do app, já calculada por computeRedirectUri()
  &response_type=token
  &scope=https://www.googleapis.com/auth/youtube
  &state={aleatório}
  &include_granted_scopes=true
```

O usuário precisa cadastrar a **mesma URL** em _Authorized redirect URIs_ e a origem em _Authorized JavaScript origins_ — as instruções por serviço de FR-005 devem dizer as duas coisas.

---

## §2 — Escopo mínimo do YouTube

**Decisão**: escopo único `https://www.googleapis.com/auth/youtube`.

**Justificativa**: é o menor escopo que cobre as três operações necessárias — `playlists.list(mine=true)` para a checagem de nome duplicado, `playlists.insert` para criar e `playlistItems.insert` para adicionar. Satisfaz FR-045 e o Princípio II ("escopos MUST ser o mínimo que o fluxo exige").

**Alternativas consideradas**: `youtube.force-ssl` cobre o mesmo e mais (avaliações, comentários, legendas) — escopo maior sem ganho, recusado. `youtube.readonly` não escreve. Combinar `youtube.readonly` + `youtube` é redundante: o segundo já contém a leitura necessária.

---

## §3 — Superfície consumida da YouTube Data API e custo de cota

**Decisão**: exatamente cinco chamadas, todas em `https://www.googleapis.com/youtube/v3/…`.

| Operação | Endpoint | Custo | Papel |
| --- | --- | --- | --- |
| Buscar candidatos | `GET /search?part=snippet&type=video&maxResults=5` | **100** | FR-023 |
| Enriquecer candidatos | `GET /videos?part=contentDetails,snippet&id=…` (até 50 ids) | **1** | duração e canal (FR-024) |
| Listar playlists do usuário | `GET /playlists?part=snippet&mine=true&maxResults=50` | **1**/página | nome duplicado (FR-022) |
| Criar playlist | `POST /playlists?part=snippet,status` | **50** | FR-026, FR-027 |
| Adicionar um vídeo | `POST /playlistItems?part=snippet` | **50** | uma requisição **por vídeo** |

**Fórmula de estimativa** (N = linhas buscáveis, S = itens confirmados na revisão):

```text
custo = 100·N  +  ceil(5·N / 50)·1  +  1  +  50  +  50·S
```

Para N = S = 50: `5000 + 5 + 1 + 50 + 2500 = 7 556` unidades ≈ **76% do orçamento padrão de 10 000/dia** — coerente com a premissa registrada na spec. O teto prático é **N ≈ 66 linhas/dia**; acima disso FR-029 bloqueia.

**Justificativa da margem**: a estimativa exibida usa o **custo nominal** (uma busca por linha, todos os itens confirmados) acrescido de **margem de segurança de 10%**, exposta como constante calibrável. O caminho de fallback de busca (§7) custa mais 100 por linha sem resultado; embuti-lo no pior caso derrubaria o teto para ~39 linhas e barraria listas que, na prática, caberiam. O esgotamento em execução (FR-031) é a rede de proteção deliberada para essa folga.

**Alternativas consideradas**: `search.list` com `maxResults=10` para dar mais alternativas — mesmo custo de 100, mas FR-023 pede no máximo 5 e mais candidatos só aumentariam o trabalho de revisão. Descoberta por `playlistItems` de playlists públicas de terceiros para evitar o custo 100 — não localiza faixa arbitrária, e dependeria de conteúdo de terceiros. APIs não oficiais do YouTube Music (`ytmusicapi` e equivalentes) — hosts fora da lista fechada, violação direta do Princípio II, além de contrariarem a decisão de produto de não prometer YouTube Music.

---

## §4 — Duração e canal exigem uma segunda chamada

**Decisão**: `search.list` **não retorna duração**. Depois da busca de uma leva de linhas, os IDs de todos os candidatos são agrupados em lotes de até 50 e enriquecidos por `videos.list(part=contentDetails,snippet)`; `contentDetails.duration` vem em ISO-8601 (`PT3M52S`) e é convertida por função pura para milissegundos.

**Justificativa**: FR-024 exige exibir duração e canal na revisão, e a duração também alimenta a heurística de versão diferente (§8). O custo é de 1 unidade por lote de 50 vídeos — 5 unidades para uma lista de 50 linhas, irrelevante diante das 5 000 da busca. Não há como obter duração de outro modo.

**Alternativas consideradas**: exibir apenas canal e omitir duração — descartado, FR-024 é explícito e a duração é o sinal mais barato de "versão diferente". Uma chamada `videos.list` por linha — 10× mais chamadas HTTP pelo mesmo custo de cota, sem ganho.

---

## §5 — Saldo de cota: Registro de Consumo Diário e a virada em Pacific Time

**Decisão**: `saldo = ORÇAMENTO_PADRÃO (10 000) − consumoRegistradoHoje`, com `consumoRegistradoHoje` mantido em `localStorage` por provedor. O "hoje" é o **dia civil em `America/Los_Angeles`**, obtido de forma pura por `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date(now))` → `YYYY-MM-DD`. Se a data guardada diferir da data corrente, o registro é tratado como zero.

**Justificativa**: FR-030 exige zerar no instante da renovação do provedor, não no fuso local. A cota da YouTube Data API renova à **meia-noite Pacific Time**, que alterna entre UTC−8 e UTC−7 conforme o horário de verão. Comparar rótulos de data produzidos pelo próprio `Intl` com `timeZone` fixo resolve o DST sem tabela própria e sem dependência nova. A função recebe `now` por parâmetro, mantendo `src/domain/quota/` puro (Princípio III).

**Alternativas consideradas**: deslocamento fixo de −8 h — erra por uma hora durante ~8 meses do ano, e erra o dia inteiro na janela crítica. Biblioteca de fuso horário (`luxon`, `date-fns-tz`) — dependência nova sem justificativa contra `Intl`, que já resolve (Princípio de simplicidade proporcional). Perguntar o orçamento ao usuário — proibido por FR-029.

**Contabilização**: o Registro é incrementado **após cada resposta bem-sucedida ou com erro de cota**, pelo custo nominal da operação, e gravado de forma síncrona (mesmo tratamento do índice de lotes confirmados). Erro de rede antes de a requisição chegar ao provedor não incrementa.

---

## §6 — Classificar erros do YouTube: cota esgotada não é limitação de taxa

**Decisão**: o cliente HTTP interpreta `403` pelo campo `error.errors[0].reason`:

| `reason` | Classe | Tratamento |
| --- | --- | --- |
| `quotaExceeded`, `dailyLimitExceeded` | **terminal de cota** | encerra a execução do serviço sem repetir (FR-031), zera nada, relata o que entrou |
| `rateLimitExceeded`, `userRateLimitExceeded` | **transitório** | backoff exponencial e repetição, como o `429` do Spotify |
| `forbidden`, `insufficientPermissions` | erro de permissão | mensagem acionável apontando escopo/consentimento (FR-046) |
| `authError`, `401` | sessão expirada | reautorização explícita (FR-035), rascunho preservado |

**Justificativa**: os dois primeiros grupos chegam com o **mesmo status HTTP 403** e exigem comportamentos opostos — repetir um `quotaExceeded` em laço é exatamente o que SC-009 proíbe. A distinção só existe no corpo da resposta, então ela precisa ser feita no adaptador do provedor, não no cliente HTTP genérico.

**Alternativas consideradas**: tratar todo `403` como terminal — abortaria execuções recuperáveis por uma rajada de requisições. Tratar todo `403` como transitório — laço de repetição contra uma cota esgotada, proibido.

---

## §7 — Correspondência no catálogo de vídeos

**Decisão**: consulta de texto livre `"{título} {artista}"` com `type=video`, `maxResults=5`; em zero resultados, **um** fallback com o título apenas. A pontuação reaproveita `src/domain/scoring/` (Levenshtein + Jaccard, peso 0,6 título / 0,4 artista) com três adaptações específicas do catálogo de vídeo:

1. **Título limpo antes de pontuar**: remoção de decorações típicas do YouTube — `(Official Video)`, `[Official Music Video]`, `(Clipe Oficial)`, `(Audio)`, `(Lyric Video)`, `| HD`, emojis — por lista de padrões em módulo puro. Sem isso, títulos corretos perdem pontos por ruído editorial.
2. **Canal no lugar de artista**: a similaridade de artista compara com `channelTitle` normalizado, descontando os sufixos ` - Topic` e `VEVO`.
3. **Bônus de canal canônico**: `+0,08` para canal terminado em ` - Topic` (áudio auto-gerado, o equivalente mais próximo da faixa de catálogo) e `+0,05` para `…VEVO`. É o sinal mais forte disponível de que o vídeo é a gravação oficial, e não um upload de terceiros.

**Limiares do YouTube** (FR-023 exige calibração mais exigente): `CONFIDENT = 0,88`, `UNCERTAIN = 0,55`, contra `0,82 / 0,55` do Spotify. Um item com sinal de versão diferente (§8) é **rebaixado de `confident` para `uncertain`** independentemente da pontuação.

**Justificativa**: o erro caro no catálogo de vídeo não é "não achou", é "achou o cover". Elevar o limiar e rebaixar por sinal de versão joga o erro para o lado de pedir confirmação humana, que é o comportamento que FR-019 e o Princípio V querem. Os valores ficam em `thresholds.ts` por provedor, calibráveis contra a fixture sem tocar na lógica — mesmo padrão já usado na 001. SC-006 (≥ 75% de `Confiante` correta) é o critério que os valida.

**Alternativas consideradas**: `videoCategoryId=10` (Música) na consulta — reduz ruído, mas exclui uploads legítimos com categoria errada, e a categoria não é confiável em canais pequenos; o sinal é melhor aproveitado como bônus de pontuação do que como filtro que apaga candidatos. Busca por campos (`intitle:`) como no Spotify — a API de busca de vídeo não tem qualificadores de campo. Reordenar pela relevância do provedor — a 001 já decidiu que a ordem da plataforma não é verdade; nada muda aqui.

---

## §8 — Sinalização de versão diferente (FR-025)

**Decisão**: função pura `versionHints(title, durationMs, medianDurationMs)` que devolve uma lista de indícios, cada um com chave de i18n:

- **Léxico no título** (normalizado, com fronteira de palavra): `ao vivo`, `live`, `cover`, `remix`, `acústic*`, `acoustic`, `karaoke`, `instrumental`, `sped up`, `speed up`, `slowed`, `reverb`, `nightcore`, `8d`, `mashup`, `tributo`, `tribute`, `remaster*`, `trecho`, `snippet`, `preview`, `teaser`, `reaction`, `tutorial`.
- **Duração destoante**: desvio superior a **25%** da mediana das durações dos candidatos daquela linha. Pega versão estendida, trecho e vídeo com introdução longa sem depender de palavra-chave.

Os indícios aparecem na revisão como marcadores visíveis por linha e por candidata, e rebaixam `confident → uncertain` (§7).

**Justificativa**: FR-025 pede que o indício esteja à vista na hora da decisão, não que o sistema decida sozinho. A mediana dos próprios candidatos é a única referência de duração disponível quando o YouTube roda sozinho — usar a duração da faixa do Spotify seria propagar escolha entre serviços, o que FR-014 proíbe explicitamente.

**Alternativas consideradas**: modelo de classificação treinado — desproporcional. Comparar com a duração do Spotify quando ele já rodou — cria comportamento diferente conforme a seleção de destinos e viola a fronteira de FR-014.

---

## §9 — Adição de itens: uma requisição por vídeo, retomada por índice

**Decisão**: `playlistItems.insert` aceita **um vídeo por requisição** — não há endpoint de lote. O progresso da criação passa a ser expresso em **itens confirmados** (`committedItems`), não em lotes, e o particionamento existente vira um caso particular: Spotify usa lote de 100, YouTube usa lote de 1. `src/domain/batching/` é generalizado para receber `batchSize` do provedor.

**Justificativa**: preserva o invariante que sustenta SC-010 e o Princípio V — índice de confirmação persistido de forma síncrona, retomada que reenvia apenas o que falta. Com lote 1 o índice fica mais fino, o que só melhora a granularidade da retomada exigida por FR-033.

**Consequência de custo**: 50 vídeos = 50 requisições = 2 500 unidades. É o segundo maior item da conta de cota e não tem como ser reduzido.

**Alternativas consideradas**: envio paralelo dos itens — destruiria a ordem exigida (`001/FR-019`, herdada) e o índice de retomada. `position` explícita em cada inserção para permitir paralelismo — a API aceita `snippet.position`, mas reordenações concorrentes tornam a retomada não idempotente; o ganho de tempo não paga a perda da garantia.

---

## §10 — Abstração de provedor: uma interface, dois adaptadores

**Decisão**: introduzir `src/services/providers/` com uma interface `PlaylistProvider` e dois adaptadores (`spotify/`, `youtube/`). O cliente HTTP genérico (`401` → renovar/reautorizar, `429`/`5xx` → backoff, `AbortSignal`) sobe de `services/spotify/client.ts` para `services/providers/http.ts`, parametrizado por provedor. Capacidades divergentes viram **dados**, não ramificações espalhadas:

```ts
interface ProviderCapabilities {
  canRefreshSilently: boolean;   // Spotify: true · YouTube: false
  dailyQuota: QuotaModel | null; // Spotify: null · YouTube: custos + 10 000
  batchSize: number;             // Spotify: 100 · YouTube: 1
  showsAlbum: boolean;           // Spotify: true · YouTube: false (FR-024)
}
```

**Justificativa**: sem a interface, cada uma das ~20 telas e runners precisaria de `if (provider === 'youtube')`. Com ela, a orquestração (fila, ciclo, revisão, criação) é escrita **uma vez** e os dois provedores são configuração — que é o que torna FR-013 a FR-022 implementáveis sem duplicar o fluxo. A extensibilidade a um terceiro provedor não é objetivo (está fora de escopo), mas é consequência gratuita.

**Justificativa da mudança de arquivos existentes**: `services/spotify/hosts.ts` **precisa** virar módulo único de hosts por exigência literal do Princípio II ("mantida em um único módulo de hosts autorizados"). Não é refatoração opcional.

**Alternativas consideradas**: duplicar o fluxo do Spotify para o YouTube — dobra a superfície de teste e garante divergência de comportamento entre destinos; contraria FR-016, que descreve **um** ciclo aplicado a cada serviço. Uma camada de tradução para um "modelo canônico de faixa" comum — introduz uma terceira representação sem consumidor: `TrackCandidate` já é o modelo canônico, bastando `album` opcional e `channel`/`durationMs` presentes.

---

## §11 — Armazenamento: esquema v2, isolado por provedor, com migração

**Decisão**: `SCHEMA_VERSION` sobe para **2** e as chaves passam a ser por provedor:

| Chave | Área | Conteúdo |
| --- | --- | --- |
| `tp.v2.credential.spotify` / `.youtube` | local | `{ clientId }` |
| `tp.v2.session.spotify` / `.youtube` | local | tokens + usuário; `refreshToken: null` no YouTube |
| `tp.v2.authreq.{provider}` | session | `{ state, codeVerifier? }` — PKCE só no Spotify |
| `tp.v2.draft` | local | rascunho estendido (seleção, fila, execuções) |
| `tp.v2.quota.youtube` | local | `{ ptDate: 'YYYY-MM-DD', units: number }` |

**Migração v1 → v2** (obrigatória por FR-042 e pelo Princípio de armazenamento): na inicialização, `tp.v1.credential` → `tp.v2.credential.spotify`; `tp.v1.session` → `tp.v2.session.spotify`; `tp.v1.draft` → rascunho v2 com `destinations: ['spotify']`, uma única execução Spotify na etapa gravada. As chaves v1 são removidas após a cópia bem-sucedida. Rascunho v1 ilegível é descartado com aviso, como hoje.

**Justificativa**: o Princípio de armazenamento exige "migração ou descarte seguro, nunca leitura de dado com formato antigo como se fosse novo" — e FR-042 escolhe explicitamente a migração, sem aviso extra além do banner de recuperação existente. Chaves separadas por provedor são o que torna estruturalmente impossível que remover a credencial de um serviço afete o outro (FR-006, e o Princípio de armazenamento em sua cláusula de isolamento).

**Alternativas consideradas**: manter `v1` e tornar os campos novos opcionais — seria exatamente "ler dado antigo como se fosse novo", vedado. Um único objeto `providers: {…}` sob uma chave só — remover uma credencial exigiria reescrever a chave que também guarda a outra, quebrando o isolamento por construção.

---

## §12 — Máquina de estados: fila de serviços e ciclo por serviço

**Decisão**: dois níveis explícitos e puros em `src/domain/run/`.

```text
Etapas globais:  credential → destinations → input → [ciclo por serviço] → summary
Ciclo (por serviço): connect → estimate? → search → review → creating → result
```

- `estimate` só existe para provedor com `dailyQuota !== null` (FR-029); nos demais é pulada sem deixar rastro na interface.
- A fila é `ProviderId[]` em **ordem fixa** derivada do registro de provedores — Spotify antes de YouTube (FR-015), sem controle de ordenação na interface.
- `summary` é exibida apenas quando `destinations.length > 1` (FR-040 e o caso de borda "um único serviço selecionado").
- Cada transição é função pura `(estado, evento) → estado`, testável sem DOM.

**Justificativa**: a fila e o ciclo carregam quase todas as regras de FR-016 a FR-021 e os estados de FR-040 (concluído/parcial/falhou/pulado). Mantê-los como redutor puro é o que permite verificá-los por teste unitário em vez de por E2E — coerente com o Princípio III e com o custo de teste que o Princípio IV impõe.

**Alternativas consideradas**: derivar o estado da árvore de componentes — inviável de testar e propenso a estados impossíveis (dois serviços "em andamento"). Biblioteca de máquina de estados (`xstate`) — dependência nova para ~8 estados e ~12 transições; a alternativa manual cabe em um arquivo.

---

## §13 — O que se propaga entre serviços, e o que não

**Decisão**: fonte única de linhas (`lines: InputLine[]`, derivada de `rawText`) compartilhada por todos os serviços. Uma correção de **texto** na revisão de um serviço reescreve `title`/`artist`/`featuredArtists` da linha na fonte única. Uma execução **já concluída** guarda cópia imutável das linhas e dos itens que usou. Escolha de candidata, inclusão/exclusão e descarte vivem apenas dentro da `ServiceRun`.

**Justificativa**: é a leitura literal de FR-014 e de FR-037 ("o registro da lista usada por um serviço já concluído DEVE ser imutável"). A cópia na conclusão é o que impede que a correção do YouTube altere retroativamente o relato do Spotify — SC-018 depende disso.

**Redução da lista para destinos posteriores** (FR-013): a lista de um serviço posterior é `lineIds` — um **subconjunto** dos ids do serviço anterior. A interface de redução só remove; validação pura `isSubsetOf(previous, next)` recusa qualquer acréscimo ou alteração, e lista vazia é apresentada como "pular destino" (caso de borda explícito da spec).

**Alternativas consideradas**: reexecutar a análise do texto por serviço — perderia os ids estáveis das linhas e, com eles, a rastreabilidade do subconjunto.

---

## §14 — Lista de hosts, CSP e o que é link em vez de destino

**Decisão**: módulo único `src/services/providers/hosts.ts` com a tabela do Princípio II, e nada além dela:

```ts
export const PROVIDER_HOSTS = {
  spotify: ['https://accounts.spotify.com', 'https://api.spotify.com', 'https://i.scdn.co'],
  youtube: ['https://accounts.google.com', 'https://www.googleapis.com', 'https://i.ytimg.com'],
} as const;
```

CSP de produção (`vite.config.ts`) atualizada em espelho:

```text
img-src     'self' data: https://i.scdn.co https://i.ytimg.com
connect-src 'self' https://accounts.spotify.com https://api.spotify.com https://www.googleapis.com
form-action 'self' https://accounts.spotify.com https://accounts.google.com
```

`https://www.youtube.com/playlist?list=…` e `https://console.cloud.google.com/…` aparecem **apenas como `href` exibido ao usuário**, nunca como destino de requisição — mesmo tratamento que `open.spotify.com` e `developer.spotify.com` já recebem na exceção de documentação do teste de hosts. `accounts.google.com` fica fora de `connect-src` porque a autorização é **navegação**, não `fetch`; entra em `form-action`.

**Justificativa**: o Princípio II exige lista fechada em módulo único e verificada por teste, e o Princípio IV exige que a verificação cubra "a tabela inteira, provedor a provedor, falhando tanto por host ausente quanto por host excedente". A distinção entre destino de requisição e link exibido precisa estar escrita, ou a próxima leitura do teste vai interpretá-la como brecha.

---

## §15 — Estratégia de verificação (Princípio IV)

**Decisão**:

| Invariante | Verificação |
| --- | --- |
| Tabela de hosts exata, por provedor, sem falta nem sobra | `tests/unit/no-secrets.spec.ts` estendido: compara `PROVIDER_HOSTS` entrada a entrada e varre `src/` por URL absoluta |
| Nenhum segredo de nenhum provedor | mesmo teste, padrão ampliado (`client_secret`, `clientSecret`) |
| Nenhuma requisição a provedor não selecionado / sem credencial | teste de integração com MSW que falha o teste se um handler de provedor não selecionado for tocado |
| SC-006 (≥ 75% Confiante correta no vídeo) | `tests/unit/scoring-youtube-reference.spec.ts` contra nova fixture `reference-50-youtube.json` |
| Estimativa e saldo de cota, virada em PT | `tests/unit/quota.spec.ts`, com `now` injetado nos dois lados do horário de verão |
| `quotaExceeded` não repete em laço | `tests/integration/youtube-quota.spec.ts` conta as requisições emitidas |
| Retomada sem duplicar nem faltar (SC-010) | `tests/integration/partial-failure.spec.ts` estendido para lote 1 e para reautorização no meio |
| Migração v1 → v2 (FR-042) | `tests/unit/storage-migration.spec.ts` |
| Fila, estados e resumo (FR-040) | `tests/unit/run-machine.spec.ts` — puro |
| Acessibilidade das telas novas (FR-047) | `tests/a11y/` estendido: destinos, fila, estimativa, resumo |
| Fluxo de dois destinos ponta a ponta, 375 px | `e2e/multi-destination.spec.ts` com **ambos** os provedores mockados |

**Justificativa**: cada linha corresponde a uma exigência nomeada da constituição ou a um SC da spec. Rastreabilidade por citação de `FR-xxx`/`SC-xxx` em nome ou comentário, como já é praticado.

---

## §16 — Desempenho com dois destinos (SC-015)

**Decisão**: manter o limitador atual (5 req/s, concorrência 4) para o Spotify e adotar **concorrência 4 com 4 req/s** para o YouTube na fase de busca; a fase de adição é serial por construção (§9).

**Estimativa para 50 linhas nos dois destinos**: Spotify ≈ 50 buscas + 1 criação + 1 lote ≈ 15 s. YouTube ≈ 50 buscas concorrentes (~13 s) + 5 chamadas de enriquecimento + 50 inserções seriais (~13 s a 4 req/s) ≈ 28 s. Total ≈ **45 s**, dentro dos 2 minutos de SC-015 com folga para a latência real.

**Justificativa**: a inserção serial é o gargalo e não é negociável (§9). A folga existente absorve variação de rede sem exigir paralelismo que quebraria a ordem.

**Alternativas consideradas**: elevar a concorrência de busca do YouTube — não reduz cota, e aumenta o risco de `rateLimitExceeded`, cujo backoff custaria mais tempo do que o ganho.

---

## Resumo das decisões

| # | Decisão |
| --- | --- |
| §1 | Implicit flow no Google; sem refresh; reautorização explícita é comportamento previsto |
| §2 | Escopo único `auth/youtube` |
| §3 | 5 endpoints; estimativa `100N + 5N/50 + 51 + 50S` + margem de 10% |
| §4 | `videos.list` em lotes de 50 para duração e canal |
| §5 | Saldo = 10 000 − consumo do dia PT, via `Intl` com `now` injetado |
| §6 | `403` desambiguado por `reason`: cota é terminal, taxa é transitório |
| §7 | Título limpo, canal como artista, bônus Topic/VEVO, `CONFIDENT = 0,88` |
| §8 | Indícios de versão por léxico + desvio de 25% da mediana; rebaixam para `uncertain` |
| §9 | Uma inserção por vídeo; `batchSize` do provedor; índice em itens |
| §10 | `PlaylistProvider` + capacidades como dados; HTTP genérico compartilhado |
| §11 | Esquema v2 por provedor + migração v1 → v2 |
| §12 | Fila e ciclo como redutores puros em `src/domain/run/` |
| §13 | Só correção de texto propaga; execução concluída é imutável; redução só remove |
| §14 | Módulo único de hosts; CSP espelhada; link exibido ≠ destino de rede |
| §15 | Onze verificações executáveis mapeadas a princípios e SCs |
| §16 | ~45 s para 50 linhas nos dois destinos |
