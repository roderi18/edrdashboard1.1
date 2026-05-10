import { useMemo } from 'react';
import { keyBy } from 'es-toolkit';
import useSWR, { mutate } from 'swr';

import { endpoints } from 'src/lib/axios';

// ----------------------------------------------------------------------

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

const localFetcher = async (args) => {
  const [url, config] = Array.isArray(args) ? args : [args, {}];
  const params = new URLSearchParams(config?.params || {});
  const requestUrl = params.toString() ? `${url}?${params.toString()}` : url;
  const response = await fetch(requestUrl);

  if (!response.ok) {
    throw new Error(`No se pudo cargar el correo (${response.status}).`);
  }

  return response.json();
};

const mailListKey = (key) => Array.isArray(key) && key[0] === endpoints.mail.list;

const revalidateMail = (mailId) => {
  mutate(endpoints.mail.labels);
  mutate((key) => mailListKey(key));

  if (mailId) {
    mutate([endpoints.mail.details, { params: { mailId } }]);
  }
};

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`No se pudo guardar el correo (${response.status}).`);
  }

  return response.json();
};

// ----------------------------------------------------------------------

export function useGetLabels() {
  const url = endpoints.mail.labels;

  const { data, isLoading, error, isValidating } = useSWR(url, localFetcher, {
    ...swrOptions,
  });

  const memoizedValue = useMemo(
    () => ({
      labels: data?.labels || [],
      labelsLoading: isLoading,
      labelsError: error,
      labelsValidating: isValidating,
      labelsEmpty: !isLoading && !isValidating && !data?.labels.length,
    }),
    [data?.labels, error, isLoading, isValidating]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

export function useGetMails(labelId) {
  const url = labelId ? [endpoints.mail.list, { params: { labelId } }] : '';

  const { data, isLoading, error, isValidating } = useSWR(url, localFetcher, {
    ...swrOptions,
  });

  const memoizedValue = useMemo(() => {
    const byId = data?.mails.length ? keyBy(data?.mails, (option) => option.id) : {};
    const allIds = Object.keys(byId);

    return {
      mails: { byId, allIds },
      mailsLoading: isLoading,
      mailsError: error,
      mailsValidating: isValidating,
      mailsEmpty: !isLoading && !isValidating && !allIds.length,
    };
  }, [data?.mails, error, isLoading, isValidating]);

  return memoizedValue;
}

// ----------------------------------------------------------------------

export function useGetMail(mailId) {
  const url = mailId ? [endpoints.mail.details, { params: { mailId } }] : '';

  const { data, isLoading, error, isValidating } = useSWR(url, localFetcher, {
    ...swrOptions,
  });

  const memoizedValue = useMemo(
    () => ({
      mail: data?.mail,
      mailLoading: isLoading,
      mailError: error,
      mailValidating: isValidating,
      mailEmpty: !isLoading && !isValidating && !data?.mail,
    }),
    [data?.mail, error, isLoading, isValidating]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

export async function updateMail(mailId, updates) {
  const params = new URLSearchParams({ mailId });
  const data = await requestJson(`${endpoints.mail.details}?${params.toString()}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });

  revalidateMail(mailId);

  return data.mail;
}

// ----------------------------------------------------------------------

export async function sendMail(mailData) {
  const data = await requestJson(endpoints.mail.list, {
    method: 'POST',
    body: JSON.stringify(mailData),
  });

  revalidateMail(mailData.sourceMailId || data.mail?.id);

  return data.mail;
}
