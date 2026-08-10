import { ActionBar } from '@/app/ActionBar';
import { PROVIDER_ORDER } from '@/domain/providers';
import { validateAtLeastOneCredential } from '@/domain/validation';
import { plural, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';

/**
 * A faixa de ações da etapa de Configuração (nó `fVjnY` em `Sim0L`).
 *
 * ## Por que ela existe agora, e não existia antes
 *
 * A 007 argumentou que esta etapa **não** deveria ter faixa: ela tem um cartão
 * por serviço, cada um com a sua ação — salvar e remover pertencem àquele Client
 * ID, não à etapa —, e por isso o avanço morava ao pé do conteúdo. O argumento
 * continua correto quanto a salvar e remover, que **permanecem** nos cartões.
 *
 * O que ele errava é que a etapa também tem **uma** decisão de etapa: seguir
 * adiante. O arquivo de design a desenha na mesma faixa fixa de Destinos, e o
 * efeito prático é o que motivou o pedido — numa página de dois mil pixels de
 * altura, um botão ao pé do conteúdo é um botão que só existe depois de rolar
 * tudo. Na faixa fixa ele está à vista o tempo todo, junto com a resposta para
 * "já dá para continuar?".
 *
 * ## Sem "Voltar"
 *
 * FR-019: é a primeira etapa. Um botão que não volta para lugar nenhum é pior
 * que nenhum botão — promete uma saída e não a cumpre. O arquivo concorda: o
 * grupo `DDNSt` tem um filho só.
 *
 * ## O bloqueio
 *
 * **Nenhum serviço é obrigatório isoladamente** (FR-002); o que a etapa exige é
 * ao menos um Client ID. A regra vive em `validateAtLeastOneCredential`, no
 * domínio, e chega aqui já decidida — a faixa não a reimplementa, apenas
 * escreve o motivo quando ela recusa.
 */
export function CredentialActionBar() {
  const credentials = useAppStore((state) => state.credentials);
  const goToStep = useAppStore((state) => state.goToStep);

  const validation = validateAtLeastOneCredential(credentials);
  /*
    A contagem vem de `PROVIDER_ORDER`, e não das chaves de `credentials`: a
    ordem e o conjunto de provedores são do domínio, e varrer o objeto do store
    faria esta tela acreditar em qualquer chave que aparecesse ali.
  */
  const count = PROVIDER_ORDER.filter((provider) => credentials[provider] !== null).length;

  return (
    <ActionBar
      state={plural(count, t.credential.configuredCountOne, t.credential.configuredCountOther)}
      blockedReason={validation.ok ? null : t.credential.noneSaved}
      advanceLabel={t.common.next}
      onAdvance={() => {
        goToStep('destinations');
      }}
    />
  );
}
