import { t } from '@/i18n/pt-BR';

import { useBootstrap } from './bootstrap';
import { Wizard } from './Wizard';

export function App() {
  useBootstrap();

  return (
    <>
      <a
        href="#conteudo"
        className="focus-ring bg-surface sr-only rounded-lg px-3 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        {t.app.skipToContent}
      </a>
      <Wizard />
    </>
  );
}
