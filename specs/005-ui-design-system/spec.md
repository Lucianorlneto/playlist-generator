# Feature Specification: Identidade Visual e Sistema de Design

**Feature Branch**: `refactor/ui`

**Created**: 2026-08-07

**Status**: Draft

**Input**: User description: "Vamos retrabalhar a UI da aplicação. Está muito genérica e sem personalidade. Adicionei novas skills que talvez ajudem com esse trabalho. Queremos algo com escolha entre tema claro e escuro onde o temo escuro terá tons pretos/azul marinhoa com laranja/amarelo. O tema claro fica a seu critério. Deve ser contruído um guideline e definidas as cores primárias e secundários assim como um design system para os componentes. Buscamos algo mais moderno, porém sem muita complexidade, pois deve continuar sendo de fácil utilização do usuário."

## Clarifications

### Session 2026-08-07

- Q: Qual composição de temas do `theme-factory` deve semear as duas paletas? → A: Ocean Depths + Golden Hour — substrato preto-azulado `#1a2332` (Ocean Depths) com primária mostarda-âmbar `#f4a900` (Golden Hour); o teal de origem do Ocean Depths e o marrom-chocolate do Golden Hour são descartados, e a secundária deriva do mesmo matiz da primária em tom mais profundo.
- Q: A aplicação herda também o par tipográfico DejaVu Sans / FreeSans que o `theme-factory` define para esses temas? → A: Não. A tipografia é escolhida à parte: **Space Grotesk**, fonte variável, família única para títulos e texto. As fontes do `theme-factory` existem por segurança de renderização em PDF, não por caráter, e adotá-las contrariaria o objetivo da feature.
- Q: O âmbar é a cor das ações primárias ou fica reservado a destaque? → A: É a cor da ação primária — botão primário com preenchimento âmbar e texto quase-preto, nos dois temas. Texto claro sobre âmbar é proibido (razão de 2,0:1).
- Q: O que acontece com as cores de estado confiante / incerto / não encontrado agora que o âmbar virou cor de ação? → A: A colisão é resolvida por forma, não por matiz — preenchimento sólido passa a significar "clicável" e selos de estado usam sempre fundo tingido + texto colorido + ícone. "Confiante" migra do verde órfão para o teal do Ocean Depths, "Incerto" permanece na família âmbar e "Não encontrado" permanece vermelho.
- Q: Que caráter deve ter o tema claro? → A: Papel quente — fundo off-white com traço mínimo de bege muito dessaturado, tinta marinho profundo e variante escurecida do âmbar para texto, link, borda e anel de foco.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Escolher entre tema claro e escuro (Priority: P1)

Quem abre o aplicativo vê, já no primeiro quadro renderizado, o tema que corresponde à preferência do próprio sistema operacional. Um controle visível e sempre acessível no topo permite trocar para o outro tema a qualquer momento, sem recarregar a página e sem perder o trabalho em andamento. A escolha feita manualmente é lembrada nas próximas visitas; quem nunca escolheu continua acompanhando a preferência do sistema.

**Why this priority**: é a única parte do pedido que muda o que o usuário **pode fazer**, e não apenas como as coisas parecem. É também a fundação das demais: definir as duas paletas obriga a fixar cores primárias, secundárias e de estado antes de qualquer componente ser redesenhado. Entregue sozinha, já resolve a queixa de conforto visual em ambiente escuro.

**Independent Test**: pode ser testada isoladamente abrindo a aplicação com a preferência do sistema em escuro e em claro, acionando o controle de tema em cada etapa do assistente, recarregando a página e confirmando que a escolha persiste — tudo isso antes de qualquer componente ser redesenhado.

**Acceptance Scenarios**:

1. **Given** um visitante que nunca escolheu tema e cujo sistema operacional está em modo escuro, **When** ele abre a aplicação, **Then** o tema escuro já está aplicado no primeiro quadro exibido, sem qualquer piscada de tema claro.
2. **Given** a aplicação exibida em tema claro, **When** o usuário aciona o controle de tema, **Then** toda a interface passa a tema escuro imediatamente, sem recarregar a página, sem alterar a etapa atual e sem perder dados já digitados.
3. **Given** um usuário que escolheu manualmente o tema claro, **When** ele fecha o navegador e retorna depois, **Then** a aplicação abre em tema claro mesmo que o sistema operacional esteja em modo escuro.
4. **Given** um usuário que nunca escolheu tema, **When** ele altera a preferência do sistema operacional com a aplicação aberta, **Then** a interface acompanha a mudança automaticamente.
5. **Given** um usuário navegando apenas pelo teclado, **When** ele percorre os elementos focáveis da página, **Then** o controle de tema recebe foco visível, é acionável por teclado e anuncia o estado atual a leitor de tela.
6. **Given** o armazenamento do navegador indisponível (janela anônima restritiva), **When** o usuário troca de tema, **Then** a troca funciona normalmente na sessão atual e nenhuma mensagem de erro é exibida.

---

### User Story 2 - Interface com personalidade própria e coerente (Priority: P2)

Quem usa o aplicativo percebe uma identidade visual reconhecível e deliberada — não um formulário genérico. Tipografia, espaçamento, hierarquia, cantos, profundidade e cor seguem um vocabulário único aplicado igualmente às cinco etapas do assistente. Os elementos que carregam significado — estados de correspondência, avisos, erros, progresso — continuam legíveis à primeira vista e distinguíveis por mais do que apenas cor.

**Why this priority**: é o coração do pedido ("muito genérica e sem personalidade"), mas depende das paletas e tokens estabelecidos na P1. Entregue depois da P1, transforma um tema funcional em uma identidade.

**Independent Test**: pode ser testada percorrendo o fluxo completo nas duas paletas e verificando, tela a tela, que nenhum elemento visual escapa do vocabulário definido — sem depender de o guia escrito existir.

**Acceptance Scenarios**:

1. **Given** o fluxo completo do assistente, **When** um avaliador percorre as cinco etapas em cada tema, **Then** todos os botões, campos, cartões, selos, diálogos e mensagens usam exclusivamente as cores, tipos, espaçamentos e raios definidos pelo sistema — nenhum valor visual avulso.
2. **Given** a etapa de revisão com correspondências confiantes, incertas e não encontradas, **When** exibida em qualquer um dos temas, **Then** os três estados permanecem distinguíveis entre si por rótulo textual e forma, além da cor.
3. **Given** qualquer etapa do assistente, **When** auditada por ferramenta automatizada de acessibilidade em ambos os temas, **Then** nenhuma violação séria ou crítica é reportada.
4. **Given** uma tela estreita de telefone, **When** o usuário percorre o fluxo completo em ambos os temas, **Then** nenhuma rolagem horizontal da página ocorre e todos os alvos de toque permanecem acionáveis.
5. **Given** um usuário com preferência de movimento reduzido ativada no sistema, **When** ele navega pela aplicação, **Then** transições e animações decorativas são suprimidas, sem perda de informação.
6. **Given** o fluxo completo, **When** comparado ao comportamento anterior à mudança, **Then** nenhuma etapa, clique ou decisão adicional foi introduzida para concluir as mesmas tarefas.

---

### User Story 3 - Guia de estilo como referência do projeto (Priority: P3)

Quem for evoluir a aplicação — hoje ou daqui a seis meses — consulta um documento único que declara as cores primárias e secundárias, os papéis de cada cor, a escala tipográfica, a escala de espaçamento, os raios, os estados de interação e a anatomia de cada componente do sistema, nos dois temas. Decisões novas de interface se resolvem por consulta ao guia, não por improviso.

**Why this priority**: é o que impede a interface de voltar a divergir com o tempo, mas não altera nada que o usuário final veja. Entregável de manutenção, valioso e posterior.

**Independent Test**: pode ser testada pedindo a alguém que não participou da implementação para descrever, só com o guia em mãos, como deve ser um botão primário desabilitado no tema escuro — e conferindo com o que existe na aplicação.

**Acceptance Scenarios**:

1. **Given** o guia publicado, **When** um leitor procura por qualquer componente presente na aplicação, **Then** encontra sua definição visual, seus estados (repouso, foco, hover, ativo, desabilitado, erro) e quando usá-lo.
2. **Given** o guia publicado, **When** um leitor procura por uma cor da paleta, **Then** encontra seu papel semântico declarado e as combinações de texto e fundo aprovadas para ela.
3. **Given** uma mudança futura na paleta, **When** o valor é alterado no ponto único de definição, **Then** a mudança se propaga a todos os componentes sem edição individual.

---

### Edge Cases

- **Carga inicial**: qual tema aparece antes de a aplicação terminar de carregar? Nenhuma piscada de tema incorreto é aceitável — o tema correto MUST estar aplicado no primeiro quadro pintado.
- **Preferência armazenada corrompida ou de formato desconhecido**: o valor é descartado silenciosamente e a preferência do sistema volta a valer; nenhuma tela de erro é exibida.
- **Armazenamento indisponível ou cheio**: a troca de tema continua funcionando na sessão atual e nenhum aviso é dirigido ao usuário por causa disso.
- **Preferência do sistema muda com a aplicação aberta**: acompanha se o usuário nunca escolheu manualmente; ignora se ele já escolheu.
- **Troca de tema durante operação em andamento** (busca em execução, criação de playlist em lotes, espera por limitação de taxa): a operação não é interrompida, cancelada nem reiniciada.
- **Capas de álbum e miniaturas vindas dos serviços**: são imagens de terceiros, com cores arbitrárias — precisam de tratamento que garanta contorno e separação visível contra o fundo escuro e contra o claro.
- **Impressão ou captura de tela**: fora de escopo; nenhuma folha de estilo específica para impressão será criada.
- **Modo de alto contraste ou cores forçadas do sistema operacional**: a interface permanece utilizável, com foco visível e estados distinguíveis, mesmo quando as cores da paleta são substituídas pelo sistema.
- **Textos longos e traduções extensas** (nomes de faixa e artista muito longos): quebram sem estourar o contêiner nem gerar rolagem horizontal.
- **Fonte própria ainda não carregada ou indisponível**: a interface aparece imediatamente com substituta nativa de métrica compatível; ao concluir a carga, nenhum texto muda de linha ou de altura.
- **Caractere fora do subconjunto embarcado** (nome de faixa com alfabeto não latino): a substituta nativa cobre o caractere; nada aparece como caixa vazia.

## Requirements _(mandatory)_

### Funcionais — Tema e paletas

- **FR-001**: O sistema MUST oferecer exatamente dois temas visuais completos — claro e escuro — cobrindo todas as telas, componentes e estados existentes.
- **FR-002**: O tema escuro MUST ser construído sobre fundos em tons de preto e azul-marinho, com laranja e amarelo como cores de destaque.
- **FR-003**: Os dois temas MUST compartilhar a mesma cor primária e a mesma família de tinta, de modo que sejam reconhecíveis como o mesmo produto e não como dois produtos diferentes. O substrato — fundo e superfícies — MAY divergir em temperatura entre os temas: é a primária e a tinta que carregam a identidade, não a temperatura do fundo. Coerência entre os temas MUST ser verificada por essas duas âncoras, não por proximidade de matiz dos fundos.
- **FR-041**: As duas paletas MUST ser semeadas pela composição **Ocean Depths + Golden Hour** do catálogo de temas do projeto: substrato preto-azulado `#1a2332` e primária mostarda-âmbar `#f4a900`. O teal do Ocean Depths e o marrom-chocolate do Golden Hour MUST NOT ser adotados; a cor secundária MUST derivar do mesmo matiz da primária, em tom mais profundo, e não de um terceiro tema.
- **FR-042**: As cores semente são **ponto de partida cromático, não valores finais**: cada token MUST ter seu valor ajustado até satisfazer os limites de contraste de SC-001, e o valor ajustado — não o hex de origem — é o normativo.
- **FR-049**: O tema claro MUST usar como substrato um off-white com traço mínimo de bege dessaturado, tinta em marinho profundo, e MUST NOT recorrer a branco puro com cinzas neutros como base.
- **FR-050**: Em ambos os temas, o âmbar em cheia saturação MUST ser usado apenas como preenchimento com texto escuro. Para texto, link, borda e anel de foco, o sistema MUST definir uma variante escurecida do mesmo matiz que atinja os limites de SC-001 sobre a superfície em que aparece.
- **FR-004**: O sistema MUST declarar um conjunto nomeado de cores com papel semântico explícito — primária, secundária, superfícies, texto, bordas, e os estados de sucesso, atenção, erro e neutro — e cada componente MUST consumir esses nomes, nunca valores de cor avulsos.
- **FR-045**: A cor primária âmbar MUST ser a cor das ações primárias: o botão primário MUST ser um preenchimento âmbar sólido com texto quase-preto, em ambos os temas.
- **FR-046**: Texto claro sobre preenchimento âmbar MUST NOT existir em nenhum componente. O par atinge razão de 2,0:1 e nenhum ajuste de tom o salva sem descaracterizar a cor.
- **FR-005**: O sistema MUST aplicar, na ausência de escolha manual do usuário, o tema correspondente à preferência declarada pelo sistema operacional.
- **FR-006**: Usuários MUST ser capazes de alternar entre os dois temas por um controle visível e disponível em todas as etapas do fluxo.
- **FR-007**: A troca de tema MUST ser aplicada imediatamente, sem recarregar a página, sem alterar a etapa atual e sem descartar dados já informados ou trabalho em andamento.
- **FR-008**: O sistema MUST preservar a escolha manual de tema entre sessões do navegador, e MUST voltar a acompanhar a preferência do sistema quando o usuário nunca escolheu.
- **FR-009**: Enquanto não houver escolha manual, o sistema MUST reagir a mudanças na preferência do sistema operacional ocorridas com a aplicação já aberta.
- **FR-010**: O tema correto MUST estar aplicado no primeiro quadro renderizado da página, sem exibição transitória do tema oposto.
- **FR-011**: Falha, indisponibilidade ou conteúdo inválido no armazenamento da preferência MUST resultar em retorno silencioso à preferência do sistema, sem mensagem de erro e sem quebrar a aplicação.
- **FR-012**: A preferência de tema MUST ser armazenada sob chave versionada e tipada, isolada das credenciais, sessões e rascunhos, e MUST NOT conter qualquer dado pessoal, token ou credencial.
- **FR-013**: Remover a preferência de tema MUST NOT afetar credenciais, sessões ou rascunhos; remover credenciais, sessões ou rascunhos MUST NOT afetar a preferência de tema.

### Funcionais — Sistema de componentes

- **FR-014**: O sistema MUST definir escalas discretas e finitas para tipografia, espaçamento, raio de canto e profundidade, e todo componente MUST usar apenas valores dessas escalas.
- **FR-015**: Todo componente reutilizável existente na aplicação MUST ter definição visual explícita para os estados de repouso, foco por teclado, hover, ativo, desabilitado e — quando aplicável — erro e carregando.
- **FR-016**: O indicador de foco por teclado MUST ser visível e atender ao contraste mínimo contra o fundo adjacente em ambos os temas, em todos os elementos interativos.
- **FR-017**: Informação MUST NOT ser transmitida apenas por cor: todo estado com significado — correspondência confiante, incerta ou não encontrada, aviso, erro, sucesso — MUST ser acompanhado de rótulo textual, ícone ou forma distinta.
- **FR-047**: Preenchimento sólido de cor MUST significar "elemento acionável". Selos e indicadores de estado MUST NOT usar preenchimento sólido: sua anatomia é fundo tingido de baixa saturação + texto na cor do estado + ícone. É essa separação por forma — não uma diferença de matiz — que impede o selo "Incerto" de ser confundido com um botão primário.
- **FR-048**: O estado "confiante" MUST migrar do verde atual para o teal da família cromática de origem; "incerto" MUST permanecer na família âmbar; "não encontrado" MUST permanecer vermelho, por ser a única convenção universal do trio.
- **FR-018**: A hierarquia visual de cada tela MUST tornar evidente, sem leitura completa, qual é a ação principal daquela etapa e qual é o conteúdo secundário.
- **FR-019**: O sistema MUST NOT introduzir etapa, clique, rolagem ou decisão adicional para concluir qualquer tarefa que já era possível antes da mudança.
- **FR-020**: O sistema MUST respeitar a preferência de movimento reduzido do sistema operacional, suprimindo transições e animações decorativas sem perda de informação.
- **FR-021**: Imagens vindas dos serviços de música MUST receber tratamento visual que garanta separação e contorno perceptíveis contra o fundo, nos dois temas.
- **FR-022**: Todo texto visível introduzido ou alterado por esta mudança MUST vir do catálogo único de textos da aplicação, em pt-BR.
- **FR-023**: A interface MUST permanecer utilizável em telas estreitas, sem rolagem horizontal da página, em ambos os temas.
- **FR-024**: A modernização visual MUST NOT depender da introdução de biblioteca externa de componentes de interface.

### Funcionais — Guia de estilo

- **FR-025**: O projeto MUST publicar um guia de estilo escrito, versionado junto ao código, declarando paleta com papéis semânticos, escala tipográfica, escala de espaçamento, raios, profundidade, estados de interação e regras de acessibilidade.
- **FR-026**: O guia MUST documentar cada componente reutilizável da aplicação: para que serve, quando usar, quando não usar, e todos os seus estados nos dois temas.
- **FR-027**: O guia MUST declarar, para cada cor de texto, as superfícies sobre as quais seu uso é aprovado, com a razão de contraste correspondente.
- **FR-028**: A definição de cada valor visual MUST existir em um único lugar, de forma que uma mudança de paleta se propague a todos os componentes sem edição individual.
- **FR-029**: O guia MUST ser um documento escrito, versionado no repositório junto ao código. Nenhuma página de galeria de componentes é criada dentro da aplicação, nem no artefato publicado nem em desenvolvimento.
- **FR-036**: O guia MUST declarar explicitamente que a definição normativa de cada valor visual é o ponto único de definição no código, e que o documento descreve esses valores — para que uma divergência entre os dois seja resolvida corrigindo o documento, nunca duplicando o valor.

### Funcionais — Verificação

- **FR-030**: A conformidade de contraste de todos os pares aprovados de texto e superfície, nos dois temas, MUST ser verificada automaticamente, falhando a construção quando um par violar o mínimo exigido.
- **FR-031**: A auditoria automatizada de acessibilidade existente MUST ser executada em ambos os temas, em todas as etapas do assistente.
- **FR-032**: A persistência, a restauração e o retorno à preferência do sistema MUST ter verificação automatizada, incluindo o caso de armazenamento indisponível ou corrompido.
- **FR-039**: A ausência de qualquer origem remota — fonte tipográfica, folha de estilo, ícone ou imagem — MUST ser verificada automaticamente sobre o artefato construído, falhando a construção quando uma referência externa aparecer.
- **FR-040**: A ausência de valores visuais avulsos nos componentes e telas MUST ser verificada automaticamente, de modo que um valor de cor, tamanho, espaçamento ou raio fora das escalas nomeadas falhe a construção.

### Escopo de alteração

- **FR-033**: A estrutura interna de cada tela — agrupamento de elementos, ordem visual, densidade e tipo de arranjo — MAY ser reorganizada em nome da hierarquia e da identidade, desde que preservados o conjunto de ações disponíveis, a ordem lógica de leitura e a ordem de navegação por teclado de cada etapa.
- **FR-034**: A aplicação MUST adotar **Space Grotesk** como família tipográfica única, em formato variável, servindo títulos e texto corrido. A fonte MUST ser distribuída embarcada no próprio artefato estático, reduzida aos caracteres efetivamente usados pela interface em pt-BR, e MUST NOT ser carregada de qualquer origem remota. Sua licença MUST permitir redistribuição junto ao aplicativo.
- **FR-043**: O par tipográfico prescrito pelos temas de origem (DejaVu Sans / FreeSans) MUST NOT ser adotado. Do catálogo de temas herdam-se as cores, não as fontes — as fontes de lá existem por segurança de renderização em documento, não por caráter.
- **FR-044**: A escala tipográfica MUST compensar as características da família escolhida nas telas densas: em listas de faixas e na grade de revisão, entrelinha e tamanho mínimo MUST ser definidos de modo que nenhuma linha de nome de faixa ou artista fique menos legível do que na tipografia atual.
- **FR-035**: O fluxo de cinco etapas, as regras de negócio, os textos existentes e o comportamento funcional da aplicação MUST permanecer inalterados por esta mudança.
- **FR-037**: Enquanto a fonte própria não estiver disponível — carga em andamento ou arquivo indisponível —, a interface MUST permanecer legível e sem deslocamento perceptível de conteúdo, usando substituta nativa de métrica compatível.
- **FR-038**: Nenhuma etapa do assistente MUST ser fundida, dividida, removida ou reordenada.

### Key Entities

- **Token de design**: um valor visual nomeado com papel semântico declarado (cor, tamanho de texto, espaçamento, raio, profundidade). Possui um valor por tema e é a única origem daquele valor em toda a aplicação.
- **Tema**: conjunto completo e coerente de valores para todos os tokens de cor. Existem exatamente dois: claro e escuro.
- **Preferência de tema**: escolha do usuário entre "claro", "escuro" ou "acompanhar o sistema". Persiste entre sessões, é isolada dos demais dados armazenados e não contém dado pessoal.
- **Componente do sistema**: elemento de interface reutilizável com anatomia, variantes e estados definidos — botão, campo de texto, área de texto, alternador, diálogo, cartão, selo de estado, cabeçalho de etapa, indicador de progresso, faixa de aviso.
- **Guia de estilo**: documento de referência que descreve tokens, componentes, estados e regras de uso, e serve de árbitro para decisões visuais futuras.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% dos pares aprovados de texto sobre superfície atingem, em ambos os temas, razão de contraste mínima de 4.5:1 para texto normal e 3:1 para texto grande, indicadores de foco e limites de controles.
- **SC-002**: Zero violações sérias ou críticas na auditoria automatizada de acessibilidade, em todas as etapas do assistente, nos dois temas.
- **SC-003**: A troca de tema é percebida como instantânea — a interface inteira reflete o novo tema em menos de 100 ms após o acionamento, sem recarregar a página.
- **SC-004**: Em 100% das cargas da página, o tema exibido no primeiro quadro é o correto; nenhuma piscada de tema oposto é observável.
- **SC-005**: A preferência manual de tema é restaurada corretamente em 100% dos retornos à aplicação enquanto o armazenamento do navegador estiver disponível.
- **SC-006**: O número de passos, cliques e decisões necessários para concluir cada tarefa do fluxo permanece igual ou menor que antes da mudança, medido etapa a etapa.
- **SC-007**: Um usuário que nunca viu a aplicação identifica corretamente a ação principal de cada etapa em menos de 5 segundos após a tela aparecer, em ambos os temas.
- **SC-008**: 100% dos componentes reutilizáveis presentes na aplicação estão documentados no guia, com todos os seus estados nos dois temas.
- **SC-009**: 100% dos valores visuais usados pelos componentes provêm das escalas e paletas nomeadas; nenhum valor visual avulso permanece no código de componentes ou telas.
- **SC-010**: O fluxo completo permanece concluível apenas com teclado, com foco visível em 100% dos elementos interativos, nos dois temas.
- **SC-011**: Em viewport de 320 px de largura, nenhuma etapa produz rolagem horizontal da página, em ambos os temas.
- **SC-012**: Nenhum requisito funcional nem texto existente da aplicação é alterado: a suíte de testes atual continua passando sem que nenhuma expectativa de **comportamento** seja modificada. Ajustes de seletor ou de estrutura em testes são aceitáveis; alteração do que um teste afirma sobre o comportamento não é.
- **SC-013**: O peso total de recursos tipográficos embarcados não excede 80 KB comprimidos, somando todos os pesos e estilos distribuídos.
- **SC-014**: Nenhuma referência a origem remota existe no artefato construído — verificável por inspeção automatizada do build.
- **SC-015**: O deslocamento de conteúdo causado pela substituição da fonte substituta pela fonte própria é imperceptível: nenhum elemento de texto muda de linha ou de altura ao concluir a carga.
- **SC-016**: A ordem de navegação por teclado e a ordem lógica de leitura de cada etapa permanecem equivalentes às anteriores à mudança, elemento a elemento.

## Assumptions

- A aplicação continua sendo um conjunto de arquivos estáticos sem servidor próprio; nada nesta mudança introduz endpoint, processo ou fonte remota de qualquer tipo — inclusive fontes tipográficas, ícones e folhas de estilo, que MUST ser embarcados.
- A fonte própria adotada terá licença de redistribuição irrestrita (família de código aberto), e a verificação da licença é pré-requisito da escolha, não consequência dela. Nenhuma fonte de licença comercial ou de uso restrito entra no artefato.
- Embarcar uma fonte é um arquivo dentro do próprio build, não uma dependência de rede nem uma biblioteca de componentes: não conflita com o Princípio II nem com a regra de simplicidade proporcional, e a justificativa por escrito exigida pela constituição é a personalidade tipográfica declarada em FR-034.
- A reorganização interna das telas preserva ações, ordem de leitura e ordem de foco; ela muda como as coisas se agrupam e respiram, não o que existe nem em que sequência é alcançado.
- A preferência de tema é um dado local do navegador, não sincronizado entre dispositivos, e não faz parte do rascunho de trabalho em andamento.
- "Acompanhar o sistema" é o estado inicial de quem nunca escolheu — não há tema fixo padrão imposto a novos visitantes.
- Múltiplos idiomas continuam fora de escopo; a interface permanece exclusivamente em pt-BR.
- Nenhuma biblioteca externa de componentes de interface será adotada; o sistema de design é construído sobre o que o projeto já possui.
- O escopo cobre as cinco etapas do assistente e todos os componentes já existentes; nenhuma tela nova de produto é criada por esta mudança.
- Estilos específicos para impressão estão fora de escopo.
- O catálogo de temas usado como semente cromática (`theme-factory`) é ferramenta de autoria, consultada uma vez para fixar os matizes de partida. Ele não é dependência do produto, não é lido em tempo de execução e não precisa estar presente para a aplicação funcionar ou ser construída.
- Nenhum dos dez temas do catálogo atendia sozinho ao briefing — os de substrato correto acentuavam em teal, os de destaque correto ancoravam em marrom. A composição Ocean Depths + Golden Hour é derivação deliberada, não escolha de um item pronto.
- A licença da família tipográfica adotada permite redistribuição embarcada; a verificação da licença precede a adoção e é condição para ela, conforme já registrado.
- Do catálogo de temas herdam-se matizes de partida. Fontes, escalas, estados, tokens semânticos e regras de contraste são autorais — quatro hex codes e um par de fontes para slides não constituem um sistema de design, e a distância entre uma coisa e outra é o trabalho desta feature.
- A verificação de contraste é feita sobre a lista declarada de pares aprovados no guia — combinações não declaradas não são permitidas em componentes, e é isso que torna a verificação exaustiva.
