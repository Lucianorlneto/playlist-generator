/**
 * Todos os textos da interface (FR-048). Nenhum literal de texto de UI pode
 * existir fora deste módulo — a regra de lint `tp/no-ui-text-literals` falha o
 * build se algum escapar.
 *
 * Não há mecanismo de troca de idioma: múltiplos idiomas estão fora de escopo
 * (research §13). O módulo único existe para revisão e teste dos textos.
 */

type Frozen<T> = T extends (infer U)[]
  ? readonly Frozen<U>[]
  : T extends object
    ? { readonly [K in keyof T]: Frozen<T[K]> }
    : T;

function deepFreeze<T>(value: T): Frozen<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.getOwnPropertyNames(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value as Frozen<T>;
}

/** Mensagem acionável: causa provável + próximo passo (FR-042). */
export interface ActionableMessage {
  title: string;
  cause: string;
  nextStep: string;
}

const messages = {
  app: {
    title: 'Importador de Playlist por Texto',
    subtitle: 'Transforme uma lista de músicas em uma playlist do Spotify.',
    skipToContent: 'Ir para o conteúdo',
  },

  steps: {
    credential: 'Credencial',
    input: 'Entrada',
    review: 'Revisão',
    result: 'Resultado',
    progressLabel: 'Etapas do fluxo',
    current: 'Etapa atual',
    completed: 'Etapa concluída',
    of: 'de',
  },

  common: {
    save: 'Salvar',
    cancel: 'Cancelar',
    back: 'Voltar',
    next: 'Continuar',
    copy: 'Copiar',
    copied: 'Copiado',
    copyFailed: 'Não foi possível copiar. Selecione o texto e copie manualmente.',
    retry: 'Tentar novamente',
    remove: 'Remover',
    discard: 'Descartar',
    close: 'Fechar',
    loading: 'Carregando…',
    yes: 'Sim',
    no: 'Não',
    optional: 'opcional',
    required: 'obrigatório',
    open: 'Abrir',
    of: 'de',
  },

  credential: {
    heading: 'Informe sua credencial do Spotify',
    intro:
      'O app usa apenas o Client ID de um aplicativo registrado por você. Nenhum Client Secret é solicitado, aceito ou armazenado.',
    fieldLabel: 'Client ID',
    fieldHint: 'O Client ID aparece na página do seu app no Spotify Developer Dashboard.',
    placeholder: 'Cole aqui o Client ID',
    save: 'Salvar credencial',
    saved: 'Credencial salva neste dispositivo.',
    emptyError: 'Informe o Client ID antes de salvar.',
    formatWarning:
      'Esse valor não parece um Client ID do Spotify (normalmente 32 caracteres hexadecimais). Você pode salvar mesmo assim — a autorização é a validação real.',
    reveal: 'Revelar credencial',
    hide: 'Ocultar credencial',
    maskedLabel: 'Credencial salva, exibida de forma mascarada',
    removeHeading: 'Remover credencial',
    remove: 'Remover credencial',
    removeHint: 'Apaga o Client ID deste dispositivo. Não afeta o rascunho de trabalho.',
    removeConfirm: 'Remover a credencial salva deste dispositivo?',
    removed: 'Credencial removida deste dispositivo.',
    howToHeading: 'Como obter o Client ID',
    howToSteps: [
      'Acesse o Spotify Developer Dashboard e entre com sua conta.',
      'Crie um app (qualquer nome e descrição servem).',
      'Copie o Client ID exibido na página do app.',
      'Em Settings, cadastre o Redirect URI exato mostrado abaixo.',
      'Se o app estiver em modo de desenvolvimento, adicione sua conta em Users and Access.',
    ],
    dashboardLinkLabel: 'Abrir o Spotify Developer Dashboard',
    redirectUriHeading: 'Redirect URI a cadastrar',
    redirectUriHint:
      'Cadastre exatamente este endereço no Developer Dashboard. A correspondência é exata, incluindo maiúsculas, minúsculas e a barra final.',
    redirectUriLocalhostWarning:
      'A plataforma não aceita http://localhost. Em desenvolvimento use o endereço IPv4 literal 127.0.0.1, como mostrado acima.',
    copyRedirectUri: 'Copiar Redirect URI',
  },

  connect: {
    heading: 'Conectar sua conta',
    intro: 'Você será levado ao Spotify para autorizar. Nada é criado na sua conta nesta etapa.',
    connect: 'Conectar ao Spotify',
    connecting: 'Redirecionando para o Spotify…',
    disconnect: 'Desconectar',
    disconnected: 'Sessão encerrada. Sua credencial e seu rascunho foram preservados.',
    connectedAs: 'Conectado como',
    accountLabel: 'Conta conectada',
    scopesNotice:
      'Permissões solicitadas: criar playlists privadas e públicas e ler a lista das suas playlists (para checar nome repetido).',
    needsCredential: 'Salve o Client ID antes de conectar.',
    reconnect: 'Reconectar',
    reconnectNeeded:
      'Sua autorização expirou. Reconecte para continuar — seu trabalho foi mantido.',
  },

  input: {
    heading: 'Cole sua lista',
    intro: 'Uma música por linha, no formato "Música - Artista".',
    textareaLabel: 'Lista de músicas',
    placeholder: 'Bohemian Rhapsody - Queen\nImagine - John Lennon\nHey Jude by The Beatles',
    separatorsHint: 'Separadores reconhecidos: hífen (-), travessão (– —) e a palavra "by".',
    lineCountOne: '1 linha',
    lineCountOther: '{count} linhas',
    emptyHint: 'Cole ou digite pelo menos uma linha para continuar.',
    largeListWarning:
      'Sua lista tem {count} linhas. A busca pode levar vários minutos — o progresso fica visível e você pode cancelar a qualquer momento.',
    search: 'Buscar correspondências',
    searching: 'Buscando…',
  },

  review: {
    heading: 'Confira as correspondências',
    intro:
      'Nada é criado na sua conta até você confirmar. Itens confiantes já vêm marcados; incertos precisam da sua confirmação.',
    listLabel: 'Correspondências encontradas',
    columnInclude: 'Incluir',
    columnOriginal: 'Linha original',
    columnMatch: 'Faixa encontrada',
    columnStatus: 'Status',
    includeLabel: 'Incluir na playlist',
    includeLabelFor: 'Incluir "{line}" na playlist',
    originalLine: 'Linha original',
    noSelection: 'Nenhuma faixa escolhida',
    album: 'Álbum',
    duration: 'Duração',
    coverAlt: 'Capa do álbum {album}',
    noCover: 'Sem capa',
    openInSpotify: 'Abrir no Spotify',
    alternatives: 'Ver alternativas',
    alternativesHeading: 'Outras candidatas para "{line}"',
    alternativesEmpty: 'Nenhuma outra candidata foi encontrada para esta linha.',
    chooseCandidate: 'Escolher esta faixa',
    chosenCandidate: 'Faixa escolhida',
    discardItem: 'Descartar este item',
    restoreItem: 'Reincluir este item',
    editLine: 'Editar linha',
    editLineLabel: 'Texto da linha',
    editLineHint: 'Pressione Enter ou saia do campo para buscar de novo apenas esta linha.',
    reSearch: 'Buscar esta linha de novo',
    selectedCount: '{selected} de {total} faixas selecionadas',
    summaryConfident: '{count} confiantes',
    summaryUncertain: '{count} incertas',
    summaryNotFound: '{count} não encontradas',
    progressLabel: 'Progresso da busca',
    progressCounting: '{done} de {total} linhas buscadas',
    progressWaiting: 'Aguardando o limite de requisições do Spotify…',
    progressDone: 'Busca concluída: {done} de {total} linhas.',
    cancelSearch: 'Cancelar busca',
    searchCanceled: 'Busca cancelada. O que já foi encontrado foi mantido.',
    status: {
      pending: 'Aguardando',
      searching: 'Buscando',
      confident: 'Confiante',
      uncertain: 'Incerta',
      notFound: 'Não encontrada',
      unparsed: 'Formato não reconhecido',
      discarded: 'Descartada',
      duplicate: 'Duplicata',
      error: 'Falha na busca',
    },
    statusHint: {
      confident: 'Correspondência forte. Já marcada para entrar na playlist.',
      uncertain: 'Confirme visualmente antes de incluir.',
      notFound: 'Nenhuma faixa suficientemente parecida. Edite a linha e tente de novo.',
      unparsed: 'Não encontramos um separador nesta linha. Corrija para "Música - Artista".',
      duplicate: 'Repetida na sua lista. Desmarcada para não duplicar na playlist.',
    },
  },

  playlistConfig: {
    heading: 'Dados da playlist',
    nameLabel: 'Nome da playlist',
    namePlaceholder: 'Ex.: Clássicos do rock',
    nameRequired: 'O nome da playlist é obrigatório.',
    nameOnlySpaces: 'O nome não pode conter apenas espaços.',
    nameDuplicate: 'Você já tem uma playlist com esse nome. Escolha outro.',
    descriptionLabel: 'Descrição',
    descriptionPlaceholder: 'Opcional',
    visibilityLabel: 'Visibilidade',
    visibilityPrivate: 'Privada',
    visibilityPublic: 'Pública',
    visibilityHint: 'Playlists privadas ficam visíveis apenas para você.',
    noTracksSelected: 'Selecione ao menos uma faixa para criar a playlist.',
    checkingNames: 'Verificando se o nome já existe…',
    create: 'Criar playlist',
    creating: 'Criando playlist…',
    confirmHeading: 'Confirmar criação',
    confirmBody: '{count} faixas serão adicionadas a "{name}", nesta ordem.',
    pathPreview: 'A playlist será criada em:',
  },

  result: {
    heading: 'Playlist criada',
    /** Raiz da biblioteca — o único "caminho" que a plataforma expõe (FR-036). */
    libraryRoot: 'Sua Biblioteca',
    playlistName: 'Nome',
    added: 'Faixas adicionadas',
    skipped: 'Faixas ignoradas',
    skippedHint: 'Somamos aqui as descartadas, as duplicatas e as não incluídas.',
    openPlaylist: 'Abrir no Spotify',
    effectivePath: 'Caminho da playlist',
    folderNoticeHeading: 'Sobre pastas',
    folderNotice:
      'A plataforma do Spotify não permite que aplicativos de terceiros criem ou escolham pastas de playlist. Sua playlist foi criada na raiz da biblioteca — para movê-la para uma pasta, arraste-a no aplicativo do Spotify.',
    failedHeading: 'Linhas sem correspondência',
    failedHint: 'Estas linhas não entraram na playlist, na ordem original da sua lista.',
    copyFailed: 'Copiar linhas que falharam',
    startOver: 'Começar uma nova playlist',
    partialHeading: 'A criação parou no meio',
    partialBody:
      '{added} de {total} faixas já foram adicionadas a "{name}". Você pode continuar de onde parou — as já adicionadas não serão repetidas.',
    retryRemaining: 'Adicionar as faixas restantes',
    retryingRemaining: 'Adicionando as faixas restantes…',
    creationProgress: 'Lote {current} de {total}',
  },

  draft: {
    recoveredHeading: 'Recuperamos um trabalho em andamento',
    recoveredBody: 'Salvo em {when}. Você pode continuar de onde parou ou começar do zero.',
    continue: 'Continuar de onde parei',
    discard: 'Descartar rascunho',
    discardConfirm: 'Descartar o trabalho salvo? A credencial salva será preservada.',
    discarded: 'Rascunho descartado. Sua credencial foi preservada.',
    quotaWarning:
      'Não foi possível salvar o rascunho neste dispositivo: o armazenamento local está cheio. O trabalho continua na memória, mas será perdido se a página for recarregada.',
    quotaDegraded:
      'O armazenamento local está quase cheio. Salvamos o rascunho sem as candidatas alternativas.',
    corrupted: 'O rascunho salvo estava ilegível e foi descartado. Começamos do zero.',
    unknownVersion:
      'O rascunho salvo veio de uma versão diferente do aplicativo e foi descartado por segurança.',
  },

  errors: {
    authInvalidClient: {
      title: 'Não foi possível autorizar com esse Client ID',
      cause: 'O Client ID está incorreto ou o app não existe mais no Developer Dashboard.',
      nextStep: 'Volte à etapa de credencial e confira o valor copiado do painel do seu app.',
    },
    authRedirectUriMismatch: {
      title: 'O Redirect URI não está cadastrado',
      cause:
        'O endereço de retorno usado por este app não consta na lista do seu app no Developer Dashboard.',
      nextStep:
        'Copie o Redirect URI exibido abaixo, cadastre-o em Settings do seu app e tente conectar de novo.',
    },
    authAccessDenied: {
      title: 'A autorização foi recusada',
      cause:
        'O consentimento foi negado — ou seu app está em modo de desenvolvimento e esta conta não está na lista de usuários permitidos.',
      nextStep:
        'Tente conectar de novo e aceite o consentimento. Se o app estiver em modo de desenvolvimento, adicione sua conta em Users and Access no Developer Dashboard.',
    },
    authStateMismatch: {
      title: 'O retorno da autorização não pôde ser validado',
      cause:
        'O código devolvido não corresponde ao pedido feito por esta aba — pode ter vindo de outra janela ou de um link antigo.',
      nextStep: 'Inicie a conexão novamente a partir desta página.',
    },
    authInvalidGrant: {
      title: 'O código de autorização expirou',
      cause: 'Códigos de autorização valem por pouco tempo e só podem ser usados uma vez.',
      nextStep: 'Clique em conectar para iniciar uma nova autorização.',
    },
    authGeneric: {
      title: 'A autorização falhou',
      cause: 'O Spotify recusou o pedido de autorização.',
      nextStep: 'Confira o Client ID e o Redirect URI cadastrados e tente de novo.',
    },
    sessionExpired: {
      title: 'Sua sessão expirou',
      cause: 'A autorização de acesso venceu e não foi possível renová-la automaticamente.',
      nextStep: 'Reconecte sua conta. Seu texto, o nome da playlist e a revisão foram preservados.',
    },
    forbidden: {
      title: 'Permissão insuficiente',
      cause: 'A autorização concedida não cobre esta operação.',
      nextStep: 'Desconecte e conecte de novo, aceitando todas as permissões pedidas.',
    },
    notFound: {
      title: 'Recurso não encontrado',
      cause: 'O item solicitado não existe mais ou não pertence a esta conta.',
      nextStep: 'Recarregue a página e tente novamente.',
    },
    rateLimited: {
      title: 'O Spotify limitou as requisições',
      cause: 'Muitas requisições em pouco tempo. O serviço pediu uma pausa.',
      nextStep: 'Aguardamos automaticamente e continuamos. Você pode cancelar a qualquer momento.',
    },
    serverError: {
      title: 'O Spotify respondeu com um erro',
      cause: 'Falha temporária no serviço do Spotify.',
      nextStep: 'Tentamos algumas vezes automaticamente. Se persistir, tente de novo em instantes.',
    },
    offline: {
      title: 'Sem conexão com a internet',
      cause: 'Não foi possível alcançar o Spotify a partir deste dispositivo.',
      nextStep: 'Verifique sua conexão e repita a operação — seu trabalho foi preservado.',
    },
    network: {
      title: 'Falha de rede',
      cause: 'A requisição não chegou ao Spotify.',
      nextStep: 'Verifique sua conexão e tente novamente.',
    },
    playlistListFailed: {
      title: 'Não foi possível verificar seus nomes de playlist',
      cause:
        'A consulta às playlists existentes falhou, e sem ela não dá para checar nome repetido.',
      nextStep: 'Tente novamente. A playlist não será criada sem essa verificação.',
    },
    createPlaylistFailed: {
      title: 'Não foi possível criar a playlist',
      cause: 'O Spotify recusou a criação da playlist.',
      nextStep: 'Tente novamente em instantes. Nada foi criado na sua conta.',
    },
    addTracksFailed: {
      title: 'A adição de faixas foi interrompida',
      cause: 'Um lote de faixas não pôde ser enviado ao Spotify.',
      nextStep:
        'Use "Adicionar as faixas restantes": as já adicionadas não serão repetidas e nenhuma segunda playlist será criada.',
    },
    searchLineFailed: {
      title: 'Não foi possível buscar esta linha',
      cause: 'A busca desta linha falhou após algumas tentativas.',
      nextStep:
        'Edite a linha e confirme para buscar de novo. As demais linhas não foram afetadas.',
    },
    unexpected: {
      title: 'Algo inesperado aconteceu',
      cause: 'O aplicativo encontrou um erro que não sabe explicar.',
      nextStep: 'Recarregue a página. Seu rascunho foi preservado neste dispositivo.',
    },
  } satisfies Record<string, ActionableMessage>,
};

export const t = deepFreeze(messages);

export type Messages = typeof t;

/** Interpola `{chave}` com os valores fornecidos. Sem HTML, sempre texto puro. */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : match,
  );
}

/** Plural simples: pt-BR só precisa de "um" e "outros" nos textos deste app. */
export function plural(count: number, one: string, other: string): string {
  return format(count === 1 ? one : other, { count });
}
