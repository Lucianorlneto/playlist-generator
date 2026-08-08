/**
 * O numeral da goteira — a assinatura do desenho, como função pura.
 *
 * O número que aparece ao lado de uma faixa **é o número da linha que a pessoa
 * colou**. Ele nasce na tela de entrada e sobrevive a tudo: à busca, à
 * correspondência incerta, à edição manual, à deduplicação, à falha parcial, à
 * reconexão depois de a sessão expirar e à retomada em lote. A linha 7 continua
 * sendo a linha 7 na tela de falhas, no resumo e no relatório do que não entrou
 * (design.md §5).
 *
 * Isso é o que justifica a numeração existir. A `frontend-design` alerta que
 * marcadores numerados costumam ser decoração, válidos só quando a ordem carrega
 * informação de que o leitor precisa. Aqui carrega: é a chave primária do
 * domínio exposta na interface, e ela responde a pergunta mais difícil que o
 * produto tem — *"quais das minhas 60 linhas não entraram, e por quê?"*.
 *
 * Vive no domínio, e não num componente, exatamente porque **três telas
 * diferentes precisam produzir o mesmo numeral para a mesma linha**. Duas cópias
 * da regra de formatação seriam duas chances de a revisão dizer `07` e o resumo
 * dizer `7`.
 */

/** Largura mínima do numeral. Duas casas é o que a grade densa comporta. */
const MIN_WIDTH = 2;

/**
 * Converte o índice de entrada (base 0) no numeral exibido (base 1), preenchido
 * à esquerda para que os algarismos alinhem em coluna.
 *
 * O preenchimento com zero é o que faz `08` e `11` ocuparem a mesma largura sem
 * depender de a fonte carregar — `data-numeral` cuida do resto com
 * `tabular-nums`, verificado em T004.
 */
export function lineNumeral(index: number, total = 0): string {
  const shown = index + 1;
  const width = Math.max(MIN_WIDTH, String(Math.max(total, shown)).length);
  return String(shown).padStart(width, '0');
}
