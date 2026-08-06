/**
 * Limiares e pesos de confiança (research §6 e §7).
 *
 * Arquivo próprio e deliberadamente minúsculo: os valores são **calibrados**
 * contra as fixtures de referência até satisfazerem SC-002 e SC-006, e a
 * calibração não deve exigir tocar na lógica de pontuação.
 *
 * Os limiares agora são **por provedor** e vivem em
 * `capabilitiesOf(provider).thresholds`, porque a diferença entre catálogos é
 * dado, não ramificação. Os valores canônicos ficam repetidos aqui como nomes
 * legíveis para teste e documentação:
 *
 * - Spotify `0,82`: tolera pontuação divergente, acento e um sufixo residual,
 *   mas rejeita título parecido de artista diferente — o erro caro ali.
 * - YouTube `0,88`: no catálogo de vídeo o erro caro não é "não achou", é
 *   "achou o cover". Elevar o limiar empurra a dúvida para o lado de pedir
 *   confirmação humana, que é o que FR-019 e o Princípio V querem.
 * - `0,55` marca, nos dois, o piso abaixo do qual o resultado é ruído.
 */

export const SPOTIFY_CONFIDENT_THRESHOLD = 0.82;
export const YOUTUBE_CONFIDENT_THRESHOLD = 0.88;
export const UNCERTAIN_THRESHOLD = 0.55;

/** Peso do título contra o do artista na pontuação combinada. */
export const TITLE_WEIGHT = 0.6;
export const ARTIST_WEIGHT = 0.4;

/** Bônus por artista secundário declarado com `feat.` confirmado na faixa. */
export const FEATURED_BONUS = 0.05;

/**
 * Bônus de canal canônico no catálogo de vídeo (research §7).
 *
 * ` - Topic` é o áudio auto-gerado pela própria plataforma a partir do catálogo
 * do detentor — o equivalente mais próximo de uma faixa de álbum, e por isso o
 * sinal mais forte disponível de que o vídeo é a gravação oficial. `VEVO` é o
 * segundo mais forte: canal oficial, mas normalmente com o clipe, cuja duração
 * pode destoar.
 */
export const CHANNEL_TOPIC_BONUS = 0.08;
export const CHANNEL_VEVO_BONUS = 0.05;
