'use client';

import { startTransition } from 'react';
import Calendar from '@fullcalendar/react';
import listPlugin from '@fullcalendar/list';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import esLocale from '@fullcalendar/core/locales/es';
import interactionPlugin from '@fullcalendar/interaction';

import Card from '@mui/material/Card';

import { updateEvent, useGetEvents } from 'src/actions/calendar';

import { CalendarRoot } from './styles';
import { useCalendar } from './hooks/use-calendar';
import { CalendarToolbar } from './calendar-toolbar';

// ----------------------------------------------------------------------

export function CalendarCard({ sx, calendarSx, ...other }) {
  const { events, eventsLoading } = useGetEvents();

  const {
    calendarRef,
    view,
    title,
    onDropEvent,
    onChangeView,
    onSelectRange,
    onClickEvent,
    onResizeEvent,
    onDateNavigation,
  } = useCalendar();

  const flexStyles = {
    flex: '1 1 auto',
    display: 'flex',
    minHeight: 0,
    flexDirection: 'column',
  };

  return (
    <Card sx={[flexStyles, { minHeight: 480 }, ...(Array.isArray(sx) ? sx : [sx])]} {...other}>
      <CalendarRoot sx={{ ...flexStyles, ...calendarSx }}>
        <CalendarToolbar
          view={view}
          title={title}
          canReset={false}
          loading={eventsLoading}
          onChangeView={onChangeView}
          onDateNavigation={onDateNavigation}
          onOpenFilters={() => {}}
          viewOptions={[
            { value: 'dayGridMonth', label: 'Mes', icon: 'mingcute:calendar-month-line' },
            { value: 'timeGridWeek', label: 'Semana', icon: 'mingcute:calendar-week-line' },
            { value: 'timeGridDay', label: 'Día', icon: 'mingcute:calendar-day-line' },
            { value: 'listWeek', label: 'Agenda', icon: 'custom:calendar-agenda-outline' },
          ]}
        />

        <Calendar
          weekends
          editable
          droppable
          selectable
          allDayMaintainDuration
          eventResizableFromStart
          locale={esLocale}
          firstDay={1}
          aspectRatio={3}
          dayMaxEvents={3}
          eventMaxStack={2}
          rerenderDelay={10}
          headerToolbar={false}
          eventDisplay="block"
          eventTimeFormat={{
            hour: 'numeric',
            minute: '2-digit',
            meridiem: 'short',
            hour12: true,
          }}
          slotLabelFormat={{
            hour: 'numeric',
            minute: '2-digit',
            meridiem: 'short',
            hour12: true,
          }}
          allDayText="Todo el día"
          noEventsText="No hay eventos para mostrar"
          moreLinkText={(num) => `+${num} más`}
          buttonText={{
            today: 'Hoy',
            month: 'Mes',
            week: 'Semana',
            day: 'Día',
            list: 'Agenda',
          }}
          ref={calendarRef}
          height="100%"
          initialView={view}
          events={events}
          select={onSelectRange}
          eventClick={onClickEvent}
          businessHours={{
            daysOfWeek: [1, 2, 3, 4, 5],
          }}
          eventDrop={(arg) => {
            startTransition(() => {
              onDropEvent(arg, updateEvent);
            });
          }}
          eventResize={(arg) => {
            startTransition(() => {
              onResizeEvent(arg, updateEvent);
            });
          }}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        />
      </CalendarRoot>
    </Card>
  );
}
