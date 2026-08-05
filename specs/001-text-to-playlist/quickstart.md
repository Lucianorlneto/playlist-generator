# Quickstart: validar o Importador de Playlist por Texto

**Feature**: `001-text-to-playlist` | **Fase**: 1

Guia de execução e validação. Descreve **como provar que a feature funciona**, não como implementá-la — os detalhes de implementação ficam em `tasks.md` e no código.

---

## Pré-requisitos

- Node.js ≥ 22 (o ambiente de referência usa 26.3.1) e npm ≥ 10.
- Conta Spotify (gratuita serve).
- Um app registrado em <https://developer.spotify.com/dashboard> com o **Redirect URI** `http://127.0.0.1:5173/` cadastrado.
  - `http://localhost:5173/` **não funciona** — a plataforma rejeita `localhost`. Use o IPv4 literal, com a barra final ([research.md §2](./research.md)).
  - App em modo de desenvolvimento: adicione sua conta em _Users and Access_, senão a autorização volta como `access_denied`.

---

## Executar

```bash
npm install
npm run dev          # abre em http://127.0.0.1:5173/
npm run build        # gera dist/ — artefato estático puro
npm run preview      # serve dist/ localmente para conferir o build
```

**Validação de SC-008** (roda de hospedagem estática, sem serviço próprio):

```bash
npm run build && npx --yes serve dist -l 8080
```

Cadastre `http://127.0.0.1:8080/` como Redirect URI adicional e repita o Cenário A. Nenhum processo além do servidor de arquivos deve estar rodando.

---

## Testes automatizados

```bash
npm test                  # unitários + integração (Vitest); rede mockada com MSW
npm run test:coverage
npm run test:e2e          # Playwright — fluxo completo com Spotify mockado
npm run lint && npm run typecheck
```

Nenhum teste toca a rede real. O contrato mockado é exatamente o de [contracts/spotify-api.md](./contracts/spotify-api.md).

---

## Cenários de validação manual

Cada cenário é ponta a ponta e mapeia diretamente para critérios de sucesso da spec.

### A — Credencial e conexão (US1, SC-004)

1. Abra o app sem nada salvo. **Esperado**: campo de credencial vazio, instruções de obtenção do Client ID e o Redirect URI exato com botão de copiar.
2. Cole o Client ID e salve. **Esperado**: valor mascarado (`••••••••1a2b`), botão de revelar visível.
3. Acione revelar / ocultar. **Esperado**: alterna entre texto claro e mascarado.
4. Recarregue a página. **Esperado**: credencial ainda salva e mascarada.
5. Conecte. **Esperado**: consentimento do Spotify e, no retorno, o nome de exibição da conta — sem `?code=` sobrando na URL.
6. Desconecte. **Esperado**: sessão encerrada, **credencial preservada**; "Remover credencial" é uma ação separada.

### B — Colar, analisar e revisar (US2, SC-002, SC-003)

Cole:

```
1. Bohemian Rhapsody - Queen
Imagine – John Lennon
Smells Like Teen Spirit — Nirvana
Hey Jude by The Beatles
Garota de Ipanema - Tom Jobim
Águas de Março (Official Video) - Elis Regina
linha sem separador nenhum
Bohemian Rhapsody - Queen
```

**Esperado**:

- 8 itens, na ordem colada; o prefixo `1.` some do título.
- Os quatro separadores são reconhecidos; acentos não atrapalham.
- `(Official Video)` não vai para a busca.
- A linha sem separador aparece como **formato não reconhecido** e é editável ali mesmo.
- A repetição de _Bohemian Rhapsody_ é sinalizada como duplicata e vem **desmarcada**.
- Cada item mostra **Confiante**, **Incerta** ou **Não encontrada**; Confiantes marcadas, Incertas desmarcadas.
- Abrir alternativas mostra até 5 candidatas com título, artista, álbum, duração e capa.

### C — Re-busca por linha (FR-017)

Na linha sem separador, escreva `Wonderwall - Oasis` e confirme com Enter.

**Esperado**: só aquela linha é buscada de novo e muda de status. As demais permanecem exatamente como estavam — inclusive as escolhas manuais feitas em itens Incertos. Digitar sem confirmar **não** dispara busca.

### D — Criar a playlist (US3, SC-007)

1. Tente criar com o nome vazio. **Esperado**: bloqueado, com a mensagem de nome obrigatório.
2. Use o nome de uma playlist que já existe na sua conta, variando caixa e espaços de borda. **Esperado**: bloqueado, pedindo outro nome.
3. Use um nome novo e confirme. **Esperado**: playlist criada; faixas na ordem original; resultado com nome, quantidade adicionada, link, o caminho `Sua Biblioteca / {seu nome} / {nome da playlist}` e o aviso sobre pastas.
4. **Esperado**: nenhum campo de seleção de pasta em lugar nenhum da interface.
5. Não encontradas listadas, com botão de copiar em bloco.

### E — Rascunho e recuperação (US4, SC-006)

1. Com a revisão preenchida e algumas escolhas manuais feitas, recarregue a página. **Esperado**: aviso de trabalho recuperado, retomada na mesma etapa, texto + nome + escolhas intactos.
2. Desconecte e reconecte no meio da revisão. **Esperado**: mesma preservação.
3. Conclua uma criação. **Esperado**: o rascunho é apagado — a próxima abertura começa limpa.
4. Acione "descartar rascunho". **Esperado**: estado zerado, credencial preservada.

### F — Volume, vazão e cancelamento (SC-005, SC-010, SC-011)

1. Cole 250 linhas. **Esperado**: conclusão em até 2 minutos, progresso avançando visivelmente o tempo todo, ordem preservada, sem duplicatas.
2. Cole 50 linhas. **Esperado**: até 30 segundos.
3. Cancele no meio da busca, inclusive durante uma espera por limitação de requisições. **Esperado**: para de imediato, sem travar a interface e sem perder o que já foi buscado.

### G — Telas estreitas e teclado (SC-012, FR-046)

Com o DevTools em **375 px** de largura, percorra as quatro etapas.

**Esperado**: nenhuma rolagem horizontal da página, todos os controles alcançáveis, fluxo inteiro navegável só pelo teclado, e o botão de revelar credencial com nome acessível audível em leitor de tela.

### H — Falha parcial na adição (SC-009)

Com 150+ faixas selecionadas, force a falha de um lote (DevTools → _Network_ → bloquear `api.spotify.com/v1/playlists/*/tracks` após o primeiro lote passar).

**Esperado**: o app informa quantas faixas entraram e oferece "tentar novamente". Ao repetir com a rede liberada, a playlist termina **sem faixas duplicadas e sem faltantes**, e nenhuma segunda playlist é criada.

### I — Erros acionáveis (US4, FR-042)

| Provocação                                              | Esperado                                                   |
| ------------------------------------------------------- | ---------------------------------------------------------- |
| Client ID inválido                                      | Mensagem com causa provável e caminho de correção          |
| Redirect URI não cadastrado                             | Mensagem com o URI **exato** a cadastrar + botão de copiar |
| Sessão expirada (adiante `expiresAt` no `localStorage`) | Renovação silenciosa; nada do que foi digitado se perde    |
| Rede desligada durante a busca                          | Aviso claro e possibilidade de repetir sem recomeçar       |

---

## Checagens de segurança e privacidade (FR-005, FR-010, SC-004)

Com o DevTools aberto durante um fluxo completo:

1. **Network** → nenhuma requisição para host fora de `accounts.spotify.com`, `api.spotify.com`, `i.scdn.co`.
2. **Application → Local Storage** → apenas `tp.v1.credential`, `tp.v1.session`, `tp.v1.draft`; nenhum campo de segredo de cliente; nenhum token dentro do rascunho.
3. **Session Storage** → `tp.v1.pkce` existe só entre o clique em conectar e o retorno; some depois.
4. Nenhuma credencial visível em texto claro enquanto o botão de revelar não é acionado.
5. `grep -ri "client_secret\|clientSecret" src/` não devolve nada.

---

## Referências

- Requisitos e critérios: [spec.md](./spec.md)
- Decisões técnicas: [research.md](./research.md)
- Entidades e estados: [data-model.md](./data-model.md)
- Contratos: [spotify-api.md](./contracts/spotify-api.md) · [storage.md](./contracts/storage.md) · [domain-api.md](./contracts/domain-api.md)
