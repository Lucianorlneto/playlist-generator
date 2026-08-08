import { useState } from 'react';

import { capabilitiesOf, type ProviderId } from '@/domain/providers';
import { lineNumeral } from '@/domain/run/numeral';
import type { MatchItem } from '@/domain/types';
import { nameOf } from '@/features/credential/providerText';
import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';
import { Button } from '@/ui/Button';
import { VersionHintBadge } from '@/ui/VersionHintBadge';

import { Alternatives } from './Alternatives';
import { formatDuration } from './formatDuration';
import { LineEditor } from './LineEditor';
import { attentionText, StatusBadge, statusHint } from './StatusBadge';

export interface MatchRowProps {
  item: MatchItem;
  provider: ProviderId;
}

/**
 * Um item da revisão: linha original, faixa escolhida e ações.
 *
 * **Álbum ou canal, nunca os dois, e nunca álbum vazio** (FR-024, invariante
 * K1): a segunda linha lê `capabilities.showsAlbum` para decidir. No catálogo de
 * vídeo não existe álbum, e exibir um campo vazio rotulado "Álbum" prometeria um
 * dado que a plataforma não tem.
 *
 * Layout **mobile-first**: cartão empilhado por padrão, virando colunas
 * alinhadas a partir de `sm:` (640 px). Nenhuma largura fixa em pixels — as
 * colunas usam `minmax(0, …)`, o que permite o conteúdo encolher em vez de
 * estourar a página.
 */
export function MatchRow({ item, provider }: MatchRowProps) {
  const toggleIncluded = useAppStore((state) => state.toggleIncluded);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [editing, setEditing] = useState(false);

  const selected = item.candidates.find((candidate) => candidate.uri === item.selectedUri) ?? null;
  const duplicate = item.duplicateOf !== null;
  const hint = statusHint(item.status, duplicate);
  const showsAlbum = capabilitiesOf(provider).showsAlbum;
  const service = nameOf(provider);
  const hints = selected?.versionHints ?? [];
  const attention = attentionText(item.attentionReason);
  /** O numeral da goteira: o índice da linha de entrada, base 1 (design.md §5). */
  const numeral = lineNumeral(item.line.index);

  if (editing) {
    return (
      <li className="app-card flex flex-col gap-2">
        <p className="text-ink-muted text-body font-mono break-words">{item.line.raw}</p>
        <LineEditor
          item={item}
          provider={provider}
          onDone={() => {
            setEditing(false);
          }}
        />
      </li>
    );
  }

  return (
    <li className="app-card gutter-row">
      {/*
        A goteira (design.md §4 e §5). Carrega a identidade da linha — o numeral
        que a pessoa colou — e a decisão sobre ela — incluir ou não. Abaixo de
        `--gutter-collapse` a coluna colapsa e o numeral vira prefixo em linha,
        logo abaixo; por isso ele é `gutter:block` aqui e `gutter:hidden` lá.
      */}
      <div className="gutter:flex-col gutter:items-start flex items-center gap-2">
        <input
          type="checkbox"
          className="focus-ring accent-accent size-4"
          checked={item.included}
          disabled={item.selectedUri === null || item.status === 'discarded'}
          aria-label={format(t.review.includeLabelFor, { line: item.line.raw })}
          onChange={() => {
            toggleIncluded(item.line.id);
          }}
        />
        <span aria-hidden="true" className="data-numeral text-accent-text gutter:block hidden">
          {numeral}
        </span>
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        {/*
          A entrada como foi colada, em tinta secundária: ela é referência, não
          o resultado. O numeral aparece aqui como prefixo apenas na tela
          estreita, mantendo o alinhamento tabular do `data-numeral`.
        */}
        <p className="text-ink-muted text-meta flex min-w-0 items-baseline gap-2 break-words">
          <span aria-hidden="true" className="data-numeral text-accent-text gutter:hidden">
            {numeral}
          </span>
          <span className="sr-only">{t.review.originalLine}</span>
          <span className="min-w-0 break-words">{item.line.raw}</span>
        </p>

        {selected === null ? (
          <p className="text-ink-muted text-body">{t.review.noSelection}</p>
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            {selected.coverUrl === null ? (
              /*
                Marcador de "sem capa". O texto continua presente para leitor de
                tela — o FR-035 congela os textos, e removê-lo custaria
                informação a quem não vê a imagem —, mas ele não cabe desenhado:
                duas palavras num quadrado de 32px transbordavam a caixa.

                O que aparece é a mesma moldura das capas reais, vazia, com um
                traço. Ocupar o mesmo espaço da capa é o que mantém a coluna de
                título alinhada entre linhas que têm imagem e linhas que não têm.
              */
              <span className="border-rule-strong bg-surface-raised text-ink-muted rounded-control flex size-8 shrink-0 items-center justify-center border">
                <span className="sr-only">{t.review.noCover}</span>
                <svg
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                  className="size-3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <path d="M4 8h8" />
                </svg>
              </span>
            ) : (
              /*
                Capa de terceiro (`i.scdn.co`, `i.ytimg.com`): 1px de
                `--rule-strong` e `--radius-control`. São imagens com cores
                arbitrárias e precisam de contorno para se separar do fundo nos
                dois temas (FR-021) — e é justamente por causa deste uso que
                `--rule-strong` precisa dos 3:1 que T016 lhe deu.
              */
              <img
                src={selected.coverUrl}
                alt={
                  showsAlbum
                    ? format(t.review.coverAlt, { album: selected.album })
                    : format(t.review.thumbnailAlt, { title: selected.title })
                }
                className="border-rule-strong rounded-control size-8 shrink-0 border object-cover"
                loading="lazy"
              />
            )}
            {/*
              **Piso de legibilidade da grade densa** (FR-044). Nome de faixa em
              `--text-item` e linha de artista em `--text-body`, ambos
              0,9375rem — acima dos 0,875rem que a versão anterior usava. A
              personalidade tipográfica não pode sair cara justamente na tela
              mais densa do aplicativo; `tests/components/review.spec.tsx` fixa
              esse piso em teste.
            */}
            <div className="min-w-0">
              <p className="text-ink text-item truncate">{selected.title}</p>
              <p className="text-ink-muted text-body truncate">
                {showsAlbum
                  ? `${selected.artists.join(', ')} · ${selected.album} · ${formatDuration(selected.durationMs)}`
                  : `${t.review.channel}: ${selected.channel ?? selected.artists.join(', ')} · ${formatDuration(selected.durationMs)}`}
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={item.status} duplicate={duplicate} errored={item.error !== null} />
          <VersionHintBadge hints={hints} />
        </div>

        {/*
        Motivo de atenção (`003/FR-017`): **texto**, não cor nem ícone. O
        `<strong>` rotulado é o que dá ao leitor de tela o mesmo contexto que o
        selo colorido dá a quem enxerga — a cor sozinha não é informação
        acessível, e este é o dado que diz ao usuário o que fazer a seguir.
      */}
        {attention !== null && (
          <p className="field-message">
            <strong className="font-semibold">{t.review.attentionReason.label}:</strong> {attention}
          </p>
        )}
        {hints.length > 0 && <p className="field-message">{t.review.statusHint.versionHint}</p>}
        {hint !== null && <p className="field-message">{hint}</p>}
        {item.error !== null && <p className="field-message text-state-missing">{item.error}</p>}

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="ghost"
            aria-expanded={showAlternatives}
            onClick={() => {
              setShowAlternatives((open) => !open);
            }}
          >
            {t.review.alternatives}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(true);
            }}
          >
            {t.review.editLine}
          </Button>
          {selected !== null && selected.externalUrl !== '' && (
            <a
              href={selected.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring text-body self-center underline"
            >
              {format(t.review.openExternal, { service })}
            </a>
          )}
        </div>

        {showAlternatives && <Alternatives item={item} provider={provider} />}
      </div>
    </li>
  );
}
