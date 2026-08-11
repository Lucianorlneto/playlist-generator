// import { useEffect } from 'react'; // ← parte do semeador abaixo; descomente junto.

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

  /*
    ⚠️ SEMEADOR DE CONFERÊNCIA MANUAL — desligado de propósito.

    Guardado comentado para a próxima vez que uma tela precisar ser vista com
    estado montado à mão (a da criação em curso foi a primeira, na 009/quickstart
    §3). Para usar: descomente o bloco e a importação de `useEffect` no topo, e
    ajuste `src/dev/mockCreating.ts` para o estado que se quer alcançar.

    Fica **depois** de `useBootstrap` de propósito: os efeitos rodam na ordem em
    que são declarados, e `restoreDraft` acontece lá dentro. Semear antes seria
    semear para ser sobrescrito pelo rascunho gravado.

    A importação é dinâmica e está atrás do guarda de desenvolvimento: em
    produção `import.meta.env.DEV` é `false`, o efeito retorna na primeira linha
    e o módulo nunca é buscado — nada de `src/dev/` entra no bundle.

    useEffect(() => {
      if (!import.meta.env.DEV) return;
      void import('@/dev/mockCreating').then(({ semearCriacaoEmCurso }) => {
        semearCriacaoEmCurso();
      });
    }, []);
  */

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
