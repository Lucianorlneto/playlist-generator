/**
 * Aplica o tema antes da primeira pintura (FR-010).
 *
 * Roda como script **clássico e bloqueante**, de mesma origem, referenciado no
 * `<head>` antes do bundle. O padrão de mercado para isto é um `<script>` inline,
 * e ele não funciona aqui: o build injeta `script-src 'self'` e bloqueia inline
 * (research §2). Afrouxar o CSP por estética seria a troca errada — o Princípio
 * II não é negociável.
 *
 * **Este arquivo cobre apenas a divergência.** Quem nunca escolheu tema já é
 * atendido pelo `@media (prefers-color-scheme: dark)` de `tokens.css`, sem script
 * nenhum. O caso que só o script resolve é a preferência manual que contradiz o
 * sistema — "Claro" gravado, sistema em escuro.
 *
 * ⚠ **Duplicação conhecida e contida.** Este arquivo vive fora de `src/`, logo
 * fora do TypeScript, do ESLint e do alias `@`, e não pode importar
 * `STORAGE_KEYS`. A chave e o formato do registro estão duplicados de propósito.
 * `tests/unit/theme-boot-sync.spec.ts` compara este texto com
 * `STORAGE_KEYS.theme` e falha se divergirem — sem esse teste, a primeira
 * renomeação de chave produziria uma piscada que nenhuma suíte pegaria e que só
 * apareceria em produção, na segunda visita de alguém com preferência manual.
 */
(function () {
  try {
    var raw = window.localStorage.getItem('tp.v2.theme');
    if (raw === null) return;

    var record = JSON.parse(raw);
    if (record === null || typeof record !== 'object') return;
    if (record.schemaVersion !== 2) return;

    var preference = record.preference;
    var root = document.documentElement;

    if (preference === 'light' || preference === 'dark') {
      root.setAttribute('data-theme', preference);
      return;
    }

    if (preference === 'system') {
      // Sem atributo, o `@media` de `tokens.css` decide. Remover em vez de não
      // fazer nada mantém o script correto mesmo se o atributo tiver sido
      // escrito no HTML servido.
      root.removeAttribute('data-theme');
    }
  } catch (error) {
    // Armazenamento bloqueado, JSON corrompido ou forma inesperada: o CSS
    // assume e o tema segue o sistema. Falhar em silêncio aqui é o
    // comportamento correto (FR-011) — e é o que limita o dano se este arquivo
    // não carregar.
  }
})();
