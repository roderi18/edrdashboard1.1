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

    // EL TOKEN TIENE QUE LLEVAR EL NUMERO DE MIEMBRO.
    //
    // El servidor es generoso identificando: si el token no lo trae, te busca en
    // Firestore y en el padron y te reconoce igual. Las reglas de Firestore no:
    // exigen `idMiembros` DENTRO del token y nada mas. Con un token viejo —de
    // antes de que se le pusieran los permisos— pasaba una cosa muy fea: la ruta
    // te reconocia, montaba bien la peticion, y la base de datos la rechazaba con
    // un "permisos insuficientes" que no explicaba nada. Se veia al intentar
    // enviar un mensaje por el chat.
    //
    // Aqui se mira antes de salir: si al token le falta, se pide uno nuevo. Los
    // permisos se leen del que ya hay en memoria, sin ir a la red; solo cuando
    // faltan se fuerza el refresco.
    const cuenta = AUTH?.currentUser;
    let token = await cuenta?.getIdToken?.();

    if (cuenta && token) {
      const resultado = await cuenta.getIdTokenResult?.().catch(() => null);

      if (resultado && resultado.claims?.idMiembros == null) {
        token = (await cuenta.getIdToken(true).catch(() => null)) ?? token;
      }
    }

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
