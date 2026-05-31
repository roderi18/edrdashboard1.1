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

const applyMailUpdates = (mail, mailId, updates) => {
  if (String(mail?.id) !== String(mailId)) {
    return mail;
  }

  const nextMail = { ...mail, ...updates };

  if (Object.prototype.hasOwnProperty.call(updates, 'isStarred')) {
    const labelIds = new Set(nextMail.labelIds || []);

    if (updates.isStarred) {
      labelIds.add('starred');
    } else {
      labelIds.delete('starred');
    }

    nextMail.labelIds = Array.from(labelIds);
  }

  return nextMail;
};

const updateCachedMail = (mailId, updates) => {
  mutate(
    (key) => mailListKey(key),
    (currentData) => {
      if (!currentData?.mails) return currentData;

      return {
        ...currentData,
        mails: currentData.mails.map((mail) => applyMailUpdates(mail, mailId, updates)),
      };
    },
    { revalidate: false }
  );

  mutate(
    (key) =>
      Array.isArray(key) &&
      key[0] === endpoints.mail.details &&
      String(key[1]?.params?.mailId) === String(mailId),
    (currentData) => {
      if (!currentData?.mail) return currentData;

      return {
        ...currentData,
        mail: {
          ...applyMailUpdates(currentData.mail, mailId, updates),
          thread: currentData.mail.thread?.map((mail) => applyMailUpdates(mail, mailId, updates)),
        },
      };
    },
    { revalidate: false }
  );
};

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

export function useGetLabels(enabled = true) {
  const url = enabled ? endpoints.mail.labels : '';

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
  updateCachedMail(mailId, updates);

  try {
    const data = await requestJson(`${endpoints.mail.details}?${params.toString()}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });

    revalidateMail(mailId);

    return data.mail;
  } catch (error) {
    revalidateMail(mailId);
    throw error;
  }
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
