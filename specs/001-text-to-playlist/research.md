# Research: Importador de Playlist por Texto (Text-to-Playlist)

**Feature**: `001-text-to-playlist` | **Data**: 2026-08-05 | **Fase**: 0

Este documento resolve todos os pontos marcados como NEEDS CLARIFICATION no Technical Context do [plan.md](./plan.md) e fixa as decisões técnicas que a spec deliberadamente deixou em aberto (limiares de confiança, mecanismo de armazenamento, fluxo de autorização concreto).

---

## 1. Fluxo de autorização

**Decisão**: OAuth 2.0 **Authorization Code + PKCE** (`code_challenge_method=S256`), executado inteiramente no navegador.

- Endpoint de autorização: `https://accounts.spotify.com/authorize`
- Endpoint de token: `https://accounts.spotify.com/api/token` (aceita CORS para o fluxo PKCE, sem `Authorization` header — apenas `client_id` + `code_verifier` no corpo)
- O `refresh_token` é retornado; ao renovar, a resposta **pode ou não** trazer um novo `refresh_token` — quando trouxer, substituir; quando não, manter o anterior.

**Justificativa**: atende FR-006 (prova de posse, sem segredo de cliente, sem servidor próprio) e FR-005 (nenhum Client Secret). É o único fluxo que o Spotify suporta para aplicações que rodam só no navegador.

**Alternativas rejeitadas**:

- _Implicit Grant_: descontinuado pelo Spotify, não emite `refresh_token` — quebraria FR-008 (renovação silenciosa).
- _Client Credentials_: não representa um usuário; não pode escrever na biblioteca de ninguém.
- _Backend proxy guardando o segredo_: violaria SC-008 (hospedagem estática) e o escopo "sem servidor próprio".

---

## 2. Redirect URI e hospedagem estática

**Decisão**: o Redirect URI é a **própria URL raiz da aplicação** (`window.location.origin + import.meta.env.BASE_URL`), sem rota `/callback` dedicada. O app detecta `?code=` / `?error=` no carregamento, processa e limpa a query string com `history.replaceState`.

**Justificativa**: hospedagens de arquivos estáticos (GitHub Pages, Netlify drop, `python -m http.server`) devolvem 404 para caminhos que não existem em disco. Uma rota `/callback` exigiria regra de rewrite — configuração de servidor que SC-008 proíbe assumir. Usando a raiz, o fluxo funciona em qualquer hospedagem estática sem configuração.

**Regras da plataforma confirmadas** (afetam a mensagem de ajuda exigida por FR-011):

- HTTPS é obrigatório, **exceto** para endereços de loopback.
- `http://localhost` **não é aceito**. Em desenvolvimento é obrigatório `http://127.0.0.1:5173/` (IPv4 literal) ou `http://[::1]:5173/`.
- A correspondência é **exata**: maiúsculas/minúsculas e barra final incluídas.

**Consequência de implementação**: o Vite dev server deve ser configurado com `server.host = '127.0.0.1'`, e a tela de credencial exibe o Redirect URI **calculado em tempo de execução** com botão de copiar — nunca um valor hardcoded.

---

## 3. Escopos mínimos

**Decisão**: `playlist-modify-private playlist-modify-public playlist-read-private`.

| Escopo                    | Por quê                                                          | Requisito      |
| ------------------------- | ---------------------------------------------------------------- | -------------- |
| `playlist-modify-private` | criar playlist privada (padrão) e adicionar faixas               | FR-030, FR-032 |
| `playlist-modify-public`  | criar playlist pública quando o usuário alterna a visibilidade   | FR-030         |
| `playlist-read-private`   | listar as playlists existentes para a checagem de nome duplicado | FR-029         |

**`user-read-private` não é solicitado**: `GET /v1/me` devolve `id` e `display_name` com qualquer token válido. Esse escopo só é necessário para `country`/`product`, que não usamos. Solicitá-lo violaria "permissões mínimas" (FR-007).

**Consequência**: a busca **omite** `market`. `market=from_token` também depende de `user-read-private` e responde `403 Insufficient client scope` sem ele; omitindo o parâmetro, a API já aplica o país da conta associada ao token de usuário.

---

## 4. Limitação de requisições e vazão da busca

**Fatos da plataforma**: janela deslizante de ~30 s; excesso devolve **429** com header `Retry-After` (em segundos). A cota exata não é publicada e é menor no modo de desenvolvimento.

**Decisão**: limitador de vazão próprio, com três camadas:

1. **Token bucket** com teto sustentado de **5 requisições/segundo** e rajada de 10.
2. **Concorrência fixa de 4** buscas simultâneas (`Promise` pool), não `Promise.all` sobre a lista inteira.
3. **Backoff em 429**: respeita `Retry-After` exatamente; se ausente, backoff exponencial `2^n × 1s` com teto de 30 s e no máximo 4 tentativas. Durante a espera o estado "aguardando" é exibido e **o cancelamento continua funcionando** (FR-026, SC-011).

**Justificativa de dimensionamento**: FR-027 exige ≥ 2 linhas/s. Cada linha custa 1 requisição de busca. Com teto de 5 req/s, 50 linhas concluem em ~10-12 s (folga de 3× sobre os 30 s de SC-010) e 250 linhas em ~55 s (folga de 2× sobre os 2 min). O teto conservador troca velocidade máxima por ausência de 429 sistemático, que é exatamente o que FR-027 pede.

**Alternativas rejeitadas**:

- _Sem limitador, `Promise.all`_: 250 requisições instantâneas garantem 429 em massa e violam FR-027.
- _Sequencial (1 por vez)_: ~1,5 linhas/s com latência típica de 250-600 ms — abaixo do mínimo exigido.
- _Concorrência adaptativa dinâmica_: complexidade sem ganho no caso de uso real (≤ 50 linhas).

---

## 5. Estratégia de busca no catálogo

**Decisão**: `GET /v1/search` com **filtros de campo**: `q=track:"{título}" artist:"{artista}"`, `type=track`, `limit=5`, sem `market` (§3).

**Fallback em duas etapas**: se a busca com filtros retorna zero itens, refazer **uma** vez com texto livre (`q={título} {artista}`) antes de classificar como Não encontrada. Isso recupera casos de grafia de artista divergente sem dobrar o custo do caminho feliz.

**Justificativa**: FR-020 exige busca por campos. `limit=5` alimenta diretamente as 5 candidatas de FR-023 sem requisição extra.

---

## 6. Normalização e pontuação de similaridade

**Decisão — pipeline de normalização** (aplicado ao texto do usuário e ao resultado do catálogo antes de comparar):

1. Unicode NFD + remoção de marcas diacríticas (`\p{Diacritic}`) → insensível a acento.
2. `toLocaleLowerCase('pt-BR')`.
3. Remoção de prefixo de numeração: `^\s*(\d+[\.\)\-]|[-–—•*])\s*`.
4. Remoção de sufixos promocionais entre parênteses/colchetes quando o conteúdo casa com a lista de ruído (`official video`, `official music video`, `lyrics`, `lyric video`, `audio`, `hd`, `hq`, `4k`, `clipe oficial`, `ao vivo`? **não** — ver abaixo).
5. Preservação explícita de `feat.` / `ft.` / `com` → extraídos como **artistas secundários**, não descartados (usados como reforço de pontuação, nunca como artista principal).
6. Colapso de pontuação e espaços múltiplos.

**Não são tratados como ruído**: `remix`, `live`/`ao vivo`, `acoustic`, `remaster`. São variantes de gravação que mudam a faixa — removê-los faria o app escolher a versão errada em silêncio.

**Decisão — pontuação** (0 a 1):

```
score = 0.6 × sim(título) + 0.4 × simArtista
simArtista = máximo de sim(artista_usuário, a) para cada artista a da faixa
sim(a,b)  = max( razão de Levenshtein normalizada , Jaccard de tokens )
```

Bônus de +0,05 (com teto em 1,0) quando algum artista secundário declarado com `feat.` aparece entre os artistas da faixa.

**Decisão — limiares** (a spec delegou explicitamente ao planejamento):

| Faixa de score            | Status             | Comportamento                                       |
| ------------------------- | ------------------ | --------------------------------------------------- |
| ≥ **0,82**                | **Confiante**      | selecionada por padrão (FR-025)                     |
| **0,55** – 0,82           | **Incerta**        | **não** selecionada até confirmação visual (FR-025) |
| < 0,55 ou zero resultados | **Não encontrada** | listada ao final, copiável (FR-039, FR-040)         |

**Justificativa dos valores**: 0,82 tolera pontuação divergente, acento e um sufixo residual, mas rejeita título parecido de artista diferente (o erro caro). 0,55 marca o piso abaixo do qual o resultado é ruído — apresentá-lo como candidato só geraria trabalho de revisão. Os limiares ficam em **um único módulo de configuração** para serem calibrados contra a lista de referência de 50 faixas de SC-002 sem tocar na lógica.

**Validação**: SC-002 (≥ 90% de Confiantes corretas em 50 faixas populares) vira um teste de dataset versionado em `tests/fixtures/reference-50.json` — é o critério de aceite dos limiares, não um chute permanente.

---

## 7. Detecção de duplicatas

**Decisão**: duas passagens.

1. **Duplicata de entrada** — chave `{título normalizado}|{artista normalizado}`: a primeira ocorrência mantém o comportamento normal; as seguintes são marcadas como duplicata e **desmarcadas** (FR-018).
2. **Duplicata de resultado** — mesma `track.uri` escolhida por linhas diferentes: sinalizada da mesma forma. Cobre "Song (Radio Edit)" e "Song" que resolvem para a mesma faixa.

A ordem original nunca é alterada — duplicatas permanecem visíveis na posição em que foram escritas (FR-019).

---

## 8. Persistência local

**Decisão**: `localStorage` com camada de repositório tipada e **chaves versionadas**.

| Chave              | Conteúdo                                                                      | Ciclo de vida                                                          |
| ------------------ | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `tp.v1.credential` | Client ID                                                                     | até "Remover credencial" (FR-004)                                      |
| `tp.v1.session`    | `access_token`, `refresh_token`, `expires_at`, `user.id`, `user.display_name` | até "Desconectar" ou falha de renovação                                |
| `tp.v1.draft`      | rascunho de trabalho (FR-043)                                                 | apagado após criação bem-sucedida ou por "descartar rascunho" (FR-045) |
| `tp.v1.pkce`       | `code_verifier` + `state`                                                     | **`sessionStorage`**, apagado ao consumir o `code`                     |

**Justificativa do `localStorage` em vez de IndexedDB**: o rascunho de 250 linhas com 5 candidatas cada gira em torno de 350-400 KB serializado — folgado dentro do orçamento típico de 5 MB. IndexedDB traria assincronia e migrações para um ganho que o caso de uso real (≤ 50 linhas) nunca exercita.

**Tratamento de `QuotaExceededError`**: degradação em dois passos — (1) regravar o rascunho sem as candidatas alternativas, mantendo só a escolhida; (2) se ainda falhar, avisar o usuário de que o rascunho não pôde ser gravado e seguir com o trabalho em memória. Nunca falhar em silêncio.

**Nota de segurança registrada deliberadamente**: guardar `refresh_token` em `localStorage` o expõe a XSS. Não há alternativa dentro da restrição "sem servidor próprio" (FR-006, SC-008) — armazenamento httpOnly exige backend. Mitigações adotadas: CSP restritiva no `index.html`, zero dependências que injetem HTML, `rel="noopener noreferrer"` em links externos, e nenhuma renderização de conteúdo do usuário como HTML. O `code_verifier` fica em `sessionStorage` e é destruído assim que consumido.

**CSP e Tailwind**: no artefato de produção o Tailwind emite um `.css` estático, então `style-src 'self'` basta e a CSP permanece restritiva. O dev server do Vite injeta CSS via `<style>`, o que exigiria `style-src 'unsafe-inline'`. A CSP é declarada **apenas no build** (via plugin de transformação do `index.html`), nunca afrouxada no arquivo-fonte — do contrário o relaxamento de desenvolvimento vazaria para produção sem ninguém perceber.

---

## 9. Renovação de sessão

**Decisão**: renovação **proativa e reativa**.

- Proativa: se `expires_at - agora < 60 s`, renovar antes de disparar a requisição.
- Reativa: um `401` dispara **uma** renovação e repete a requisição original; se a renovação falhar, a sessão é limpa e o app pede reconexão **preservando o rascunho** (FR-043, FR-044, Cenário 2 da US4).
- Renovações concorrentes são coalescidas em uma única promessa em voo — 4 buscas paralelas não podem disparar 4 renovações.

---

## 10. Criação da playlist e resiliência a falha parcial

**Decisão**:

1. `GET /v1/me` → `user.id`, `display_name`.
2. `GET /v1/me/playlists?limit=50` paginado → checagem de nome duplicado, comparando `nome.trim().toLocaleLowerCase()`. **Só playlists cujo `owner.id === user.id`** entram na comparação — bloquear por causa de uma playlist de terceiros apenas seguida pelo usuário seria surpreendente e não é o que FR-029 descreve ("playlist da conta"). Falha nessa consulta **bloqueia** a criação com opção de repetir (edge case da spec: nunca criar às cegas).
3. `POST /v1/users/{user_id}/playlists` → cria com `name`, `description`, `public`.
4. `POST /v1/playlists/{id}/tracks` em lotes de **100 URIs** (limite da plataforma), **sequenciais**, na ordem original.

**Resiliência (FR-033, SC-009)**: após cada lote confirmado, o índice do último lote bem-sucedido e o `playlistId` são gravados no rascunho. Uma falha no lote _n_ deixa a retomada partir exatamente de _n_ — os lotes já confirmados nunca são reenviados, logo não há duplicação. O lote é a unidade atômica: a plataforma confirma o lote inteiro ou nenhum item dele.

**Por que sequencial e não paralelo**: paralelizar lotes destruiria a garantia de ordem de FR-019 e o índice de retomada. Com ≤ 3 lotes no pior caso realista, não há ganho de tempo relevante.

---

## 11. Stack

| Escolha          | Decisão                                           | Justificativa                                                                                                                             | Rejeitado                                                                                  |
| ---------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Linguagem        | TypeScript 5.x (`strict`)                         | Correspondências, status e transições de etapa são um domínio de tipos discriminados; o compilador cobre grande parte dos erros de estado | JS puro — sem rede de proteção para o modelo de estados                                    |
| UI               | React 19                                          | Estado de revisão com edição por linha e re-busca pontual; ecossistema de testes maduro                                                   | Vanilla JS — reimplementar reconciliação de lista longa a mão                              |
| Build            | Vite 7                                            | `build` gera artefato estático puro, servível de qualquer lugar (SC-008); dev server com HMR                                              | Next.js — presume servidor/rotas, contraria SC-008                                         |
| Estado           | Zustand + middleware `persist` com `partialize`   | Persistência seletiva de rascunho sem escrever a máquina de estado a mão                                                                  | Redux Toolkit (cerimônia demais); Context puro (re-renderiza a lista inteira a cada tecla) |
| Testes unitários | Vitest + Testing Library + happy-dom              | Mesmo pipeline do Vite; domínio puro testável sem navegador                                                                               | Jest — configuração duplicada com o Vite                                                   |
| Mock de rede     | MSW                                               | Testa o cliente HTTP real, inclusive 429/401/paginação                                                                                    | `fetch` mockado a mão — não exercita retry nem headers                                     |
| E2E              | Playwright                                        | Único caminho para validar SC-012 (375 px, sem rolagem horizontal) e o retorno do redirect                                                | Cypress — suporte a multi-origem mais frágil                                               |
| Estilo           | Tailwind CSS 4.3 via `@tailwindcss/vite`          | Ver §14                                                                                                                                   | CSS Modules, CSS-in-JS                                                                     |
| Formatação/lint  | ESLint + Prettier + `prettier-plugin-tailwindcss` | Padrão do ecossistema; o plugin ordena as classes utilitárias de forma determinística, o que elimina ruído de diff em atributos longos    | —                                                                                          |

**Sem biblioteca de componentes** (MUI, Chakra, shadcn/ui): são 4 telas com um punhado de controles. Os componentes de `src/ui/` são escritos à mão sobre elementos nativos, o que mantém o comportamento de acessibilidade (FR-046) inteiramente sob nosso controle, sem herdar nem auditar o de terceiros. Tailwind não muda isso — é camada de estilo, não de comportamento.

---

## 12. Acessibilidade e telas estreitas

**Decisão**:

- Layout em coluna única com largura máxima; a revisão é escrita **mobile-first** — cartões empilhados por padrão, virando tabela a partir do breakpoint `sm` (640 px). Essa inversão é o que garante SC-012: o caso estreito é o comportamento padrão, não uma exceção a lembrar de escrever. Nenhum contêiner usa largura fixa em pixels.
- O botão de revelar credencial é um `<button aria-pressed>` com rótulo dinâmico ("Revelar credencial" / "Ocultar credencial"), nunca um ícone sem nome acessível (FR-046).
- Progresso da busca em região `aria-live="polite"` com contagem textual; o cancelamento é um botão real, alcançável por teclado durante toda a operação.
- Foco movido para o cabeçalho da etapa a cada transição, e mensagens de erro associadas aos campos por `aria-describedby`.
- Validação automatizada: `axe-core` rodando dentro dos testes de componente das 4 etapas.

---

## 13. Textos da interface

**Decisão**: todos os textos em um único módulo `src/i18n/pt-BR.ts` exportando um objeto congelado; nenhum literal de UI espalhado em componentes (FR-048). Não há mecanismo de troca de idioma — múltiplos idiomas estão fora de escopo. O módulo único existe para revisão e teste dos textos, não para internacionalização.

---

## 14. Estilo — Tailwind CSS

**Decisão**: Tailwind CSS 4.3 pelo plugin oficial do Vite (`@tailwindcss/vite`), com **configuração CSS-first**. Não existe `tailwind.config.js`: toda a customização vive em `src/styles/index.css`.

```css
@import 'tailwindcss';

@theme {
  /* tokens do produto — geram utilitários automaticamente */
  --color-surface: …;
  --color-status-confident: …;
  --color-status-uncertain: …;
  --color-status-not-found: …;
}
```

**Justificativa**:

- **Zero runtime**: o Tailwind roda no build e emite um `.css` estático. Não adiciona JavaScript ao pacote nem custo de execução — condição para o artefato continuar sendo arquivos estáticos puros (SC-008).
- **Só o que é usado é emitido**: o scanner detecta as classes no código-fonte, então as 4 telas produzem um CSS pequeno independentemente do tamanho do vocabulário disponível.
- **Responsividade por padrão**: os prefixos de breakpoint (`sm:`, `md:`) tornam o layout mobile-first o caminho de menor esforço. FR-047 e SC-012 deixam de depender de alguém lembrar de escrever a media query.
- **`@theme` substitui a camada de tokens**: as custom properties viram utilitários automaticamente, eliminando a duplicação entre um arquivo de tokens e as folhas que os consomem.

**Restrição adotada — classes utilitárias são estáticas**: nunca construir nomes de classe por concatenação (`` `text-${cor}` ``). O scanner do Tailwind lê o código como texto e não resolve expressões — classes montadas em tempo de execução simplesmente não são emitidas. Os estados variáveis (status da correspondência, seleção, erro) usam um **mapa explícito de literais** em um único módulo por componente. É a armadilha mais comum do Tailwind e a única que quebraria a interface em produção sem quebrar em desenvolvimento.

**Restrição adotada — `@utility` para recorrências**: repetições que apareçam em três ou mais lugares (cartão da revisão, campo com erro, selo de status) viram um utilitário nomeado em `index.css`, não uma string copiada. Evita o modo de falha em que a mesma "variante" diverge silenciosamente entre telas.

**Alternativas rejeitadas**:

- _CSS Modules com custom properties_ (escolha anterior): funciona, mas exige escrever à mão toda a escala de espaçamento, cor e tipografia, e toda media query. Mais arquivos e mais decisões para o mesmo resultado visual.
- _CSS-in-JS_ (styled-components, emotion): adiciona runtime ao pacote e, nas variantes com injeção de `<style>`, força `style-src 'unsafe-inline'` na CSP — conflita diretamente com a mitigação de XSS de §8.
- _shadcn/ui e similares_: traz componentes prontos junto, o que reintroduz exatamente o comportamento de acessibilidade de terceiros que decidimos não herdar em §11.

**Impacto na acessibilidade**: nenhum. Tailwind não gera marcação nem comportamento. Os requisitos de FR-046 continuam sendo satisfeitos pelos elementos nativos e pelos atributos ARIA escritos à mão em `src/ui/`, e verificados por axe-core.

---

## Pendências residuais

Nenhuma. Todos os NEEDS CLARIFICATION do Technical Context foram resolvidos acima.
