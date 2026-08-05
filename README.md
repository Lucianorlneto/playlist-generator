# Importador de Playlist por Texto

Cole uma lista no formato `Música - Artista`, confira as correspondências e crie
a playlist no Spotify. Aplicação de página única, **100% cliente**: não há
servidor, banco de dados nem telemetria. Nada sai do seu navegador além das
requisições para os serviços oficiais do Spotify.

- Fluxo linear de quatro etapas: **Credencial → Entrada → Revisão → Resultado**.
- A revisão é obrigatória: nada é escrito na sua conta antes de você confirmar.
- O trabalho em andamento é gravado no seu dispositivo e sobrevive a recarga,
  expiração de sessão e reconexão.
- Interface inteiramente em português do Brasil.

---

## 1. Obter o Client ID

O Spotify não usa "API key". Para escrever na biblioteca de um usuário é preciso
o consentimento dele, e uma aplicação que roda só no navegador usa apenas o
**Client ID** — um valor público. O _Client Secret_ **não** é solicitado, aceito
nem armazenado por este app.

1. Acesse o [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   e entre com sua conta.
2. Crie um app (qualquer nome e descrição servem).
3. Copie o **Client ID** exibido na página do app.
4. Em _Settings_, cadastre o **Redirect URI** (próxima seção).
5. Se o app estiver em modo de desenvolvimento, adicione sua conta em
   _Users and Access_ — sem isso a autorização volta como `access_denied`.

O Client ID é informado na própria interface e fica guardado no armazenamento
local do navegador, exibido mascarado por padrão. Não existe arquivo `.env`.

---

## 2. Qual Redirect URI cadastrar (e por que `localhost` não serve)

O Redirect URI é a **própria URL raiz** de onde a aplicação está sendo servida —
não existe rota `/callback`. A tela de credencial mostra o endereço exato,
calculado em tempo de execução, com botão de copiar. Cadastre exatamente aquele
valor.

| Onde você está rodando                        | Redirect URI a cadastrar           |
| --------------------------------------------- | ---------------------------------- |
| Desenvolvimento (`npm run dev`)               | `http://127.0.0.1:5173/`           |
| Pré-visualização do build (`npm run preview`) | `http://127.0.0.1:4173/`           |
| Hospedagem estática                           | a URL da página, com a barra final |

Três regras da plataforma que costumam custar tempo:

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
npm run test:e2e     # Playwright, incluindo viewport de 375 px
npm run lint
npm run typecheck
```

Nenhum teste toca a rede real.

---

## 4. Publicar em hospedagem estática

O `dist/` é um conjunto de arquivos estáticos com caminhos relativos, então
funciona a partir de qualquer diretório, inclusive em subpasta.

```bash
npm run build
npx --yes serve dist -l 8080
```

Depois cadastre `http://127.0.0.1:8080/` como Redirect URI adicional e repita o
fluxo. Para publicar de verdade, copie o conteúdo de `dist/` para o seu provedor
(GitHub Pages, Netlify, S3, um `nginx` servindo arquivos — tanto faz) e cadastre
a URL pública, com a barra final, como Redirect URI.

Nenhum passo além de servir os arquivos é necessário: não há processo, variável
de ambiente nem regra de rewrite a configurar.

---

## 5. O que a plataforma não permite

**Pastas de playlist não existem na Web API.** Aplicações de terceiros não podem
criar, listar ou mover playlists entre pastas — é recurso exclusivo dos clientes
oficiais. Este app não oferece campo de pasta nem simula um: ele mostra o caminho
efetivo real, `Sua Biblioteca / {seu nome} / {nome da playlist}`, e avisa que a
movimentação precisa ser feita no aplicativo do Spotify.

---

## 6. Privacidade

- Três destinos de rede, e nenhum outro: `accounts.spotify.com`,
  `api.spotify.com` e `i.scdn.co` (capas de álbum). Um teste automatizado falha
  se alguma URL do código escapar dessa lista.
- Permissões solicitadas: criar playlists privadas e públicas e ler a lista das
  suas playlists (para checar nome repetido). `user-read-private` **não** é
  pedido.
- O que fica no seu dispositivo: `tp.v1.credential` (Client ID), `tp.v1.session`
  (autorização) e `tp.v1.draft` (trabalho em andamento). O rascunho nunca contém
  token nem Client ID.
- Desconectar apaga só a sessão; a credencial e o rascunho continuam. Remover a
  credencial e descartar o rascunho são ações separadas e explícitas.

**Nota de segurança, registrada deliberadamente**: guardar o token de renovação
no armazenamento local o expõe a XSS. Não há alternativa dentro da restrição "sem
servidor próprio" — armazenamento `httpOnly` exigiria um backend. As mitigações
adotadas são uma CSP restritiva no artefato de produção, nenhuma dependência que
injete HTML, `rel="noopener noreferrer"` em links externos e nenhuma renderização
de conteúdo do usuário como HTML.

---

## 7. Estrutura

```text
src/
├── app/          # as quatro etapas e a inicialização
├── features/     # credential, connect, input, review, result
├── domain/       # PURO: parser, normalize, scoring, dedupe, batching, validation
├── services/     # spotify/ (todo o I/O), rate-limiter, storage/
├── store/        # estado (Zustand) + persistência seletiva do rascunho
├── ui/           # componentes acessíveis compartilhados
├── i18n/pt-BR.ts # todos os textos da interface
└── styles/       # Tailwind CSS 4 com configuração CSS-first
```

A separação que importa é entre `src/domain/` — puro, determinístico, sem rede
nem DOM, onde vivem as regras e a maior parte dos testes — e `src/services/`,
onde está todo o I/O, isolado atrás de interfaces mockáveis.

Documentação de projeto: [`specs/001-text-to-playlist/`](specs/001-text-to-playlist/).
# playlist-generator
