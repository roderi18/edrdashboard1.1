'use client';

import { useRef, useState, useEffect } from 'react';
import { pdf, Text, View, Document, StyleSheet, Page as PdfPage } from '@react-pdf/renderer';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';

import { useParams } from 'src/routes/hooks';

import { Iconify } from 'src/components/iconify';
import { OrganizationalChart } from 'src/components/organizational-chart';

import { DestEditLayout } from 'src/sections/dest/layout/dest-edit-layout';
import { SIMPLE_DATA } from 'src/sections/_examples/extra/organizational-chart-view/data';
import { StandardNode } from 'src/sections/_examples/extra/organizational-chart-view/standard-node';

const MIN_ZOOM = 0.7;
const MAX_ZOOM = 1.4;
const ZOOM_STEP = 0.1;
const CONTROL_BUTTON_SIZE = 36;
const CONTROL_BUTTON_GAP = 6;
const ZOOM_PERCENT_WIDTH = CONTROL_BUTTON_SIZE * 2 + CONTROL_BUTTON_GAP;

const pdfStyles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#1C252E',
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 18,
    marginBottom: 4,
    fontWeight: 700,
  },
  subtitle: {
    fontSize: 10,
    marginBottom: 18,
    color: '#637381',
  },
  chart: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#DFE3E8',
    borderRadius: 8,
    backgroundColor: '#F4F6F8',
  },
  nodeWrap: {
    alignItems: 'center',
  },
  node: {
    width: 118,
    minHeight: 58,
    padding: 8,
    borderWidth: 1,
    borderColor: '#DFE3E8',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  nodeName: {
    fontSize: 9,
    marginBottom: 4,
    fontWeight: 700,
  },
  nodeRole: {
    fontSize: 7,
    color: '#637381',
  },
  children: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  child: {
    marginHorizontal: 5,
    alignItems: 'center',
  },
});

function PdfNode({ node }) {
  const children = node.children || [];

  return (
    <View style={pdfStyles.nodeWrap}>
      <View style={pdfStyles.node}>
        <Text style={pdfStyles.nodeName}>{node.name}</Text>
        <Text style={pdfStyles.nodeRole}>{node.role}</Text>
      </View>

      {!!children.length && (
        <View style={pdfStyles.children}>
          {children.map((child) => (
            <View key={child.id || child.name} style={pdfStyles.child}>
              <PdfNode node={child} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function LeadershipPdfDocument({ destName, data }) {
  return (
    <Document>
      <PdfPage size="A4" orientation="landscape" style={pdfStyles.page}>
        <Text style={pdfStyles.title}>Organigrama de directiva</Text>
        <Text style={pdfStyles.subtitle}>Destacamento: {destName}</Text>

        <View style={pdfStyles.chart}>
          <PdfNode node={data} />
        </View>
      </PdfPage>
    </Document>
  );
}

const slugify = (value) =>
  String(value || 'destacamento')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

export default function Page() {
  const params = useParams();
  const destId = params?.id;
  const dragRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const skipNextDragRef = useRef(false);
  const [destName, setDestName] = useState('Destacamento');
  const [isDragging, setIsDragging] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const zoomPercentage = Math.round(zoom * 100);

  useEffect(() => {
    const handleClickAwayPopover = (event) => {
      const popoverPaper = document.querySelector('.MuiPopover-paper');

      if (!popoverPaper || popoverPaper.contains(event.target)) {
        return;
      }

      skipNextDragRef.current = true;
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          code: 'Escape',
          bubbles: true,
        })
      );
    };

    document.addEventListener('pointerdown', handleClickAwayPopover, true);

    return () => {
      document.removeEventListener('pointerdown', handleClickAwayPopover, true);
    };
  }, []);

  useEffect(() => {
    const loadDest = async () => {
      try {
        const res = await fetch('/api/dest');
        const data = await res.json();
        const found = (data?.data || []).find(
          (dest) =>
            String(dest.idDestacamento) === String(destId) || String(dest.id) === String(destId)
        );

        if (found?.nombre || found?.name) {
          setDestName(found.nombre || found.name);
        }
      } catch (error) {
        console.error('Error cargando destacamento:', error);
      }
    };

    if (destId) {
      loadDest();
    }
  }, [destId]);

  const handlePointerDown = (event) => {
    const interactiveElement = event.target.closest?.(
      '.MuiCard-root, button, a, input, textarea, select, [role="button"]'
    );

    if (skipNextDragRef.current) {
      skipNextDragRef.current = false;
      return;
    }

    if (event.button !== 0 || interactiveElement) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (event) => {
    if (!isDragging) {
      return;
    }

    const deltaX = event.clientX - dragRef.current.x;
    const deltaY = event.clientY - dragRef.current.y;

    setPan({
      x: dragRef.current.panX + deltaX,
      y: dragRef.current.panY + deltaY,
    });
  };

  const handlePointerUp = (event) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setIsDragging(false);
  };

  const handleZoomOut = () => {
    setZoom((currentZoom) => Math.max(MIN_ZOOM, Number((currentZoom - ZOOM_STEP).toFixed(2))));
  };

  const handleZoomIn = () => {
    setZoom((currentZoom) => Math.min(MAX_ZOOM, Number((currentZoom + ZOOM_STEP).toFixed(2))));
  };

  const handleResetView = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  };

  const handleDownloadPdf = async () => {
    setIsDownloading(true);

    try {
      const blob = await pdf(
        <LeadershipPdfDocument destName={destName} data={SIMPLE_DATA} />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = `organigrama-${slugify(destName)}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <DestEditLayout maxWidth={false}>
      <Box
        aria-label="Mover organigrama"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        sx={{
          width: 1,
          mx: 'auto',
          display: 'flex',
          overflow: 'hidden',
          position: 'relative',
          minHeight: 680,
          justifyContent: 'center',
          bgcolor: 'background.neutral',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
          py: { xs: 3, md: 4 },
          px: { xs: 1.5, md: 2 },
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          touchAction: 'none',
          '& button, & a, & input, & textarea, & select, & [role="button"]': {
            cursor: 'pointer',
            touchAction: 'auto',
          },
          '& .MuiCard-root': {
            cursor: 'default',
            touchAction: 'auto',
          },
          '& .MuiCard-root button': {
            cursor: 'pointer',
          },
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{
            position: 'absolute',
            top: 18,
            left: 24,
            zIndex: 1,
            px: 1,
            py: 0.5,
            borderRadius: 1,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: 1,
          }}
        >
          {destName}
        </Typography>

        <Stack
          spacing={0.75}
          onPointerDown={(event) => event.stopPropagation()}
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 2,
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gap: `${CONTROL_BUTTON_GAP}px`,
              gridTemplateColumns: `repeat(3, ${CONTROL_BUTTON_SIZE}px)`,
            }}
          >
            <Tooltip title="Centrar vista">
              <IconButton
                size="small"
                aria-label="Centrar vista"
                onClick={handleResetView}
                sx={{
                  width: CONTROL_BUTTON_SIZE,
                  height: CONTROL_BUTTON_SIZE,
                  minWidth: CONTROL_BUTTON_SIZE,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  boxShadow: 1,
                  '&:hover': { bgcolor: 'background.paper' },
                }}
              >
                <Iconify width={18} icon="solar:restart-bold" />
              </IconButton>
            </Tooltip>

            <Tooltip title="Descargar PDF">
              <Box component="span" sx={{ gridColumn: '1', gridRow: '2' }}>
                <IconButton
                  size="small"
                  aria-label="Descargar PDF"
                  disabled={isDownloading}
                  onClick={handleDownloadPdf}
                  sx={{
                    width: CONTROL_BUTTON_SIZE,
                    height: CONTROL_BUTTON_SIZE,
                    minWidth: CONTROL_BUTTON_SIZE,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    boxShadow: 1,
                    '&:hover': { bgcolor: 'background.paper' },
                  }}
                >
                  <Iconify width={18} icon="solar:download-bold" />
                </IconButton>
              </Box>
            </Tooltip>

            <Tooltip title="Reducir zoom">
              <Box component="span" sx={{ gridColumn: '2', gridRow: '1' }}>
                <IconButton
                  size="small"
                  aria-label="Reducir zoom"
                  disabled={zoom <= MIN_ZOOM}
                  onClick={handleZoomOut}
                  sx={{
                    width: CONTROL_BUTTON_SIZE,
                    height: CONTROL_BUTTON_SIZE,
                    minWidth: CONTROL_BUTTON_SIZE,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    boxShadow: 1,
                    fontSize: 20,
                    fontWeight: 700,
                    '&:hover': { bgcolor: 'background.paper' },
                  }}
                >
                  -
                </IconButton>
              </Box>
            </Tooltip>

            <Tooltip title="Aumentar zoom">
              <Box component="span" sx={{ gridColumn: '3', gridRow: '1' }}>
                <IconButton
                  size="small"
                  aria-label="Aumentar zoom"
                  disabled={zoom >= MAX_ZOOM}
                  onClick={handleZoomIn}
                  sx={{
                    width: CONTROL_BUTTON_SIZE,
                    height: CONTROL_BUTTON_SIZE,
                    minWidth: CONTROL_BUTTON_SIZE,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    boxShadow: 1,
                    fontSize: 20,
                    fontWeight: 700,
                    '&:hover': { bgcolor: 'background.paper' },
                  }}
                >
                  +
                </IconButton>
              </Box>
            </Tooltip>

            <Typography
              variant="caption"
              sx={{
                width: ZOOM_PERCENT_WIDTH,
                height: CONTROL_BUTTON_SIZE,
                minWidth: ZOOM_PERCENT_WIDTH,
                display: 'flex',
                gridColumn: '2 / 4',
                gridRow: '2',
                alignItems: 'center',
                justifyContent: 'center',
                alignSelf: 'center',
                borderRadius: 1,
                boxShadow: 1,
                lineHeight: 1.5,
                fontWeight: 700,
                color: 'text.secondary',
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              {zoomPercentage}%
            </Typography>
          </Box>
        </Stack>

        <Box
          sx={{
            '--chart-pan-x': `${pan.x}px`,
            '--chart-pan-y': `${pan.y}px`,
            '--chart-zoom': zoom,
            width: 1080,
            flexShrink: 0,
            '--chart-base-scale': {
              xs: 0.42,
              sm: 0.5,
              md: 0.58,
              lg: 0.68,
              xl: 0.78,
            },
            transform: {
              xs: 'translate(var(--chart-pan-x), var(--chart-pan-y)) scale(calc(var(--chart-base-scale) * var(--chart-zoom)))',
              sm: 'translate(var(--chart-pan-x), var(--chart-pan-y)) scale(calc(var(--chart-base-scale) * var(--chart-zoom)))',
              md: 'translate(var(--chart-pan-x), var(--chart-pan-y)) scale(calc(var(--chart-base-scale) * var(--chart-zoom)))',
              lg: 'translate(var(--chart-pan-x), var(--chart-pan-y)) scale(calc(var(--chart-base-scale) * var(--chart-zoom)))',
              xl: 'translate(var(--chart-pan-x), var(--chart-pan-y)) scale(calc(var(--chart-base-scale) * var(--chart-zoom)))',
            },
            transformOrigin: 'top center',
          }}
        >
          <OrganizationalChart
            lineHeight="34px"
            data={SIMPLE_DATA}
            nodeItem={(props) => <StandardNode sx={{}} {...props} />}
          />
        </Box>
      </Box>
    </DestEditLayout>
  );
}
