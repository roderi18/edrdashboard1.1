import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Paper from '@mui/material/Paper';
import Timeline from '@mui/lab/Timeline';
import Button from '@mui/material/Button';
import TimelineDot from '@mui/lab/TimelineDot';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineItem, { timelineItemClasses } from '@mui/lab/TimelineItem';

import { fDateTime } from 'src/utils/format-time';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

const INITIAL_TIMELINE_ITEMS = 7;
const ADMIN_EVENT_TITLES = new Set(['Orden aceptada', 'Orden rechazada', 'Archivo adjunto eliminado']);

const isAdminTimelineItem = (item = {}) =>
  item.role === 'admin' || ADMIN_EVENT_TITLES.has(item.title);

export function OrderDetailsHistory({ history }) {
  const [expanded, setExpanded] = useState(false);
  const timeline = history?.timeline || [];
  const visibleTimeline = expanded ? timeline : timeline.slice(0, INITIAL_TIMELINE_ITEMS);
  const hasHiddenItems = timeline.length > INITIAL_TIMELINE_ITEMS;
  const hiddenItemsCount = Math.max(timeline.length - INITIAL_TIMELINE_ITEMS, 0);
  const items = [
    { label: 'Pedido realizado', value: fDateTime(history?.orderTime) },
    { label: 'Hora de pago', value: fDateTime(history?.orderTime) },
    { label: 'Hora de entrega al transportista', value: fDateTime(history?.orderTime) },
    { label: 'Hora de finalización', value: fDateTime(history?.orderTime) },
  ];

  const renderSummary = () => (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5,
        gap: 2,
        minWidth: 260,
        flexShrink: 0,
        borderRadius: 2,
        display: 'flex',
        typography: 'body2',
        borderStyle: 'dashed',
        flexDirection: 'column',
      }}
    >
      {items.map((item) => (
        <Box key={item.label} sx={{ gap: 0.5, display: 'flex', flexDirection: 'column' }}>
          <Box component="span" sx={{ color: 'text.secondary' }}>
            {item.label}
          </Box>
          {item.value}
        </Box>
      ))}
    </Paper>
  );

  const renderTimeline = () => (
    <Timeline
      sx={{
        p: 0,
        [`& .${timelineItemClasses.root}:before`]: { p: 0, flex: 0 },
      }}
    >
      {visibleTimeline.map((item, index) => {
        const firstTime = index === 0;
        const lastTime = index === visibleTimeline.length - 1;

        return (
          <TimelineItem key={`${item.title}-${item.time || index}-${index}`}>
            <TimelineSeparator>
              <TimelineDot color={firstTime ? 'primary' : 'grey'} />
              {lastTime ? null : <TimelineConnector />}
            </TimelineSeparator>

            <TimelineContent>
              <Typography variant="subtitle2">
                {item.title}
                {isAdminTimelineItem(item) ? ' [Administrador]' : ''}
              </Typography>
              <Box component="span" sx={{ color: 'text.disabled', typography: 'caption', mt: 0.5 }}>
                {fDateTime(item.time)}
              </Box>
            </TimelineContent>
          </TimelineItem>
        );
      })}
    </Timeline>
  );

  return (
    <Card>
      <CardHeader title="Historial" />
      <Box
        sx={{
          p: 3,
          gap: 3,
          display: 'flex',
          alignItems: { md: 'flex-start' },
          flexDirection: { xs: 'column-reverse', md: 'row' },
        }}
      >
        <Box sx={{ flexGrow: 1 }}>
          {renderTimeline()}

          {hasHiddenItems && (
            <Button
              size="small"
              color="inherit"
              endIcon={
                <Iconify
                  icon={expanded ? 'eva:arrow-ios-upward-fill' : 'eva:arrow-ios-forward-fill'}
                  width={18}
                />
              }
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? 'Ver menos' : `Ver más (${hiddenItemsCount})`}
            </Button>
          )}
        </Box>
        {renderSummary()}
      </Box>
    </Card>
  );
}
