import { t } from '@/i18n/pt-BR';

import { useBootstrap } from './bootstrap';
import { Wizard } from './Wizard';

/**
 * A raiz da aplicação.
 *
 * O link de pular vem **antes** de tudo e aponta para `#conteudo`, que é o
 * `<main>` da área principal do `Shell`. A feature 007 trocou o que existe entre
 * os dois — passaram a ser duas zonas, barra superior e trilha, em vez de um
 * cabeçalho — e é exatamente por isso que o link importa mais agora do que
 * antes: há mais controles a pular (FR-040).
 */
export function App() {
  useBootstrap();

  return (
    <>
      <a
        href="#conteudo"
        className="focus-ring bg-surface sr-only rounded-card px-3 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        {t.app.skipToContent}
      </a>
      <Wizard />
    </>
  );
}
