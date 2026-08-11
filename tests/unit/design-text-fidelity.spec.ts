import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { format, plural, t } from '@/i18n/pt-BR';

/**
 * Fidelidade textual ao arquivo de design — 008/FR-030, FR-030a, FR-030b, SC-001.
 *
 * ## Por que este arquivo existe
 *
 * **Divergência de texto não falha em lugar nenhum.** Uma frase trocada passa por
 * `tp/no-ui-text-literals`, por `typecheck`, por todos os testes de comportamento
 * e por todos os de acessibilidade. O único mecanismo que a pegava era alguém pôr
 * as duas telas lado a lado — e foi exatamente esse mecanismo que falhou na
 * feature 007, que é a causa desta feature existir.
 *
 * Este teste transforma "conferimos uma vez" em "a máquina confere a cada
 * `npm test`". Ele lê dois artefatos versionados:
 *
 * - `design-inventory.json` — um item por texto do arquivo de design, com o nó de
 *   origem e o desfecho de cada um;
 * - `design-inventory-exclusions.json` — os ramos do dicionário que estão **fora**
 *   do alcance do arquivo, cada um com o motivo escrito.
 *
 * ## As duas direções
 *
 * O inventário sozinho é **unidirecional**: ele responde "este texto do design
 * está na aplicação?". Um texto que existisse só no dicionário e divergisse do
 * design não teria item, e por isso nunca falharia. A cobertura inversa (SC-001)
 * é o que fecha o buraco: **toda** chave de `t` precisa estar coberta por um item
 * ou por uma exclusão que alguém escreveu.
 *
 * É isso que faz um texto novo — ou renomeado — parar a suíte até alguém decidir
 * se ele corresponde a algo no design.
 */

const FIXTURES = join(process.cwd(), 'tests/fixtures');

interface InventoryEntry {
  readonly tela: string;
  readonly no: string;
  readonly design: string;
  readonly desfecho: 'adotado' | 'mantido-diferente';
  readonly chave?: string;
  readonly amostra?: Readonly<Record<string, string | number>>;
  readonly plural?: number;
  readonly motivo?: string;
}

interface Exclusion {
  readonly chave: string;
  readonly motivo: string;
}

function ler<T>(nome: string): T[] {
  return JSON.parse(readFileSync(join(FIXTURES, nome), 'utf8')) as T[];
}

const INVENTARIO = ler<InventoryEntry>('design-inventory.json');
const EXCLUSOES = ler<Exclusion>('design-inventory-exclusions.json');

/**
 * As quatorze telas do arquivo (`contracts/text-inventory.md` §4).
 *
 * A lista é fechada e a cobertura é exigida: FR-030 pede o levantamento das
 * quatorze, não apenas das telas citadas no pedido original.
 */
const TELAS = [
  'Importador · Configuração',
  'Importador · Destinos',
  'Importador · Entrada',
  'Importador · Serviço',
  'Importador · Serviço · Reconectar',
  'Importador · Serviço · Orçamento',
  'Importador · Serviço · YouTube',
  'Importador · Serviço · Spotify (Carregando)',
  'Importador · Serviço · Spotify Concluído',
  'Importador · Serviço · YouTube Concluído',
  'Importador · Resumo',
  'Components / Playlist Importer',
  'Components / Serviço',
  'Components / Configuração',
] as const;

/**
 * Os ramos que o arquivo de design **desenha**, e que por isso não podem ser
 * cobertos por exclusão de prefixo (`contracts/text-inventory.md` §2.1).
 *
 * O prefixo existe para fazer o custo de classificar 468 chaves caber numa
 * revisão que alguém releia. O que ele não pode fazer é apagar justamente os
 * ramos em que a fidelidade importa — esses são classificados chave a chave.
 */
const RAMOS_DESENHADOS = [
  'rail.',
  'steps.',
  'destinations.',
  'queue.',
  'connectionChip.',
  'app.',
  'header.',
] as const;

/** Achata a árvore de textos em `caminho.pontilhado` → valor. */
function flatten(value: unknown, prefix = ''): Record<string, string> {
  if (typeof value === 'string') return { [prefix]: value };
  if (Array.isArray(value)) {
    return Object.assign(
      {},
      ...value.map((entry, index) => flatten(entry, `${prefix}[${String(index)}]`)),
    ) as Record<string, string>;
  }
  if (typeof value === 'object' && value !== null) {
    return Object.assign(
      {},
      ...Object.entries(value).map(([key, entry]) =>
        flatten(entry, prefix === '' ? key : `${prefix}.${key}`),
      ),
    ) as Record<string, string>;
  }
  return {};
}

const DICIONARIO = flatten(t);

/**
 * Resolve o item para o texto que o produto **renderiza**.
 *
 * A comparação é sobre o texto renderizado, e não sobre o template, porque o
 * arquivo contém "Conectado como Luciano Rodrigues" e o dicionário contém um
 * template com `{account}`. Comparar os dois diretamente é impossível;
 * renderizar o template com a amostra que o próprio arquivo usa verifica **duas**
 * coisas de uma vez — o texto e a interpolação. Um `{account}` esquecido no meio
 * da frase falha aqui, e não falharia em nenhum outro lugar.
 */
function renderizar(item: InventoryEntry): string {
  const chave = item.chave ?? '';
  const template = DICIONARIO[chave];
  if (template === undefined) throw new Error(`chave inexistente: ${chave}`);

  const amostra = item.amostra ?? {};
  // `plural` primeiro, `format` depois: a escolha da forma precede a
  // interpolação, como no produto.
  if (item.plural !== undefined) {
    return format(plural(item.plural, template, template), amostra);
  }
  return format(template, amostra);
}

describe('FR-030b · todo item adotado resolve para uma chave existente', () => {
  const adotados = INVENTARIO.filter((item) => item.desfecho === 'adotado');

  it('o inventário tem itens adotados para verificar', () => {
    expect(adotados.length).toBeGreaterThan(50);
  });

  it('nenhuma chave citada pelo inventário desapareceu do dicionário', () => {
    /*
      **É o modo de falha real.** Renomear uma chave é mais comum do que
      reescrever uma frase, e um inventário que só comparasse strings passaria
      em silêncio sobre uma chave que não existe mais — comparando `undefined`
      com `undefined`, ou pulando o item.
    */
    const ausentes = INVENTARIO.filter(
      (item) => item.chave !== undefined && !(item.chave in DICIONARIO),
    ).map((item) => `${item.chave ?? ''} (${item.tela}, nó ${item.no})`);

    expect(ausentes, `Chaves do inventário que não existem em \`t\`:\n  ${ausentes.join('\n  ')}`).toEqual(
      [],
    );
  });
});

describe('FR-030b e SC-001 · todo item adotado renderiza o texto do arquivo', () => {
  const adotados = INVENTARIO.filter((item) => item.desfecho === 'adotado');

  it.each(
    adotados.map((item) => [`${item.tela} · ${item.no} · ${item.chave ?? ''}`, item] as const),
  )('%s', (_nome, item) => {
    // Comparação **caractere a caractere**. Um espaço a mais, um travessão
    // trocado por hífen ou uma reticência composta em vez do caractere único
    // são divergências reais, e é exatamente esse tipo que a conferência a olho
    // deixa passar.
    expect(
      renderizar(item),
      `O texto de \`${item.chave ?? ''}\` diverge do nó ${item.no} da tela "${item.tela}".`,
    ).toBe(item.design);
  });
});

describe('FR-030a · o inventário não pode virar uma lista de itens ignorados', () => {
  it('todo item tem `chave` ou `motivo` — nenhum tem os dois ausentes', () => {
    const mudos = INVENTARIO.filter(
      (item) =>
        (item.chave === undefined || item.chave === '') &&
        (item.motivo === undefined || item.motivo.trim() === ''),
    ).map((item) => `${item.tela} · ${item.no}: ${item.design}`);

    expect(mudos, `Itens sem chave e sem motivo:\n  ${mudos.join('\n  ')}`).toEqual([]);
  });

  it('todo item `mantido-diferente` traz um motivo **escrito**, não um marcador', () => {
    // Um motivo de três palavras é um marcador com aparência de justificativa.
    // O comprimento mínimo não mede qualidade, mas separa "porque sim" de uma
    // decisão que alguém precisou formular.
    const fracos = INVENTARIO.filter(
      (item) => item.desfecho === 'mantido-diferente' && (item.motivo ?? '').trim().length < 40,
    ).map((item) => `${item.tela} · ${item.no}: ${item.motivo ?? '(vazio)'}`);

    expect(fracos, `Motivos vazios ou insuficientes:\n  ${fracos.join('\n  ')}`).toEqual([]);
  });

  it('todo item `adotado` traz chave', () => {
    const semChave = INVENTARIO.filter(
      (item) => item.desfecho === 'adotado' && (item.chave ?? '') === '',
    ).map((item) => `${item.tela} · ${item.no}: ${item.design}`);

    expect(semChave).toEqual([]);
  });

  it('o desfecho é sempre um dos dois valores previstos', () => {
    const invalidos = INVENTARIO.filter(
      (item) => item.desfecho !== 'adotado' && item.desfecho !== 'mantido-diferente',
    );
    expect(invalidos).toEqual([]);
  });
});

describe('FR-030 e SC-001 · as quatorze telas estão representadas', () => {
  it.each(TELAS)('a tela %s tem ao menos um item', (tela) => {
    const itens = INVENTARIO.filter((item) => item.tela === tela);
    expect(
      itens.length,
      `A tela "${tela}" não tem nenhum item no inventário. FR-030 exige as quatorze, ` +
        'não apenas as citadas no pedido.',
    ).toBeGreaterThan(0);
  });

  it('nenhum item cita uma tela fora da lista das quatorze', () => {
    // Pega o erro de digitação no nome da tela, que de outro modo produziria uma
    // tela "coberta" que ninguém consegue localizar no arquivo.
    const forasteiras = [...new Set(INVENTARIO.map((item) => item.tela))]
      .filter((tela) => !TELAS.includes(tela as (typeof TELAS)[number]))
      .sort();
    expect(forasteiras, `Telas desconhecidas no inventário: ${forasteiras.join(', ')}`).toEqual([]);
  });

  it('todo item aponta um nó de origem', () => {
    const semNo = INVENTARIO.filter((item) => item.no.trim() === '');
    expect(semNo).toEqual([]);
  });
});

/**
 * A **direção inversa** (SC-001) — o que faz este portão valer alguma coisa.
 *
 * Sem ela o inventário responderia apenas "este texto do design está na
 * aplicação?", e um texto que existisse só no dicionário e divergisse do design
 * nunca teria item, nunca falharia e nunca seria revisto.
 */
describe('SC-001 · toda chave do dicionário está classificada', () => {
  const cobertas = new Set(
    INVENTARIO.filter((item) => item.chave !== undefined).map((item) => item.chave ?? ''),
  );

  function excluida(chave: string): boolean {
    return EXCLUSOES.some((entrada) =>
      entrada.chave.endsWith('.') ? chave.startsWith(entrada.chave) : chave === entrada.chave,
    );
  }

  it('nenhuma chave escapa de inventário e de exclusão', () => {
    const descobertas = Object.keys(DICIONARIO)
      .filter((chave) => !cobertas.has(chave))
      .filter((chave) => !excluida(chave))
      .sort();

    expect(
      descobertas,
      'Chaves de `t` sem item de inventário e sem entrada de exclusão. Cada uma precisa ' +
        'de uma decisão escrita: ou corresponde a um texto do arquivo de design (item ' +
        `\`adotado\`), ou não (item \`mantido-diferente\` ou exclusão):\n  ${descobertas.join('\n  ')}`,
    ).toEqual([]);
  });

  it('nenhuma exclusão por prefixo alcança um ramo que o design desenha', () => {
    /*
      A regra que impede a exclusão de esvaziar o portão. Uma entrada com
      `chave: "rail."` é falha **por si só**, independentemente do motivo: aquele
      ramo é classificado chave a chave, e um prefixo ali apagaria de uma vez
      toda a fidelidade da trilha.
    */
    const invasoras = EXCLUSOES.filter((entrada) =>
      RAMOS_DESENHADOS.some(
        (ramo) => entrada.chave.startsWith(ramo) || ramo.startsWith(entrada.chave),
      ),
    ).map((entrada) => entrada.chave);

    expect(
      invasoras,
      `Exclusões sobre ramos que o arquivo de design desenha: ${invasoras.join(', ')}. ` +
        'Esses ramos são classificados chave a chave no inventário.',
    ).toEqual([]);
  });

  it('toda exclusão traz um motivo escrito', () => {
    const fracas = EXCLUSOES.filter((entrada) => entrada.motivo.trim().length < 40).map(
      (entrada) => entrada.chave,
    );
    expect(fracas, `Exclusões sem motivo suficiente: ${fracas.join(', ')}`).toEqual([]);
  });

  it('nenhuma exclusão é inútil — toda entrada cobre ao menos uma chave', () => {
    // Uma exclusão que não alcança nada é resquício de um ramo renomeado, e ela
    // ficaria no arquivo dando a impressão de que algo foi decidido.
    const orfas = EXCLUSOES.filter(
      (entrada) =>
        !Object.keys(DICIONARIO).some((chave) =>
          entrada.chave.endsWith('.') ? chave.startsWith(entrada.chave) : chave === entrada.chave,
        ),
    ).map((entrada) => entrada.chave);

    expect(orfas, `Exclusões que não cobrem chave nenhuma: ${orfas.join(', ')}`).toEqual([]);
  });

  it('009/FR-021 · as chaves do cartão de carregamento não vivem só do prefixo `result.`', () => {
    /*
      O ponto delicado da 009 (`009/contracts/text-inventory.md` §4).

      O ramo `result.` é excluído por prefixo porque contém o caminho de criação
      interrompida, que o arquivo não desenha. As três chaves da tela `SjphR`
      **são** desenhadas, e o prefixo as cobriria em silêncio — o portão da 008
      passaria sem nunca comparar as frases novas com o arquivo. Seria a mesma
      falha que a 008 existiu para corrigir, reintroduzida pela porta dos fundos.

      A asserção é sobre o item de inventário, não sobre a exclusão: é o item que
      força a comparação caractere a caractere.
    */
    const DESENHADAS = [
      'result.creatingSubtitle',
      'result.creatingDescription',
      'result.awaitingConfirmation',
    ];

    const orfas = DESENHADAS.filter((chave) => !cobertas.has(chave));
    expect(
      orfas,
      'Chaves que o arquivo de design desenha e que estariam cobertas apenas pela exclusão ' +
        `de prefixo \`result.\`: ${orfas.join(', ')}. Cada uma precisa de item próprio no ` +
        'inventário (009/FR-021).',
    ).toEqual([]);

    // `creatingDescription` é a única divergência da feature, e ela é
    // inventariada como `mantido-diferente` com motivo escrito — o item existe
    // sob o nó `G37LNR`, não sob a chave.
    const divergente = INVENTARIO.find((item) => item.no === 'yjjDB/G37LNR');
    expect(divergente?.desfecho).toBe('mantido-diferente');
    expect((divergente?.motivo ?? '').length).toBeGreaterThan(40);
  });

  it('nenhuma exclusão de chave **exata** duplica um item de inventário', () => {
    /*
      A sobreposição entre um prefixo e um item **é o desenho**, não um defeito:
      cada exclusão de ramo diz, no seu motivo, que os textos desenhados estão
      inventariados um a um e que a entrada cobre o restante. `providers.` exclui
      o ramo, e `providers.spotify.openPlaylist` tem item próprio porque o
      arquivo o desenha — o item é a decisão mais específica, e ela vence.

      O que **é** ambiguidade é uma exclusão de chave exata sobre uma chave já
      inventariada: ali as duas afirmam a mesma coisa em níveis iguais, e a
      revisão leria o motivo da exclusão sem notar que o item já a adotara.
    */
    const exatas = EXCLUSOES.filter((entrada) => !entrada.chave.endsWith('.'));
    const duplas = exatas.filter((entrada) => cobertas.has(entrada.chave)).map((e) => e.chave);

    expect(
      duplas,
      `Exclusões de chave exata sobre chaves já inventariadas: ${duplas.join(', ')}`,
    ).toEqual([]);
  });
});
