# Importador de Playlist por Texto

Cole uma lista no formato `Música - Artista`, escolha os destinos, confira as
correspondências e crie a playlist no **Spotify**, no **YouTube** ou nos dois.
Aplicação de página única, **100% cliente**: não há servidor, banco de dados nem
telemetria. Nada sai do seu navegador além das requisições para os serviços
oficiais de cada provedor.

- Fluxo linear de cinco etapas: **Configuração → Destinos → Entrada → Serviço →
  Resumo**. A etapa "Serviço" é um ciclo completo por destino, um de cada vez.
- A revisão é obrigatória **em cada serviço**: nada é escrito na sua conta antes
  de você confirmar naquele destino. Confirmar o Spotify não libera o YouTube.
- Nenhuma credencial é obrigatória isoladamente — basta cadastrar a de um
  serviço para usar aquele destino.
- O trabalho em andamento é gravado no seu dispositivo e sobrevive a recarga,
  expiração de sessão e reconexão, retomando no serviço e na etapa exatos.
- Interface inteiramente em português do Brasil.

---

## 1. Obter os Client IDs

Nenhum dos dois serviços usa "API key". Para escrever na conta de um usuário é
preciso o consentimento dele, e uma aplicação que roda só no navegador usa apenas
o **Client ID** — um valor público. Nenhum _Client Secret_ é solicitado, aceito
ou armazenado por este app.

Cadastre o que você for usar. Os dois são opcionais; ao menos um é necessário.

### Spotify

1. Acesse o [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   e entre com sua conta.
2. Crie um app (qualquer nome e descrição servem).
3. Copie o **Client ID** exibido na página do app.
4. Em _Settings_, cadastre o **Redirect URI** (seção 2).
5. Se o app estiver em modo de desenvolvimento, adicione sua conta em
   _Users and Access_ — sem isso a autorização volta como `access_denied`.

### YouTube

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   e crie (ou escolha) um projeto.
2. Ative a **YouTube Data API v3** na biblioteca de APIs do projeto.
3. Em _Credenciais_, crie um **ID do cliente OAuth** do tipo _Aplicativo da Web_.
4. Cadastre **dois** endereços, cada um no seu campo — veja a seção 2, porque são
   parecidos e diferentes.
5. Em _Público-alvo_, adicione como **usuário de teste** a conta do YouTube onde
   as playlists serão criadas. Ela precisa estar na lista mesmo sendo a dona do
   projeto; se for diferente da conta que criou o projeto, é ela que deve entrar.
   Sem isso a autorização é bloqueada com `access_denied`.

Os Client IDs são informados na própria interface e ficam guardados no
armazenamento local do navegador, exibidos mascarados por padrão, em chaves
separadas por serviço. Não existe arquivo `.env`.

---

## 2. Redirect URI e origem JavaScript

O **Redirect URI** é a **própria URL raiz** de onde a aplicação está sendo
servida — não existe rota `/callback`. A tela de configuração mostra o endereço
exato, calculado em tempo de execução, com botão de copiar. Cadastre exatamente
aquele valor.

| Onde você está rodando                        | Redirect URI a cadastrar           |
| --------------------------------------------- | ---------------------------------- |
| Desenvolvimento (`npm run dev`)               | `http://127.0.0.1:5173/`           |
| Pré-visualização do build (`npm run preview`) | `http://127.0.0.1:4173/`           |
| Hospedagem estática                           | a URL da página, com a barra final |

O Google exige, **além** do Redirect URI, a **origem JavaScript autorizada**. São
valores parecidos e não intercambiáveis:

| Campo no Google Cloud Console       | Valor                     | Barra final |
| ----------------------------------- | ------------------------- | ----------- |
| _URIs de redirecionamento_          | `http://127.0.0.1:5173/`  | **sim**     |
| _Origens JavaScript autorizadas_    | `http://127.0.0.1:5173`   | **não**     |

Trocar um pelo outro é a causa mais comum de `redirect_uri_mismatch`. A tela de
configuração do YouTube mostra os dois, cada um com seu botão de copiar. O
Spotify não usa origem JavaScript e, por isso, o campo não aparece lá.

Três regras de plataforma que costumam custar tempo:

- **`http://localhost` não é aceito.** Em desenvolvimento é obrigatório o IPv4
  literal `127.0.0.1` (ou `[::1]`). Por isso o dev server é fixado nesse host.
- **HTTPS é obrigatório**, exceto para endereços de loopback.
- **A correspondência é exata**: maiúsculas, minúsculas e a barra final contam.

Por que a raiz e não uma rota dedicada: hospedagens de arquivos estáticos
devolvem 404 para caminhos que não existem em disco, e uma rota `/callback`
exigiria regra de rewrite — configuração de servidor que este projeto se recusa
a assumir.

---

## 3. Executar

Requisitos: Node.js ≥ 22 e npm ≥ 10 (apenas para build e testes — o artefato
final não roda Node).

```bash
npm install
npm run dev          # http://127.0.0.1:5173/
npm run build        # gera dist/ — arquivos estáticos puros
npm run preview      # serve dist/ para conferir o build
```

### Qualidade

```bash
npm test             # unitários + integração (Vitest); rede mockada com MSW
npm run test:coverage
npm run test:e2e     # Playwright, incluindo viewport de 375 px e dois destinos
npm run lint
npm run typecheck
```

Nenhum teste toca a rede real: a integração usa MSW e a ponta a ponta roda com
**os dois** provedores mockados.

---

## 4. Publicar em hospedagem estática

O `dist/` é um conjunto de arquivos estáticos com caminhos relativos, então
funciona a partir de qualquer diretório, inclusive em subpasta.

```bash
npm run build
npx --yes serve dist -l 8080
```

Depois cadastre `http://127.0.0.1:8080/` como Redirect URI adicional (e a origem
`http://127.0.0.1:8080`, no caso do YouTube) e repita o fluxo. Para publicar de
verdade, copie o conteúdo de `dist/` para o seu provedor (GitHub Pages, Netlify,
S3, um `nginx` servindo arquivos — tanto faz) e cadastre a URL pública.

Nenhum passo além de servir os arquivos é necessário: não há processo, variável
de ambiente nem regra de rewrite a configurar.

---

## 5. O que as plataformas não permitem

Este app não simula recurso que a plataforma não oferece. Onde há limite, ele é
dito onde afeta o que você pode fazer.

**Pastas de playlist não existem para aplicações de terceiros — em nenhum dos
dois.** No Spotify é recurso exclusivo dos clientes oficiais; no YouTube não há
API de pastas. Não existe campo de pasta em etapa alguma: o app mostra o caminho
efetivo real — `Sua Biblioteca / {seu nome} / {playlist}` no Spotify,
`Você / Playlists / {playlist}` no YouTube — e avisa que mover precisa ser feito
no aplicativo do serviço.

**A playlist do YouTube não é uma playlist do YouTube Music.** Ela pode aparecer
lá, mas quem a gerencia é o YouTube. A API do YouTube Music não é pública.

**O escopo do YouTube é mais amplo do que o app usa.** Não existe permissão
apenas para playlists: a menor que permite criar uma cobre a conta do YouTube
inteira. O app lista suas playlists, cria uma nova e adiciona vídeos a ela — nada
além disso. Você pode revogar o acesso a qualquer momento na sua Conta Google.

**O YouTube tem orçamento diário de cota.** Cada busca custa 100 unidades e cada
vídeo adicionado custa 50, sobre um orçamento padrão de 10 000 unidades por dia:
uma lista de 50 linhas consome cerca de 76% do dia. Por isso a estimativa é
exibida **antes** de qualquer busca, e uma lista que não couber no saldo é
bloqueada com duas saídas — reduzir a lista ou pular o destino. O cálculo parte
sempre do orçamento padrão menos o que este app já consumiu hoje **neste
dispositivo**; ampliar a cota junto ao Google não altera esse cálculo.

---

## 6. Privacidade e segurança

Seis destinos de rede, e nenhum outro. Um teste automatizado falha tanto se um
host **faltar** quanto se um host **sobrar**:

| Serviço | Destinos de requisição                                                             |
| ------- | ---------------------------------------------------------------------------------- |
| Spotify | `accounts.spotify.com`, `api.spotify.com`, `i.scdn.co` (capas)                     |
| YouTube | `accounts.google.com`, `www.googleapis.com`, `i.ytimg.com` (miniaturas)            |

`open.spotify.com`, `developer.spotify.com`, `www.youtube.com` e
`console.cloud.google.com` aparecem **apenas como link exibido**, nunca como
destino de requisição. `accounts.google.com` recebe apenas uma navegação de
página inteira, nunca um `fetch` — e por isso não está em `connect-src` na CSP.

Permissões solicitadas:

- **Spotify**: criar playlists privadas e públicas e ler a lista das suas
  playlists (para checar nome repetido). `user-read-private` **não** é pedido.
- **YouTube**: gerenciar sua conta do YouTube — o menor escopo que permite listar
  e criar playlists, como explicado na seção 5.

O que fica no seu dispositivo, em chaves separadas por serviço:
`tp.v2.credential.{serviço}` (Client ID), `tp.v2.session.{serviço}`
(autorização), `tp.v2.quota.{serviço}` (consumo do dia) e `tp.v2.draft` (trabalho
em andamento). O rascunho nunca contém token nem Client ID. Desconectar de um
serviço não afeta o outro, e apaga só a sessão: a credencial e o rascunho
continuam. Remover a credencial e descartar o rascunho são ações separadas e
explícitas.

### Riscos registrados

**Token no armazenamento local.** Guardar o token de renovação ali o expõe a XSS.
Não há alternativa dentro da restrição "sem servidor próprio" — armazenamento
`httpOnly` exigiria um backend. As mitigações adotadas são uma CSP restritiva no
artefato de produção, nenhuma dependência que injete HTML,
`rel="noopener noreferrer"` em links externos e nenhuma renderização de conteúdo
do usuário como HTML.

**Implicit flow no YouTube, sem renovação silenciosa.** O Google não emite
_refresh token_ para clientes públicos sem servidor, então a autorização do
YouTube vale cerca de uma hora e **não pode ser renovada em silêncio**. Duas
consequências aceitas conscientemente: o token vem no fragmento da URL, onde
sobreviveria no histórico — o app o lê e limpa o fragmento com `replaceState`
antes de qualquer `await` —, e a expiração no meio do trabalho vira um pedido
explícito de reautorização. Nenhuma decisão da revisão é perdida nesse caminho: o
rascunho é preservado integralmente e o fluxo volta exatamente para onde parou. O
Spotify, que usa authorization code com PKCE, renova em silêncio e não tem esse
problema.

---

## 7. Estrutura

```text
src/
├── app/          # as cinco etapas e a inicialização
├── features/     # credential, destinations, connect, input, review,
│                 # quota, queue, result, service, summary
├── domain/       # PURO: parser, normalize, scoring, versionHints, quota,
│                 # dedupe, batching, validation, run/ (fila e ciclo)
├── services/     # providers/ (contrato + spotify/ + youtube/), storage/
├── store/        # estado (Zustand) + persistência seletiva do rascunho
├── ui/           # componentes acessíveis compartilhados
├── i18n/pt-BR.ts # todos os textos da interface
└── styles/       # Tailwind CSS 4 com configuração CSS-first
```

A separação que importa é entre `src/domain/` — puro, determinístico, sem rede
nem DOM, onde vivem as regras e a maior parte dos testes — e `src/services/`,
onde está todo o I/O, isolado atrás da interface `PlaylistProvider`. Acrescentar
um terceiro serviço é implementar essa interface e registrá-lo; nenhuma tela
ramifica por provedor.

Documentação de projeto: [`specs/001-text-to-playlist/`](specs/001-text-to-playlist/)
e [`specs/002-multi-service-playlists/`](specs/002-multi-service-playlists/).
