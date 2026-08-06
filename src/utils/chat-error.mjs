export const CHAT_QUOTA_MESSAGE =
  '🔥 La fogata está encendiéndose. En unos minutos podrás continuar la conversación.';

const asSafeToken = (value) =>
  String(value ?? '')
    .replace(/[^a-z0-9_-]/gi, '')
    .slice(0, 80);

export const isChatQuotaError = (error) =>
  error?.code === 'RESOURCE_EXHAUSTED' || /cuota|quota exceeded/i.test(error?.message || '');

export const getChatErrorMessage = (error, fallback = 'No se pudo completar la operación.') => {
  if (isChatQuotaError(error)) return CHAT_QUOTA_MESSAGE;
  if (Number(error?.status) === 401) return 'Tu sesión expiró. Inicia sesión nuevamente.';
  if (Number(error?.status) === 403) return 'No tienes permiso para realizar esta acción.';

  return error?.message || fallback;
};

export const logChatClientError = (scope, error) => {
  const entry = {
    event: 'chat_client_error',
    scope: asSafeToken(scope) || 'unknown',
    code: asSafeToken(error?.code) || 'CHAT_CLIENT_ERROR',
    status: Number.isSafeInteger(Number(error?.status)) ? Number(error.status) : null,
    requestId: asSafeToken(error?.requestId) || null,
  };

  console.warn(JSON.stringify(entry));
  return entry;
};
