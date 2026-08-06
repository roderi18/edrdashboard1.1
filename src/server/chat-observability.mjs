const safeCode = (value) => String(value ?? '').replace(/[^A-Z0-9_-]/gi, '').slice(0, 80);

export const toSafeChatErrorMetric = (error) => ({
  code: safeCode(error?.code) || 'CHAT_INTERNAL_ERROR',
  status: Number.isSafeInteger(Number(error?.status)) ? Number(error.status) : 500,
  category:
    error?.code === 'RESOURCE_EXHAUSTED'
      ? 'quota'
      : Number(error?.status) === 401
        ? 'authentication'
        : Number(error?.status) === 403
          ? 'authorization'
          : 'operation',
});

export const startChatOperation = ({
  method,
  url,
  now = () => performance.now(),
  requestId = crypto.randomUUID(),
  write = (entry) => console.info(JSON.stringify(entry)),
} = {}) => {
  const startedAt = now();
  let endpoint = 'chat';

  try {
    endpoint = new URL(url).searchParams.get('endpoint') || 'chat';
  } catch {
    endpoint = 'chat';
  }

  return {
    requestId,
    finish: ({ error = null } = {}) => {
      const errorMetric = error ? toSafeChatErrorMetric(error) : null;
      const entry = {
        event: 'chat_request',
        requestId,
        method: String(method ?? 'UNKNOWN').toUpperCase(),
        endpoint,
        outcome: error ? 'error' : 'success',
        durationMs: Math.max(0, Math.round((now() - startedAt) * 100) / 100),
        ...(errorMetric ?? {}),
      };

      write(entry);
      return entry;
    },
  };
};
