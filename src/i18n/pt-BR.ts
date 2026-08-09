/**
 * Todos os textos da interface (Princípio de idioma). Nenhum literal de texto de
 * UI pode existir fora deste módulo — a regra de lint `tp/no-ui-text-literals`
 * falha o build se algum escapar.
 *
 * Não há mecanismo de troca de idioma: múltiplos idiomas estão fora de escopo.
 * O módulo único existe para revisão e teste dos textos.
 *
 * **Sobre os dois serviços.** Textos comuns interpolam `{service}` e são
 * resolvidos com o nome do provedor; textos que só fazem sentido em um serviço
 * vivem sob `providers.{id}`. É a tradução literal da seção "Assimetria entre
 * provedores" da constituição: a limitação é dita onde ela afeta o que o usuário
 * pode fazer, não diluída em nota genérica.
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

/** Mensagem acionável: causa provável + próximo passo (FR-046). */
export interface ActionableMessage {
  title: string;
  cause: string;
  nextStep: string;
}

const messages = {
  app: {
    title: 'Importador de Playlist por Texto',
    subtitle: 'Transforme uma lista de músicas em playlists nos serviços que você escolher.',
    skipToContent: 'Ir para o conteúdo',
  },

  /**
   * Controle de tema (FR-022). Os únicos textos **novos** desta feature — o
   * FR-035 congela todos os demais, e mexer em copy aqui misturaria duas
   * mudanças de natureza diferente na mesma revisão (design.md §7).
   */
  theme: {
    groupLabel: 'Tema',
    light: 'Claro',
    dark: 'Escuro',
    system: 'Sistema',
    /** Lido junto do segmento "Sistema", que sozinho não diz o que faz. */
    systemHint: 'Acompanha a preferência do sistema',
  },

  steps: {
    credential: 'Configuração',
    destinations: 'Destinos',
    input: 'Entrada',
    service: 'Serviço',
    summary: 'Resumo',
    progressLabel: 'Etapas do fluxo',
    current: 'Etapa atual',
    completed: 'Etapa concluída',
    of: 'de',
  },

  /**
   * A trilha vertical de etapas (FR-010 a FR-015).
   *
   * ## As duas famílias de linha de apoio
   *
   * `neutral` descreve **o que fazer** na etapa; `derived` descreve **o que foi
   * decidido** nela. A regra que escolhe entre as duas é do domínio, não daqui:
   * `src/domain/rail/` deriva apenas quando a etapa está concluída e existe
   * valor real (FR-012, FR-066).
   *
   * É por isso que não há texto aqui para "Spotify e YouTube" sob Destinos na
   * tela de Configuração, ainda que o arquivo de design o mostre: reproduzi-lo
   * seria a trilha afirmando uma escolha que o usuário não fez.
   */
  rail: {
    title: 'Etapas',
    restart: 'Recomeçar do início',
    /** Anunciado só a leitor de tela, com o ordinal e o total do domínio. */
    position: 'Etapa {n} de {total}',

    neutral: {
      credential: 'Informe o Client ID de cada serviço',
      destinations: 'Escolha onde criar as playlists',
      input: 'Cole a sua lista de músicas',
      service: 'Acompanhe a criação em cada serviço',
      summary: 'Veja o resultado de cada destino',
    },

    derived: {
      credential: 'Credenciais salvas neste dispositivo',
      /** Recebe os destinos reais já unidos por `listAnd`. */
      destinations: '{list}',
      inputOne: '{count} linha colada',
      inputOther: '{count} linhas coladas',
      serviceOne: '{count} serviço concluído',
      serviceOther: '{count} serviços concluídos',
    },
  },

  /**
   * Chip de conexão da barra superior (FR-007 a FR-009).
   *
   * Os três estados são distinguíveis por **rótulo e forma**, não só por cor: o
   * nome do estado e o rótulo da ação dizem o mesmo que o ponto colorido diz.
   * `no-credential` nunca ganha identificador de conta — nem vazio, nem
   * genérico (FR-009).
   */
  connectionChip: {
    connected: 'Conectado',
    disconnected: 'Desconectado',
    noCredential: 'Sem credencial',

    /**
     * Rótulo **visível** da ação: curto, porque a barra superior é estreita e o
     * serviço já está escrito ao lado.
     */
    reconnect: 'Reconectar',
    connect: 'Conectar',
    configure: 'Configurar',
    /**
     * Só existe no estado `connected`: não há o que encerrar quando não há
     * sessão, e um "Desconectar" apagado ao lado de "Conectar" seria ruído.
     * O nome acessível é `t.connect.disconnect`, da feature 002.
     */
    disconnect: 'Sair',

    /**
     * Nome **acessível** da ação.
     *
     * Nomeia o serviço, porque dois botões chamados "Reconectar" lado a lado são
     * indistinguíveis para quem navega por lista de controles — e a barra
     * superior tem exatamente isso, um chip por provedor.
     *
     * **Diz "a conta do" e não "ao"** para não colidir com o botão primário da
     * etapa de conexão, que se chama "Conectar ao {service}". Os dois aparecem na
     * mesma tela, e dois controles com o mesmo nome acessível deixam quem usa
     * leitor de tela sem como escolher entre eles. A distinção também é honesta:
     * o chip age sobre a **conta**, o botão da etapa conduz o fluxo.
     */
    reconnectFor: 'Reconectar a conta do {service}',
    connectFor: 'Conectar a conta do {service}',
    configureFor: 'Configurar a credencial do {service}',

    /** Nome acessível do chip inteiro, com o estado já resolvido. */
    label: '{service}: {state}',
  },

  /**
   * Barra de ações do rodapé do conteúdo (FR-016 a FR-019).
   *
   * Existe **apenas** em Destinos e Entrada. As demais etapas mantêm as ações
   * dentro do cartão que as explica (FR-061), e "Pular o {serviço}" continua
   * adjacente ao cartão da fase (FR-062).
   */
  actionBar: {
    label: 'Ações da etapa',
    advance: 'Avançar',
    back: 'Voltar',
    /** Prefixo do motivo, para que a frase leia como impedimento e não como erro. */
    blockedPrefix: 'Para avançar:',
  },

  common: {
    /** Conjunção de lista, usada por `listAnd`. */
    and: 'e',
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
    skip: 'Pular',
  },

  // -------------------------------------------------------------------------
  // O que é específico de cada serviço (FR-005, FR-045, Assimetria)
  // -------------------------------------------------------------------------

  providers: {
    /** Usado quando ainda não há serviço atribuído à mensagem. */
    generic: 'o serviço',

    spotify: {
      name: 'Spotify',
      credentialHeading: 'Credencial do Spotify',
      credentialLabel: 'Client ID do Spotify',
      credentialHint: 'O Client ID aparece na página do seu app no Spotify Developer Dashboard.',
      placeholder: 'Cole aqui o Client ID do Spotify',
      formatWarning:
        'Esse valor não parece um Client ID do Spotify (normalmente 32 caracteres hexadecimais). Você pode salvar mesmo assim — a autorização é a validação real.',
      howToHeading: 'Como obter o Client ID do Spotify',
      howToSteps: [
        'Acesse o Spotify Developer Dashboard e entre com sua conta.',
        'Crie um app (qualquer nome e descrição servem).',
        'Copie o Client ID exibido na página do app.',
        'Em Settings, cadastre o Redirect URI exato mostrado abaixo.',
        'Se o app estiver em modo de desenvolvimento, adicione sua conta em Users and Access.',
      ],
      consoleLinkLabel: 'Abrir o Spotify Developer Dashboard',
      scopesNotice:
        'Permissões solicitadas: criar playlists privadas e públicas e ler a lista das suas playlists (para checar nome repetido).',
      /** Avisos exibidos na configuração deste serviço (FR-045). */
      setupNotices: [] as readonly string[],
      /** Raiz da biblioteca — o único "caminho" que a plataforma expõe (FR-027). */
      libraryRoot: 'Sua Biblioteca',
      folderNotice:
        'A plataforma do Spotify não permite que aplicativos de terceiros criem ou escolham pastas de playlist. Sua playlist foi criada na raiz da biblioteca — para movê-la para uma pasta, arraste-a no aplicativo do Spotify.',
      openPlaylist: 'Abrir no Spotify',
      /** Avisos exibidos no resultado deste serviço (FR-027, FR-028). */
      resultNotices: [] as readonly string[],
    },

    youtube: {
      name: 'YouTube',
      credentialHeading: 'Credencial do YouTube',
      credentialLabel: 'Client ID do YouTube',
      credentialHint:
        'O Client ID vem de um cliente OAuth do tipo "Aplicativo da Web", criado no Google Cloud Console.',
      placeholder: 'Cole aqui o Client ID do YouTube',
      formatWarning:
        'Esse valor não parece um Client ID do Google (normalmente termina em .apps.googleusercontent.com). Você pode salvar mesmo assim — a autorização é a validação real.',
      howToHeading: 'Como obter o Client ID do YouTube',
      howToSteps: [
        'Acesse o Google Cloud Console e crie (ou escolha) um projeto.',
        'Ative a YouTube Data API v3 na biblioteca de APIs do projeto.',
        'Em Credenciais, crie um ID do cliente OAuth do tipo "Aplicativo da Web".',
        'Cadastre os dois endereços mostrados abaixo, cada um no seu campo: a origem em "Origens JavaScript autorizadas" e o Redirect URI em "URIs de redirecionamento autorizados". São parecidos mas diferentes — só o Redirect URI termina em barra.',
        'Em "Público-alvo", adicione como usuário de teste a conta do YouTube onde as playlists serão criadas. Ela precisa estar na lista mesmo que seja a dona do projeto, e se for diferente da conta que criou o projeto é ela que deve entrar — sem isso a autorização é bloqueada com "access_denied".',
      ],
      consoleLinkLabel: 'Abrir o Google Cloud Console',
      scopesNotice:
        'Permissão solicitada: gerenciar sua conta do YouTube — é o menor escopo que permite listar e criar playlists.',
      setupNotices: [
        /**
         * FR-045: o escopo do YouTube é mais amplo do que o app usa, e não
         * existe escopo menor que crie playlists. Dizer isso é obrigação.
         */
        'O YouTube não oferece uma permissão apenas para playlists. A permissão concedida cobre mais do que este app faz — ele lista suas playlists, cria uma nova e adiciona vídeos a ela, e nada além disso. Você pode revogar o acesso a qualquer momento na sua Conta Google.',
        /** FR-035: a plataforma não oferece renovação silenciosa (research §1). */
        'A autorização do YouTube vale cerca de uma hora e não pode ser renovada em silêncio por um app sem servidor. Quando ela vencer, pediremos para autorizar de novo — seu trabalho é preservado integralmente.',
      ] as readonly string[],
      /** Raiz que o YouTube expõe (FR-027). */
      libraryRoot: 'Você / Playlists',
      folderNotice:
        'O YouTube não expõe pastas de playlist a aplicativos de terceiros. Sua playlist foi criada na sua lista de playlists — este app não cria nem escolhe pastas.',
      openPlaylist: 'Abrir no YouTube',
      resultNotices: [
        /** FR-028: honestidade sobre limites. Não é playlist do YouTube Music. */
        'A playlist criada é uma playlist do YouTube, não do YouTube Music. Ela pode aparecer no YouTube Music, mas quem a gerencia é o YouTube — este app não cria playlists do YouTube Music.',
      ] as readonly string[],
    },
  },

  // -------------------------------------------------------------------------
  // Etapa 1 — Configuração (FR-001 a FR-007)
  // -------------------------------------------------------------------------

  credential: {
    heading: 'Informe suas credenciais',
    intro:
      'Cadastre o Client ID de cada serviço que você quer usar. Nenhum deles é obrigatório isoladamente — basta um para continuar. Nenhum Client Secret é solicitado, aceito ou armazenado.',
    fieldLabel: 'Client ID',
    save: 'Salvar credencial',
    saved: 'Credencial de {service} salva neste dispositivo.',
    emptyError: 'Informe o Client ID antes de salvar.',
    noneSaved: 'Cadastre ao menos um Client ID para continuar.',
    reveal: 'Revelar credencial de {service}',
    hide: 'Ocultar credencial de {service}',
    maskedLabel: 'Credencial de {service} salva, exibida de forma mascarada',
    removeHeading: 'Remover credencial',
    remove: 'Remover credencial de {service}',
    removeHint:
      'Apaga o Client ID de {service} deste dispositivo. Não afeta o outro serviço nem o rascunho de trabalho.',
    removeConfirm: 'Remover a credencial de {service} salva neste dispositivo?',
    removed: 'Credencial de {service} removida deste dispositivo.',
    redirectUriHeading: 'Redirect URI a cadastrar',
    redirectUriHint:
      'Cadastre exatamente este endereço, com a barra final. A correspondência é exata, incluindo maiúsculas e minúsculas. Faltando a barra, a autorização é recusada com "redirect_uri_mismatch".',
    redirectUriLocalhostWarning:
      'As plataformas não aceitam http://localhost. Em desenvolvimento use o endereço IPv4 literal 127.0.0.1, como mostrado acima.',
    copyRedirectUri: 'Copiar Redirect URI',
    javascriptOriginHeading: 'Origem JavaScript autorizada',
    javascriptOriginHint:
      'Valor diferente do Redirect URI: este vai sem a barra final, em "Origens JavaScript autorizadas". Sem ele a autorização é recusada antes mesmo da tela de consentimento.',
    copyJavascriptOrigin: 'Copiar origem JavaScript',
  },

  // -------------------------------------------------------------------------
  // Etapa 2 — Destinos (US1, FR-008 a FR-012)
  // -------------------------------------------------------------------------

  destinations: {
    heading: 'Para onde vai a playlist?',
    intro:
      'Escolha um ou mais destinos. O texto, o nome e a visibilidade são informados uma vez só e valem para todos.',
    groupLabel: 'Serviços de destino',
    selectLabel: 'Criar no {service}',
    unavailableReason: 'Sem Client ID de {service} cadastrado.',
    unavailableAction: 'Cadastrar Client ID de {service}',
    lockedNotice:
      'A seleção foi travada quando a primeira criação começou. Para mudá-la, descarte o rascunho.',
    noneSelected: 'Selecione ao menos um destino para continuar.',
    orderNotice:
      'Quando você escolhe os dois, executamos um serviço de cada vez, sempre nesta ordem: {first}, depois {second}.',
    selectedCountOne: '1 destino selecionado',
    selectedCountOther: '{count} destinos selecionados',
  },

  // -------------------------------------------------------------------------
  // Conexão por serviço (FR-017, FR-036)
  // -------------------------------------------------------------------------

  connect: {
    heading: 'Conectar sua conta do {service}',
    intro: 'Você será levado ao {service} para autorizar. Nada é criado na sua conta nesta etapa.',
    connect: 'Conectar ao {service}',
    connecting: 'Redirecionando para o {service}…',
    disconnect: 'Desconectar do {service}',
    disconnected: 'Sessão do {service} encerrada. Sua credencial e seu rascunho foram preservados.',
    connectedAs: 'Conectado como',
    accountLabel: 'Conta conectada no {service}',
    needsCredential: 'Salve o Client ID do {service} antes de conectar.',
    reconnect: 'Reconectar ao {service}',
    reconnectNeeded:
      'Sua autorização do {service} expirou. Reconecte para continuar — seu trabalho foi mantido.',
    resumeAt: 'Ao reconectar, você volta para: {where}',

    // -----------------------------------------------------------------------
    // 004 — reconexão sem descartar o trabalho
    //
    // As três chaves acima já existiam desde a 002 e **nunca foram
    // renderizadas**: a perda de sessão no YouTube nem chegava a este caminho.
    // Reusá-las é a exigência de FR-033, e não gentileza — texto novo para a
    // mesma ideia produziria duas frases divergentes para o mesmo estado.
    // -----------------------------------------------------------------------

    /** Rótulos do ponto de retomada, consumidos por `resumeAt`. */
    resumePoint: {
      search: 'a busca das músicas',
      creating: 'a criação da playlist',
      connect: 'a conexão da conta',
    },

    reauthTitle: 'Reconecte o {service} para continuar',
    reauthPreserved: 'Nada do seu trabalho foi perdido.',
    reauthDismiss: 'Fechar sem reconectar',
    reauthStillPending:
      'O {service} continua aguardando reconexão. Você pode reconectar agora ou pular este serviço.',

    /** Progresso preservado, por fase de origem (`004/FR-009`, FR-028). */
    reauthSearchProgress: '{done} de {total} linhas já foram buscadas.',
    reauthCreationProgress: '{added} de {total} faixas já entraram na playlist.',

    /**
     * Custo da retomada — só em provedor com orçamento diário (C4). Calculado
     * sobre as linhas que **faltam**, nunca sobre a lista inteira (FR-013).
     */
    reauthCostOne: 'Retomar vai custar cerca de {units} unidades de cota, para 1 linha restante.',
    reauthCostOther:
      'Retomar vai custar cerca de {units} unidades de cota, para {count} linhas restantes.',
    reauthCostNone: 'Todas as linhas já foram buscadas. Retomar não consome cota.',

    /** Credencial removida com o pedido aberto (`004/FR-016a`, R5). */
    reauthNeedsCredential:
      'O Client ID do {service} não está mais salvo. Cadastre-o de novo para reconectar — seu trabalho continua guardado.',
    reauthGoToCredential: 'Cadastrar o Client ID',

    /** Reconexão a uma conta diferente durante a criação (`004/FR-031`). */
    reauthAccountChanged:
      'A playlist parcial foi criada em outra conta do {service}. A retomada não é possível nela, e este serviço será encerrado como parcial.',

    /** Estado de cada serviço no cabeçalho de contas (`004/US3`). */
    disconnectedState: 'Desconectado',
    accountsLabel: 'Contas dos serviços escolhidos',
    serviceStateLabel: '{service} · {state}',
  },

  // -------------------------------------------------------------------------
  // Etapa 3 — Entrada (compartilhada por todos os serviços)
  // -------------------------------------------------------------------------

  input: {
    heading: 'Cole sua lista',
    intro: 'Uma música por linha. Escrever o artista ajuda, mas não é obrigatório.',
    textareaLabel: 'Lista de músicas',
    placeholder:
      'Bohemian Rhapsody - Queen\nnao sei viver sem ter voce cpm 22\nGarota de Ipanema',
    // FR-006: o separador virou informação opcional, não condição de admissão.
    separatorsHint:
      'O separador é opcional. Separar com hífen (-), travessão (– —) ou a palavra "by" diz ao app onde termina o título e aumenta o acerto automático; sem ele, a linha inteira é pesquisada.',
    lineCountOne: '1 linha',
    lineCountOther: '{count} linhas',
    emptyHint: 'Cole ou digite pelo menos uma linha para continuar.',
    largeListWarning:
      'Sua lista tem {count} linhas. A busca pode levar vários minutos — o progresso fica visível e você pode cancelar a qualquer momento.',
    // US4/AC1: previsão de esforço antes de começar.
    manualEffortOne: '1 linha provavelmente vai exigir que você escolha entre as candidatas.',
    manualEffortOther:
      '{count} linhas provavelmente vão exigir que você escolha entre as candidatas.',
    manualEffortNone: 'Nenhuma linha deve exigir escolha manual.',
    search: 'Buscar correspondências',
    searching: 'Buscando…',
    start: 'Começar',
  },

  // -------------------------------------------------------------------------
  // Redução da lista para um destino posterior (FR-013)
  // -------------------------------------------------------------------------

  reduction: {
    heading: 'Ajustar a lista para o {service}',
    intro:
      'Você pode remover linhas antes de começar este destino. Não é possível acrescentar nem reordenar — os destinos posteriores sempre recebem um subconjunto do que veio antes.',
    listLabel: 'Linhas que irão para o {service}',
    removeLine: 'Remover "{line}"',
    restoreLine: 'Voltar "{line}" para a lista',
    remainingOne: '1 linha continua na lista',
    remainingOther: '{count} linhas continuam na lista',
    removedCountOne: '1 linha removida deste destino',
    removedCountOther: '{count} linhas removidas deste destino',
    emptyMeansSkip:
      'Sem nenhuma linha, este destino é pulado — nada será criado na sua conta do {service}.',
    fitHint: 'Cabem {count} linhas no saldo de hoje.',
    confirm: 'Usar esta lista',
    notASubset: 'Só é possível remover linhas, nunca acrescentar ou alterar.',
  },

  // -------------------------------------------------------------------------
  // Fila de execução (FR-018)
  // -------------------------------------------------------------------------

  queue: {
    label: 'Serviço em andamento',
    position: '{service} — {current} de {total}',
    phase: {
      connect: 'Conectando',
      estimate: 'Conferindo o orçamento',
      search: 'Buscando',
      review: 'Revisando',
      creating: 'Criando',
      // A execução está **parada**, não encerrada (`004/FR-002`).
      awaiting_reauth: 'Aguardando reconexão',
      done: 'Concluído',
      skipped: 'Pulado',
      failed: 'Falhou',
      pending: 'Aguardando',
    },
    skipService: 'Pular o {service}',
    skipConfirm:
      'Pular o {service}? O que já foi criado nos outros serviços continua intacto e será relatado.',
    endService: 'Encerrar este serviço',
    skipped: 'O {service} foi pulado. Nada foi criado na sua conta desse serviço.',

    // Confirmação do **único** caminho em que pular descarta trabalho: o último
    // destino de uma fila em que nada rodou (`006/FR-005`). Nos outros cinco
    // pontos de pulo não há diálogo (FR-012).
    //
    // Não confundir com `skipConfirm` acima, que existe desde a 002 e nunca foi
    // renderizado: aquele texto tranquiliza sobre o que já foi criado em outros
    // serviços — a mensagem do caso em que **algo rodou**, e é justamente nesse
    // caso que FR-012 proíbe confirmar.
    skipEndsFlowTitle: 'Pular o {service} encerra o fluxo',
    skipEndsFlowBody:
      'Este é o último serviço e nenhum outro foi concluído. Pular descarta a lista colada e a configuração da playlist.',
  },

  // -------------------------------------------------------------------------
  // Estimativa e bloqueio de cota (FR-029, FR-034, US4)
  // -------------------------------------------------------------------------

  quota: {
    heading: 'Orçamento diário do {service}',
    intro:
      'O {service} limita quanto um app pode consumir por dia. Antes de qualquer busca, mostramos o que esta lista deve custar.',
    estimateLabel: 'Consumo previsto',
    availableLabel: 'Saldo estimado de hoje',
    unit: 'unidades',
    fractionLabel: 'Isso é cerca de {percent}% do orçamento diário.',
    // FR-010: a reserva entra no número exibido, e o usuário sabe por quê.
    retryReserveLabel: 'Reserva para segunda tentativa',
    retryReserveNoneOne: 'Nenhuma das {total} linhas deve precisar de segunda busca.',
    retryReserveNoneOther: 'Nenhuma das {total} linhas deve precisar de segunda busca.',
    retryReserveOne:
      '1 das {total} linhas pode precisar de uma segunda busca, e o consumo previsto já a inclui. Se não for usada, a cota não é gasta.',
    retryReserveOther:
      '{count} das {total} linhas podem precisar de uma segunda busca, e o consumo previsto já as inclui. As que não forem usadas não gastam cota.',
    premise:
      'O cálculo parte sempre do orçamento padrão do serviço, menos o que este app já consumiu hoje neste dispositivo. Ampliar a cota junto ao {service} não altera este cálculo.',
    resetNotice: 'O orçamento é renovado à meia-noite no fuso do provedor.',
    proceed: 'Continuar e buscar',
    blockedHeading: 'Esta lista não cabe no saldo de hoje',
    blockedBody:
      'A busca consumiria cerca de {estimated} unidades e restam cerca de {available}. Nada foi enviado ao {service}.',
    blockedFits: 'Cabem {count} linhas no saldo de hoje.',
    blockedFitsNone: 'Nenhuma linha cabe no saldo de hoje.',
    reduceList: 'Reduzir a lista',
    skipDestination: 'Pular o {service}',
    exhaustedHeading: 'O orçamento do {service} acabou durante a criação',
    exhaustedBody:
      'A playlist "{name}" existe na sua conta com {added} de {total} itens. Paramos na hora — repetir a chamada não traria nada de volta.',
    exhaustedNextStep:
      'Você pode ampliar o orçamento no projeto que você criou no console do provedor, ou esperar a renovação diária e criar uma nova playlist com outro nome.',
    incompleteWarning:
      'A playlist ficou incompleta e **não** foi removida. Se você repetir com o mesmo nome, a checagem de nome duplicado vai bloquear — escolha outro nome.',
  },

  // -------------------------------------------------------------------------
  // Revisão (FR-019, FR-023 a FR-025)
  // -------------------------------------------------------------------------

  review: {
    heading: 'Confira as correspondências no {service}',
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
    channel: 'Canal',
    duration: 'Duração',
    coverAlt: 'Capa do álbum {album}',
    thumbnailAlt: 'Miniatura do vídeo {title}',
    noCover: 'Sem capa',
    openExternal: 'Abrir no {service}',
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
    editLinePropagates:
      'Corrigir o texto aqui corrige a linha para os serviços seguintes. A faixa escolhida, não — cada serviço tem a sua.',
    reSearch: 'Buscar esta linha de novo',
    selectedCount: '{selected} de {total} faixas selecionadas',
    summaryConfident: '{count} confiantes',
    summaryUncertain: '{count} incertas',
    summaryNotFound: '{count} não encontradas',
    progressLabel: 'Progresso da busca',
    progressCounting: '{done} de {total} linhas buscadas',
    progressWaiting: 'Aguardando o limite de requisições do {service}…',
    progressDone: 'Busca concluída: {done} de {total} linhas.',
    cancelSearch: 'Cancelar busca',
    searchCanceled: 'Busca cancelada. O que já foi encontrado foi mantido.',
    confirm: 'Confirmar e criar no {service}',
    status: {
      pending: 'Aguardando',
      searching: 'Buscando',
      confident: 'Confiante',
      uncertain: 'Incerta',
      notFound: 'Não encontrada',
      unparsed: 'Sem conteúdo para buscar',
      discarded: 'Descartada',
      duplicate: 'Duplicata',
      error: 'Falha na busca',
    },
    statusHint: {
      confident: 'Correspondência forte. Já marcada para entrar na playlist.',
      uncertain: 'Confirme visualmente antes de incluir.',
      notFound: 'Nenhuma faixa suficientemente parecida. Edite a linha e tente de novo.',
      // `003/FR-004`: a linha só é inválida quando não tem nada pesquisável.
      unparsed: 'Esta linha não tem letras nem números para buscar. Escreva o nome da música.',
      duplicate: 'Repetida na sua lista. Desmarcada para não duplicar na playlist.',
      versionHint: 'Pode ser outra versão da faixa. Confirme antes de incluir.',
    },

    /**
     * Por que o item pede atenção (`003/FR-017`).
     *
     * O par mais importante é `notFound` × `retrySkippedQuota`: o primeiro pede
     * que o usuário corrija o texto, o segundo diz que o texto pode estar certo
     * e foi o app que desistiu. Apresentar um como o outro faria o usuário
     * reescrever uma linha correta.
     */
    attentionReason: {
      label: 'Por que pede atenção',
      noArtistAmbiguous:
        'Sua linha não diz o artista, e mais de uma gravação combina igualmente bem. Escolha entre as candidatas ou acrescente o artista à linha.',
      versionHint:
        'A candidata escolhida parece ser outra versão da gravação. Confira antes de incluir.',
      notFound: 'Nenhuma candidata suficientemente parecida. Edite a linha e busque de novo.',
      retrySkippedQuota:
        'A primeira busca não trouxe nada e a reserva de cota do dia acabou — não houve segunda tentativa. Sua linha pode estar correta: tente de novo amanhã ou busque só esta linha.',
    },
  },

  /** Indícios de versão diferente (FR-025). Marcador visível na revisão. */
  versionHints: {
    badgeLabel: 'Possível outra versão',
    badgeLabelFor: 'Possível outra versão: {hints}',
    live: 'ao vivo',
    cover: 'cover',
    remix: 'remix',
    acoustic: 'acústico',
    karaoke: 'karaokê',
    instrumental: 'instrumental',
    sped_up: 'acelerado',
    slowed: 'desacelerado',
    nightcore: 'nightcore',
    mashup: 'mashup',
    tribute: 'tributo',
    remaster: 'remasterizado',
    excerpt: 'trecho',
    reaction: 'reação',
    duration_outlier: 'duração destoante',
  },

  playlistConfig: {
    heading: 'Dados da playlist',
    nameLabel: 'Nome da playlist',
    namePlaceholder: 'Ex.: Clássicos do rock',
    nameRequired: 'O nome da playlist é obrigatório.',
    nameOnlySpaces: 'O nome não pode conter apenas espaços.',
    nameDuplicate: 'Você já tem uma playlist com esse nome no {service}. Escolha outro.',
    nameDuplicateScope:
      'A checagem vale só para este serviço — o nome usado em outro destino não interfere.',
    descriptionLabel: 'Descrição',
    descriptionPlaceholder: 'Opcional',
    visibilityLabel: 'Visibilidade',
    visibilityPrivate: 'Privada',
    visibilityPublic: 'Pública',
    visibilityHint: 'Playlists privadas ficam visíveis apenas para você.',
    noTracksSelected: 'Selecione ao menos uma faixa para criar a playlist.',
    checkingNames: 'Verificando se o nome já existe no {service}…',
    create: 'Criar playlist no {service}',
    creating: 'Criando playlist no {service}…',
    confirmHeading: 'Confirmar criação no {service}',
    confirmBody: '{count} faixas serão adicionadas a "{name}", nesta ordem.',
    pathPreview: 'A playlist será criada em:',
  },

  result: {
    heading: 'Playlist criada no {service}',
    playlistName: 'Nome',
    added: 'Itens adicionados',
    skipped: 'Itens ignorados',
    skippedHint: 'Somamos aqui as descartadas, as duplicatas e as não incluídas.',
    openPlaylist: 'Abrir a playlist',
    effectivePath: 'Caminho da playlist',
    accountNotice: 'Criada na conta {account}.',
    folderNoticeHeading: 'Sobre pastas',
    failedHeading: 'Linhas sem correspondência no {service}',
    failedHint: 'Estas linhas não entraram na playlist, na ordem original da sua lista.',
    copyFailed: 'Copiar linhas que falharam no {service}',
    startOver: 'Começar uma nova playlist',
    continueNext: 'Continuar para o {service}',
    adjustList: 'Ajustar a lista antes de continuar',
    partialHeading: 'A criação parou no meio',
    partialBody:
      '{added} de {total} itens já foram adicionados a "{name}". Você pode continuar de onde parou — os já adicionados não serão repetidos.',
    retryRemaining: 'Adicionar os itens restantes',
    retryingRemaining: 'Adicionando os itens restantes…',
    creationProgress: '{current} de {total} itens',
  },

  // -------------------------------------------------------------------------
  // Etapa 5 — Resumo consolidado (US3, FR-040, FR-041)
  // -------------------------------------------------------------------------

  summary: {
    heading: 'Resumo',
    intro: 'O que aconteceu em cada serviço.',
    listLabel: 'Resultado por serviço',
    outcome: {
      completed: 'Concluído',
      partial: 'Parcial',
      failed: 'Falhou',
      skipped: 'Pulado',
    },
    outcomeHint: {
      completed: 'A playlist foi criada e todos os itens confirmados entraram.',
      partial: 'A playlist existe na sua conta, mas faltou item confirmado.',
      failed: 'Nenhuma playlist foi criada neste serviço.',
      skipped: 'Você encerrou este serviço antes de confirmar a criação.',
    },
    accountLabel: 'Conta',
    linesUsedOne: '1 linha enviada',
    linesUsedOther: '{count} linhas enviadas',
    divergedHeading: 'Os destinos receberam listas diferentes',
    divergedBody:
      'Você ajustou a lista entre os serviços. Cada resultado acima vale para a lista que aquele serviço recebeu — o relato de um serviço concluído nunca é reescrito.',
    removedForLater: 'Linhas removidas para os destinos posteriores',
    copyFailedFor: 'Copiar linhas que falharam no {service}',
    startOver: 'Começar uma nova playlist',
  },

  draft: {
    recoveredHeading: 'Recuperamos um trabalho em andamento',
    recoveredBody: 'Salvo em {when}. Você pode continuar de onde parou ou começar do zero.',
    resumeAt: 'Você volta para: {where}',
    continue: 'Continuar de onde parei',
    discard: 'Descartar rascunho',
    discardConfirm: 'Descartar o trabalho salvo? As credenciais salvas serão preservadas.',
    discarded: 'Rascunho descartado. Suas credenciais foram preservadas.',
    quotaWarning:
      'Não foi possível salvar o rascunho neste dispositivo: o armazenamento local está cheio. O trabalho continua na memória, mas será perdido se a página for recarregada.',
    quotaDegraded:
      'O armazenamento local está quase cheio. Salvamos o rascunho sem as candidatas alternativas.',
    quotaDegradedFinished:
      'O armazenamento local está cheio. Mantivemos o essencial e descartamos as candidatas alternativas dos serviços já concluídos — o resultado deles continua íntegro.',
    corrupted: 'O rascunho salvo estava ilegível e foi descartado. Começamos do zero.',
    migrated: 'Recuperamos um trabalho salvo antes dos destinos múltiplos.',
    unknownVersion:
      'O rascunho salvo veio de uma versão diferente do aplicativo e foi descartado por segurança.',
    keptAfterQuota:
      'O rascunho foi preservado. Você pode consultar o relato acima e descartá-lo quando quiser — não há retomada depois que o orçamento do dia acaba.',
  },

  // -------------------------------------------------------------------------
  // Recomeço do fluxo (`006/US3`, US4) e o que sobrevive a um descarte
  // -------------------------------------------------------------------------

  flow: {
    reset: 'Recomeçar',
    resetTitle: 'Recomeçar do zero?',
    resetBody: 'A lista colada, as correções e a configuração da playlist serão descartadas.',
    /**
     * `resetKeeps` é compartilhado com a confirmação de pular que encerra o
     * fluxo (`006/ui-contract §3`): o que é preservado é literalmente o mesmo
     * conjunto, e duas redações do mesmo fato divergiriam com o tempo.
     */
    resetKeeps: 'Suas credenciais e as contas conectadas continuam salvas.',
    resetKeepsPlaylist:
      'As playlists já criadas permanecem nas suas contas — nada é removido de lá.',
    resetConfirm: 'Descartar e recomeçar',
  },

  errors: {
    authInvalidClient: {
      title: 'Não foi possível autorizar com esse Client ID',
      cause: 'O Client ID do {service} está incorreto ou o app não existe mais no painel.',
      nextStep: 'Volte à configuração e confira o valor copiado do painel do seu app.',
    },
    authRedirectUriMismatch: {
      title: 'O Redirect URI não está cadastrado',
      cause:
        'O endereço de retorno usado por este app não consta na lista do seu app no painel do {service}.',
      nextStep:
        'Volte à configuração, copie o Redirect URI pelo botão de copiar e cole-o no painel do seu app. Confira a barra final: o Redirect URI termina em barra, a origem JavaScript não — trocar um pelo outro é a causa mais comum deste erro.',
    },
    authAccessDenied: {
      title: 'A autorização foi recusada',
      cause:
        'O consentimento foi negado — ou seu app está em modo de teste e esta conta não está na lista de usuários permitidos do {service}.',
      nextStep:
        'Tente conectar de novo e aceite o consentimento. Se o app estiver em modo de teste, adicione sua conta como usuário de teste no painel do provedor.',
    },
    authStateMismatch: {
      title: 'O retorno da autorização não pôde ser validado',
      cause:
        'A resposta devolvida não corresponde ao pedido feito por esta aba — pode ter vindo de outra janela ou de um link antigo.',
      nextStep: 'Inicie a conexão novamente a partir desta página.',
    },
    authInvalidGrant: {
      title: 'O código de autorização expirou',
      cause: 'Códigos de autorização valem por pouco tempo e só podem ser usados uma vez.',
      nextStep: 'Clique em conectar para iniciar uma nova autorização.',
    },
    authNotVerified: {
      title: 'O app não é verificado pelo provedor',
      cause:
        'Seu app do {service} está em modo de teste: a tela de consentimento avisa que ele não é verificado e só aceita contas na lista de testadores do seu projeto.',
      nextStep:
        'No painel do provedor, adicione como usuário de teste exatamente a conta com que você está autorizando — ela não entra na lista sozinha, nem quando é a dona do projeto. Depois autorize de novo.',
    },
    authGeneric: {
      title: 'A autorização falhou',
      cause: 'O {service} recusou o pedido de autorização.',
      nextStep: 'Confira o Client ID e o Redirect URI cadastrados e tente de novo.',
    },
    sessionExpired: {
      title: 'Sua sessão do {service} expirou',
      cause: 'A autorização de acesso venceu e não foi possível renová-la automaticamente.',
      nextStep: 'Reconecte sua conta. Seu texto, o nome da playlist e a revisão foram preservados.',
    },
    reauthRequired: {
      title: 'Autorize o {service} de novo para continuar',
      cause:
        'A autorização do {service} vale cerca de uma hora e não pode ser renovada em silêncio por um app sem servidor. Isso é limitação da plataforma, não falha.',
      nextStep:
        'Clique em reconectar. Nenhuma decisão da revisão foi perdida — você volta exatamente para onde parou.',
    },
    quotaExhausted: {
      title: 'O orçamento diário do {service} acabou',
      cause:
        'O {service} recusou a operação por esgotamento da cota diária do seu projeto. Repetir agora não mudaria a resposta.',
      nextStep:
        'Encerramos este serviço sem repetir. Amplie o orçamento no projeto que você criou no console do provedor ou espere a renovação diária.',
    },
    forbidden: {
      title: 'Permissão insuficiente no {service}',
      cause: 'A autorização concedida não cobre esta operação.',
      nextStep: 'Desconecte e conecte de novo, aceitando todas as permissões pedidas.',
    },
    notFound: {
      title: 'Recurso não encontrado no {service}',
      cause: 'O item solicitado não existe mais ou não pertence a esta conta.',
      nextStep: 'Recarregue a página e tente novamente.',
    },
    rateLimited: {
      title: 'O {service} limitou as requisições',
      cause: 'Muitas requisições em pouco tempo. O serviço pediu uma pausa.',
      nextStep: 'Aguardamos automaticamente e continuamos. Você pode cancelar a qualquer momento.',
    },
    serverError: {
      title: 'O {service} respondeu com um erro',
      cause: 'Falha temporária no serviço do {service}.',
      nextStep: 'Tentamos algumas vezes automaticamente. Se persistir, tente de novo em instantes.',
    },
    offline: {
      title: 'Sem conexão com a internet',
      cause: 'Não foi possível alcançar o {service} a partir deste dispositivo.',
      nextStep: 'Verifique sua conexão e repita a operação — seu trabalho foi preservado.',
    },
    network: {
      title: 'Falha de rede',
      cause: 'A requisição não chegou ao {service}.',
      nextStep: 'Verifique sua conexão e tente novamente.',
    },
    playlistListFailed: {
      title: 'Não foi possível verificar seus nomes de playlist no {service}',
      cause:
        'A consulta às playlists existentes falhou, e sem ela não dá para checar nome repetido.',
      nextStep: 'Tente novamente. A playlist não será criada sem essa verificação.',
    },
    createPlaylistFailed: {
      title: 'Não foi possível criar a playlist no {service}',
      cause: 'O {service} recusou a criação da playlist.',
      nextStep: 'Tente novamente em instantes. Nada foi criado nessa conta.',
    },
    addItemsFailed: {
      title: 'A adição de itens no {service} foi interrompida',
      cause: 'Um item não pôde ser enviado ao {service}.',
      nextStep:
        'Use "Adicionar os itens restantes": os já adicionados não serão repetidos e nenhuma segunda playlist será criada.',
    },
    searchLineFailed: {
      title: 'Não foi possível buscar esta linha no {service}',
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

/**
 * Une nomes em linguagem natural: `a`, `a e b`, `a, b e c`.
 *
 * Vive aqui, junto do dicionário, porque a conjunção é texto de interface — e
 * porque `Intl.ListFormat` resolveria isto sozinho mas traria consigo a escolha
 * de locale em tempo de execução, que este projeto não tem (idioma único,
 * declarado). A vírgula e o "e" são literais deste módulo, não dos chamadores.
 */
export function listAnd(items: readonly string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0] ?? '';
  const inicio = items.slice(0, -1).join(', ');
  return `${inicio} ${t.common.and} ${items[items.length - 1] ?? ''}`;
}
