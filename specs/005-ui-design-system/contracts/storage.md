# Contrato — Armazenamento da Preferência de Tema

**Feature**: 005-ui-design-system

Estende `specs/002-multi-service-playlists/contracts/storage.md` com uma única chave nova. Nada
do que já existe muda de formato ou de versão.

---

## 1. A chave

| Propriedade | Valor |
| --- | --- |
| Chave | `tp.v2.theme` |
| Área | `localStorage` |
| Versão | `RECORD_SCHEMA_VERSION = 2` (a mesma dos registros planos) |
| Escopo | Global — **não** é função de `ProviderId` |

Acrescentada a `STORAGE_KEYS` em `src/services/storage/schema.ts` como valor literal, ao lado de
`draft`, e não como função — a preferência de tema não pertence a provedor nenhum.

---

## 2. Formato

```json
{
  "schemaVersion": 2,
  "preference": "dark"
}
```

| Campo | Tipo | Regra |
| --- | --- | --- |
| `schemaVersion` | número | Sempre `2`. Divergência ⇒ descarte silencioso |
| `preference` | string | `'light'` \| `'dark'` \| `'system'`. Fora do conjunto ⇒ descarte |

O registro **não contém** token, credencial, identificador de usuário ou qualquer dado pessoal
(FR-012). Contém uma palavra de um conjunto de três.

`'system'` é gravado explicitamente, não representado por ausência da chave — ver data-model.md §1.

---

## 3. Comportamento em falha

Herdado de `readVersioned`, sem código novo de tratamento:

| Situação | Resultado |
| --- | --- |
| Chave ausente | `'system'` |
| Armazenamento indisponível (modo privado restritivo) | `'system'`, aviso emitido |
| JSON corrompido | Descarte + `'system'`, aviso emitido |
| Forma inválida ou `preference` desconhecida | Descarte + `'system'`, aviso emitido |
| `schemaVersion` divergente | Descarte + `'system'`, aviso emitido |
| Gravação falha por cota | Troca vale na sessão atual; **nada é dito ao usuário** |

**Regra específica desta chave** (FR-011): os avisos de armazenamento emitidos por
`emitStorageWarning` chegam à interface para outras chaves. Para `tp.v2.theme` eles **não podem**
produzir mensagem visível — o consumidor de avisos precisa filtrar esta chave. Falhar em gravar
uma preferência de cor não é assunto do usuário.

---

## 4. Isolamento

FR-013 é satisfeito por construção, não por disciplina:

- As chaves de credencial, sessão, autorização em voo e cota são **funções** de `ProviderId`.
  `tp.v2.theme` é literal. Nenhum caminho que remove dados de um provedor pode alcançá-la.
- Remover a preferência de tema não toca credencial, sessão nem rascunho.
- Desconectar de um serviço, expirar sessão ou descartar rascunho não altera o tema.

---

## 5. A duplicação, e como ela é contida

`public/theme-boot.js` precisa ler esta chave **antes** de qualquer módulo carregar, para aplicar
o tema no primeiro quadro (FR-010) sob `script-src 'self'` (research §2). Ele vive fora de `src/`
e portanto não pode importar `STORAGE_KEYS` — a string e o formato ficam duplicados.

Isso é dívida conhecida, não descuido, e a contenção é obrigatória:

**Teste `tests/unit/theme-boot-sync.spec.ts`** lê o texto de `public/theme-boot.js` e falha se:

1. não contiver literalmente a chave exportada por `STORAGE_KEYS.theme`;
2. não referenciar o campo `preference`;
3. não tratar os três valores válidos.

Sem esse teste, a primeira renomeação de chave produziria uma piscada de tema que nenhuma suíte
pegaria e que só apareceria em produção, na segunda visita de um usuário com preferência manual.

---

## 6. Migração

Nenhuma. A chave é nova; ausência é o estado inicial legítimo e já significa `'system'`. Não há
formato anterior a converter nem chave legada a limpar.
