import moodPhoto from '@/assets/imgs/loja-de-discos-1637873416794_1920x1279 (1).jpg';
import { t } from '@/i18n/pt-BR';
import { Stickers } from '@/ui/Stickers';

/**
 * O painel lateral de apoio da etapa de Destinos (FR-020, FR-034, FR-049).
 *
 * **Não rouba a largura de leitura** da coluna primária: ele ocupa
 * `--side-panel-width` ao lado dela, e em largura estreita desce para baixo, pelo
 * `flex-wrap` do `Shell`. É a forma executável de FR-020.
 *
 * ## O que ele carrega, e o que não carrega
 *
 * A fotografia e os adesivos são **decoração** — `aria-hidden`, `alt` vazio,
 * carregados de forma diferida. Nenhuma informação vive aqui que não esteja na
 * coluna primária, e com imagens desabilitadas a etapa continua completa
 * (SC-014). O texto de apoio existe porque é conteúdo, não legenda da foto.
 *
 * A sobreposição em degradê é **declarada por tema** (FR-049): a que o design
 * mostra caminha para o quase-preto e escureceria demais sobre papel. As duas
 * versões vivem em `mood-photo-veil`, em `src/styles/index.css`.
 */
export function MoodPanel() {
  return (
    <div className="border-rule bg-surface-zone rounded-panel relative overflow-hidden border">
      {/*
        `aspect-video` reserva a caixa **antes** de a imagem chegar: nada se
        desloca quando ela carrega (FR-070, SC-020), e sem imagem o painel não
        colapsa num buraco.
      */}
      <div className="mood-photo aspect-video w-full">
        <img
          src={moodPhoto}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />
        <span aria-hidden="true" className="mood-photo-veil" />
      </div>

      <div className="relative flex flex-col gap-2 p-4">
        <Stickers />
        <p className="text-ink text-section">{t.destinations.groupLabel}</p>
        <p className="text-ink-muted text-meta">{t.destinations.intro}</p>
      </div>
    </div>
  );
}
