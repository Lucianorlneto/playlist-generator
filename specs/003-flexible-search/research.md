# Research — Busca Sem Separador e por Título Isolado

**Feature**: `003-flexible-search` · **Data**: 2026-08-06 · **Fase**: 0

Decisões técnicas que precedem o desenho. Cada uma registra o que foi escolhido, por quê, e o que foi recusado. Referências a `research §N` no código e nos demais artefatos apontam para as seções deste documento.

---

## §1 — O separador é um portão de admissão, não um mecanismo de busca

**Decisão**: remover o portão. `parseLine` deixa de devolver `parseStatus: 'unparsed'` por ausência de separador e passa a classificar a linha em uma **forma declarada**: `explicit` (houve corte por separador com os dois lados não vazios) ou `free` (todo o resto). `unparsed` permanece, mas com um único gatilho: nenhum caractere alfanumérico após normalização.

**Rationale**: a verificação em `src/domain/parser/index.ts:68` devolve `unparsed` quando não há separador, e `searchRunner.searchOne` (`src/services/providers/searchRunner.ts:79`) retorna imediatamente para linhas `unparsed`, sem emitir requisição. Os dois exemplos do pedido falham aí — **antes** de qualquer rede. Nenhum dos dois catálogos rejeita a consulta; o app é que nunca a faz. Remover o portão é, literalmente, apagar uma condição de saída antecipada.

**Alternativas consideradas**:

- _Manter `unparsed` e buscar mesmo assim_: preservaria a compatibilidade do tipo, mas `unparsed` significaria duas coisas incompatíveis ("não sei ler" e "li como texto livre"), e todo consumidor precisaria de um segundo campo para desambiguar. Descartada por criar exatamente a ramificação que o tipo existe para evitar.
- _Heurística de corte sem separador_ (tentar adivinhar onde termina o título): erraria sistematicamente em `Charlie Brown Jr`, `CPM 22`, `Nossa Senhora Aparecida`. Descartada em favor de §3, que não precisa adivinhar.

---

## §2 — Pontuação renormalizada pelo que a linha declarou

**Decisão**: a pontuação passa a ser calculada sobre os campos **declarados**. Linha `explicit` mantém exatamente a fórmula de hoje (`0,6·título + 0,4·artista`). Linha `free` usa a comparação combinada de §3. Uma linha sem artista comparável nunca é penalizada estruturalmente pela ausência.

**Rationale**: hoje `bestArtistSimilarity('', [...])` devolve 0 e a pontuação máxima possível de uma linha sem artista é `0,6 + 0,05` (bônus de _featured_) `= 0,65` — abaixo dos dois limiares de Confiante (0,82 e 0,88). O teto não é uma medida de qualidade da correspondência; é um artefato de dividir por um campo que a linha não tem. Renormalizar é a correção.

**Consequência que exige contrapeso**: com a renormalização, um título isolado com correspondência exata pontua 1,0 e passaria o limiar — inclusive quando existem cinco gravações do mesmo título por artistas diferentes, todas em 1,0. A pontuação sozinha deixa de discriminar. É §5 que resolve.

---

## §3 — Comparação combinada por cobertura assimétrica

**Decisão**: para a linha `free`, comparar o conjunto de termos da linha contra **título e artistas da candidata tomados juntos**, por duas coberturas assimétricas combinadas em média harmônica:

```text
coberturaDaLinha  = |L ∩ (T ∪ A)| / |L|      quanto da linha a candidata explica
coberturaDoTítulo = |T ∩ L|       / |T|      quanto do título a linha reivindica
pontuação         = 2·cL·cT / (cL + cT)      média harmônica (zero se qualquer uma for zero)
```

`L` são os termos da linha, `T` os do título da candidata, `A` os dos artistas. A interseção usa **igualdade tolerante**: dois termos casam quando `levenshteinRatio ≥ 0,85`, preservando a tolerância a erro de digitação que a medida atual tem e a comparação por conjunto perderia.

**Rationale**: é a formulação que satisfaz literalmente FR-013 — "termos do artista presentes contam a favor; sua ausência não conta contra". Verificado contra os dois exemplos do pedido:

| Linha                               | cL      | cT      | Pontuação | Leitura                                            |
| ----------------------------------- | ------- | ------- | --------- | -------------------------------------------------- |
| `nao sei viver sem ter voce cpm 22` | 8/8 = 1 | 6/6 = 1 | **1,00**  | linha inteira explicada, título inteiro reivindicado |
| `Não sei viver sem ter voce`        | 6/6 = 1 | 6/6 = 1 | **1,00**  | idem; os termos do artista simplesmente não existem  |
| `amor` vs `Amor Perfeito`           | 1/1 = 1 | 1/2 = 0,5 | **0,67** | a linha não reivindica metade do título              |
| `cpm 22` (só o artista)             | 2/2 = 1 | 0/6 = 0 | **0,00**  | nada do título reivindicado — corretamente descartada |

A última linha é o caso de borda "linha que é só o nome do artista" da spec: a média harmônica zera quando qualquer cobertura zera, sem precisar de regra especial.

**Alternativas consideradas**:

- _Jaccard simétrico_ (a medida atual): `nao sei viver sem ter voce` contra o par título+artista daria `6/8 = 0,75` — a linha seria **punida** por não conter o artista, que é exatamente o que FR-013 proíbe. Descartada.
- _Só cobertura da linha_: `amor` casaria 1,0 com qualquer candidata que contenha "amor". Descartada por não discriminar título genérico.
- _Média aritmética das duas coberturas_: `cpm 22` daria 0,5 em vez de 0. A harmônica pune desequilíbrio, que é o comportamento desejado aqui.

---

## §4 — "Artista reivindicado" decide se a margem se aplica

**Decisão**: para a linha `free`, o sistema determina **por candidata** se os termos do artista foram reivindicados pela linha:

```text
artistaReivindicado = |A ∩ L| / |A| ≥ 0,6
```

Quando a melhor candidata tem o artista reivindicado, a linha é tratada como se tivesse declarado artista — a regra de margem de §5 **não** se aplica. Quando não, a linha é tratada como título isolado e a margem se aplica.

**Rationale**: é o que distingue os dois exemplos do pedido sem separador algum, e é a peça que faz a promessa da tabela de viabilidade da spec se cumprir na prática. `nao sei viver sem ter voce cpm 22` confirma `CPM 22` na candidata e ganha o mesmo tratamento de uma linha explícita; `Não sei viver sem ter voce` não confirma nada e entra na regra de margem. A decisão é **derivada dos dados**, não declarada pelo usuário — que é a única forma possível, já que sem separador não há como saber de antemão se o artista está na linha.

O limiar 0,6 tolera artista parcialmente escrito (`charlie brown` para `Charlie Brown Jr` = 2/3 = 0,67 ✓) sem aceitar coincidência de uma palavra em nome longo.

**Alternativa considerada**: exigir reivindicação total (`= 1`). Recusaria `zoio de lula charlie brown` por faltar o `Jr`, jogando em escolha manual um caso que a pontuação resolve com folga.

---

## §5 — Regra de margem para linha sem artista confirmado

**Decisão**: linha sem artista declarado (`free` sem reivindicação, ou `explicit` com artista vazio) só é `confident` quando **as duas** condições valem:

```text
melhor.pontuação ≥ limiar.confident      (do provedor, como hoje)
melhor.pontuação − segunda.pontuação ≥ margemSolo
```

`margemSolo` entra em `ProviderCapabilities.thresholds` como valor calibrado por provedor. **Sementes de calibração**: Spotify `0,10`, YouTube `0,12`. Havendo **uma única** candidata, não há segunda contra a qual medir: a linha é `uncertain` (FR-014b).

**Rationale**: quando existem cinco gravações do mesmo título, todas pontuam quase igual — a margem é ~0 e a escolha vai para o humano. Quando o título é distintivo, as candidatas 2ª a 5ª são outras músicas, a margem é larga, e a linha passa sozinha. A margem mede exatamente a propriedade que interessa ("esta candidata se destaca?"), que a pontuação absoluta não mede.

**Sobre os valores**: eram sementes. `SC-004` (zero seleções automáticas erradas) é o teto e `SC-010` (≥ 60% de resolução automática) é o piso; a calibração aconteceu contra a lista de referência estendida (§13).

### Calibração executada — 2026-08-06

Medição contra `tests/fixtures/reference-titles-30.json` (20 títulos distintivos, 10 genéricos), via de pontuação da forma livre, limiares do catálogo musical:

| `soloMargin` | Automáticas corretas | Automáticas **erradas** | Para escolha manual |
| --- | --- | --- | --- |
| 0,02 | 20 (67%) | **0** | 10 |
| 0,05 | 20 (67%) | **0** | 10 |
| **0,10** (adotado) | **20 (67%)** | **0** | **10** |
| 0,12 | 20 (67%) | **0** | 10 |
| 0,20 | 20 (67%) | **0** | 10 |
| 0,30 | 20 (67%) | **0** | 10 |

**Decisão: as sementes ficam** — Spotify `0,10`, YouTube `0,12`. SC-004 e SC-010 fecham juntos com folga (67% contra o piso de 60%, zero erros contra o teto de zero), e a opção B do D1 da spec **não** foi necessária. `classifyLine` mantém a regra de margem.

**Limite honesto desta medição, registrado por escrito**: o resultado é insensível ao valor da margem em toda a faixa varrida, e isso não é sorte — é a forma da fixture. Os títulos genéricos produzem candidatas com pontuação **idêntica** (margem exatamente 0), então qualquer margem positiva as separa; os distintivos têm como concorrentes outras faixas do mesmo artista, que pontuam ~0 pela cobertura combinada, então a margem é ~1. A distribuição é bimodal e não contém os casos intermediários que decidiriam entre 0,05 e 0,20.

O que a medição **sustenta**: a regra de margem funciona, o valor adotado satisfaz os dois critérios, e nenhum valor razoável na faixa produz seleção automática errada. O que ela **não** sustenta: que 0,10 seja ótimo. Um catálogo real trará casos intermediários, e o valor deve ser reavaliado contra dados de uso antes de ser tratado como definitivo. A escolha de manter a semente é deliberada: sem evidência que discrimine, mover o número seria trocar um palpite por outro.

**Assimetria esperada e honesta**: no catálogo de vídeo, títulos isolados produzem candidatas cujos títulos são quase idênticos entre si (clipe, áudio, ao vivo, cover), então a margem raramente abrirá e quase tudo irá para escolha manual. Isso é o comportamento correto sob o Princípio V e sob a seção "Assimetria entre provedores" da constituição — mas significa que **SC-010 só é atingível no catálogo musical**. Ver a divergência D1 registrada no plano.

**Alternativa considerada**: margem relativa (`melhor / segunda ≥ 1,15`) em vez de absoluta. Descartada porque a razão fica instável na faixa alta — 0,98/0,86 dá 1,14 e 0,50/0,44 também dá 1,14, mas o segundo par é ruído. A diferença absoluta trata as duas situações como o que são.

---

## §6 — A retentativa só existe quando a consulta é de fato outra

**Decisão**: a nova tentativa de FR-009 só é emitida quando a consulta alternativa, **após normalização**, difere da primeira. Consulta idêntica não é retentativa — é a mesma requisição pela segunda vez, e não pode custar cota.

**Rationale — e esta é a descoberta que muda o custo da decisão Q2**: no catálogo de vídeo a consulta primária de uma linha `explicit` já é `"{título} {artista}"`, texto livre. A consulta de retentativa é a linha inteira. Normalizadas, quase sempre são a **mesma string**:

| Linha                                | Consulta primária (norm.)      | Retentativa (norm.)              | Difere? |
| ------------------------------------ | ------------------------------ | -------------------------------- | ------- |
| `Zoio de Lula - Charlie Brown Jr`    | `zoio de lula charlie brown jr` | `zoio de lula charlie brown jr`  | não     |
| `Song (Official Video) - Artist`     | `song artist`                  | `song artist`                    | não     |
| `Song feat. X - Artist A & B`        | `song artist a`                | `song feat x artist a b`         | **sim** |
| Linha `free` (qualquer)              | a linha inteira                | a linha inteira                  | não     |

No Spotify a primária é uma consulta **por campos** (`track:"…" artist:"…"`), estruturalmente diferente do texto livre — sempre elegível. E o Spotify não tem orçamento diário.

**Consequência**: a decisão Q2 ("retentativa nos dois serviços") é implementada uniformemente — a regra é a mesma nos dois — e custa quase nada no serviço que tem cota, porque lá a retentativa raramente é uma consulta diferente. Não é uma reinterpretação da decisão: é a decisão aplicada com uma condição que a torna barata.

**Corolário**: o problema de falso corte (`Marília Mendonça - Ao Vivo`) **não** é resolvido por segunda consulta no catálogo de vídeo, porque a segunda consulta seria igual à primeira. Ele é resolvido em §7, sem gastar unidade alguma.

---

## §7 — Falso corte é resolvido na pontuação, não na consulta

**Decisão**: quando a linha é `explicit` e a melhor pontuação pela via de campos declarados fica **abaixo do piso** (`uncertain`, 0,55), a mesma candidata é reavaliada pela comparação combinada de §3 sobre a linha inteira, e prevalece a **maior** das duas pontuações.

**Rationale**: `Marília Mendonça - Ao Vivo` é cortada em título `Marília Mendonça` e artista `Ao Vivo`. Pela via declarada, a candidata correta pontua mal — o "título" comparado é o nome da artista. Pela comparação combinada sobre a linha inteira, todos os termos encontram destino em título+artista da candidata e a pontuação sobe. O reparo é **puro, determinístico e de custo zero em rede** — é aritmética sobre candidatas que já estão na mão.

Isso torna o falso corte um problema de pontuação, que é onde ele sempre esteve: a consulta emitida para essa linha no Spotify (`track:"Marília Mendonça" artist:"Ao Vivo"`) falha e cai no texto livre já existente, que devolve as candidatas certas — o que faltava era reconhecê-las.

**Alternativa considerada**: aplicar a comparação combinada a **todas** as linhas `explicit`, sempre, tomando o máximo. Descartada por SC-011: mudaria a pontuação de linhas hoje corretamente classificadas, e a exigência é zero mudanças de classe no formato explícito. Restringir o reparo à faixa abaixo do piso garante que só linhas hoje **perdidas** possam mudar de classe — e para melhor.

---

## §8 — Reserva exata de retentativa, com teto de execução

**Decisão**: a estimativa de cota conta o custo de retentativa das linhas **elegíveis** segundo §6 — uma contagem exata, calculada antes da busca, e não uma fração arbitrária. A execução respeita essa contagem como **teto**: esgotada, nenhuma retentativa é feita, e as linhas afetadas chegam à revisão com o motivo de atenção `retry_skipped_quota`.

```text
custoNominal = 100·N + 100·R + ceil(5·N/50) + 1 + 50 + 50·S
                      ↑ novo: R = linhas elegíveis a retentativa (§6)
```

**Rationale**: FR-010 pede uma "fração limitada" das linhas. Uma fração é um chute que precisa de calibração e ainda assim erra nos dois sentidos. A contagem exata é melhor em todos os aspectos: é conhecida no momento da estimativa (a elegibilidade depende só do texto da linha, já analisado), nunca subestima, e não desperdiça orçamento com linhas que comprovadamente não vão retentar. Combinada com o teto de execução, torna `SC-007` verdadeiro **por construção** em vez de provável por margem.

**Descoberta associada — buraco pré-existente**: o comentário em `src/domain/quota/index.ts:62` declara que o fallback de busca **não** entra na estimativa, "porque embuti-lo no pior caso derrubaria o teto prático de ~60 para ~39 linhas". A consequência é que o fallback que já existe hoje em `searchVideo` pode estourar a estimativa: para N=50, a margem de 10% cobre 756 unidades, ou **7,5 buscas extras**; a partir da oitava linha em fallback, o consumo real ultrapassa o que foi prometido ao usuário. Esta feature fecha esse buraco de passagem — não o abre.

**Impacto no teto prático** (orçamento cheio, `S = N`):

| Cenário                                        | Teto de linhas |
| ---------------------------------------------- | -------------- |
| Hoje (fallback fora da conta)                   | 60             |
| Reserva para **todas** as linhas (o que FR-010 proíbe) | 36        |
| **Adotado**: reserva exata, `R ≈ 0` no vídeo    | **60**         |

O teto não se move no caso típico, porque no catálogo de vídeo quase nenhuma linha é elegível (§6). Uma lista atipicamente cheia de linhas com `feat.` reduz o teto proporcionalmente, e o usuário vê isso na estimativa antes de começar — que é o comportamento correto.

**Alternativa considerada**: fração fixa de 20%, conforme a leitura literal de FR-010. Custaria ~7 linhas de teto prático (60 → 53) em troca de uma reserva que na maioria das listas ficaria integralmente sem uso. Descartada; exige ajuste de redação na spec (divergência D2 do plano).

---

## §9 — Chave de duplicata unificada

**Decisão**: a chave de duplicata de entrada passa a ser `normalizeText(textoPesquisável)`, onde o texto pesquisável é `"{título} {artista}"` para linha `explicit` e a linha inteira para `free`. O par `título|artista` deixa de ser a chave.

**Rationale**: `Zoio de Lula - Charlie Brown Jr` e `zoio de lula charlie brown jr` produzem hoje chaves diferentes (`zoio de lula|charlie brown jr` contra `zoio de lula charlie brown jr|`) e escapariam da detecção de entrada. Com a chave unificada, ambas viram `zoio de lula charlie brown jr`. A deduplicação por `uri` escolhida permanece intocada e continua sendo a segunda rede.

**Limite aceito e registrado**: `Song (feat. X) - Artist` produz `song artist` (o _featured_ é extraído do título), enquanto a forma livre `song feat x artist` produz outra chave. As duas só se encontram na deduplicação por resultado, depois da escolha. Uniformizar exigiria descartar informação que a forma explícita fornece de propósito; não vale o preço.

---

## §10 — Motivo de atenção como dado, não como texto

**Decisão**: `MatchItem` ganha `attentionReason`, um dos quatro valores exigidos por FR-017: `no_artist_ambiguous`, `version_hint`, `not_found`, `retry_skipped_quota`. O campo é calculado no domínio; a interface só o traduz por `src/i18n/pt-BR.ts`.

**Rationale**: é a forma que respeita a regra de lint `tp/no-ui-text-literals` e o Princípio III — o domínio decide o **motivo**, a apresentação decide a **frase**. Também é o que torna FR-017 testável sem renderizar componente: o motivo é uma asserção sobre um valor.

`retry_skipped_quota` precisa existir separado de `not_found` porque a ação do usuário é diferente: no primeiro caso a linha pode estar certa e o app é que desistiu; no segundo, o texto provavelmente precisa de correção. Apresentar um como o outro faria o usuário reescrever uma linha correta.

---

## §11 — Esquema v3 e migração

**Decisão**: `SCHEMA_VERSION` passa de 2 para 3. A migração v2→v3 reprocessa `WorkDraft.lines`: linha com `parseStatus: 'parsed'` recebe `shape: 'explicit'`; linha com `parseStatus: 'unparsed'` é **reanalisada** sob as novas regras e normalmente vira `shape: 'free'`, deixando de ser inválida. `attentionReason` ausente é derivado do `status` já gravado.

**Rationale**: `InputLine` e `MatchItem` mudam de forma e vivem dentro do rascunho persistido. O Princípio II da seção Armazenamento proíbe ler dado em formato antigo como se fosse novo. A migração é também um ganho de produto: um rascunho salvo antes desta feature volta com as linhas que estavam condenadas agora buscáveis.

**Alternativa considerada**: descartar o rascunho v2. Mais simples, mas apagaria trabalho do usuário sem ação explícita de descarte — vedado pelo Princípio V.

---

## §12 — Zero dependências novas

**Decisão**: nenhuma dependência é adicionada. Cobertura de conjuntos, média harmônica e igualdade tolerante são aritmética sobre a `levenshteinRatio` e a `tokenize` que já existem.

**Rationale**: a posição padrão do projeto ("o ônus da prova é de quem quer adicionar"). Bibliotecas de correspondência aproximada — Fuse.js, fast-fuzzy — trariam um motor de pontuação inteiro para substituir ~60 linhas de domínio puro, com o efeito colateral de tornar a calibração de §5 dependente de uma implementação opaca de terceiros. O que o projeto precisa medir é específico demais para ganhar de uma biblioteca genérica.

---

## §13 — Lista de referência estendida

**Decisão**: `tests/fixtures/` ganha as mesmas faixas escritas nas três formas, com a resposta esperada por forma. As fixtures existentes de `scoring-reference` e `scoring-youtube-reference` permanecem intocadas e passam a ser a prova de não regressão de SC-005 e SC-011.

**Rationale**: sete dos onze critérios de sucesso (SC-002 a SC-006, SC-010, SC-011) são medidas comparativas entre formas de escrita. Sem o mesmo conjunto de faixas nas três formas, não há o que comparar. Escrever a fixture é pré-requisito da calibração de §5, não consequência dela.

---

## §14 — Mapa de verificação executável

Princípio IV exige verificação para cada regra. O mapa abaixo é o contrato com `/speckit-tasks`.

| Regra                                      | Verificação                                                        |
| ------------------------------------------ | ------------------------------------------------------------------ |
| §1 formas declaradas, invalidez            | `tests/unit/parser.spec.ts` (estendido)                             |
| §2 renormalização                          | `tests/unit/scoring.spec.ts` (estendido)                            |
| §3 cobertura combinada                     | `tests/unit/scoring-combined.spec.ts` (novo)                        |
| §4 artista reivindicado                    | `tests/unit/scoring-combined.spec.ts` (novo)                        |
| §5 margem, candidata única                 | `tests/unit/scoring-margin.spec.ts` (novo)                          |
| §5 calibração (SC-004, SC-010)             | `tests/unit/scoring-reference.spec.ts` (fixtures das três formas)    |
| §6 elegibilidade de retentativa            | `tests/unit/retry-eligibility.spec.ts` (novo)                       |
| §7 reparo de falso corte                   | `tests/unit/scoring-combined.spec.ts` + `scoring-reference`          |
| §8 reserva e teto (SC-007)                 | `tests/unit/quota.spec.ts` (estendido) + `tests/integration/youtube-retry-budget.spec.ts` (novo) |
| §9 chave unificada                         | `tests/unit/dedupe.spec.ts` (estendido)                             |
| §10 motivo de atenção                      | `tests/unit/attention-reason.spec.ts` (novo) + `tests/a11y/`         |
| §11 migração v2→v3                         | `tests/unit/storage-migration.spec.ts` (estendido)                  |
| SC-005 / SC-011 não regressão              | `scoring-reference.spec.ts`, `scoring-youtube-reference.spec.ts` inalteradas |
| SC-009 vazão                               | `tests/unit/throughput.spec.ts` (inalterada)                        |
| Nenhum host novo                           | `tests/unit/no-secrets.spec.ts` (inalterada — deve continuar passando) |
| Fluxo ponta a ponta sem separador          | `e2e/flexible-search.spec.ts` (novo)                                |
