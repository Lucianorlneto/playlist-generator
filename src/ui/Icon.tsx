import { ICONS, type IconRole } from './icons';
import { cx } from './cx';

/**
 * O envoltório único de consumo de ícone (FR-051, FR-058, FR-060, SC-017).
 *
 * Existe para que as três decisões que um ícone carrega — cor, tamanho e
 * semântica — sejam tomadas **uma vez**, aqui, em vez de trinta vezes espalhadas
 * pelas superfícies:
 *
 * 1. **Cor vem do contexto.** `currentColor`, sempre. Um ícone que fixa a
 *    própria cor sobrevive à troca de tema com a cor errada, e a falha é
 *    invisível em revisão de código — só aparece na tela de alguém.
 * 2. **Tamanho acompanha o tipo do contexto.** `1em`, nunca uma medida avulsa.
 *    O ícone ao lado de um rótulo `text-meta` encolhe junto com ele; o de um
 *    título `text-step` cresce junto. É o que impede a escala finita de
 *    tipografia de ser contornada por uma escala paralela de ícones.
 * 3. **Semântica pelo papel na frase, não pelo desenho.** Ver abaixo.
 *
 * ## `label` é o que decide a semântica
 *
 * Um ícone que acompanha texto é **decoração**: repeti-lo no leitor de tela
 * produz "seta para a direita Avançar", que é ruído. Um ícone que é o único
 * conteúdo de um controle é a **única** pista disponível, e precisa de nome.
 *
 * A escolha não é adivinhada: quem usa declara. Sem `label`, o ícone é
 * `aria-hidden`; com `label`, ganha `role="img"` e nome acessível. O padrão é o
 * caso mais comum e o mais seguro — errar para `aria-hidden` cala um ícone
 * redundante, errar para o contrário faz o leitor ler o desenho duas vezes.
 *
 * **Isto não dispensa FR-042**: ícone nunca é o único portador de um estado. O
 * selo "confiante" tem `gem` **e** rótulo **e** fundo tingido **e** contorno. O
 * `label` daqui resolve o nome acessível de um controle, não a comunicação de
 * estado.
 *
 * ## A marca não passa por nenhuma das três regras
 *
 * `brand` é arte, não componente: não herda `currentColor`, e por ter sido
 * composta contra o quase-preto exige tratamento declarado por tema
 * (`contracts/decor.md` §2). O tratamento vive na classe que o chamador passa;
 * o que este componente garante é que a marca nunca seja tingida por engano.
 */

export interface IconProps {
  /** Papel do vocabulário da aplicação — nunca um componente de biblioteca. */
  readonly role: IconRole;
  /**
   * Nome acessível. Presente **apenas** quando o ícone é o único conteúdo de um
   * controle; ausente quando acompanha rótulo textual (FR-058).
   */
  readonly label?: string;
  readonly className?: string;
}

/**
 * `icon-glyph` carrega as três medidas que amarram o glifo ao texto em volta —
 * tamanho em `1em`, proteção contra esmagamento em flex e alinhamento óptico à
 * linha de base. Estão declaradas em `src/styles/index.css`, e não aqui, porque
 * são relações e não degraus de escala: não há token para elas, e escrevê-las
 * como valor em colchete é o que `tp/no-raw-visual-values` recusa.
 */
const BASE = 'icon-glyph';

export function Icon({ role, label, className }: IconProps) {
  const entry = ICONS[role];
  const decorative = label === undefined;

  if (entry.kind === 'art') {
    return (
      <img
        src={entry.src}
        className={cx(BASE, className)}
        // Arte: sem `currentColor`, sem recoloração por token. O `alt` vazio é o
        // equivalente de `aria-hidden` para imagem, e o preenchido dá o nome.
        alt={decorative ? '' : label}
        {...(decorative ? { 'aria-hidden': true } : {})}
        decoding="async"
      />
    );
  }

  const Glyph = entry.component;
  return (
    <Glyph
      className={cx(BASE, className)}
      // `currentColor` é o padrão de `react-icons`, mas declarar é o que torna a
      // regra verificável em vez de herdada por sorte da biblioteca (SC-017).
      color="currentColor"
      {...(decorative
        ? { 'aria-hidden': true, focusable: false }
        : { role: 'img', 'aria-label': label })}
    />
  );
}
