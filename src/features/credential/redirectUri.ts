/**
 * Redirect URI calculado em tempo de execução — nunca hardcoded (research §2).
 *
 * O endereço de retorno é a própria raiz da aplicação, sem rota `/callback`:
 * hospedagens de arquivos estáticos devolvem 404 para caminhos que não existem
 * em disco, e uma rota dedicada exigiria regra de rewrite — configuração de
 * servidor que SC-008 proíbe assumir.
 *
 * Como o projeto usa `base: './'`, `import.meta.env.BASE_URL` é relativo e não
 * serve para montar uma URL absoluta. Nesse caso o diretório vem do próprio
 * `pathname`, o que dá o resultado certo tanto na raiz quanto em subdiretório.
 */

export interface LocationLike {
  origin: string;
  pathname: string;
}

export function computeRedirectUri(
  location: LocationLike = window.location,
  baseUrl: string = import.meta.env.BASE_URL,
): string {
  if (baseUrl.startsWith('/')) {
    const withSlash = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    return `${location.origin}${withSlash}`;
  }

  // Remove o nome do arquivo, preservando o diretório: `/app/index.html` → `/app/`.
  const directory = location.pathname.replace(/[^/]*$/, '');
  return `${location.origin}${directory === '' ? '/' : directory}`;
}

/** A plataforma rejeita `localhost`; em desenvolvimento é obrigatório o IPv4 literal. */
export function usesRejectedLocalhost(redirectUri: string): boolean {
  try {
    return new URL(redirectUri).hostname === 'localhost';
  } catch {
    return false;
  }
}
