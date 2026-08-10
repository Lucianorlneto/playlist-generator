# Fase 1 — Modelo de dados

**Feature**: 009 · Estado de carregamento da criação de playlist

Esta feature **não introduz nenhuma entidade persistida, nenhuma chave de armazenamento e
nenhum campo novo no estado da execução**. `ServiceRun`, `CreationProgress`,
`ProviderCapabilities` e o esquema de `localStorage` ficam exatamente como estão — é o que
o FR-026 exige e o que o SC-008 verifica.

O que existe de modelo aqui é **derivação**: três funções que transformam estado já
existente no que a tela mostra. Todas puras, todas testáveis sem DOM.

---

## 1. O estado de exibição do cartão em carregamento

Não é um objeto novo no store. É uma projeção de quatro coisas que o store já tem.

| Entrada | Origem | Papel |
| --- | --- | --- |
| `run.phase` | `queue.runs[provider].phase` | `creating` é o que autoriza o cartão |
| `run.creation` | idem, `CreationProgress \| null` | de onde sai o progresso confirmado |
| `run.error`, `run.outcome` | idem | qualquer um não nulo **derruba** o carregamento (FR-024) |
| `creating`, `creationError` | `playlistConfigSlice` | escrita em voo e falha da escrita |

### Regra de exibição

```text
mostraCarregamento =
     run.phase === 'creating'
  && run.outcome === null
  && run.error === null
  && creationError === null
```

As quatro condições são conjuntas de propósito. `run.phase === 'creating'` sozinho não
basta: a fase permanece `creating` enquanto o erro de escrita está na tela com as saídas,
e um disco girando atrás de uma mensagem de erro é exatamente o que o FR-024 proíbe.

A perda de sessão não precisa de cláusula própria: ela leva a execução para
`awaiting_reauth`, que é outra fase, e `ServiceStep` já troca a tela inteira.

**Sem tempo mínimo.** A condição é lida a cada render e nada a segura. Uma lista de uma
linha que resolve em 300ms mostra o carregamento por 300ms e some — o Edge Case da spec
proíbe explicitamente o piso artificial.

---

## 2. O texto do rodapé

Função pura de duas entradas, sem relógio e sem provedor:

```text
rodape(creation, nomeDoServico) =
  creation === null || committedItemCount(creation) === 0
    ? aguardandoConfirmacao(nomeDoServico)
    : progresso(committedItemCount(creation), creation.orderedUris.length)
```

`committedItemCount` já existe em `src/domain/batching.ts` e já é a fonte de verdade de
quantos itens estão confirmados — a mesma que a retomada usa para não duplicar. Nenhum
contador novo é introduzido.

### A transição, e por que é uma só

| Momento | Rodapé | Anúncio |
| --- | --- | --- |
| `creation === null` (playlist ainda não criada) | aguardando | na montagem |
| `committedItems === 0` | aguardando | nenhum — o texto não mudou |
| primeiro lote confirmado | `n de N itens` | **um** |
| lotes seguintes | `n de N itens` | um por lote |

O primeiro anúncio de progresso é a única troca de forma; depois disso é o mesmo texto
com outro número, que é o que a tela já fazia antes desta feature.

**Na retomada** (FR-025) `creation` chega do rascunho com `committedItems > 0`, então o
rodapé nasce mostrando progresso. Ele não volta para "aguardando" — a confirmação já
aconteceu, e dizer o contrário seria mentir sobre trabalho que existe na conta do usuário.

---

## 3. Os segundos que faltam na espera

```text
segundosRestantes(resumesAt, agora) = max(0, ceil((resumesAt - agora) / 1000))
```

Vive em `src/domain/retry/countdown.ts`. `agora` é **parâmetro**, nunca `Date.now()` lido
dentro da função: o Princípio III proíbe relógio ambiente no domínio, e um contador que lê
o relógio por dentro é intestável sem congelar o tempo do processo.

`WaitState` já existe em `src/services/rate-limiter.ts` e já carrega `resumesAt`. Nada é
acrescentado a ele.

---

## 4. Fronteiras que esta feature **não** atravessa

Registrado porque é o que o SC-008 e o Princípio V verificam, e porque a lista é curta o
bastante para ser conferida no diff:

- **Nenhum evento novo no redutor de execução.** `src/domain/run/machine.ts` não é tocado.
  `review_confirmed` continua sendo o único caminho para `creating`.
- **Nenhuma mudança em `creationRunner.ts`.** Lotes, ordem, índice de confirmação,
  tratamento de cota, tratamento de 429 e tratamento de perda de sessão ficam byte a byte
  como estão. O que muda é quem lê `committedItemCount`, não quem o incrementa.
- **Nenhum campo em `ProviderCapabilities`.** A diferença entre os serviços nesta tela é
  nome e identidade visual, e as duas já estão resolvidas.
- **Nenhuma chave de `localStorage`, nenhuma migração.** `tests/unit/storage-migration.spec.ts`
  não muda.
- **Nenhum destino de rede.** O movimento é código local; nenhum recurso é carregado de
  origem remota (FR-027, SC-009).

---

## 5. Estados visuais, para a conferência de forma

A tabela existe para o checklist de fidelidade e para o teste de componente saberem o que
esperar em cada combinação.

| Fase / condição | Disco | Esqueleto | Rodapé | Aviso de espera |
| --- | --- | --- | --- | --- |
| `creating`, sem lote confirmado | gira | pulsa | aguardando | ausente |
| `creating`, com lotes confirmados | gira | pulsa | progresso | ausente |
| `creating`, em espera por 429 | gira | pulsa | inalterado | presente, sem ícone, com contagem |
| `creating` + `creationError` | **ausente** | **ausente** | ausente | ausente |
| `creating` + `run.error` | **ausente** | **ausente** | ausente | ausente |
| `awaiting_reauth` | **ausente** | **ausente** | ausente | ausente |
| resultado recebido | ausente | fusão cruzada → informações reais | ausente | ausente |
| cota esgotada | ausente | fusão cruzada → resultado parcial | ausente | ausente |
| movimento reduzido, em qualquer linha acima | **estático** | **estático** | igual | igual, sem transição |

A última linha é o SC-003: a coluna do rodapé e a do aviso são idênticas com e sem a
preferência, porque nenhuma informação dependia do movimento.
