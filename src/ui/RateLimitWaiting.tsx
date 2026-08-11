import { useEffect, useState } from 'react';

import { segundosRestantes } from '@/domain/retry/countdown';
import { t } from '@/i18n/pt-BR';
import { onWaitStateChange, type WaitState } from '@/services/rate-limiter';

import { Button } from './Button';
import { Icon } from './Icon';

/**
 * Como o aviso se apresenta (009/FR-018a, FR-018b, 009/contracts/loading-card.md §6.2).
 *
 * | variante | Ícone | Contagem | Cancelamento | Quem usa |
 * | --- | --- | --- | --- | --- |
 * | `spinner` (padrão) | `loading`, girando | não | conforme `onCancel` | busca, retomada |
 * | `countdown` | **nenhum** | sim, `aria-hidden` | **nunca** | a criação inicial |
 *
 * O padrão preserva o comportamento anterior à 009 byte a byte: as duas posições
 * que já existiam não mudam nada.
 */
export type RateLimitWaitingVariant = 'spinner' | 'countdown';

export interface RateLimitWaitingProps {
  /**
   * Quando presente, o cancelamento continua alcançável durante a espera.
   * **Ignorado na variante `countdown`** (FR-018b).
   */
  onCancel?: () => void;
  /**
   * Mensagem já resolvida com o nome do serviço que pediu a pausa (FR-046).
   *
   * **Obrigatória, e a obrigatoriedade é a correção de um defeito.** Ela era
   * opcional, com `t.review.progressWaiting` como padrão — e aquele texto é um
   * **template**, com `{service}` a interpolar. Quem omitisse a propriedade
   * renderizava o marcador cru na tela, sem que nada falhasse: nem o TypeScript,
   * nem o lint, nem teste algum. Foi o que aconteceu na primeira escrita do
   * ponto de uso da criação, e só apareceu numa conferência a olho.
   *
   * Com a propriedade exigida, o mesmo erro passa a ser erro de compilação.
   */
  label: string;
  /** Ver `RateLimitWaitingVariant`. Padrão: `spinner`. */
  variant?: RateLimitWaitingVariant;
}

/**
 * Estado de espera por limitação de requisições (FR-034, SC-011).
 *
 * Usado na busca, na retomada e — desde a 009 — na criação inicial. O botão de
 * cancelar fica **dentro** do aviso de propósito: SC-011 exige que cancelar
 * funcione inclusive enquanto o app aguarda, e é aqui que o usuário está olhando
 * quando isso acontece.
 */
export function RateLimitWaiting({
  onCancel,
  label,
  variant = 'spinner',
}: RateLimitWaitingProps) {
  const [wait, setWait] = useState<WaitState | null>(null);
  const [agora, setAgora] = useState(() => Date.now());

  /*
    O relógio é I/O e por isso vive aqui, não no domínio (Princípio III): a
    conversão em segundos é a função pura `segundosRestantes`, com `agora` como
    parâmetro. O intervalo nasce e morre no mesmo `useEffect` em que
    `onWaitStateChange` já era assinado, de modo que não existe o caminho em que
    um dos dois sobrevive ao outro.

    O tique só é criado na variante que mostra a contagem: um `setInterval` por
    segundo na busca renderizaria o aviso sessenta vezes por minuto para não
    mudar nada na tela.
  */
  const mostraContagem = variant === 'countdown';

  useEffect(() => {
    /*
      O relógio é reancorado **na chegada da espera**, e não na montagem: este
      componente fica montado o tempo todo devolvendo `null`, e o `agora` inicial
      estaria minutos velho quando um 429 finalmente acontecesse — o primeiro
      quadro da contagem mostraria um número absurdo até o tique seguinte.
    */
    const unsubscribe = onWaitStateChange((state) => {
      setWait(state);
      if (state !== null) setAgora(Date.now());
    });
    if (!mostraContagem) return unsubscribe;

    const tique = setInterval(() => {
      setAgora(Date.now());
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(tique);
    };
  }, [mostraContagem]);

  if (wait === null) return null;

  // A saída de cancelamento nunca é oferecida na criação (FR-018b): cancelar
  // uma escrita já confirmada em voo não é a mesma ação que cancelar uma busca,
  // e a propriedade simplesmente não é honrada aqui.
  const cancelamento = mostraContagem ? undefined : onCancel;

  return (
    /*
      **A analogia adotada** (FR-063, FR-064): o design não desenha aviso de
      espera. O mais próximo é a caixa de dica — cartão baixo, fundo tingido,
      contorno na cor do estado. A tinta é a de "incerta" e não a de erro: uma
      pausa por limite de taxa é o serviço pedindo calma, não uma falha, e pintá-la
      de vermelho ensinaria o usuário a temer o normal.

      **Reconferido na 008** (FR-008, T021a). Com a saída da moldura do `Wizard`,
      este aviso passou a repousar sobre `--bg` quando aparece na revisão — a
      única das duas posições que não tem cartão de fase em volta. O substrato
      tingido continua se destacando porque ele é derivado de `--surface`, e o
      **contorno na cor do estado** é o que garante a separação sem depender
      disso: ele sobrevive inclusive ao modo de cores forçadas, que descarta
      preenchimento e preserva contorno.
    */
    <div
      role="status"
      className="border-state-uncertain-edge bg-state-uncertain-tint text-ink flex flex-wrap items-center gap-2 rounded-card border px-3 py-2 text-body"
    >
      {/*
        Na criação o ícone some **por inteiro**, e não fica parado (FR-018a): um
        glifo de carregamento congelado lê como travamento, e o disco do cartão
        já é o único giro da tela.
      */}
      {!mostraContagem && (
        // Decorativo: a espera está escrita ao lado, e o giro comunica duração.
        <Icon role="loading" className="text-state-uncertain motion-safe:animate-spin" />
      )}
      <span>{label}</span>
      {mostraContagem && (
        /*
          **`aria-hidden`, e a decisão é essa.** Um número que muda a cada
          segundo dentro de um `role="status"` é um anúncio por segundo. A região
          viva carrega a frase, anunciada uma vez na entrada; os segundos são
          informação visual (009/contracts/loading-card.md §6.2).
        */
        <span aria-hidden className="text-ink-muted text-meta tabular-nums">
          {segundosRestantes(wait.resumesAt, agora)}
        </span>
      )}
      {cancelamento !== undefined && (
        <Button size="sm" variant="ghost" onClick={cancelamento}>
          {t.review.cancelSearch}
        </Button>
      )}
    </div>
  );
}
