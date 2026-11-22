/**
 * Regras do encerramento automático por inatividade.
 *
 * O valor canônico é armazenado em { enabled, seconds, warning_seconds }.
 * As chaves antigas { minutes, warning_minutes } continuam sendo gravadas
 * para compatibilidade com clientes que ainda leem apenas minutos.
 */

export const SESSION_TIMEOUT_MIN_SECONDS = 30;
export const SESSION_TIMEOUT_MAX_SECONDS = 30 * 60;
export const SESSION_TIMEOUT_DEFAULT_SECONDS = 30 * 60;
export const SESSION_WARNING_DEFAULT_SECONDS = 5 * 60;

export interface SessionTimeoutConfig {
  enabled: boolean;
  seconds: number;
  warningSeconds: number;
}

export interface StoredSessionTimeout {
  enabled: boolean;
  seconds: number;
  warning_seconds: number;
  minutes: number;
  warning_minutes: number;
}

function toFiniteNumber(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
}

export function clampTimeoutSeconds(seconds: number): number {
  return Math.min(
    SESSION_TIMEOUT_MAX_SECONDS,
    Math.max(SESSION_TIMEOUT_MIN_SECONDS, Math.round(seconds))
  );
}

/** Converte minutos fracionados (ex.: 0.5) em segundos inteiros. */
export function minutesToSeconds(minutes: number): number {
  return Math.round(minutes * 60);
}

export function normalizeSessionTimeout(raw: unknown): SessionTimeoutConfig {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

  const rawSeconds = toFiniteNumber(source.seconds);
  const rawWarningSeconds = toFiniteNumber(source.warning_seconds);
  const rawMinutes = toFiniteNumber(source.minutes);
  const rawWarningMinutes = toFiniteNumber(source.warning_minutes);

  const secondsValue =
    rawSeconds !== null && rawSeconds > 0
      ? rawSeconds
      : rawMinutes !== null && rawMinutes > 0
        ? minutesToSeconds(rawMinutes)
        : SESSION_TIMEOUT_DEFAULT_SECONDS;

  const seconds = clampTimeoutSeconds(secondsValue);

  // Aviso: no formato novo vale o valor explícito. No formato antigo
  // (somente warning_minutes) limitamos a 20% do timeout para que um prazo
  // curto, como 1 minuto, não abra o aviso quase imediatamente.
  const warningCeiling = Math.max(0, Math.floor(seconds / 5));
  let warningValue: number;

  if (rawWarningSeconds !== null && rawWarningSeconds >= 0) {
    warningValue = rawWarningSeconds;
  } else if (rawWarningMinutes !== null && rawWarningMinutes >= 0) {
    warningValue = Math.min(minutesToSeconds(rawWarningMinutes), warningCeiling);
  } else {
    warningValue = Math.min(SESSION_WARNING_DEFAULT_SECONDS, warningCeiling);
  }

  // O aviso precisa terminar antes do logout.
  const warningSeconds = Math.min(seconds - 1, Math.max(0, Math.round(warningValue)));

  return {
    enabled: source.enabled === true,
    seconds,
    warningSeconds,
  };
}

/** Formato persistido em system_settings.session_timeout. */
export function toStoredSessionTimeout(config: SessionTimeoutConfig): StoredSessionTimeout {
  const seconds = clampTimeoutSeconds(config.seconds);
  const warningSeconds = Math.min(seconds - 1, Math.max(0, Math.round(config.warningSeconds)));

  return {
    enabled: config.enabled,
    seconds,
    warning_seconds: warningSeconds,
    minutes: Number((seconds / 60).toFixed(3)),
    warning_minutes: Number((warningSeconds / 60).toFixed(3)),
  };
}

export function formatSessionDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;

  if (minutes === 0) return `${rest} s`;
  if (rest === 0) return `${minutes} min`;
  return `${minutes} min ${rest} s`;
}
