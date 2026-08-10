import { render } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';

import { Icon } from '@/ui/Icon';
import { ICONS, type IconRole } from '@/ui/icons';

/**
 * A cor do glifo vem de quem o usa (007/SC-017).
 *
 * ## O defeito que este arquivo existe para não deixar voltar
 *
 * `Icon` passava `color="currentColor"` ao componente de `react-icons`. A
 * biblioteca **não** repassa `color` como atributo: ela o emite como
 * `style="color: …"` no `<svg>`. Estilo em linha vence classe utilitária, e
 * `currentColor` na própria propriedade `color` significa "o valor herdado" —
 * de modo que todo glifo pintava com a cor do **pai** e qualquer `text-*`
 * passado por `className` era descartado sem erro nenhum.
 *
 * O custo foi medido na tela: os três lugares em que o arquivo de design tinge o
 * glifo do provedor — chip de conexão (`gVoPE`), distintivo do cartão de destino
 * (`WDCUM`) e marcador da fila (`Lsvko`) — pediam `text-brand-spotify` e
 * `text-brand-youtube` desde a 007 e renderizavam em `--ink`. Classe escrita,
 * CSS emitido, e nada na tela.
 *
 * É o modo de falha que a constituição manda transformar em teste: **não falha
 * em lugar nenhum**. Nem o TypeScript, nem o `lint`, nem o build reclamam de uma
 * classe de cor que o estilo em linha anula.
 */
describe('SC-017 · o glifo não fixa a própria cor', () => {
  const papeisDeGlifo = (Object.keys(ICONS) as IconRole[]).filter(
    (papel) => ICONS[papel].kind === 'component',
  );

  it('nenhum papel do mapa emite cor própria — nem por atributo, nem em linha', () => {
    expect(papeisDeGlifo.length).toBeGreaterThan(0);

    for (const papel of papeisDeGlifo) {
      const { container, unmount } = render(createElement(Icon, { role: papel }));
      const svg = container.querySelector('svg');

      expect(svg, `o papel "${papel}" não renderizou um glifo`).not.toBeNull();
      expect(svg?.getAttribute('color'), papel).toBeNull();
      expect(svg?.style.color, papel).toBe('');

      unmount();
    }
  });

  it('a classe do chamador chega ao glifo e é o que decide a cor', () => {
    /*
      A asserção positiva: a cor **precisa** ter um caminho até o `<svg>`. Um
      componente que simplesmente descartasse `className` passaria no caso
      acima — a ausência de cor própria é necessária, não suficiente.

      `fill="currentColor"` é o outro elo: sem ele o glifo pintaria de preto
      independentemente da classe.
    */
    const { container } = render(
      createElement(Icon, { role: 'provider-spotify', className: 'text-brand-spotify' }),
    );
    const svg = container.querySelector('svg');

    expect(svg?.classList.contains('text-brand-spotify')).toBe(true);
    expect(svg?.getAttribute('fill')).toBe('currentColor');
  });
});
