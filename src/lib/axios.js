import axios, { AxiosHeaders } from 'axios';

import { CONFIG } from 'src/global-config';

// ----------------------------------------------------------------------

const axiosInstance = axios.create({
  baseURL: CONFIG.serverUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosInstance.interceptors.request.use(async (config) => {
  if (typeof window === 'undefined') return config;

  try {
    const { AUTH } = await import('./firebase');

    await AUTH?.authStateReady?.();
    const token = await AUTH?.currentUser?.getIdToken?.();

    if (token) {
      const headers = AxiosHeaders.from(config.headers);
      headers.set('Authorization', `Bearer ${token}`);

      return { ...config, headers };
    }
  } catch {
    // La API devolverá un error de autenticación controlado si no hay sesión válida.
  }

  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const responseData = error?.response?.data;
    const isHtmlResponse =
      typeof responseData === 'string' && responseData.trim().toLowerCase().startsWith('<!doctype');
    const message =
      responseData?.message ||
      (isHtmlResponse
        ? `La ruta ${error?.config?.url || ''} respondió HTML en lugar de JSON.`
        : error?.message) ||
      'Something went wrong!';

    const normalizedError = new Error(message, { cause: error });
    normalizedError.code = responseData?.code || error?.code || null;
    normalizedError.status = error?.response?.status || null;
    normalizedError.requestId = responseData?.requestId || null;

    return Promise.reject(normalizedError);
  }
);

export default axiosInstance;

// ----------------------------------------------------------------------

export const fetcher = async (args) => {
  const [url, config] = Array.isArray(args) ? args : [args, {}];

  const res = await axiosInstance.get(url, config);

  return res.data;
};

// ----------------------------------------------------------------------

export const endpoints = {
  chat: '/api/chat/',
  kanban: '/api/kanban/',
  calendar: '/api/calendar/',
  auth: {
    me: '/api/auth/me/',
    signIn: '/api/auth/sign-in/',
    signUp: '/api/auth/sign-up/',
  },
  mail: {
    list: '/api/mail/list/',
    details: '/api/mail/details/',
    labels: '/api/mail/labels/',
  },
  post: {
    list: '/api/post/list/',
    details: '/api/post/details/',
    latest: '/api/post/latest/',
    search: '/api/post/search/',
  },
  product: {
    list: '/api/product/list/',
    details: '/api/product/details/',
    search: '/api/product/search/',
  },
};
