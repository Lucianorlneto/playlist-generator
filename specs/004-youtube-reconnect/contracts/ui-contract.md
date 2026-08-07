# Contrato — Modal de Reconexão e Cabeçalho de Contas

**Feature**: `specs/004-youtube-reconnect` · **Fase 1**

---

## §1. `Dialog` — primitivo sobre `<dialog>` nativo

`src/ui/Dialog.tsx`. Sem biblioteca: o elemento nativo já entrega contenção de foco, `Esc`, camada de topo e semântica de modal para leitor de tela ([research §8](../research.md)).

```ts
interface DialogProps {
  open: boolean;
  onClose: () => void;
  labelledBy: string;      // id do título — o diálogo é sempre rotulado
  children: React.ReactNode;
}
```

| # | Obrigação |
| --- | --- |
| U1 | `open` verdadeiro ⟹ `showModal()`; falso ⟹ `close()`. Nunca `show()` não-modal |
| U2 | O evento `close` nativo (inclusive por `Esc`) chama `onClose` **uma vez** |
| U3 | Foco vai para o primeiro elemento focável ao abrir |
| U4 | Foco volta ao elemento que tinha o foco antes de abrir, ao fechar |
| U5 | `aria-labelledby={labelledBy}`; sem título não há diálogo |
| U6 | Nenhum `z-index` — a camada de topo do navegador resolve |
| U7 | Todo texto vem de `src/i18n/` (regra `tp/no-ui-text-literals`) |

**Limite de verificação**: happy-dom expõe `showModal()` mas não emula a contenção real de foco. U1, U2, U3, U4 são testáveis em componente; **a contenção (U-trap) só é verificável em Playwright**, e é lá que ela é provada. Afirmá-la a partir de happy-dom seria invariante falsamente verificado, o que o Princípio IV proíbe.

---

## §2. `ReauthDialog`

`src/features/connect/ReauthDialog.tsx`. Aberto por **estado derivado** — a execução corrente está em `awaiting_reauth` e o usuário não dispensou nesta visita.

### Conteúdo

| Elemento | Regra |
| --- | --- |
| Título | serviço afetado, nomeado (FR-009) |
| Corpo | trabalho preservado + de onde retoma (FR-009). Reúsa `t.connect.reconnectNeeded` e `t.connect.resumeAt`, já existentes e hoje nunca renderizados |
| Progresso — busca | linhas já resolvidas de quantas |
| Progresso — criação | faixas já adicionadas de quantas (FR-028), de `committedItemCount` |
| Custo — só com cota | custo da retomada, de `remainingLineIds` (FR-013, [provider-contract §5](./provider-contract.md)) |
| Ação primária | **Reconectar** (FR-010) |
| Ação secundária | **Fechar sem reconectar** (FR-010) |

| # | Obrigação |
| --- | --- |
| R1 | Reconectar reúsa o caminho de `ConnectButton`: grava rascunho e navega só ao provedor afetado (FR-024) |
| R2 | Fechar **não** encerra a execução nem descarta nada; a etapa continua exibindo o pedido com ação de reconectar e a opção de pular (FR-012) |
| R3 | "Dispensado" é estado local do componente, **nunca persistido**: recarregar reapresenta o pedido (US4 cenário 3) |
| R4 | Sem sessão válida, nenhuma retomada automática dispara (FR-016) |
| R5 | Credencial ausente ⟹ o diálogo diz que o Client ID precisa ser cadastrado e oferece o caminho, sem descartar o trabalho (FR-016a) |
| R6 | Provedor sem orçamento diário não exibe linha de custo (C4) |

---

## §3. Etapa do serviço em `awaiting_reauth`

`ServiceStep` ganha um ramo para a fase nova.

| # | Obrigação |
| --- | --- |
| T1 | Exibe pedido de reautorização, ação de reconectar e **Pular este serviço** (FR-012, US4 cenário 2) |
| T2 | O ramo **atribui `startedFor.current`**, como todos os outros. Sem isso, a chave permanece `provider:search` e a volta a `search` não reinicia a busca — FR-014 quebraria em silêncio ([research §4](../research.md)). Coberto por V19, que retoma **sem recarregar** |
| T3 | Ao voltar para `search`, busca **apenas** `remainingLineIds(run)` (FR-013b) |
| T4 | Ao voltar para `creating`, chama `retryRemaining()` — que já existe e já não duplica (FR-029) |
| T5 | A fase de estimativa **não** é reexibida na retomada: o custo já foi dito no diálogo, sobre o que falta ([research §4](../research.md)) |

---

## §4. `SessionHeader`

De "sessões ativas" para "destinos com credencial".

**Antes**: `PROVIDER_ORDER.filter((p) => sessions[p] !== null)` — o desconectado desaparece com seu único ponto de interação.

**Depois**: provedores em `destinations.selected` **com credencial salva**, na ordem de `PROVIDER_ORDER`.

| # | Obrigação |
| --- | --- |
| H1 | Conectado: nome da conta + **Reconectar** + **Desconectar** (FR-020 a FR-022) |
| H2 | Desconectado: identificado como tal + **Reconectar** (FR-020, FR-021) |
| H3 | Sem credencial salva: **não listado** (FR-023) |
| H4 | Fora dos destinos selecionados: não listado — o Princípio II proíbe requisição a provedor não selecionado ([research §9](../research.md)) |
| H5 | Desconectar mantém o serviço listado com ação de reconectar (FR-025, SC-004) |
| H6 | Rótulos inequívocos entre reconectar e desconectar (FR-022) |
| H7 | Nenhuma ação daqui escreve na conta do usuário (FR-026) |
| H8 | Reconectar de um serviço não toca sessão nem credencial do outro (FR-004, FR-005) |

Antes da etapa de destinos, `selected` está vazio e o cabeçalho não lista nada — correto: ainda não há trabalho a preservar.

---

## §5. Acessibilidade

| # | Obrigação | Onde é provado |
| --- | --- | --- |
| A1 | Fluxo completo operável só por teclado (SC-006) | e2e |
| A2 | Foco visível em todos os controles novos | e2e + a11y |
| A3 | Diálogo anunciado como conteúdo que exige atenção (FR-011) | componente (papel/rótulo) |
| A4 | Zero violação séria ou crítica no axe-core com o diálogo aberto (SC-006) | a11y |
| A5 | Sem rolagem horizontal em tela estreita | e2e |
