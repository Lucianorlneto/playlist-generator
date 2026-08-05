/**
 * Detecção de perda de conexão (US4 cenário 5).
 *
 * `navigator.onLine` é a única fonte disponível sem servidor próprio, e ela só
 * é confiável no sentido negativo: `false` significa mesmo sem rede. Por isso a
 * distinção entre "offline" e "falha de rede" existe em `errors.ts` — a mensagem
 * muda, mas o próximo passo (repetir sem recomeçar) é o mesmo.
 */

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export type ConnectivityListener = (online: boolean) => void;

/** Assina mudanças de conectividade. Devolve a função de cancelamento. */
export function onConnectivityChange(listener: ConnectivityListener): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const handleOnline = (): void => listener(true);
  const handleOffline = (): void => listener(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
