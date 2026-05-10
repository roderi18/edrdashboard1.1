'use client';

import Calendar from '@fullcalendar/react';
import listPlugin from '@fullcalendar/list';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import esLocale from '@fullcalendar/core/locales/es';
import interactionPlugin from '@fullcalendar/interaction';
import { useBoolean, useSetState } from 'minimal-shared/hooks';
import { useMemo, useState, useEffect, useCallback, startTransition } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';

import { fIsAfter, fIsBetween } from 'src/utils/format-time';

import { DashboardContent } from 'src/layouts/dashboard';
import { getMembers } from 'src/services/member-service';
import { CALENDAR_COLOR_OPTIONS } from 'src/_mock/_calendar';
import { createEvent, updateEvent, deleteEvent, useGetEvents } from 'src/actions/calendar';

import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

import { CalendarRoot } from '../styles';
import { useEvent } from '../hooks/use-event';
import { CalendarForm } from '../calendar-form';
import { useCalendar } from '../hooks/use-calendar';
import { CalendarToolbar } from '../calendar-toolbar';
import { CalendarFilters } from '../calendar-filters';
import { CalendarFiltersResult } from '../calendar-filters-result';

// ----------------------------------------------------------------------

const normalizeIdentity = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '');

const normalizeWords = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .filter(Boolean);

const buildActorFromUser = (user = {}) => ({
  idMiembros: Number(user?.idMiembros || 0) || null,
  codigoMiembro: user?.codigoMiembro || user?.memberId || '',
  nombre: user?.displayName || user?.nombre || user?.name || '',
  correo: user?.email || user?.correo || '',
});

const buildActorFromMember = (member = {}, fallback = {}) => ({
  idMiembros: Number(member.id || member.idMiembros || fallback.idMiembros || 0) || null,
  codigoMiembro: member.memberId || member.codigoMiembro || fallback.codigoMiembro || '',
  nombre:
    [member.firstName || member.nombres, member.lastName || member.apellidos]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    member.name ||
    fallback.nombre ||
    '',
  correo: member.email || member.correo || fallback.correo || '',
});

const findMemberForUser = (members = [], user = {}, fallback = {}) => {
  const userEmail = normalizeIdentity(user.email || user.correo);
  const userCode = normalizeIdentity(user.codigoMiembro || user.memberId);
  const userId = normalizeIdentity(user.idMiembros);
  const userName = user.displayName || user.nombre || user.name || fallback.nombre;
  const userNameParts = normalizeWords(userName);

  return members.find((member) => {
    const memberEmail = normalizeIdentity(member.email || member.correo);
    const memberCode = normalizeIdentity(member.memberId || member.codigoMiembro);
    const memberId = normalizeIdentity(member.id || member.idMiembros);
    const memberNameText = normalizeIdentity(
      [member.firstName || member.nombres, member.lastName || member.apellidos]
        .filter(Boolean)
        .join(' ') || member.name
    );

    return (
      (userEmail && memberEmail === userEmail) ||
      (userCode && memberCode === userCode) ||
      (userId && memberId === userId) ||
      (userNameParts.length > 0 &&
        userNameParts.every((part) => memberNameText.includes(part))) ||
      (fallback.nombre && memberNameText.includes(normalizeIdentity(fallback.nombre)))
    );
  });
};

export function CalendarView() {
  const theme = useTheme();
  const { user } = useAuthContext();

  const openFilters = useBoolean();

  const { events, eventsLoading } = useGetEvents();

  const filters = useSetState({ colors: [], startDate: null, endDate: null });
  const { state: currentFilters } = filters;

  const dateError = fIsAfter(currentFilters.startDate, currentFilters.endDate);

  const {
    calendarRef,
    /********/
    view,
    title,
    /********/
    onDropEvent,
    onChangeView,
    onSelectRange,
    onClickEvent,
    onResizeEvent,
    onDateNavigation,
    /********/
    openForm,
    onOpenForm,
    onCloseForm,
    /********/
    selectedRange,
    selectedEventId,
    /********/
    onClickEventInFilters,
  } = useCalendar();

  const fallbackActor = useMemo(() => buildActorFromUser(user), [user]);
  const [actorMiembro, setActorMiembro] = useState(fallbackActor);

  useEffect(() => {
    let mounted = true;

    setActorMiembro(fallbackActor);

    getMembers()
      .then((members) => {
        if (!mounted) return;

        const member = findMemberForUser(members, user, fallbackActor);
        setActorMiembro(member ? buildActorFromMember(member, fallbackActor) : fallbackActor);
      })
      .catch(() => {
        if (mounted) {
          setActorMiembro(fallbackActor);
        }
      });

    return () => {
      mounted = false;
    };
  }, [fallbackActor, user]);

  const handleCreateEvent = useCallback(
    async (eventData) => {
      await createEvent({ ...eventData, creadoPor: actorMiembro, actualizadoPor: actorMiembro });
    },
    [actorMiembro]
  );

  const handleUpdateEvent = useCallback(
    async (eventData) => {
      await updateEvent({ ...eventData, actualizadoPor: actorMiembro });
    },
    [actorMiembro]
  );

  const handleDeleteEvent = useCallback(async (eventId) => {
    await deleteEvent(eventId);
  }, []);

  const currentEvent = useEvent(events, selectedEventId, selectedRange, openForm);

  const canReset =
    currentFilters.colors.length > 0 || (!!currentFilters.startDate && !!currentFilters.endDate);

  const dataFiltered = applyFilter({
    inputData: events,
    filters: currentFilters,
    dateError,
  });

  const flexStyles = {
    flex: '1 1 auto',
    display: 'flex',
    flexDirection: 'column',
  };

  const renderCreateFormDialog = () => (
    <Dialog
      fullWidth
      maxWidth="xs"
      open={openForm}
      onClose={onCloseForm}
      transitionDuration={{
        enter: theme.transitions.duration.shortest,
        exit: theme.transitions.duration.shortest - 80,
      }}
      slotProps={{
        paper: {
          sx: {
            display: 'flex',
            overflow: 'hidden',
            flexDirection: 'column',
            '& form': { ...flexStyles, minHeight: 0 },
          },
        },
      }}
    >
      <DialogTitle sx={{ minHeight: 76 }}>
        {openForm && <>{currentEvent?.id ? 'Editar evento' : 'Agregar evento'}</>}
      </DialogTitle>

      <CalendarForm
        currentEvent={currentEvent}
        colorOptions={CALENDAR_COLOR_OPTIONS}
        onClose={onCloseForm}
        onCreateEvent={handleCreateEvent}
        onUpdateEvent={handleUpdateEvent}
        onDeleteEvent={handleDeleteEvent}
      />
    </Dialog>
  );

  const renderFiltersDrawer = () => (
    <CalendarFilters
      events={events}
      filters={filters}
      canReset={canReset}
      dateError={dateError}
      open={openFilters.value}
      onClose={openFilters.onFalse}
      onClickEvent={onClickEventInFilters}
      colorOptions={CALENDAR_COLOR_OPTIONS}
    />
  );

  const renderResults = () => (
    <CalendarFiltersResult
      filters={filters}
      totalResults={dataFiltered.length}
      sx={{ mb: { xs: 3, md: 5 } }}
    />
  );

  return (
    <>
      <DashboardContent maxWidth="xl" sx={{ ...flexStyles }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: { xs: 3, md: 5 },
          }}
        >
          <Typography variant="h4">Calendario</Typography>
          <Button
            variant="contained"
            startIcon={<Iconify icon="mingcute:add-line" />}
            onClick={onOpenForm}
          >
            Agregar evento
          </Button>
        </Box>

        {canReset && renderResults()}

        <Card sx={{ ...flexStyles, minHeight: '50vh' }}>
          <CalendarRoot sx={{ ...flexStyles }}>
            <CalendarToolbar
              view={view}
              title={title}
              canReset={canReset}
              loading={eventsLoading}
              onChangeView={onChangeView}
              onDateNavigation={onDateNavigation}
              onOpenFilters={openFilters.onTrue}
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
              initialView={view}
              events={dataFiltered}
              select={onSelectRange}
              eventClick={onClickEvent}
              businessHours={{
                daysOfWeek: [1, 2, 3, 4, 5], // Lunes a viernes
              }}
              eventDrop={(arg) => {
                startTransition(() => {
                  onDropEvent(arg, handleUpdateEvent);
                });
              }}
              eventResize={(arg) => {
                startTransition(() => {
                  onResizeEvent(arg, handleUpdateEvent);
                });
              }}
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
            />
          </CalendarRoot>
        </Card>
      </DashboardContent>

      {renderCreateFormDialog()}
      {renderFiltersDrawer()}
    </>
  );
}

// ----------------------------------------------------------------------

function applyFilter({ inputData, filters, dateError }) {
  const { colors, startDate, endDate } = filters;

  const stabilizedThis = inputData.map((el, index) => [el, index]);

  inputData = stabilizedThis.map((el) => el[0]);

  if (colors.length) {
    inputData = inputData.filter((event) => colors.includes(event.color));
  }

  if (!dateError) {
    if (startDate && endDate) {
      inputData = inputData.filter((event) => fIsBetween(event.start, startDate, endDate));
    }
  }

  return inputData;
}
