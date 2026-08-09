/**
 * O mapa único de papel → ícone (FR-055, FR-056, FR-059, FR-063, FR-064).
 *
 * **Este é o único arquivo do projeto que importa de `react-icons`.** Uma
 * superfície pede `advance`; nunca importa `LuArrowRight`. A regra é imposta por
 * `tp/no-icon-library-import` em `eslint-rules/index.js` e verificada de novo pela
 * denylist de `tests/unit/no-orphan-tokens.spec.ts` — duas vezes, porque o custo
 * de perder a fechadura é uma varredura por todo o `src/` no dia em que um ícone
 * precisar mudar.
 *
 * ## Por que uma dependência, se o projeto escreve SVG à mão
 *
 * Porque foi decisão explícita de padronização do autor, registrada no
 * **Complexity Tracking** do plano. Transcrever os dezesseis SVGs à mão era mais
 * simples e tecnicamente viável; o que se ganha em troca é rastreabilidade: o
 * nome do ícone no arquivo de design mapeia para um componente nomeado, e não
 * para um caminho SVG anônimo que ninguém consegue conferir contra o desenho.
 *
 * ## Importação por subcaminho
 *
 * `react-icons/lu` e `react-icons/pi`, nunca `react-icons`. O índice raiz puxa a
 * árvore inteira — dezenas de milhares de componentes — **sem emitir aviso
 * nenhum**, e o custo só apareceria na medição de pacote do SC-018 (FR-056).
 *
 * ## A marca é a exceção declarada
 *
 * `brand` é o único papel que resolve para **arte**, não para componente. O
 * símbolo não existe em biblioteca alguma, e por ser arte composta contra o
 * quase-preto ele não herda `currentColor` e exige tratamento próprio por tema
 * (FR-049, FR-060; `contracts/decor.md` §2).
 */

import type { IconType } from 'react-icons';
import {
  LuArrowLeft,
  LuArrowRight,
  LuCheck,
  LuCircleCheck,
  LuExternalLink,
  LuGem,
  LuInfo,
  LuListOrdered,
  LuLoaderCircle,
  LuMonitor,
  LuMoon,
  LuRefreshCw,
  LuRotateCcw,
  LuSearchX,
  LuSun,
  LuTriangleAlert,
} from 'react-icons/lu';
import { PiSpotifyLogo, PiYoutubeLogo } from 'react-icons/pi';

import brandMark from '@/assets/imgs/Logo Mark.png';

/**
 * Os dezesseis papéis que resolvem para um componente de biblioteca.
 *
 * Os nomes de exportação foram resolvidos contra `react-icons@5.5.0` em
 * 2026-08-09 e estão registrados em `contracts/icons.md` §1. O Lucide renomeia
 * partes do conjunto entre versões — `LuCheckCircle` virou `LuCircleCheck`,
 * `LuLoader2` virou `LuLoaderCircle` —, e é `tests/unit/icon-roles.spec.ts` que
 * falha, **com o papel nomeado**, quando isso acontecer de novo.
 */
const LIBRARY_ICONS = {
  /* Controle de tema — os três segmentos do `radiogroup`. */
  'theme-light': LuSun,
  'theme-dark': LuMoon,
  'theme-system': LuMonitor,

  /* Ações da casca. */
  restart: LuRotateCcw,
  reconnect: LuRefreshCw,
  advance: LuArrowRight,
  back: LuArrowLeft,

  /* Confirmação e progresso. */
  done: LuCheck,
  'status-ok': LuCircleCheck,
  loading: LuLoaderCircle,

  /* Selos de correspondência. O design só desenha o "confiante"; os outros dois
     entram por analogia, porque silêncio do design não é remoção (FR-063). A
     analogia adotada está registrada em `contracts/icons.md` §2 e no guia de
     estilo (FR-064). */
  confident: LuGem,
  uncertain: LuTriangleAlert,
  missing: LuSearchX,

  /* Apoio. */
  hint: LuInfo,
  queue: LuListOrdered,
  external: LuExternalLink,

  /* Identificação de provedor. Único par vindo do Phosphor. */
  'provider-spotify': PiSpotifyLogo,
  'provider-youtube': PiYoutubeLogo,
} as const satisfies Record<string, IconType>;

/** Papel que resolve para um componente e herda `currentColor`. */
export type LibraryIconRole = keyof typeof LIBRARY_ICONS;

/** O papel único que resolve para arte local em vez de componente. */
export const BRAND_ROLE = 'brand';

/** O vocabulário completo de ícones da aplicação. */
export type IconRole = LibraryIconRole | typeof BRAND_ROLE;

/**
 * O mapa, na forma que o `Icon` consome.
 *
 * `kind` existe para que o envoltório não precise adivinhar o que fazer: arte e
 * componente têm regras de cor opostas, e um `typeof === 'function'` espalhado
 * pelo código seria a mesma decisão tomada em silêncio.
 */
export type IconEntry =
  | { readonly kind: 'component'; readonly component: IconType }
  | { readonly kind: 'art'; readonly src: string };

export const ICONS: Readonly<Record<IconRole, IconEntry>> = {
  ...(Object.fromEntries(
    Object.entries(LIBRARY_ICONS).map(([role, component]) => [role, { kind: 'component', component }]),
  ) as Record<LibraryIconRole, IconEntry>),
  [BRAND_ROLE]: { kind: 'art', src: brandMark },
};

/** Todos os papéis, para o teste de completude percorrer sem repetir a lista. */
export const ICON_ROLES = Object.keys(ICONS) as readonly IconRole[];
