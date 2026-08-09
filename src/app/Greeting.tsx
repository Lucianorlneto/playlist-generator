import { PROVIDER_ORDER } from '@/domain/providers';
import { format, t } from '@/i18n/pt-BR';
import { useAppStore } from '@/store';

/**
 * A saudação do cabeçalho de conteúdo (FR-036).
 *
 * ## Degrada para a forma impessoal, nunca para o vazio
 *
 * Sem conta conectada, a saudação vira "Olá" — uma frase completa, no mesmo
 * lugar e com a mesma altura. As duas alternativas ruins que o requisito
 * descarta explicitamente:
 *
 * - **espaço vazio**, que faz o cabeçalho pular quando a primeira conexão
 *   acontece e deixa um buraco sem explicação até lá;
 * - **nome inventado** — "Olá, usuário", "Olá, visitante" —, que é a aplicação
 *   fingindo saber quem está do outro lado. A honestidade sobre o que se sabe
 *   vale também para o que é só cortesia.
 *
 * ## De onde vem o nome
 *
 * Da sessão que a aplicação já possui, na ordem fixa do produto: com dois
 * serviços conectados, o primeiro da `PROVIDER_ORDER` decide. **Nada novo é
 * coletado nem persistido** para isto existir — é o mesmo identificador que o
 * chip de conexão já exibe.
 */
export function Greeting() {
  const sessions = useAppStore((state) => state.sessions);

  const provider = PROVIDER_ORDER.find((id) => sessions[id] !== null);
  const name = provider === undefined ? null : (sessions[provider]?.user.displayName ?? null);

  return (
    <p className="text-ink-muted text-meta">
      {name === null ? t.greeting.impersonal : format(t.greeting.personal, { name })}
    </p>
  );
}
