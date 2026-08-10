# Contrato — Delta do inventário de textos

Definição normativa de FR-021, e do que o FR-005 e o FR-006 produzem no artefato versionado
que a 008 criou.

O esquema, o teste e as regras não mudam: valem
[`008/contracts/text-inventory.md`](../../008-design-fidelity-pass/contracts/text-inventory.md)
na íntegra. Este documento descreve **apenas o delta**.

Artefatos tocados:

- `tests/fixtures/design-inventory.json`
- `tests/fixtures/design-inventory-exclusions.json`
- `tests/fixtures/i18n-pt-BR.snapshot.json`

---

## 1. Uma reversão

O inventário carrega hoje este item:

```jsonc
{
  "tela": "Importador · Serviço · Spotify (Carregando)",
  "no": "yjjDB/FeEHR",
  "design": "Isso pode levar alguns segundos.",
  "desfecho": "mantido-diferente",
  "motivo": "… A aplicação exibe **progresso real** no lugar delas: '{current} de {total} itens' … Substituir informação por tranquilização genérica seria uma regressão."
}
```

**A premissa desse motivo deixa de valer nesta feature.** Ele afirma que as frases de
espera substituiriam o progresso real; elas não substituem nada — o progresso continua na
tela, agora no rodapé (FR-012), e as frases entram **além** dele.

O item passa a `adotado`, apontando para a chave nova do subtítulo.

Deixar o motivo antigo no arquivo seria pior do que removê-lo: um motivo escrito é lido
como verdade, e este passaria a documentar uma decisão que a própria feature reverteu.

---

## 2. Três entradas novas, e a divergência que permanece

| Nó | Texto do arquivo | Desfecho | Chave |
| --- | --- | --- | --- |
| `yjjDB/FeEHR` | `Isso pode levar alguns segundos.` | **adotado** | subtítulo do indicador |
| `yjjDB/G37LNR` | `Estamos enviando sua lista para o Spotify. Isso pode levar alguns segundos — não feche esta janela.` | **mantido-diferente** | — |
| `yjjDB/mJCdf` | `Aguardando confirmação do Spotify…` | **adotado** | rodapé, forma "aguardando" |

O item de `gT44B` — "Criando playlist no Spotify…" — já está no inventário como `adotado`
apontando para `playlistConfig.creating`, e **não é tocado**.

### 2.1 A única divergência da feature

`G37LNR` é `mantido-diferente`, e o motivo é o FR-006, escrito por extenso no item:

> O arquivo repete "Isso pode levar alguns segundos" no subtítulo (`FeEHR`) e de novo
> aqui. Lidas em sequência por um leitor de tela, as duas viram a mesma frase dita duas
> vezes. O subtítulo é mantido verbatim — é ele que fica colado no disco, o lugar natural
> da expectativa de duração — e a descrição preserva "Estamos enviando sua lista para o
> {serviço}" e "não feche esta janela", sem a oração repetida.

É a mesma classe de decisão que o inventário já registra para os erros de concordância do
mockup: adotar o vocabulário sem adotar o defeito.

### 2.2 Amostras

As três entradas usam `{"service": "Spotify"}` como amostra, porque é o serviço que o
arquivo desenha. O teste renderiza o template com a amostra e compara caractere a
caractere — é o que verifica o texto **e** a interpolação de uma vez.

---

## 3. As chaves novas

Três chaves, todas no ramo `result.`, que é onde o cartão de fase já vive:

| Chave | Valor | Papel |
| --- | --- | --- |
| `result.creatingSubtitle` | `Isso pode levar alguns segundos.` | subtítulo da linha do indicador (FR-005) |
| `result.creatingDescription` | `Estamos enviando sua lista para o {service} — não feche esta janela.` | descrição (FR-006) |
| `result.awaitingConfirmation` | `Aguardando confirmação do {service}…` | rodapé antes do primeiro lote (FR-011) |

O valor exato de `result.creatingDescription` é decisão da implementação dentro do que o
FR-006 fixa: preserva "Estamos enviando sua lista para o {serviço}" e "não feche esta
janela", e **não** repete a expectativa de duração. O que o inventário registra é a
divergência e o motivo, não uma segunda cópia da frase.

`result.creationProgress` já existe e **não muda de valor** — muda apenas quando aparece
(FR-012).

---

## 4. A correção de cobertura, que é o ponto delicado

`design-inventory-exclusions.json` exclui hoje o ramo `result.` inteiro, por prefixo, com
este motivo:

> Resultado por serviço. A tela `C13Hj` está inventariada campo a campo; o restante é o
> caminho de criação interrompida e retomada — parcial, itens restantes, linhas que
> falharam —, que o arquivo não desenha.

**As três chaves novas são desenhadas pelo arquivo**, então o motivo passa a ser falso
para elas. O prefixo continua existindo — o ramo tem chaves que o arquivo de fato não
desenha —, mas o motivo é reescrito para dizer que a tela `SjphR` está inventariada nó a
nó, além da `C13Hj`.

Isso importa mais do que parece. O prefixo cobriria as chaves novas em silêncio, e o
portão que a 008 construiu — "toda chave está coberta por inventário ou por exclusão
escrita" — passaria sem nunca comparar as frases novas com o arquivo. Seria a mesma falha
que a 008 existiu para corrigir, reintroduzida pela porta dos fundos.

A regra 7 do contrato da 008 não é violada: ela proíbe exclusão por prefixo em ramos que o
design desenha, e a resolução aqui é justamente **inventariar individualmente** as chaves
desenhadas, mantendo o prefixo para o que sobra.

---

## 5. O instantâneo de i18n

`tests/fixtures/i18n-pt-BR.snapshot.json` é rebaselinado com `ATUALIZAR_I18N=1`, pelo
motivo de sempre: três chaves entram e nenhum valor existente muda.

Os dois testes continuam com papéis opostos — `i18n-stability` garante que nada muda **por
acidente**, `design-text-fidelity` garante que o que foi adotado **coincide com o
arquivo**.

---

## 6. Portões

| Verificação | Onde | Requisito |
| --- | --- | --- |
| As três chaves novas resolvem e coincidem com o arquivo | `tests/unit/design-text-fidelity.spec.ts` | FR-021 |
| A divergência de `G37LNR` traz motivo escrito | idem | FR-006, FR-021 |
| Nenhuma chave nova fica coberta só pelo prefixo `result.` | idem, cobertura inversa | FR-021 |
| Nenhum texto visível fora de `src/i18n/` | `npm run lint` | Constituição, idioma |
| Nenhum valor existente muda por acidente | `tests/unit/i18n-stability.spec.ts` | — |
