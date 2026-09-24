'use client';

import { useEffect } from 'react';
import Calendar from '@fullcalendar/react';
import listPlugin from '@fullcalendar/list';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import esLocale from '@fullcalendar/core/locales/es';
import interactionPlugin from '@fullcalendar/interaction';

// ----------------------------------------------------------------------
// LA CUADRÍCULA DE FULLCALENDAR, EN SU PROPIO TROZO.
//
// FullCalendar y sus cuatro plugins pesan bastante más que el resto de la
// pantalla. Importados arriba, la barra, los filtros y el título esperaban a que
// bajara todo. Ahora la pantalla se pinta al momento y esta pieza llega con
// `next/dynamic` (con su esqueleto mientras tanto).
//
// La ref viaja como `calendarRef` (no `ref`): `next/dynamic` no la reenvía a un
// componente de clase. `alMontar` avisa de que la API ya existe, para que el
// título y la vista se sincronicen (antes lo hacía el primer efecto, que ahora
// llega antes que el calendario).
// ----------------------------------------------------------------------

export const PLUGINS_DEL_CALENDARIO = [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin];

export function CalendarioGrid({ calendarRef, alMontar, ...other }) {
  useEffect(() => {
    alMontar?.();
    // Solo al montar: después la sincronización la lleva `useCalendar`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Calendar ref={calendarRef} locale={esLocale} plugins={PLUGINS_DEL_CALENDARIO} {...other} />
  );
}
