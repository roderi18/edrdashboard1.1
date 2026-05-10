import { useMemo } from 'react';
import useSWR, { mutate } from 'swr';

// ----------------------------------------------------------------------

const CALENDAR_ENDPOINT = '/api/calendar/';

const swrOptions = {
  revalidateIfStale: true,
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
};

const requestJson = async (url, options) => {
  const response = await fetch(url, options);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'No se pudo completar la accion del calendario.');
  }

  return response.json();
};

const fetchCalendarEvents = async () => {
  const data = await requestJson(CALENDAR_ENDPOINT, { cache: 'no-store' });

  return data.events || [];
};

// ----------------------------------------------------------------------

export function useGetEvents() {
  const { data, isLoading, error, isValidating } = useSWR(
    CALENDAR_ENDPOINT,
    fetchCalendarEvents,
    {
      fallbackData: [],
      ...swrOptions,
    }
  );

  const memoizedValue = useMemo(() => {
    const events = data || [];

    return {
      events,
      eventsLoading: isLoading,
      eventsError: error,
      eventsValidating: isValidating,
      eventsEmpty: !isLoading && !isValidating && !events.length,
    };
  }, [data, error, isLoading, isValidating]);

  return memoizedValue;
}

// ----------------------------------------------------------------------

export async function createEvent(eventData) {
  const data = await requestJson(CALENDAR_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify({ eventData }),
    headers: { 'Content-Type': 'application/json' },
  });

  await mutate(CALENDAR_ENDPOINT);

  return data.id;
}

// ----------------------------------------------------------------------

export async function updateEvent(eventData) {
  await requestJson(CALENDAR_ENDPOINT, {
    method: 'PUT',
    body: JSON.stringify({ eventData }),
    headers: { 'Content-Type': 'application/json' },
  });

  await mutate(CALENDAR_ENDPOINT);
}

// ----------------------------------------------------------------------

export async function deleteEvent(eventId) {
  await requestJson(CALENDAR_ENDPOINT, {
    method: 'PATCH',
    body: JSON.stringify({ eventId }),
    headers: { 'Content-Type': 'application/json' },
  });

  await mutate(CALENDAR_ENDPOINT);
}
