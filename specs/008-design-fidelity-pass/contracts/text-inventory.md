# Contrato — Inventário de textos e verificação executável

Definição normativa de FR-030, FR-030a, FR-030b e SC-001. É a resposta à pergunta que
motivou esta feature: *como a fidelidade dos textos é verificada, já que a conferência
manual da 007 foi o que deixou passar estas divergências?*

Artefato: `tests/fixtures/design-inventory.json` · Portão:
`tests/unit/design-text-fidelity.spec.ts`

---

## 1. Por que um artefato versionado, e não uma lista de conferência

Divergência de texto **não falha em lugar nenhum**. Uma frase trocada passa por
`tp/no-ui-text-literals`, por `typecheck`, por todos os testes de comportamento e por
todos os testes de acessibilidade. O único mecanismo que a pegava era alguém pôr as duas
telas lado a lado — e foi exatamente esse mecanismo que falhou.

O inventário transforma "conferimos uma vez" em "a máquina confere a cada `npm test`".
Ele é dado, não documentação: existe para ser lido por um teste.

---

## 2. Esquema

Um array JSON. Cada item descreve **um** texto do arquivo de design.

```jsonc
{
  "tela": "Importador · Destinos",   // nome do frame no arquivo
  "no": "uy2ns",                     // id do nó — rastreabilidade
  "design": "· vamos levar suas músicas pra casa",
  "desfecho": "adotado",             // "adotado" | "mantido-diferente"
  "chave": "header.destinationsComplement",
  "amostra": { "name": "Luciano" },  // opcional — valores de interpolação
  "plural": 2,                       // opcional — escolhe a forma One/Other
  "motivo": "…"                      // obrigatório em "mantido-diferente"
}
```

| Campo | Obrigatório | Papel |
| --- | --- | --- |
| `tela` | sempre | Agrupa o inventário por tela (FR-030a) |
| `no` | sempre | Aponta para o nó do arquivo; permite reconferir a origem |
| `design` | sempre | O texto **exatamente** como o arquivo o contém |
| `desfecho` | sempre | `adotado` ou `mantido-diferente` |
| `chave` | se `adotado` | Caminho pontilhado em `t`, ex.: `rail.neutral.credential`. Índice de array por `[n]` |
| `amostra` | quando o template interpola | Valores para `format` |
| `plural` | quando a chave é par `One`/`Other` | Quantidade que escolhe a forma |
| `motivo` | se `mantido-diferente` | **Escrito**, não um marcador |

### 2.1 O arquivo companheiro de exclusões

O inventário responde "este texto do design está na aplicação?". Sozinho, ele é
**unidirecional**: um texto que existe só no dicionário e diverge do design não tem item, e
por isso nunca falha. A cobertura inversa vem de um segundo artefato:

`tests/fixtures/design-inventory-exclusions.json` — array de entradas que declaram o que
está **fora** do alcance do arquivo de design:

```jsonc
{
  "chave": "errors.",                // chave exata, ou prefixo terminado em ponto
  "motivo": "Estados de erro de rede e de autorização; o arquivo de design não desenha nenhum deles. Permanecem por FR-008."
}
```

| Campo | Papel |
| --- | --- |
| `chave` | Caminho pontilhado exato, **ou** prefixo terminado em ponto, que cobre um ramo inteiro |
| `motivo` | Por que o ramo está fora do design. **Escrito**, e é o que a revisão lê |

**Por que prefixo é aceito.** O dicionário tem 459 chaves; exigir enumeração exata
produziria cerca de 380 linhas mecânicas, e um artefato que ninguém relê deixa de ser
revisão. O prefixo mantém a propriedade que importa — nenhuma chave escapa sem estar
coberta por um item de inventário ou por uma exclusão que alguém escreveu — e faz o custo
cair para uma linha por ramo. O que o prefixo **não** pode fazer é cobrir um ramo que o
design desenha: `rail.`, `steps.`, `destinations.`, `queue.`, `connectionChip.`, `app.` e o
ramo da linha de contexto ficam de fora da exclusão por prefixo, e cada chave deles é
classificada individualmente.

---

## 3. O que o teste faz

Para cada item:

1. **`mantido-diferente`** — exige `motivo` não vazio. Nada mais é verificado: o item
   existe para constar, e a decisão já foi tomada por escrito.
2. **`adotado`** — resolve `chave` em `t`. Chave inexistente é **falha**, com o caminho
   nomeado.
3. Aplica `format(valor, amostra)` — e `plural(n, one, other)` antes, quando `plural`
   está presente.
4. Compara o resultado com `design`, **caractere a caractere**. Qualquer diferença é
   falha, com as duas strings no relatório.

E, sobre o inventário como um todo:

5. Todo item tem `chave` **ou** `motivo`. Um item sem nenhum dos dois é falha — é assim
   que o inventário deixa de poder virar uma lista de itens silenciosamente ignorados.

E, na direção inversa (SC-001):

6. **Toda chave de `t`** está coberta por um item `adotado` do inventário, por um item
   `mantido-diferente`, ou por uma entrada de `design-inventory-exclusions.json`. Chave
   descoberta é **falha**, com o caminho nomeado. É o que faz um texto novo — ou renomeado —
   parar a suíte até alguém decidir se ele corresponde a algo no design.
7. Nenhuma exclusão por prefixo alcança um ramo que o design desenha. Uma entrada com
   `chave: "rail."` é falha por si só, independentemente do motivo: aquele ramo é
   classificado chave a chave.

### Por que comparar o texto renderizado, e não o template

O arquivo contém "Conectado como Luciano Rodrigues"; o dicionário contém um template com
`{name}`. Comparar os dois diretamente é impossível. Renderizar o template com a amostra
que o próprio arquivo usa verifica **duas** coisas de uma vez: o texto e a interpolação —
um `{name}` esquecido no meio da frase falha aqui, e não falharia em nenhum outro lugar.

---

## 4. Cobertura exigida

As quatorze telas do arquivo, não apenas as citadas no pedido (FR-030):

| Tela | Nó |
| --- | --- |
| Importador · Configuração | `Sim0L` |
| Importador · Destinos | `uy2ns` |
| Importador · Entrada | `okw1h` |
| Importador · Serviço | `dIPW6` |
| Importador · Serviço · Reconectar | `DP6mq` |
| Importador · Serviço · Orçamento | `TSwx6` |
| Importador · Serviço · YouTube | `ND2Zm` |
| Importador · Serviço · Spotify (Carregando) | `SjphR` |
| Importador · Serviço · Spotify Concluído | `C13Hj` |
| Importador · Serviço · YouTube Concluído | `zCaeY` |
| Importador · Resumo | `w1fTC` |
| Components / Playlist Importer | `G2IsFJ` |
| Components / Serviço | `eckoA` |
| Components / Configuração | `wwUgy` |

**Texto que se repete entre telas** — a assinatura da marca, os rótulos da trilha, os
nomes de conta — entra **uma vez**, na tela em que foi conferido. Repetir o mesmo item
catorze vezes tornaria o inventário ilegível sem verificar nada a mais.

**Nomes próprios de exemplo** ("Luciano Rodrigues", "teste 12", "Bohemian Rhapsody —
Queen") não são texto de interface: são dados de amostra do mockup. Entram como `amostra`
de um item, nunca como item próprio.

---

## 5. Divergências já conhecidas, e o desfecho de cada uma

Levantadas na leitura do arquivo durante a Fase 0. Não são a lista completa — o
levantamento tela a tela é trabalho da implementação —, mas fixam o padrão de decisão:

| Design | Aplicação hoje | Desfecho |
| --- | --- | --- |
| "Texto → Spotify · YouTube" | "Transforme uma lista de músicas em playlists nos serviços que você escolher." | **adotado** — `app.subtitle` (FR-026) |
| "Playlist Importer" | "Importador de Playlist por Texto" | **mantido diferente** — a constituição exige interface em pt-BR, e trocar o nome do produto é decisão de produto, não de fidelidade visual (decisão registrada na spec) |
| "Oi, {nome}" | "Olá, {nome completo}" | **adotado**, com o primeiro nome (FR-010) |
| "Suas credenciais" | "Informe o Client ID de cada serviço" | **adotado** — `rail.neutral.credential` |
| "Preferências salvas" | "Credenciais salvas neste dispositivo" | **adotado** — `rail.derived.credential` |
| "Cole a lista de músicas" | "Cole a sua lista de músicas" | **adotado** — `rail.neutral.input` |
| "Criação e resultado" | "Acompanhe a criação em cada serviço" | **adotado** — `rail.neutral.service` |
| "O que aconteceu em cada serviço" | "Veja o resultado de cada destino" | **adotado** — `rail.neutral.summary` |
| "Spotify e YouTube" sob Destinos, na tela de Configuração | linha neutra | **mantido diferente** — FR-029: a regra vence o mockup, a trilha não afirma escolha não feita |
| "Nenhuma das 1 linhas deve precisar de segunda tentativa." | "Nenhuma das {total} linhas deve precisar de segunda busca." | a decidir no levantamento: "tentativa" é adotável; a concordância de "das 1 linhas" é defeito do mockup e **não** é adotada |

O último item é o padrão para um caso que vai se repetir: **o mockup contém erros de
concordância porque foi escrito com dados de exemplo fixos**. Adotar o vocabulário sem
adotar o erro é a leitura correta de "fidelidade ao design", e cada caso desses vira um
item `mantido-diferente` com o motivo escrito.

---

## 6. Relação com `i18n-stability.spec.ts`

As duas verificações convivem e têm papéis opostos:

| Teste | Garante | Falha quando |
| --- | --- | --- |
| `i18n-stability.spec.ts` | Nenhum texto muda **por acidente** | Um valor existente muda sem o instantâneo ser regravado |
| `design-text-fidelity.spec.ts` | Todo texto adotado **coincide com o design** | O dicionário diverge do arquivo, ou uma chave some |

O instantâneo é rebaselinado nesta feature (`ATUALIZAR_I18N=1`) e o docblock do teste é
reescrito: ele afirma hoje que "esta feature troca a aparência inteira e **nenhuma
palavra**", o que era verdade na 007 e é falso agora. Deixar o comentário como está seria
pior que removê-lo, porque comentário é lido como verdade.

---

## 7. Portões

| Verificação | Onde | Requisito |
| --- | --- | --- |
| Todo item `adotado` resolve para chave existente | `tests/unit/design-text-fidelity.spec.ts` | FR-030b |
| Todo item `adotado` renderiza exatamente o texto do design | idem | FR-030b, SC-001 |
| Todo item tem `chave` ou `motivo` | idem | FR-030a |
| As quatorze telas estão representadas no inventário | idem | FR-030, SC-001 |
| Toda chave de `t` está coberta por inventário ou por exclusão escrita | idem | SC-001 |
| Nenhuma exclusão por prefixo alcança ramo que o design desenha | idem | SC-001 |
| Nenhum texto visível fora de `src/i18n/` | `npm run lint` | FR-031 |
| Nenhum texto muda por acidente | `tests/unit/i18n-stability.spec.ts` | — |
| Fidelidade de **forma**, tela a tela | `checklists/design-fidelity.md` | SC-011 |
