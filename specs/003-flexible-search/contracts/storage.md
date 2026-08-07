# Contrato — Armazenamento, esquema v3

**Feature**: `003-flexible-search` · **Fase**: 1

Complementa `specs/002-multi-service-playlists/contracts/storage.md`. Só o delta v2 → v3.

---

## 1. Chaves — inalteradas

Nenhuma chave nova, nenhuma chave renomeada. O prefixo `tp.v2.` **permanece**: ele identifica o namespace de isolamento por provedor introduzido na 002, não a versão do conteúdo. A versão do conteúdo é o campo `schemaVersion` dentro do rascunho.

| Chave                       | Área             | Muda em v3? |
| --------------------------- | ---------------- | ----------- |
| `tp.v2.credential.{provider}` | `localStorage`   | não         |
| `tp.v2.session.{provider}`    | `localStorage`   | não         |
| `tp.v2.authreq.{provider}`    | `sessionStorage` | não         |
| `tp.v2.quota.{provider}`      | `localStorage`   | não         |
| `tp.v2.draft`                 | `localStorage`   | **conteúdo** |

**Consequência deliberada**: o Registro de Consumo Diário não é tocado pela migração. O saldo de cota do dia continua valendo, o que é o comportamento correto — o consumo já aconteceu, independentemente da versão do rascunho.

---

## 2. `schemaVersion: 2 → 3`

Só o rascunho carrega `schemaVersion`. Credencial, sessão e cota são estruturas planas e estáveis desde a v2.

---

## 3. Migração v2 → v3

Executada por `migrateToV3()` em `src/services/storage/migrations.ts`, no mesmo ponto de bootstrap onde `migrateToV2()` já roda. As duas coexistem: um rascunho v1 passa por v1→v2→v3 em sequência.

### Transformações

| Alvo                     | Regra                                                                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `lines[].shape`          | `parseStatus === 'parsed'` → `'explicit'`; `'unparsed'` → reanalisar `raw` com o parser novo e adotar o `shape` resultante.          |
| `lines[].parseStatus`    | Recalculado por L2. **Linhas antes inválidas por falta de separador voltam válidas** — ganho de produto, não efeito colateral.       |
| `lines[].title/artist`   | Preservados quando `shape === 'explicit'`. Recalculados pelo parser quando a linha era `unparsed`.                                  |
| `queue.runs[].items[].attentionReason` | Derivado do `status` gravado (tabela §6 do data-model). Nunca inventado.                                              |
| `queue.runs[].retriesUsed` | `0`.                                                                                                                              |
| `queue.runs[].estimate.retryReserve` | Recalculado das linhas por `retryReserveFor`. O5 garante idempotência.                                                  |
| `schemaVersion`          | `3`.                                                                                                                              |

### O que a migração **não** faz

- **Não** reexecuta busca. Candidatas e escolhas gravadas são preservadas como estão: uma linha que já tinha faixa escolhida continua com ela, mesmo que a reanálise mude seu `shape`.
- **Não** descarta o rascunho por conteúdo inesperado em campo novo — campo ausente vira o padrão da tabela acima.
- **Não** altera o desfecho de execução já concluída. `002/SC-018` continua valendo: o relato de um serviço que terminou é imutável.

### Falha da migração

Regra herdada e inalterada: **nunca lança**. Rascunho ilegível, `schemaVersion` desconhecida ou forma inesperada → descarte com aviso, nunca leitura às cegas. `saveDraft` falhando devolve `migrated: false` sem apagar o original.

---

## 4. Invariantes

| Id  | Invariante                                                                                     |
| --- | ------------------------------------------------------------------------------------------------ |
| W1  | (herdada) rascunho nunca contém token nem Client ID                                              |
| W2  | (herdada) rascunho apagado só após sucesso ou descarte explícito — encerramento por cota preserva |
| W3  | nenhum campo novo desta feature carrega credencial                                               |
| W4  | migração v2→v3 é **idempotente**: aplicá-la a um rascunho v3 é no-op                            |
| W5  | migração nunca aumenta o número de linhas inválidas — só pode reduzi-lo                          |

W5 é a formulação testável de "a migração é um ganho": se um rascunho v2 tinha 12 linhas inválidas por falta de separador, o v3 tem no máximo as que não têm conteúdo alfanumérico.

---

## 5. Verificação

`tests/unit/storage-migration.spec.ts`, estendida:

- rascunho v2 com linhas `unparsed` por falta de separador → v3 com as mesmas linhas válidas e `shape: 'free'` (W5);
- rascunho v2 com execução concluída → desfecho byte a byte idêntico após migração (`002/SC-018`);
- migração aplicada duas vezes → resultado idêntico (W4);
- rascunho v1 → v2 → v3 em cadeia, sem perda;
- rascunho corrompido → descarte com aviso, sem exceção.
