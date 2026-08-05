/**
 * Junta classes já completas. Não constrói nomes: cada fragmento recebido é uma
 * string literal inteira, escrita no código-fonte, que o scanner do Tailwind
 * consegue enxergar (research §14).
 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter((part): part is string => typeof part === 'string' && part !== '').join(' ');
}
